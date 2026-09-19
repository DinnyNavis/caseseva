import fs from "node:fs";

export default async function globalSetup() {
  const databasePath = "D:\\AWSHACK\\.localdev\\playwright-database.json";
  if (fs.existsSync(databasePath)) fs.rmSync(databasePath, { force: true });
  const uploadsPath = "D:\\AWSHACK\\.localdev\\playwright-uploads";
  if (fs.existsSync(uploadsPath)) fs.rmSync(uploadsPath, { recursive: true, force: true });
}
