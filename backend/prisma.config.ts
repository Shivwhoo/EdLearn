import path from "path";
import fs from "fs";
import dotenv from "dotenv";
import { defineConfig, env } from "prisma/config";

const localEnv = path.resolve(process.cwd(), ".env");
const parentEnv = path.resolve(process.cwd(), "../.env");

if (fs.existsSync(localEnv)) {
  dotenv.config({ path: localEnv });
} else if (fs.existsSync(parentEnv)) {
  dotenv.config({ path: parentEnv });
} else {
  dotenv.config();
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: env("DATABASE_URL"),
  },
});
