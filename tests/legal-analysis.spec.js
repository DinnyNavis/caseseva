import { test, expect } from "@playwright/test";

const POLL_TIMEOUT = parseInt(process.env.POLL_TIMEOUT_MS || "20000", 10);
const email = () => `legal-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`;

const REALISTIC_LAPTOP_STORY = "I purchased a laptop online for personal use on 1 August 2026 for Rs. 78,999. The laptop was delivered on 3 August 2026. However, starting 7 August 2026, the laptop began shutting down repeatedly. I brought it to an authorised service centre on 10 August 2026, which inspected it and recorded a motherboard fault on the job sheet. On 12 August 2026, I requested a replacement laptop from the online seller as per their replacement policy. On 14 August 2026, the seller refused the replacement and offered only repair, despite the documented manufacturing defect.";
const REALISTIC_LABOUR_STORY = "I worked as a Senior Software Engineer at TechCorp Solutions Private Limited in Bengaluru from January 2024 to June 2026. My earned salary of Rs 1,50,000 for May 2026 and June 2026 was not paid by the company despite repeated written requests and follow-ups. On 10 July 2026, the HR sent an email stating that payments were delayed due to financial restructuring. No deduction was ever authorized under my employment contract. I am seeking payment of unpaid wages along with interest.";

async function approvedCase(request, story = REALISTIC_LAPTOP_STORY, approve = true) {
  const signup = await request.post("http://127.0.0.1:8000/api/auth/signup", { data: {
    full_name: "Legal Client", email: email(), mobile_number: "9876543210",
    password: "Password123", preferred_language: "English", state: "Delhi", district_city: "Delhi",
  }});
  const token = (await signup.json()).session_token;
  const headers = { Authorization: `Bearer ${token}` };
  const created = await request.post("http://127.0.0.1:8000/api/cases", { headers });
  const caseId = (await created.json()).case.case_id;
  await request.patch(`http://127.0.0.1:8000/api/cases/${caseId}`, {
    headers, data: { stage: "NEW_CONSULTATION", stage_details: {}, client_story: story },
  });
  await request.post(`http://127.0.0.1:8000/api/cases/${caseId}/evidence`, {
    headers, multipart: { file: { name: "invoice.txt", mimeType: "text/plain", buffer: Buffer.from("invoice") } },
  });
  await request.post(`http://127.0.0.1:8000/api/cases/${caseId}/submit`, { headers });
  await request.post(`http://127.0.0.1:8000/api/cases/${caseId}/analyze`, { headers });
  await expect.poll(async () => (await (await request.get(`http://127.0.0.1:8000/api/cases/${caseId}/status`, { headers })).json()).status, { timeout: POLL_TIMEOUT }).toBe("AWAITING_PREVIEW_1");
  if (approve) await request.post(`http://127.0.0.1:8000/api/cases/${caseId}/preview1/approve`, { headers });
  return { caseId, headers, token };
}

async function runLegal(request, setup, targetStatus = "AWAITING_PREVIEW_2") {
  await request.post(`http://127.0.0.1:8000/api/cases/${setup.caseId}/legal-analysis`, { headers: setup.headers });
  await expect.poll(async () => (await (await request.get(`http://127.0.0.1:8000/api/cases/${setup.caseId}/status`, { headers: setup.headers })).json()).status, { timeout: POLL_TIMEOUT }).toBe(targetStatus);
}

test("legal analysis completes and reports stage progress", async ({ request }) => {
  const setup = await approvedCase(request);
  const start = await request.post(`http://127.0.0.1:8000/api/cases/${setup.caseId}/legal-analysis`, { headers: setup.headers });
  expect(start.ok()).toBeTruthy();
  const early = await (await request.get(`http://127.0.0.1:8000/api/cases/${setup.caseId}/status`, { headers: setup.headers })).json();
  expect(early.stage_statuses.DOMAIN_ROUTER).toMatch(/WAITING|RUNNING|COMPLETED/);
  await expect.poll(async () => (await (await request.get(`http://127.0.0.1:8000/api/cases/${setup.caseId}/status`, { headers: setup.headers })).json()).status, { timeout: POLL_TIMEOUT }).toBe("AWAITING_PREVIEW_2");
});

