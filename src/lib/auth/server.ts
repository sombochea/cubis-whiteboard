import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { genericOAuth } from "better-auth/plugins";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";

const plugins = [];

if (process.env.ZITADEL_CLIENT_ID) {
  plugins.push(
    genericOAuth({
      config: [
        {
          providerId: "sso",
          discoveryUrl: `${process.env.ZITADEL_ISSUER}/.well-known/openid-configuration`,
          clientId: process.env.ZITADEL_CLIENT_ID!,
          clientSecret: process.env.ZITADEL_CLIENT_SECRET!,
          scopes: ["openid", "profile", "email"],
        },
      ],
    })
  );
}

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
  emailAndPassword: {
    enabled: true,
  },
  plugins,
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60,
    },
  },
});

export type Session = typeof auth.$Infer.Session;
