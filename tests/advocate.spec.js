import { test, expect } from "@playwright/test";

const POLL_TIMEOUT = parseInt(process.env.POLL_TIMEOUT_MS || "10000", 10);
const email = (prefix = "adv") => `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`;
const base = "http://127.0.0.1:8000";

async function signup(request, role = "client", extra = {}) {
  const data = role === "advocate" ? {
    full_name: "Test Advocate", email: email("advocate"), mobile_number: "9876543210", password: "Password123",
    preferred_language: "English", state: "Tamil Nadu", district_city: "Chennai", role,
    bar_council: "Tamil Nadu Bar Council", enrolment_number: "TN/TEST/2020", enrolment_year: 2020,
    place_of_practice: "Chennai", court_region: "Madras High Court", practice_domains: ["Consumer"], languages: ["English", "Tamil"], ...extra,
  } : {
    full_name: "Test Client", email: email(), mobile_number: "9876543210", password: "Password123",
    preferred_language: "English", state: "Tamil Nadu", district_city: "Chennai", ...extra,
  };
  const response = await request.post(`${base}/api/auth/signup`, { data });
  const json = await response.json();
  return { token: json.session_token, user: json.user, headers: { Authorization: `Bearer ${json.session_token}` } };
}

const REALISTIC_LAPTOP_STORY = "I purchased a laptop online for personal use on 1 August 2026 for Rs. 78,999. The laptop was delivered on 3 August 2026. However, starting 7 August 2026, the laptop began shutting down repeatedly. I brought it to an authorised service centre on 10 August 2026, which inspected it and recorded a motherboard fault on the job sheet. On 12 August 2026, I requested a replacement laptop from the online seller as per their replacement policy. On 14 August 2026, the seller refused the replacement and offered only repair, despite the documented manufacturing defect.";

