import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  globalSetup: "./tests/global-setup.js",
  fullyParallel: false,
  workers: 1,
  timeout: 60000,
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
      reuseExistingServer: false,
      env: {
        USE_MOCK_AWS: "true",
        USE_REAL_DATABASE: "false",
        USE_REAL_STORAGE: "false",
        USE_REAL_LLM: "false",
        MOCK_DATABASE_PATH: "D:\\AWSHACK\\.localdev\\playwright-database.json",
        MOCK_STORAGE_PATH: "D:\\AWSHACK\\.localdev\\playwright-uploads"
      }
    },
    {
      command: "npm run dev",
      cwd: "frontend",
      url: "http://127.0.0.1:5173",
      timeout: 120000,
      reuseExistingServer: true,
      env: {
        VITE_API_BASE_URL: "http://127.0.0.1:8000"
      }
    }
  ],
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    }
  ]
});
