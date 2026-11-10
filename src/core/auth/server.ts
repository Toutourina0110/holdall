import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { admin } from "better-auth/plugins";
import { getDb } from "@/core/db/client";
import * as schema from "@/core/db/schema";
import { getEnv } from "@/core/env";
import { currentSignupGrant } from "./signup-grant";

function createAuth() {
  const env = getEnv();
  return betterAuth({
    appName: "Holdall",
    secret: env.appSecret,
    baseURL: env.appUrl,
    database: drizzleAdapter(getDb(), { provider: "sqlite", schema }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 10,
      maxPasswordLength: 128,
      autoSignIn: true,
    },
    session: {
      expiresIn: 60 * 60 * 24 * 30,
      updateAge: 60 * 60 * 24,
    },
    rateLimit: {
      enabled: true,
      storage: "database",
      window: 60,
      max: 100,
      customRules: {
        "/sign-in/email": { window: 60, max: 5 },
        "/sign-up/email": { window: 60, max: 3 },
        "/change-password": { window: 60, max: 5 },
      },
    },
    advanced: {
      ipAddress: {
        ipAddressHeaders: env.trustProxy ? ["cf-connecting-ip", "x-real-ip", "x-forwarded-for"] : [],
      },
    },
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        if (ctx.path.startsWith("/sign-up") && !currentSignupGrant()) {
          throw new APIError("FORBIDDEN", { message: "Accounts are created from the setup, invitation or registration page." });
        }
      }),
    },
    databaseHooks: {
      user: {
        create: {
          before: async (user) => {
            const signup = currentSignupGrant();
            if (!signup) throw new APIError("FORBIDDEN", { message: "Accounts are created from the setup, invitation or registration page." });
            return { data: { ...user, role: signup.role } };
          },
        },
      },
    },
    plugins: [admin({ defaultRole: "user", adminRoles: ["admin"] }), nextCookies()],
  });
}

let instance: ReturnType<typeof createAuth> | undefined;

export function getAuth() {
  instance ??= createAuth();
  return instance;
}

export const auth = getAuth;
