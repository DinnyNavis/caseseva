import { test, expect } from "@playwright/test";

const uniqueEmail = () => `case-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`;

async function signup(page) {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.goto("/signup");
  await page.getByLabel("Full name").fill("Case Client");
  await page.getByLabel("Email").fill(uniqueEmail());
  await page.getByLabel("Mobile number").fill("9876543210");
  await page.getByLabel("Password").fill("Password123");
  await page.getByLabel("Preferred language").fill("English");
  await page.getByLabel("State").fill("Delhi");
  await page.getByLabel("District / city").fill("New Delhi");
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL(/\/dashboard$/);
}

async function startCase(page) {
  await page.getByRole("link", { name: "Start a new case" }).click();
  await page.waitForURL(/\/cases\/new$/);
}

async function chooseNewStage(page) {
  await page.getByTestId("stage-NEW_CONSULTATION").click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.waitForURL(/\/cases\/[^/]+\/edit$/);
}

test("creating a case shows it in the dashboard list", async ({ page }) => {
  await signup(page);
  await startCase(page);
  await chooseNewStage(page);
  await page.getByLabel("Your story").fill("A landlord has withheld my security deposit after I moved out.");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByTestId("evidence-input").setInputFiles({ name: "receipt.txt", mimeType: "text/plain", buffer: Buffer.from("test") });
  await page.getByRole("button", { name: "Review" }).click();
  await page.getByRole("button", { name: "Submit case" }).click();
  await page.waitForURL(/\/cases\/[^\/]+$/);
  await page.getByRole("link", { name: "Dashboard" }).click();
  await expect(page.getByTestId("case-card")).toContainText("A landlord has withheld my security deposit");
});

test("each stage shows only its conditional fields", async ({ page }) => {
  await signup(page);
  await startCase(page);
  await page.getByTestId("stage-NEW_CONSULTATION").click();
  await expect(page.getByLabel("FIR or reference?")).not.toBeVisible();
  await expect(page.getByLabel("CNR or case number")).not.toBeVisible();
  await page.getByTestId("stage-COMPLAINT_FIR").click();
  await expect(page.getByLabel("FIR or reference?")).toBeVisible();
  await expect(page.getByLabel("Reference number")).toBeVisible();
  await expect(page.getByLabel("CNR or case number")).not.toBeVisible();
  await page.getByTestId("stage-EXISTING_OLD_CASE").click();
  await expect(page.getByLabel("CNR or case number")).toBeVisible();
  await expect(page.getByLabel("FIR or reference?")).not.toBeVisible();
  await expect(page.getByLabel("Current stage")).toBeVisible();
});

test("switching stages clears conditional fields", async ({ page }) => {
  await signup(page);
  await startCase(page);
  await page.getByTestId("stage-COMPLAINT_FIR").click();
  await page.getByLabel("Reference number").fill("FIR-123");
  await page.getByTestId("stage-EXISTING_OLD_CASE").click();
  await page.getByTestId("stage-COMPLAINT_FIR").click();
  await expect(page.getByLabel("Reference number")).toHaveValue("");
});

test("missing stage fields show the right errors", async ({ page }) => {
  await signup(page);
  await startCase(page);
  await page.getByTestId("stage-COMPLAINT_FIR").click();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText("This field is required for the selected stage.").first()).toBeVisible();
  await expect(page.getByLabel("Reference number")).toBeVisible();
});

test("story survives reload through draft autosave", async ({ page }) => {
  await signup(page);
  await startCase(page);
  await chooseNewStage(page);
  const story = "I paid for a service that was never delivered and want a refund.";
  await page.getByLabel("Your story").fill(story);
  await expect(page.getByText("Auto-saved to draft")).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Your story")).toHaveValue(story);
});

test("evidence uploads receive stable sequential IDs", async ({ page }) => {
  await signup(page);
  await startCase(page);
  await chooseNewStage(page);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByTestId("evidence-input").setInputFiles([
    { name: "receipt-one.txt", mimeType: "text/plain", buffer: Buffer.from("one") },
  ]);
  await expect(page.getByTestId("evidence-card")).toContainText("E001");
  await page.getByTestId("evidence-input").setInputFiles([
    { name: "receipt-two.txt", mimeType: "text/plain", buffer: Buffer.from("two") },
  ]);
  await expect(page.getByTestId("evidence-card")).toHaveCount(2);
  await expect(page.getByText("E002")).toBeVisible();
});

