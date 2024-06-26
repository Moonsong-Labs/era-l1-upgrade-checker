import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    ALLOW_INDEXING: z.coerce.boolean().default(false),
    DATABASE_URL: z.string(),
    LOG_LEVEL: z.enum(["debug", "info"]).default("info"),
    NODE_ENV: z.enum(["development", "test", "production"]),
    SERVER_PORT: z.coerce.number().default(3000),
    WALLET_CONNECT_PROJECT_ID: z.string(),
  },
  // eslint-disable-next-line n/no-process-env
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});

export const clientEnv = {
  ALLOW_INDEXING: env.ALLOW_INDEXING,
  NODE_ENV: env.NODE_ENV,
  WALLET_CONNECT_PROJECT_ID: env.WALLET_CONNECT_PROJECT_ID,
};

declare global {
  interface Window {
    ENV: typeof clientEnv;
  }
}