test("Preview 2 renders the complete legal picture", async ({ request }) => {
  const setup = await approvedCase(request);
  await runLegal(request, setup);
  const preview = await (await request.get(`http://127.0.0.1:8000/api/cases/${setup.caseId}/preview2`, { headers: setup.headers })).json();
  expect(preview.domain.domain).toBe("Consumer");
  expect(preview.issues.length).toBeGreaterThan(0);
  expect(preview.verified_provisions.length).toBeGreaterThan(0);
  expect(preview.verified_provisions[0].source_url).toContain("indiacode");
  expect(preview.forum.commission_level).toBe("District Commission");
  expect(preview.limitation.result).toBe("NO_APPARENT_ISSUE");
  expect(preview.evidence_matrix.length).toBeGreaterThan(0);
  expect(preview.arguments.opponent.objections).toHaveLength(3);
  expect(preview.arguments.rebuttal.rebuttals).toHaveLength(3);
  expect(preview.neutral_evaluation.strengths.length).toBeGreaterThan(0);
});

test("Preview 2 browser screen presents the legal analysis", async ({ page, request }) => {
  const setup = await approvedCase(request);
  await runLegal(request, setup);
  await page.addInitScript(({ token }) => localStorage.setItem("caseseva_session_token", token), { token: setup.token });
  await page.goto(`/cases/${setup.caseId}/preview2`);
  await expect(page.getByTestId("preview2-domain")).toContainText("Consumer");
  await expect(page.getByTestId("verified-provision").first()).toBeVisible();
  await expect(page.getByTestId("forum-result")).toContainText("District Commission");
});

test("citation verification excludes rejected provisions", async ({ request }) => {
  const setup = await approvedCase(request);
  await runLegal(request, setup);
  const preview = await (await request.get(`http://127.0.0.1:8000/api/cases/${setup.caseId}/preview2`, { headers: setup.headers })).json();
  expect(preview.rejected_provisions.some((item) => item.provision_id === "CPA-2-47")).toBeTruthy();
  expect(preview.verified_provisions.some((item) => item.provision_id === "CPA-2-47")).toBeFalsy();
  expect(preview.citation_verification.decisions.find((item) => item.provision_id === "CPA-2-47").decision).toBe("REJECTED");
});

test("document request can be resolved with a targeted rerun", async ({ request }) => {
  const setup = await approvedCase(request, "[NEEDS_DOCUMENT] laptop dispute");
  await runLegalUntil(request, setup, "NEEDS_DOCUMENT");
  let preview = await (await request.get(`http://127.0.0.1:8000/api/cases/${setup.caseId}/preview2`, { headers: setup.headers })).json();
  expect(preview.document_requests[0].request_id).toBe("DR001");
  const resolved = await request.post(`http://127.0.0.1:8000/api/cases/${setup.caseId}/evidence-request/DR001/resolve`, {
    headers: setup.headers, multipart: { file: { name: "seller-response.txt", mimeType: "text/plain", buffer: Buffer.from("replacement refused") } },
  });
  expect(resolved.ok()).toBeTruthy();
  await expect.poll(async () => (await (await request.get(`http://127.0.0.1:8000/api/cases/${setup.caseId}/status`, { headers: setup.headers })).json()).status, { timeout: 10000 }).toBe("AWAITING_PREVIEW_2");
  const status = await (await request.get(`http://127.0.0.1:8000/api/cases/${setup.caseId}/status`, { headers: setup.headers })).json();
  expect(status.stage_statuses.DOMAIN_ROUTER).toBe("COMPLETED");
  preview = await (await request.get(`http://127.0.0.1:8000/api/cases/${setup.caseId}/preview2`, { headers: setup.headers })).json();
  expect(preview.document_requests[0].resolved).toBeTruthy();
});

async function runLegalUntil(request, setup, expected) {
  await request.post(`http://127.0.0.1:8000/api/cases/${setup.caseId}/legal-analysis`, { headers: setup.headers });
  await expect.poll(async () => (await (await request.get(`http://127.0.0.1:8000/api/cases/${setup.caseId}/status`, { headers: setup.headers })).json()).status, { timeout: 10000 }).toBe(expected);
}

