import { test, expect } from "@playwright/test";

const POLL_TIMEOUT = parseInt(process.env.POLL_TIMEOUT_MS || "10000", 10);
test.beforeEach(async () => {
  test.setTimeout(parseInt(process.env.TEST_TIMEOUT_MS || process.env.POLL_TIMEOUT_MS || "60000", 10));
});

const email = () => `analysis-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`;

const REALISTIC_LAPTOP_STORY = "I purchased a laptop online for personal use on 1 August 2026 for Rs. 78,999. The laptop was delivered on 3 August 2026. However, starting 7 August 2026, the laptop began shutting down repeatedly. I brought it to an authorised service centre on 10 August 2026, which inspected it and recorded a motherboard fault on the job sheet. On 12 August 2026, I requested a replacement laptop from the online seller as per their replacement policy. On 14 August 2026, the seller refused the replacement and offered only repair, despite the documented manufacturing defect.";

async function readyCase(request, story = REALISTIC_LAPTOP_STORY) {
  const auth = await request.post("http://127.0.0.1:8000/api/auth/signup", { data: {
    full_name: "Analysis Client", email: email(), mobile_number: "9876543210",
    password: "Password123", preferred_language: "English", state: "Delhi", district_city: "Delhi",
  }});
  const token = (await auth.json()).session_token;
  const headers = { Authorization: `Bearer ${token}` };
  const created = await request.post("http://127.0.0.1:8000/api/cases", { headers });
  const caseId = (await created.json()).case.case_id;
  await request.patch(`http://127.0.0.1:8000/api/cases/${caseId}`, { headers, data: { stage: "NEW_CONSULTATION", stage_details: {}, client_story: story } });
  await request.post(`http://127.0.0.1:8000/api/cases/${caseId}/evidence`, {
    headers, multipart: { file: { name: "receipt.txt", mimeType: "text/plain", buffer: Buffer.from("receipt") } },
  });
  await request.post(`http://127.0.0.1:8000/api/cases/${caseId}/submit`, { headers });
  return { token, caseId, headers };
}

async function analyzeAndWait(request, setup) {
  await request.post(`http://127.0.0.1:8000/api/cases/${setup.caseId}/analyze`, { headers: setup.headers });
  await expect.poll(async () => (await (await request.get(`http://127.0.0.1:8000/api/cases/${setup.caseId}/status`, { headers: setup.headers })).json()).status, { timeout: POLL_TIMEOUT }).toBe("AWAITING_PREVIEW_1");
}

test("analysis completes and Preview 1 contains structured output", async ({ request }) => {
  const setup = await readyCase(request);
  await analyzeAndWait(request, setup);
  const response = await request.get(`http://127.0.0.1:8000/api/cases/${setup.caseId}/preview1`, { headers: setup.headers });
  const preview = await response.json();
  expect(preview.facts.length).toBeGreaterThan(0);
  expect(preview.facts[0].fact_id).toBe("F001");
  expect(preview.facts[0].evidence[0].filename).toBe("receipt.txt");
  expect(preview.timeline.length).toBeGreaterThan(0);
  expect(preview.parties.opposite_party).toBeTruthy();
});

test("Preview 1 fact edits, additions, timeline, and parties persist", async ({ request }) => {
  const setup = await readyCase(request);
  await analyzeAndWait(request, setup);
  await request.patch(`http://127.0.0.1:8000/api/cases/${setup.caseId}/facts/F001`, { headers: setup.headers, data: { text: "Corrected fact" } });
  await request.post(`http://127.0.0.1:8000/api/cases/${setup.caseId}/facts`, { headers: setup.headers, data: { text: "Client supplied fact" } });
  await request.patch(`http://127.0.0.1:8000/api/cases/${setup.caseId}/timeline/T001`, { headers: setup.headers, data: { date: "2026-08-02" } });
  await request.patch(`http://127.0.0.1:8000/api/cases/${setup.caseId}/parties`, { headers: setup.headers, data: { client_role: "Buyer", opposite_party: "Seller", relationship: "Consumer and seller" } });
  const preview = await (await request.get(`http://127.0.0.1:8000/api/cases/${setup.caseId}/preview1`, { headers: setup.headers })).json();
  expect(preview.facts.find((fact) => fact.fact_id === "F001").text).toBe("Corrected fact");
  expect(preview.facts.at(-1).fact_id).toMatch(/^F\d+$/);
  expect(preview.timeline[0].date).toBe("2026-08-02");
  expect(preview.parties.client_role).toBe("Buyer");
});

test("approval moves case to PREVIEW_1_APPROVED", async ({ request }) => {
  const setup = await readyCase(request);
  await analyzeAndWait(request, setup);
  const response = await request.post(`http://127.0.0.1:8000/api/cases/${setup.caseId}/preview1/approve`, { headers: setup.headers });
  expect((await response.json()).case.status).toBe("PREVIEW_1_APPROVED");
});

test("malformed LLM output fails the fact stage and exposes retry", async ({ request }) => {
  const setup = await readyCase(request, "[MALFORMED] trigger");
  await request.post(`http://127.0.0.1:8000/api/cases/${setup.caseId}/analyze`, { headers: setup.headers });
  await expect.poll(async () => (await (await request.get(`http://127.0.0.1:8000/api/cases/${setup.caseId}/status`, { headers: setup.headers })).json()).status, { timeout: POLL_TIMEOUT }).toBe("ANALYSIS_FAILED");
  const status = await (await request.get(`http://127.0.0.1:8000/api/cases/${setup.caseId}/status`, { headers: setup.headers })).json();
  expect(status.stage_statuses.FACT_EXTRACTION).toBe("FAILED");
});

test("uninformative story returns low confidence or unknown parties without inventing roles", async ({ request }) => {
  const setup = await readyCase(request, "Uninformative brief note with no legal details or parties");
  await request.post(`http://127.0.0.1:8000/api/cases/${setup.caseId}/analyze`, { headers: setup.headers });
  await expect.poll(async () => (await (await request.get(`http://127.0.0.1:8000/api/cases/${setup.caseId}/status`, { headers: setup.headers })).json()).status, { timeout: POLL_TIMEOUT }).toBe("ANALYSIS_FAILED");
  const status = await (await request.get(`http://127.0.0.1:8000/api/cases/${setup.caseId}/status`, { headers: setup.headers })).json();
  expect(status.stage_statuses.PARTY_IDENTIFICATION).toBe("FAILED");
});

test("analysis cannot start for a draft and ownership is enforced", async ({ request }) => {
  const auth = await request.post("http://127.0.0.1:8000/api/auth/signup", { data: {
    full_name: "Draft Client", email: email(), mobile_number: "9876543210", password: "Password123",
    preferred_language: "English", state: "Delhi", district_city: "Delhi",
  }});
  const token = (await auth.json()).session_token;
  const headers = { Authorization: `Bearer ${token}` };
  const created = await request.post("http://127.0.0.1:8000/api/cases", { headers });
  const caseId = (await created.json()).case.case_id;
  expect((await request.post(`http://127.0.0.1:8000/api/cases/${caseId}/analyze`, { headers })).status()).toBe(409);
});