test("deleted evidence IDs are not reused", async ({ page }) => {
  await signup(page);
  await startCase(page);
  await chooseNewStage(page);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByTestId("evidence-input").setInputFiles({ name: "first.txt", mimeType: "text/plain", buffer: Buffer.from("one") });
  await expect(page.getByText("E001")).toBeVisible();
  await page.getByTestId("evidence-input").setInputFiles({ name: "second.txt", mimeType: "text/plain", buffer: Buffer.from("two") });
  await expect(page.getByText("E002")).toBeVisible();
  await page.getByTestId("evidence-card").first().getByRole("button", { name: "Delete" }).click();
  await expect(page.getByText("E001")).not.toBeVisible();
  await page.getByTestId("evidence-input").setInputFiles({ name: "third.txt", mimeType: "text/plain", buffer: Buffer.from("three") });
  await expect(page.getByText("E003")).toBeVisible();
});

test("unsupported evidence displays a visible error", async ({ page }) => {
  await signup(page);
  await startCase(page);
  await chooseNewStage(page);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByTestId("evidence-input").setInputFiles({ name: "malware.exe", mimeType: "application/octet-stream", buffer: Buffer.from("bad") });
  await expect(page.getByRole("alert")).toContainText("Unsupported file type");
});

test("complete case submits as ready for analysis", async ({ page }) => {
  await signup(page);
  await startCase(page);
  await chooseNewStage(page);
  await page.getByLabel("Your story").fill("My employer has not paid my wages for two months.");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByTestId("evidence-input").setInputFiles({ name: "wage-record.txt", mimeType: "text/plain", buffer: Buffer.from("wage record") });
  await page.getByRole("button", { name: "Review" }).click();
  await page.getByRole("button", { name: "Submit case" }).click();
  await expect(page).toHaveURL(/\/cases\/[^/]+$/);
  await expect(page.getByTestId("case-status")).toContainText("READY_FOR_ANALYSIS");
  await expect(page.getByTestId("analysis-placeholder")).toBeVisible();
});

test("incomplete case submission is blocked", async ({ page }) => {
  await signup(page);
  await startCase(page);
  await chooseNewStage(page);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Review" }).click();
  await page.getByRole("button", { name: "Submit case" }).click();
  await expect(page.getByRole("alert")).toContainText("Upload at least one evidence file");
});

test("a user cannot open another users case", async ({ request }) => {
  const createUser = async (email) => {
    const response = await request.post("http://127.0.0.1:8000/api/auth/signup", {
      data: {
        full_name: "Ownership Client",
        email,
        mobile_number: "9876543210",
        password: "Password123",
        preferred_language: "English",
        state: "Delhi",
        district_city: "Delhi",
      },
    });
    return response.json();
  };
  const first = await createUser(uniqueEmail());
  const second = await createUser(uniqueEmail());
  const created = await request.post("http://127.0.0.1:8000/api/cases", {
    headers: { Authorization: `Bearer ${first.session_token}` },
  });
  const caseId = (await created.json()).case.case_id;
  const response = await request.get(`http://127.0.0.1:8000/api/cases/${caseId}`, {
    headers: { Authorization: `Bearer ${second.session_token}` },
  });
  expect(response.status()).toBe(403);
});

test("opening /cases/new and leaving without typing anything creates no case", async ({ page }) => {
  await signup(page);
  await page.goto("/cases/new");
  await page.goto("/dashboard");

  await expect(page.getByTestId("case-card")).toHaveCount(0);
});

test("typing, refreshing, and continuing edits the same case rather than creating a second one", async ({ page }) => {
  await signup(page);
  await page.goto("/cases/new");
  await chooseNewStage(page);
  await page.waitForURL(/\/cases\/[^/]+\/edit$/);

  const editUrl = page.url();

  await page.getByLabel("Your story").fill("My salary was delayed by two months in August 2026.");
  await expect(page.getByText("Auto-saved to draft")).toBeVisible();

  await page.reload();
  expect(page.url()).toBe(editUrl);
  await expect(page.getByLabel("Your story")).toHaveValue("My salary was delayed by two months in August 2026.");

  await page.getByRole("link", { name: "Dashboard" }).click();
  await expect(page.getByTestId("case-card")).toHaveCount(1);
});