test("approval is blocked by a request and waiver is recorded", async ({ request }) => {
  const setup = await approvedCase(request, "[NEEDS_DOCUMENT] laptop dispute");
  await runLegalUntil(request, setup, "NEEDS_DOCUMENT");
  const blocked = await request.post(`http://127.0.0.1:8000/api/cases/${setup.caseId}/preview2/approve`, { headers: setup.headers, data: {} });
  expect(blocked.status()).toBe(409);
  const approved = await request.post(`http://127.0.0.1:8000/api/cases/${setup.caseId}/preview2/approve`, { headers: setup.headers, data: { proceed_without_documents: true } });
  expect((await approved.json()).case.preview2_waived_document_requests).toEqual(["DR001"]);
});

test("correcting a Preview 2 fact preserves the correction and reruns legal stages", async ({ request }) => {
  const setup = await approvedCase(request);
  await runLegal(request, setup);
  const response = await request.patch(`http://127.0.0.1:8000/api/cases/${setup.caseId}/preview2/facts/F001`, { headers: setup.headers, data: { text: "Corrected confirmed purchase fact" } });
  expect(response.ok()).toBeTruthy();
  await expect.poll(async () => (await (await request.get(`http://127.0.0.1:8000/api/cases/${setup.caseId}/status`, { headers: setup.headers })).json()).status, { timeout: 10000 }).toBe("AWAITING_PREVIEW_2");
  const preview = await (await request.get(`http://127.0.0.1:8000/api/cases/${setup.caseId}/preview1`, { headers: setup.headers })).json();
  expect(preview.facts.find((fact) => fact.fact_id === "F001").human_corrected).toBeTruthy();
});

test("Preview 2 approval moves the case forward", async ({ request }) => {
  const setup = await approvedCase(request);
  await runLegal(request, setup);
  const response = await request.post(`http://127.0.0.1:8000/api/cases/${setup.caseId}/preview2/approve`, { headers: setup.headers, data: {} });
  expect((await response.json()).case.status).toBe("PREVIEW_2_APPROVED");
});

test("legal analysis cannot start before Preview 1 approval", async ({ request }) => {
  const setup = await approvedCase(request, "Laptop dispute story", false);
  const response = await request.post(`http://127.0.0.1:8000/api/cases/${setup.caseId}/legal-analysis`, { headers: setup.headers });
  expect(response.status()).toBe(409);
});

test("malformed legal output fails its stage", async ({ request }) => {
  const setup = await approvedCase(request, "[LEGAL_MALFORMED] laptop dispute");
  await request.post(`http://127.0.0.1:8000/api/cases/${setup.caseId}/legal-analysis`, { headers: setup.headers });
  await expect.poll(async () => (await (await request.get(`http://127.0.0.1:8000/api/cases/${setup.caseId}/status`, { headers: setup.headers })).json()).status, { timeout: 10000 }).toBe("LEGAL_ANALYSIS_FAILED");
  const status = await (await request.get(`http://127.0.0.1:8000/api/cases/${setup.caseId}/status`, { headers: setup.headers })).json();
  expect(status.stage_statuses.LEGAL_ISSUE_IDENTIFICATION).toBe("FAILED");
});

test("cross-user Preview 2 and approval are rejected", async ({ request }) => {
  const owner = await approvedCase(request);
  await runLegal(request, owner);
  const otherSignup = await request.post("http://127.0.0.1:8000/api/auth/signup", { data: {
    full_name: "Other Client", email: email(), mobile_number: "9876543210", password: "Password123",
    preferred_language: "English", state: "Delhi", district_city: "Delhi",
  }});
  const otherHeaders = { Authorization: `Bearer ${(await otherSignup.json()).session_token}` };
  expect((await request.get(`http://127.0.0.1:8000/api/cases/${owner.caseId}/preview2`, { headers: otherHeaders })).status()).toBe(403);
  expect((await request.post(`http://127.0.0.1:8000/api/cases/${owner.caseId}/preview2/approve`, { headers: otherHeaders, data: {} })).status()).toBe(403);
});

