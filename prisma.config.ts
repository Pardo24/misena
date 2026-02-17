import path from "path";
import { readFileSync } from "fs";
import { defineConfig } from "prisma/config";

// Load .env manually (dotenv was removed as a dependency)
function loadEnv() {
  if (process.env.DATABASE_URL) return;
  try {
    const content = readFileSync(path.resolve(process.cwd(), ".env"), "utf8");
    for (const line of content.split("\n")) {
      const m = line.match(/^\s*([\w]+)\s*=\s*"?([^"]*)"?\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  } catch {}
}
loadEnv();

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: process.env.DATABASE_URL!,
  },
  migrations: {
    path: "prisma/migrations",
  },
});
