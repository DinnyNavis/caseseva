import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  globalSetup: "./tests/global-setup.js",
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:5173",
    trace: "on-first-retry"
  },
  webServer: [
    {
      command: "python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000",
      url: "http://127.0.0.1:8000/api/health",
      timeout: 120000,
      reuseExistingServer: true,
      env: {
        USE_MOCK_AWS: process.env.USE_REAL_DATABASE === "true" || process.env.USE_REAL_STORAGE === "true" || process.env.USE_REAL_LLM === "true" ? "false" : (process.env.USE_MOCK_AWS || "true"),
        USE_REAL_DATABASE: process.env.USE_REAL_DATABASE || "false",
        USE_REAL_STORAGE: process.env.USE_REAL_STORAGE || "false",
        USE_REAL_LLM: process.env.USE_REAL_LLM || "false",
        MOCK_DATABASE_PATH: "D:\\AWSHACK\\.localdev\\playwright-database.json",
        MOCK_STORAGE_PATH: "D:\\AWSHACK\\.localdev\\playwright-uploads"
      }
    },
    {
      command: "npm run dev",
      cwd: "frontend",
      url: "http://127.0.0.1:5173",
      timeout: 120000,
      reuseExistingServer: true
    }
  ],
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    }
  ]
});