test("code-level corpus filter drops hallucinated provision IDs", async ({ request }) => {
  const setup = await approvedCase(request, "[HALLUCINATED_STATUTE] laptop dispute story");
  await runLegal(request, setup);
  const preview = await (await request.get(`http://127.0.0.1:8000/api/cases/${setup.caseId}/preview2`, { headers: setup.headers })).json();
  const selectedIds = (preview.verified_provisions || []).map((item) => item.provision_id);
  expect(selectedIds).toContain("CPA-2-7");
  expect(selectedIds).not.toContain("CPA-2019-SEC-12");
  expect(selectedIds).not.toContain("SOGA-14");
});

test("sabotage check: disabling corpus filter causes hallucinated provisions to leak", async ({ request }) => {
  const setup = await approvedCase(request, "[HALLUCINATED_STATUTE] [DISABLE_CORPUS_FILTER] laptop dispute story");
  await runLegal(request, setup);
  const preview = await (await request.get(`http://127.0.0.1:8000/api/cases/${setup.caseId}/preview2`, { headers: setup.headers })).json();
  const selectedIds = (preview.verified_provisions || []).map((item) => item.provision_id);
  expect(selectedIds).toContain("CPA-2019-SEC-12");
  expect(selectedIds).toContain("SOGA-14");
});

test("cross-domain corpus isolation: Labour case never receives Consumer provisions and vice versa", async ({ request }) => {
  const labourSetup = await approvedCase(request, REALISTIC_LABOUR_STORY);
  await runLegal(request, labourSetup);
  const labourPreview = await (await request.get(`http://127.0.0.1:8000/api/cases/${labourSetup.caseId}/preview2`, { headers: labourSetup.headers })).json();
  const labourProvisions = (labourPreview.verified_provisions || []).map(p => p.provision_id);
  expect(labourProvisions.every(id => id.startsWith("WAGES"))).toBe(true);
  expect(labourProvisions).not.toContain("CPA-2-7");

  const consumerSetup = await approvedCase(request, REALISTIC_LAPTOP_STORY);
  await runLegal(request, consumerSetup);
  const consumerPreview = await (await request.get(`http://127.0.0.1:8000/api/cases/${consumerSetup.caseId}/preview2`, { headers: consumerSetup.headers })).json();
  const consumerProvisions = (consumerPreview.verified_provisions || []).map(p => p.provision_id);
  expect(consumerProvisions.every(id => id.startsWith("CPA") || id.startsWith("RULE"))).toBe(true);
  expect(consumerProvisions).not.toContain("WAGES-45");
});

test("unsupported domain extracts facts and timeline, returns no-corpus result, and blocks document generation", async ({ request }) => {
  const setup = await approvedCase(request, "[NON_CONSUMER] I inherited an ancestral property plot in Pune in 2015, but my neighbor illegally encroached upon 500 sq ft and built a boundary wall without my permission in May 2026.");
  await runLegal(request, setup, "OUT_OF_SCOPE");
  const preview = await (await request.get(`http://127.0.0.1:8000/api/cases/${setup.caseId}/preview2`, { headers: setup.headers })).json();
  expect(preview.verified_provisions.length).toBe(0);
  expect(preview.forum.forum_family).toBe("UNSUPPORTED_DOMAIN");
  expect(preview.limitation.result).toBe("UNKNOWN");
  
  await request.post(`http://127.0.0.1:8000/api/cases/${setup.caseId}/preview2/approve`, { headers: setup.headers, data: {} });
  const docResp = await request.post(`http://127.0.0.1:8000/api/cases/${setup.caseId}/documents/generate`, { headers: setup.headers });
  expect([409, 422, 500]).toContain(docResp.status());
});

test("sabotage check for Labour corpus: disabling corpus filter causes hallucinated Labour provisions to leak", async ({ request }) => {
  const setup = await approvedCase(request, "[HALLUCINATED_STATUTE] [DISABLE_CORPUS_FILTER] " + REALISTIC_LABOUR_STORY);
  await runLegal(request, setup);
  const preview = await (await request.get(`http://127.0.0.1:8000/api/cases/${setup.caseId}/preview2`, { headers: setup.headers })).json();
  const selectedIds = (preview.verified_provisions || []).map((item) => item.provision_id);
  expect(selectedIds).toContain("CPA-2019-SEC-12");
  expect(selectedIds).toContain("SOGA-14");
});

