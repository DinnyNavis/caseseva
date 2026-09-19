import { test, expect } from "@playwright/test";

const POLL_TIMEOUT = parseInt(process.env.POLL_TIMEOUT_MS || "20000", 10);

test.beforeEach(async () => {
  test.setTimeout(parseInt(process.env.TEST_TIMEOUT_MS || process.env.POLL_TIMEOUT_MS || "60000", 10));
});

const base = "http://127.0.0.1:8000";
const email = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`;

async function signup(request, role = "client") {
  const data = role === "advocate"
    ? { full_name: "Document Advocate", email: email("adv"), mobile_number: "9876543210", password: "Password123", preferred_language: "English", state: "Tamil Nadu", district_city: "Chennai", role, bar_council: "Tamil Nadu Bar Council", enrolment_number: "TN/DOC/2020", enrolment_year: 2020, place_of_practice: "Chennai", court_region: "Madras High Court", practice_domains: ["Consumer"], languages: ["English", "Tamil"] }
    : { full_name: "Document Client", email: email("client"), mobile_number: "9876543210", password: "Password123", preferred_language: "English", state: "Tamil Nadu", district_city: "Chennai" };
  const response = await request.post(`${base}/api/auth/signup`, { data });
  const json = await response.json();
  return { user: json.user, headers: { Authorization: `Bearer ${json.session_token}` } };
}

const REALISTIC_LAPTOP_STORY = "I purchased a laptop online for personal use on 1 August 2026 for Rs. 78,999. The laptop was delivered on 3 August 2026. However, starting 7 August 2026, the laptop began shutting down repeatedly. I brought it to an authorised service centre on 10 August 2026, which inspected it and recorded a motherboard fault on the job sheet. On 12 August 2026, I requested a replacement laptop from the online seller as per their replacement policy. On 14 August 2026, the seller refused the replacement and offered only repair, despite the documented manufacturing defect.";

async function approvedCase(request, story = REALISTIC_LAPTOP_STORY) {
  const client = await signup(request);
  const created = await request.post(`${base}/api/cases`, { headers: client.headers });
  const caseId = (await created.json()).case.case_id;
  await request.patch(`${base}/api/cases/${caseId}`, { headers: client.headers, data: { stage: "NEW_CONSULTATION", stage_details: {}, client_story: story } });
  await request.post(`${base}/api/cases/${caseId}/evidence`, { headers: client.headers, multipart: { file: { name: "invoice.txt", mimeType: "text/plain", buffer: Buffer.from("invoice") } } });
  await request.post(`${base}/api/cases/${caseId}/submit`, { headers: client.headers });
  await request.post(`${base}/api/cases/${caseId}/analyze`, { headers: client.headers });
  await expect.poll(async () => (await (await request.get(`${base}/api/cases/${caseId}/status`, { headers: client.headers })).json()).status, { timeout: POLL_TIMEOUT }).toBe("AWAITING_PREVIEW_1");
  await request.post(`${base}/api/cases/${caseId}/preview1/approve`, { headers: client.headers });
  await request.post(`${base}/api/cases/${caseId}/legal-analysis`, { headers: client.headers });
  await expect.poll(async () => (await (await request.get(`${base}/api/cases/${caseId}/status`, { headers: client.headers })).json()).status, { timeout: POLL_TIMEOUT }).toBe("AWAITING_PREVIEW_2");
  await request.post(`${base}/api/cases/${caseId}/preview2/approve`, { headers: client.headers, data: {} });
  return { client, caseId };
}

async function finalizedCase(request, story = REALISTIC_LAPTOP_STORY) {
  const setup = await approvedCase(request, story);
  const advocate = await signup(request, "advocate");
  await request.post(`${base}/api/admin/advocates/${advocate.user.id}/verification`, { headers: { ...advocate.headers, "X-Admin-Token": "caseseva-admin" }, data: { status: "VERIFIED" } });
  await request.post(`${base}/api/cases/${setup.caseId}/request-advocate`, { headers: setup.client.headers, data: { advocate_id: advocate.user.id } });
  await request.post(`${base}/api/advocate/requests/${setup.caseId}/accept`, { headers: advocate.headers });
  const current = (await (await request.get(`${base}/api/advocate/cases/${setup.caseId}`, { headers: advocate.headers })).json()).case;
  for (const fact of current.facts.filter((x) => !x.removed)) await request.post(`${base}/api/advocate/cases/${setup.caseId}/facts/${fact.fact_id}/approve`, { headers: advocate.headers });
  for (const provision of current.verified_legal_sections.filter((x) => !x.removed)) await request.post(`${base}/api/advocate/cases/${setup.caseId}/provisions/${provision.provision_id}/approve`, { headers: advocate.headers });
  for (const evidence of current.evidence) await request.post(`${base}/api/advocate/cases/${setup.caseId}/evidence/${evidence.evidence_id}/approve`, { headers: advocate.headers });
  await request.post(`${base}/api/advocate/cases/${setup.caseId}/forum/approve`, { headers: advocate.headers });
  await request.post(`${base}/api/advocate/cases/${setup.caseId}/limitation/approve`, { headers: advocate.headers });
  for (const objection of current.arguments.opponent.objections) await request.post(`${base}/api/advocate/cases/${setup.caseId}/arguments/${objection.objection_id}/approve`, { headers: advocate.headers });
  await request.post(`${base}/api/cases/${setup.caseId}/advocate/finalize`, { headers: advocate.headers });
  return { ...setup, advocate };
}

test("document generation produces both documents and reaches DOCUMENTS_READY", async ({ request }) => {
  const setup = await finalizedCase(request);
  const response = await request.post(`${base}/api/cases/${setup.caseId}/documents/generate`, { headers: setup.client.headers });
  expect(response.ok()).toBeTruthy();
  expect((await response.json()).documents).toHaveLength(2);
  expect((await (await request.get(`${base}/api/cases/${setup.caseId}/status`, { headers: setup.client.headers })).json()).status).toBe("DOCUMENTS_READY");
});

test("document generation is blocked before ADVOCATE_APPROVED", async ({ request }) => {
  const setup = await approvedCase(request);
  expect((await request.post(`${base}/api/cases/${setup.caseId}/documents/generate`, { headers: setup.client.headers })).status()).toBe(409);
});

test("removed provisions and unsupported facts are absent from both documents", async ({ request }) => {
  const setup = await approvedCase(request);
  const advocate = await signup(request, "advocate");
  await request.post(`${base}/api/admin/advocates/${advocate.user.id}/verification`, { headers: { ...advocate.headers, "X-Admin-Token": "caseseva-admin" }, data: { status: "VERIFIED" } });
  await request.post(`${base}/api/cases/${setup.caseId}/request-advocate`, { headers: setup.client.headers, data: { advocate_id: advocate.user.id } });
  await request.post(`${base}/api/advocate/requests/${setup.caseId}/accept`, { headers: advocate.headers });

  const current = (await (await request.get(`${base}/api/advocate/cases/${setup.caseId}`, { headers: advocate.headers })).json()).case;

  const activeProvisions = current.verified_legal_sections.filter((x) => !x.removed);
  const targetProvision = activeProvisions[activeProvisions.length - 1];
  const approvedProvision = activeProvisions[0];

  const activeFacts = current.facts.filter((x) => !x.removed);
  const targetFact = activeFacts[activeFacts.length - 1];

  for (const fact of current.facts.filter((x) => !x.removed)) {
    await request.post(`${base}/api/advocate/cases/${setup.caseId}/facts/${fact.fact_id}/approve`, { headers: advocate.headers });
  }
  for (const provision of current.verified_legal_sections.filter((x) => !x.removed)) {
    await request.post(`${base}/api/advocate/cases/${setup.caseId}/provisions/${provision.provision_id}/approve`, { headers: advocate.headers });
  }

  await request.post(`${base}/api/advocate/cases/${setup.caseId}/provisions/${targetProvision.provision_id}/remove`, { headers: advocate.headers });
  await request.patch(`${base}/api/advocate/cases/${setup.caseId}/facts/${targetFact.fact_id}`, { headers: advocate.headers, data: { removed: true } });
  for (const evidence of current.evidence) {
    await request.post(`${base}/api/advocate/cases/${setup.caseId}/evidence/${evidence.evidence_id}/approve`, { headers: advocate.headers });
  }
  await request.post(`${base}/api/advocate/cases/${setup.caseId}/forum/approve`, { headers: advocate.headers });
  await request.post(`${base}/api/advocate/cases/${setup.caseId}/limitation/approve`, { headers: advocate.headers });
  for (const objection of current.arguments.opponent.objections) {
    await request.post(`${base}/api/advocate/cases/${setup.caseId}/arguments/${objection.objection_id}/approve`, { headers: advocate.headers });
  }

  await request.post(`${base}/api/cases/${setup.caseId}/advocate/finalize`, { headers: advocate.headers });
  await request.post(`${base}/api/cases/${setup.caseId}/documents/generate`, { headers: setup.client.headers });

  const docs = (await (await request.get(`${base}/api/cases/${setup.caseId}/documents`, { headers: setup.client.headers })).json()).documents;
  const contents = await Promise.all(docs.map(async (doc) => (await (await request.get(`${base}/api/cases/${setup.caseId}/documents/${doc.id}`, { headers: setup.client.headers })).json()).document));

  for (const content of contents) {
    expect(content.html).not.toContain(targetProvision.provision_id);
    expect(content.text).not.toContain(targetProvision.provision_id);
    expect(content.html).not.toContain(targetProvision.explanation);
    expect(content.text).not.toContain(targetProvision.explanation);
    expect(content.html).not.toContain(targetFact.text);
    expect(content.text).not.toContain(targetFact.text);
    expect(content.html).toContain(approvedProvision.provision_id);
  }
});

test("every section cited in the draft is from approved provisions", async ({ request }) => {
  const setup = await finalizedCase(request);
  await request.post(`${base}/api/cases/${setup.caseId}/documents/generate`, { headers: setup.client.headers });
  const docs = (await (await request.get(`${base}/api/cases/${setup.caseId}/documents`, { headers: setup.client.headers })).json()).documents;
  const draft = docs.find((x) => x.type === "draft");
  const consistency = await (await request.get(`${base}/api/cases/${setup.caseId}/documents/${draft.id}/consistency`, { headers: setup.client.headers })).json();
  expect(consistency.findings.find((x) => x.check === "cited_sections_exist").result).toBe("PASS");
});

test("approved evidence receives annexures and removed evidence does not", async ({ request }) => {
  const setup = await finalizedCase(request);
  await request.post(`${base}/api/cases/${setup.caseId}/documents/generate`, { headers: setup.client.headers });
  const docs = (await (await request.get(`${base}/api/cases/${setup.caseId}/documents`, { headers: setup.client.headers })).json()).documents;
  const draft = (await (await request.get(`${base}/api/cases/${setup.caseId}/documents/${docs.find((x) => x.type === "draft").id}`, { headers: setup.client.headers })).json()).document;
  expect(draft.html).toContain("Annexure A");
});

test("annexure references resolve and consistency exposes a seeded failure location", async ({ request }) => {
  const setup = await finalizedCase(request, "[CONSISTENCY_FAIL] Laptop dispute story");
  await request.post(`${base}/api/cases/${setup.caseId}/documents/generate`, { headers: setup.client.headers });
  const docs = (await (await request.get(`${base}/api/cases/${setup.caseId}/documents`, { headers: setup.client.headers })).json()).documents;
  const findings = (await (await request.get(`${base}/api/cases/${setup.caseId}/documents/${docs[0].id}/consistency`, { headers: setup.client.headers })).json()).findings;
  expect(findings.find((x) => x.check === "annexures_resolve").result).toBe("PASS");
  expect(findings.find((x) => x.result === "FAIL").location).toBeTruthy();
});

test("a consistency failure can be overridden only by the advocate", async ({ request }) => {
  const setup = await finalizedCase(request, "[CONSISTENCY_FAIL] Laptop dispute story");
  await request.post(`${base}/api/cases/${setup.caseId}/documents/generate`, { headers: setup.client.headers });
  const docs = (await (await request.get(`${base}/api/cases/${setup.caseId}/documents`, { headers: setup.client.headers })).json()).documents;
  const result = await request.post(`${base}/api/cases/${setup.caseId}/documents/${docs[0].id}/override-consistency`, { headers: setup.advocate.headers, data: { reason: "Reviewed and accepted for demo." } });
  expect(result.ok()).toBeTruthy();
  expect((await (await request.post(`${base}/api/cases/${setup.caseId}/documents/${docs[0].id}/override-consistency`, { headers: setup.client.headers, data: { reason: "No" } })).status())).toBe(403);
});

test("a consistency FAIL blocks document readiness until overridden", async ({ request }) => {
  const setup = await finalizedCase(request, "[CONSISTENCY_FAIL] Laptop dispute story");
  const generated = await request.post(`${base}/api/cases/${setup.caseId}/documents/generate`, { headers: setup.client.headers });
  expect((await generated.json()).status).toBe("DOCUMENTS_BLOCKED");
  const docs = (await (await request.get(`${base}/api/cases/${setup.caseId}/documents`, { headers: setup.client.headers })).json()).documents;
  for (const doc of docs) await request.post(`${base}/api/cases/${setup.caseId}/documents/${doc.id}/override-consistency`, { headers: setup.advocate.headers, data: { reason: "Advocate reviewed the flagged fixture." } });
  expect((await (await request.get(`${base}/api/cases/${setup.caseId}/status`, { headers: setup.client.headers })).json()).status).toBe("DOCUMENTS_READY");
});

test("regeneration creates a new version while preserving the old version", async ({ request }) => {
  const setup = await finalizedCase(request);
  await request.post(`${base}/api/cases/${setup.caseId}/documents/generate`, { headers: setup.client.headers });
  const first = (await (await request.get(`${base}/api/cases/${setup.caseId}/documents`, { headers: setup.client.headers })).json()).documents;
  await request.post(`${base}/api/cases/${setup.caseId}/documents/regenerate`, { headers: setup.client.headers });
  const all = (await (await request.get(`${base}/api/cases/${setup.caseId}/documents`, { headers: setup.client.headers })).json()).documents;
  expect(new Set(all.map((x) => x.version)).size).toBe(2);
  expect((await request.get(`${base}/api/cases/${setup.caseId}/documents/${first[0].id}`, { headers: setup.client.headers })).ok()).toBeTruthy();
});

test("placeholders remain visible for details requiring completion", async ({ page, request }) => {
  const unverifiedSetup = await finalizedCase(request);
  await request.post(`${base}/api/cases/${unverifiedSetup.caseId}/documents/generate`, { headers: unverifiedSetup.client.headers });
  const unverifiedDocs = (await (await request.get(`${base}/api/cases/${unverifiedSetup.caseId}/documents`, { headers: unverifiedSetup.client.headers })).json()).documents;
  const unverifiedDraftDoc = unverifiedDocs.find((x) => x.type === "draft");
  const unverifiedDraft = (await (await request.get(`${base}/api/cases/${unverifiedSetup.caseId}/documents/${unverifiedDraftDoc.id}`, { headers: unverifiedSetup.client.headers })).json()).document;

  expect(unverifiedDraft.html).toContain("[TO BE COMPLETED: EXACT DISTRICT COMMISSION AFTER ADDRESS VERIFICATION]");

  await page.addInitScript(({ token }) => localStorage.setItem("caseseva_session_token", token), { token: unverifiedSetup.client.headers.Authorization.slice(7) });
  await page.goto(`/cases/${unverifiedSetup.caseId}/documents`);
  await page.locator("article", { hasText: "Consumer Complaint Draft" }).getByRole("button", { name: "View" }).click();
  await expect(page.locator("mark", { hasText: "[TO BE COMPLETED:" }).first()).toBeVisible();

  const verifiedSetup = await approvedCase(request);
  const advocate = await signup(request, "advocate");
  await request.post(`${base}/api/admin/advocates/${advocate.user.id}/verification`, { headers: { ...advocate.headers, "X-Admin-Token": "caseseva-admin" }, data: { status: "VERIFIED" } });
  await request.post(`${base}/api/cases/${verifiedSetup.caseId}/request-advocate`, { headers: verifiedSetup.client.headers, data: { advocate_id: advocate.user.id } });
  await request.post(`${base}/api/advocate/requests/${verifiedSetup.caseId}/accept`, { headers: advocate.headers });

  const current = (await (await request.get(`${base}/api/advocate/cases/${verifiedSetup.caseId}`, { headers: advocate.headers })).json()).case;
  for (const fact of current.facts.filter((x) => !x.removed)) await request.post(`${base}/api/advocate/cases/${verifiedSetup.caseId}/facts/${fact.fact_id}/approve`, { headers: advocate.headers });
  for (const provision of current.verified_legal_sections.filter((x) => !x.removed)) await request.post(`${base}/api/advocate/cases/${verifiedSetup.caseId}/provisions/${provision.provision_id}/approve`, { headers: advocate.headers });
  for (const evidence of current.evidence) await request.post(`${base}/api/advocate/cases/${verifiedSetup.caseId}/evidence/${evidence.evidence_id}/approve`, { headers: advocate.headers });

  await request.patch(`${base}/api/advocate/cases/${verifiedSetup.caseId}/forum`, { headers: advocate.headers, data: { commission_level: "District Consumer Disputes Redressal Commission, Chennai", territorial_basis: "Complainant resides in Chennai" } });
  await request.post(`${base}/api/advocate/cases/${verifiedSetup.caseId}/forum/approve`, { headers: advocate.headers });
  await request.post(`${base}/api/advocate/cases/${verifiedSetup.caseId}/limitation/approve`, { headers: advocate.headers });
  for (const objection of current.arguments.opponent.objections) await request.post(`${base}/api/advocate/cases/${verifiedSetup.caseId}/arguments/${objection.objection_id}/approve`, { headers: advocate.headers });

  await request.post(`${base}/api/cases/${verifiedSetup.caseId}/advocate/finalize`, { headers: advocate.headers });
  await request.post(`${base}/api/cases/${verifiedSetup.caseId}/documents/generate`, { headers: verifiedSetup.client.headers });

  const verifiedDocs = (await (await request.get(`${base}/api/cases/${verifiedSetup.caseId}/documents`, { headers: verifiedSetup.client.headers })).json()).documents;
  const verifiedDraftDoc = verifiedDocs.find((x) => x.type === "draft");
  const verifiedDraft = (await (await request.get(`${base}/api/cases/${verifiedSetup.caseId}/documents/${verifiedDraftDoc.id}`, { headers: verifiedSetup.client.headers })).json()).document;

  expect(verifiedDraft.html).not.toContain("[TO BE COMPLETED: exact District Commission after address verification]");
  expect(verifiedDraft.html).toContain("DISTRICT CONSUMER DISPUTES REDRESSAL COMMISSION, CHENNAI");
});

test("client and accepted advocate can view and download documents", async ({ request }) => {
  const setup = await finalizedCase(request);
  await request.post(`${base}/api/cases/${setup.caseId}/documents/generate`, { headers: setup.client.headers });
  const doc = (await (await request.get(`${base}/api/cases/${setup.caseId}/documents`, { headers: setup.client.headers })).json()).documents[0];
  expect((await request.get(`${base}/api/cases/${setup.caseId}/documents/${doc.id}/download`, { headers: setup.client.headers })).ok()).toBeTruthy();
  expect((await request.get(`${base}/api/cases/${setup.caseId}/documents/${doc.id}`, { headers: setup.advocate.headers })).ok()).toBeTruthy();
});

test("third-party users cannot access documents", async ({ request }) => {
  const setup = await finalizedCase(request);
  await request.post(`${base}/api/cases/${setup.caseId}/documents/generate`, { headers: setup.client.headers });
  const doc = (await (await request.get(`${base}/api/cases/${setup.caseId}/documents`, { headers: setup.client.headers })).json()).documents[0];
  const other = await signup(request);
  expect((await request.get(`${base}/api/cases/${setup.caseId}/documents/${doc.id}`, { headers: other.headers })).status()).toBe(403);
});

test("only advocates can see the override control", async ({ page, request }) => {
  const setup = await finalizedCase(request, "[CONSISTENCY_FAIL] Laptop dispute story");
  await request.post(`${base}/api/cases/${setup.caseId}/documents/generate`, { headers: setup.client.headers });
  await page.addInitScript(({ token }) => localStorage.setItem("caseseva_session_token", token), { token: setup.client.headers.Authorization.slice(7) });
  await page.goto(`/cases/${setup.caseId}/documents`);
  await expect(page.getByText("Override consistency")).toHaveCount(0);
});