async function approvedCase(request) {
  const client = await signup(request);
  const created = await request.post(`${base}/api/cases`, { headers: client.headers });
  const caseId = (await created.json()).case.case_id;
  await request.patch(`${base}/api/cases/${caseId}`, { headers: client.headers, data: { stage: "NEW_CONSULTATION", stage_details: {}, client_story: REALISTIC_LAPTOP_STORY } });
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

async function verifiedAdvocate(request, extra = {}) {
  const advocate = await signup(request, "advocate", extra);
  await request.post(`${base}/api/admin/advocates/${advocate.user.id}/verification`, {
    headers: { ...advocate.headers, "X-Admin-Token": "caseseva-admin" }, data: { status: "VERIFIED" },
  });
  return advocate;
}

async function requestCase(request, setup, advocateId) {
  await request.post(`${base}/api/cases/${setup.caseId}/request-advocate`, { headers: setup.client.headers, data: { advocate_id: advocateId } });
}

test("advocate signup creates PENDING account excluded from directory", async ({ request }) => {
  const advocate = await signup(request, "advocate");
  expect(advocate.user.verification_status).toBe("PENDING");
  const directory = await (await request.get(`${base}/api/advocates`, { headers: advocate.headers })).json();
  expect(directory.advocates.some((item) => item.id === advocate.user.id)).toBeFalsy();
});

test("PENDING advocate cannot accept a case", async ({ request }) => {
  const setup = await approvedCase(request);
  const pending = await signup(request, "advocate");
  const response = await request.post(`${base}/api/advocate/requests/${setup.caseId}/accept`, { headers: pending.headers });
  expect(response.status()).toBe(403);
});

test("verifying an advocate makes them appear in the directory", async ({ request }) => {
  const advocate = await signup(request, "advocate");
  await request.post(`${base}/api/admin/advocates/${advocate.user.id}/verification`, { headers: { ...advocate.headers, "X-Admin-Token": "caseseva-admin" }, data: { status: "VERIFIED" } });
  const directory = await (await request.get(`${base}/api/advocates`, { headers: advocate.headers })).json();
  expect(directory.advocates.some((item) => item.id === advocate.user.id)).toBeTruthy();
});

test("directory filters by domain, state, and language", async ({ request }) => {
  const advocate = await verifiedAdvocate(request, { state: "Tamil Nadu", languages: ["Tamil"], practice_domains: ["Consumer"] });
  const response = await request.get(`${base}/api/advocates?domain=Consumer&state=Tamil%20Nadu&language=Tamil`, { headers: advocate.headers });
  const list = (await response.json()).advocates;
  expect(list.some((item) => item.id === advocate.user.id)).toBeTruthy();
});

test("client request moves case to AWAITING_ADVOCATE", async ({ request }) => {
  const setup = await approvedCase(request);
  const advocate = await verifiedAdvocate(request);
  await requestCase(request, setup, advocate.user.id);
  expect((await (await request.get(`${base}/api/cases/${setup.caseId}`, { headers: setup.client.headers })).json()).case.status).toBe("AWAITING_ADVOCATE");
});

test("client can cancel a pending request", async ({ request }) => {
  const setup = await approvedCase(request);
  const advocate = await verifiedAdvocate(request);
  await requestCase(request, setup, advocate.user.id);
  await request.post(`${base}/api/cases/${setup.caseId}/cancel-advocate-request`, { headers: setup.client.headers });
  expect((await (await request.get(`${base}/api/cases/${setup.caseId}`, { headers: setup.client.headers })).json()).case.status).toBe("PREVIEW_2_APPROVED");
});

test("advocate inbox exposes summary information only", async ({ request }) => {
  const setup = await approvedCase(request);
  const advocate = await verifiedAdvocate(request);
  await requestCase(request, setup, advocate.user.id);
  const inbox = (await (await request.get(`${base}/api/advocate/requests`, { headers: advocate.headers })).json()).requests[0];
  expect(inbox.domain).toBe("Consumer");
  expect(inbox.evidence_count).toBeGreaterThan(0);
  expect(inbox.client_story).toBeUndefined();
});

test("declining returns case to client", async ({ request }) => {
  const setup = await approvedCase(request);
  const advocate = await verifiedAdvocate(request);
  await requestCase(request, setup, advocate.user.id);
  await request.post(`${base}/api/advocate/requests/${setup.caseId}/decline?reason=Unavailable`, { headers: advocate.headers });
  expect((await (await request.get(`${base}/api/cases/${setup.caseId}`, { headers: setup.client.headers })).json()).case.status).toBe("PREVIEW_2_APPROVED");
});

test("accepting moves case to ADVOCATE_REVIEW and grants full access", async ({ request }) => {
  const setup = await approvedCase(request);
  const advocate = await verifiedAdvocate(request);
  await requestCase(request, setup, advocate.user.id);
  await request.post(`${base}/api/advocate/requests/${setup.caseId}/accept`, { headers: advocate.headers });
  const result = await request.get(`${base}/api/advocate/cases/${setup.caseId}`, { headers: advocate.headers });
  expect((await result.json()).case.client_story).toBe(REALISTIC_LAPTOP_STORY);
});

test("advocate cannot read a case not requested from them", async ({ request }) => {
  const setup = await approvedCase(request);
  const advocate = await verifiedAdvocate(request);
  expect((await request.get(`${base}/api/advocate/cases/${setup.caseId}`, { headers: advocate.headers })).status()).toBe(403);
});

test("advocate cannot read a requested but unaccepted case", async ({ request }) => {
  const setup = await approvedCase(request);
  const advocate = await verifiedAdvocate(request);
  await requestCase(request, setup, advocate.user.id);
  expect((await request.get(`${base}/api/advocate/cases/${setup.caseId}`, { headers: advocate.headers })).status()).toBe(403);
});

test("role boundaries block client advocate endpoints and isolate inboxes", async ({ request }) => {
  const setup = await approvedCase(request);
  expect((await request.get(`${base}/api/advocate/requests`, { headers: setup.client.headers })).status()).toBe(403);
  const first = await verifiedAdvocate(request);
  const second = await verifiedAdvocate(request);
  await requestCase(request, setup, first.user.id);
  expect((await request.get(`${base}/api/advocate/requests`, { headers: second.headers })).status()).toBe(200);
  expect((await (await request.get(`${base}/api/advocate/requests`, { headers: second.headers })).json()).requests).toHaveLength(0);
});

test("approving a fact records a lock against rerun overwrites", async ({ request }) => {
  const setup = await approvedCase(request);
  const advocate = await verifiedAdvocate(request);
  await requestCase(request, setup, advocate.user.id);
  await request.post(`${base}/api/advocate/requests/${setup.caseId}/accept`, { headers: advocate.headers });
  await request.post(`${base}/api/advocate/cases/${setup.caseId}/facts/F001/approve`, { headers: advocate.headers });
  const result = await (await request.get(`${base}/api/advocate/cases/${setup.caseId}`, { headers: advocate.headers })).json();
  expect(result.case.advocate_approved_items).toContain("fact:F001");
});

test("removing a provision reruns only dependent stages and exposes the rerun", async ({ request }) => {
  const setup = await approvedCase(request);
  const advocate = await verifiedAdvocate(request);
  await requestCase(request, setup, advocate.user.id);
  await request.post(`${base}/api/advocate/requests/${setup.caseId}/accept`, { headers: advocate.headers });
  const before = await (await request.get(`${base}/api/advocate/cases/${setup.caseId}`, { headers: advocate.headers })).json();
  const provision = before.case.verified_legal_sections[0].provision_id;
  const result = await (await request.post(`${base}/api/advocate/cases/${setup.caseId}/provisions/${provision}/remove`, { headers: advocate.headers })).json();
  expect(result.rerun_stages).toContain("CLAIMANT_COUNSEL");
  expect(result.rerun_stages).not.toContain("DOMAIN_ROUTER");
  expect(result.case.advocate_reruns.at(-1).reason).toContain("provision");
});

test("correcting a fact preserves other human-confirmed facts", async ({ request }) => {
  const setup = await approvedCase(request);
  const advocate = await verifiedAdvocate(request);
  await requestCase(request, setup, advocate.user.id);
  await request.post(`${base}/api/advocate/requests/${setup.caseId}/accept`, { headers: advocate.headers });
  await request.post(`${base}/api/advocate/cases/${setup.caseId}/facts/F001/approve`, { headers: advocate.headers });
  const result = await request.patch(`${base}/api/advocate/cases/${setup.caseId}/facts/F002`, { headers: advocate.headers, data: { text: "Corrected second fact" } });
  expect(result.ok()).toBeTruthy();
  const caseData = (await (await request.get(`${base}/api/advocate/cases/${setup.caseId}`, { headers: advocate.headers })).json()).case;
  expect(caseData.facts.find((item) => item.fact_id === "F001").human_corrected).toBeTruthy();
});

test("every advocate action is appended to the audit trail", async ({ request }) => {
  const setup = await approvedCase(request);
  const advocate = await verifiedAdvocate(request);
  await requestCase(request, setup, advocate.user.id);
  await request.post(`${base}/api/advocate/requests/${setup.caseId}/accept`, { headers: advocate.headers });
  await request.post(`${base}/api/advocate/cases/${setup.caseId}/facts/F001/approve`, { headers: advocate.headers });
  await request.post(`${base}/api/advocate/cases/${setup.caseId}/review-note`, { headers: advocate.headers, data: { note: "Reviewed" } });
  const caseData = (await (await request.get(`${base}/api/advocate/cases/${setup.caseId}`, { headers: advocate.headers })).json()).case;
  expect(caseData.advocate_audit.some((entry) => entry.action === "approve")).toBeTruthy();
  expect(caseData.advocate_audit.some((entry) => entry.action === "review_note" && entry.new === "Reviewed")).toBeTruthy();
});

test("finalization is blocked with an explicit outstanding list", async ({ request }) => {
  const setup = await approvedCase(request);
  const advocate = await verifiedAdvocate(request);
  await requestCase(request, setup, advocate.user.id);
  await request.post(`${base}/api/advocate/requests/${setup.caseId}/accept`, { headers: advocate.headers });
  const response = await request.post(`${base}/api/cases/${setup.caseId}/advocate/finalize`, { headers: advocate.headers });
  expect(response.status()).toBe(409);
  expect((await response.json()).detail.outstanding_items.length).toBeGreaterThan(0);
});

test("finalization succeeds once every review item is approved", async ({ request }) => {
  const setup = await approvedCase(request);
  const advocate = await verifiedAdvocate(request);
  await requestCase(request, setup, advocate.user.id);
  await request.post(`${base}/api/advocate/requests/${setup.caseId}/accept`, { headers: advocate.headers });
  const caseData = (await (await request.get(`${base}/api/advocate/cases/${setup.caseId}`, { headers: advocate.headers })).json()).case;
  for (const fact of caseData.facts.filter((item) => !item.removed)) await request.post(`${base}/api/advocate/cases/${setup.caseId}/facts/${fact.fact_id}/approve`, { headers: advocate.headers });
  for (const provision of caseData.verified_legal_sections.filter((item) => !item.removed)) await request.post(`${base}/api/advocate/cases/${setup.caseId}/provisions/${provision.provision_id}/approve`, { headers: advocate.headers });
  await request.post(`${base}/api/advocate/cases/${setup.caseId}/forum/approve`, { headers: advocate.headers });
  await request.post(`${base}/api/advocate/cases/${setup.caseId}/limitation/approve`, { headers: advocate.headers });
  for (const objection of caseData.arguments.opponent.objections) await request.post(`${base}/api/advocate/cases/${setup.caseId}/arguments/${objection.objection_id}/approve`, { headers: advocate.headers });
  const result = await request.post(`${base}/api/cases/${setup.caseId}/advocate/finalize`, { headers: advocate.headers });
  expect((await result.json()).case.status).toBe("ADVOCATE_APPROVED");
});

test("client sees advocate changes and review notes after finalization", async ({ request }) => {
  const setup = await approvedCase(request);
  const advocate = await verifiedAdvocate(request);
  await requestCase(request, setup, advocate.user.id);
  await request.post(`${base}/api/advocate/requests/${setup.caseId}/accept`, { headers: advocate.headers });
  await request.post(`${base}/api/advocate/cases/${setup.caseId}/review-note`, { headers: advocate.headers, data: { note: "Ready for document preparation." } });
  const result = await (await request.get(`${base}/api/cases/${setup.caseId}`, { headers: setup.client.headers })).json();
  expect(result.case.advocate_review_note).toBe("Ready for document preparation.");
});