test("unpaid salary story routes to Labour, retrieves Code on Wages provisions, and reaches document generation", async ({ request }) => {
  const setup = await approvedCase(request, REALISTIC_LABOUR_STORY);
  await runLegal(request, setup);
  const preview = await (await request.get(`http://127.0.0.1:8000/api/cases/${setup.caseId}/preview2`, { headers: setup.headers })).json();
  
  expect(preview.domain.domain).toMatch(/Labor|Labour|Wages/i);
  const provisions = (preview.verified_provisions || []).map(p => p.provision_id);
  expect(provisions.length).toBeGreaterThan(0);
  expect(provisions.some(id => id.startsWith("WAGES"))).toBe(true);

  const appRes = await request.post(`http://127.0.0.1:8000/api/cases/${setup.caseId}/preview2/approve`, { headers: setup.headers, data: {} });
  expect(appRes.ok()).toBeTruthy();

  const advSignup = await request.post("http://127.0.0.1:8000/api/auth/signup", { data: {
    full_name: "Labour Advocate", email: email(), mobile_number: "9876543210", password: "Password123",
    preferred_language: "English", state: "Karnataka", district_city: "Bengaluru", role: "advocate",
    bar_council: "Karnataka Bar Council", enrolment_number: "KAR/LAB/2020", enrolment_year: 2020,
    place_of_practice: "Bengaluru", court_region: "Karnataka High Court", practice_domains: ["Labour"], languages: ["English"]
  }});
  const advJson = await advSignup.json();
  const advHeaders = { Authorization: `Bearer ${advJson.session_token}` };
  await request.post(`http://127.0.0.1:8000/api/admin/advocates/${advJson.user.id}/verification`, { headers: { ...advHeaders, "X-Admin-Token": "caseseva-admin" }, data: { status: "VERIFIED" } });
  await request.post(`http://127.0.0.1:8000/api/cases/${setup.caseId}/request-advocate`, { headers: setup.headers, data: { advocate_id: advJson.user.id } });
  await request.post(`http://127.0.0.1:8000/api/advocate/requests/${setup.caseId}/accept`, { headers: advHeaders });

  const current = (await (await request.get(`http://127.0.0.1:8000/api/advocate/cases/${setup.caseId}`, { headers: advHeaders })).json()).case;
  for (const fact of current.facts.filter((x) => !x.removed)) await request.post(`http://127.0.0.1:8000/api/advocate/cases/${setup.caseId}/facts/${fact.fact_id}/approve`, { headers: advHeaders });
  for (const provision of current.verified_legal_sections.filter((x) => !x.removed)) await request.post(`http://127.0.0.1:8000/api/advocate/cases/${setup.caseId}/provisions/${provision.provision_id}/approve`, { headers: advHeaders });
  for (const evidence of current.evidence) await request.post(`http://127.0.0.1:8000/api/advocate/cases/${setup.caseId}/evidence/${evidence.evidence_id}/approve`, { headers: advHeaders });
  await request.post(`http://127.0.0.1:8000/api/advocate/cases/${setup.caseId}/forum/approve`, { headers: advHeaders });
  await request.post(`http://127.0.0.1:8000/api/advocate/cases/${setup.caseId}/limitation/approve`, { headers: advHeaders });
  for (const objection of current.arguments.opponent.objections) await request.post(`http://127.0.0.1:8000/api/advocate/cases/${setup.caseId}/arguments/${objection.objection_id}/approve`, { headers: advHeaders });
  await request.post(`http://127.0.0.1:8000/api/cases/${setup.caseId}/advocate/finalize`, { headers: advHeaders });

  const docGen = await request.post(`http://127.0.0.1:8000/api/cases/${setup.caseId}/documents/generate`, { headers: setup.headers });
  expect(docGen.ok()).toBeTruthy();
  const docsJson = await docGen.json();
  expect(docsJson.documents).toHaveLength(2);
});
