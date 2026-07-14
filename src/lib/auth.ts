import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "../db";
import * as schema from "../db/schema";
import crypto from "crypto";

function getBaseURL(): string {
  const url = process.env.BETTER_AUTH_URL;
  if (!url) {
    throw new Error(
      "[Better Auth] BETTER_AUTH_URL belum di-set di environment. " +
        "Tambahkan ke .env dan production environment sebelum deploy.",
    );
  }
  return url.replace(/\/$/, "");
}

function getTrustedOrigins(): string[] {
  const origins = process.env.BETTER_AUTH_TRUSTED_ORIGINS;
  if (origins) {
    return origins.split(",").map((o) => o.trim());
  }
  const baseUrl = getBaseURL();
  const httpVariant = baseUrl.replace(/^https:/i, "http:");
  const httpsVariant = baseUrl.replace(/^http:/i, "https:");
  return Array.from(new Set([baseUrl, httpVariant, httpsVariant]));
}

export const auth = betterAuth({
  baseURL: getBaseURL(),
  basePath: "/api/auth",
  trustedOrigins: getTrustedOrigins(),
  database: drizzleAdapter(db, {
    provider: "mysql",
    schema: {
      user: schema.users,
      session: schema.sessions,
      account: schema.accounts,
      verification: schema.verifications,
    },
  }),
  advanced: {
    database: {
      generateId: () => crypto.randomUUID(),
    },
  },
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 6,
  },
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: false,
        defaultValue: "staff",
      },
      phone: {
        type: "string",
        required: false,
      },
      position: {
        type: "string",
        required: false,
      },
      bio: {
        type: "string",
        required: false,
      },
      isActive: {
        type: "boolean",
        required: false,
        defaultValue: true,
      },
    },
  },
});
export type Auth = typeof auth;
