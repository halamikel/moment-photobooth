import "dotenv/config";
import path from "node:path";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  TRUST_PROXY: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  DATABASE_PATH: z.string().min(1).default("./data/photobooth.sqlite"),
  UPLOAD_DIR: z.string().min(1).default("./storage/uploads"),
  SESSION_TTL_HOURS: z.coerce.number().int().min(1).max(168).default(24),
  SHARE_TTL_HOURS: z.coerce.number().int().min(1).max(168).default(24),
  WEB_DIST: z.string().min(1).default("./dist"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment configuration", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

const env = parsed.data;

function resolveRuntimePath(value: string): string {
  if (value === ":memory:") return value;
  return path.resolve(process.cwd(), value);
}

export const config = {
  nodeEnv: env.NODE_ENV,
  isProduction: env.NODE_ENV === "production",
  port: env.PORT,
  trustProxy: env.TRUST_PROXY,
  databasePath: resolveRuntimePath(env.DATABASE_PATH),
  uploadDir: resolveRuntimePath(env.UPLOAD_DIR),
  webDist: resolveRuntimePath(env.WEB_DIST),
  sessionTtlMs: env.SESSION_TTL_HOURS * 60 * 60 * 1000,
  shareTtlMs: env.SHARE_TTL_HOURS * 60 * 60 * 1000,
  maxUploadBytes: 10 * 1024 * 1024,
  maxCaptionLength: 40,
} as const;
