import type { Config } from "drizzle-kit";
import { resolveDbPath } from "./src/db/path.js";

const dbPath = resolveDbPath();

export default {
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: {
    url: dbPath,
  },
} satisfies Config;
