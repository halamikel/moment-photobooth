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
  DATABASE_URL: z
    .string()
    .min(1)
    .default("postgres://postgres:postgres@127.0.0.1:5432/moment"),
  DATABASE_SSL: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.enum(["true", "false"]).optional(),
  ),
  SESSION_TTL_HOURS: z.coerce.number().int().min(1).max(168).default(24),
  SHARE_TTL_HOURS: z.coerce.number().int().min(1).max(168).default(24),
  WEB_DIST: z.string().min(1).default("./dist"),
  CRON_SECRET: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().min(1).optional(),
  ),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment configuration", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

const env = parsed.data;

function resolveRuntimePath(value: string): string {
  return path.resolve(process.cwd(), value);
}

function defaultDatabaseSsl(databaseUrl: string): boolean {
  try {
    const hostname = new URL(databaseUrl).hostname;
    return hostname !== "localhost" && hostname !== "127.0.0.1" && hostname !== "::1";
  } catch {
    return false;
  }
}

export const config = {
  nodeEnv: env.NODE_ENV,
  isProduction: env.NODE_ENV === "production",
  isServerless: Boolean(process.env.VERCEL),
  port: env.PORT,
  trustProxy: env.TRUST_PROXY || Boolean(process.env.VERCEL),
  databaseUrl: env.DATABASE_URL,
  databaseSsl:
    env.DATABASE_SSL === undefined
      ? defaultDatabaseSsl(env.DATABASE_URL)
      : env.DATABASE_SSL === "true",
  webDist: resolveRuntimePath(env.WEB_DIST),
  cronSecret: env.CRON_SECRET,
  sessionTtlMs: env.SESSION_TTL_HOURS * 60 * 60 * 1000,
  shareTtlMs: env.SHARE_TTL_HOURS * 60 * 60 * 1000,
  maxUploadBytes: 10 * 1024 * 1024,
  maxCaptionLength: 40,
} as const;
