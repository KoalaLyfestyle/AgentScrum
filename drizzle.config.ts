import type { Config } from "drizzle-kit";

export default {
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: {
    url: process.env["SCRUM_DB_PATH"] ?? "./agentscrum.db",
  },
} satisfies Config;
