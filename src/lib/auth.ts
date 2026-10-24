import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { admin } from "better-auth/plugins";

import { sendEmail } from "@/lib/email";
import { prisma } from "@/lib/prisma";

// Secret from BETTER_AUTH_SECRET. Sessions last 7 days, extended once a day while the app is used.
export const auth = betterAuth({
  // The build loads this module without the secret, which is only given at run time (and required by instrumentation.ts).
  ...(process.env.NEXT_PHASE === "phase-production-build" && { secret: "build-only-placeholder-never-used-at-run-time" }),
  baseURL: process.env.APP_URL,
  database: prismaAdapter(prisma, { provider: "sqlite" }),

  emailAndPassword: {
    enabled: true,
    // Accounts come from invitations only.
    disableSignUp: true,
    // A reset signs out everywhere: whoever knew the old password loses access.
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      await sendEmail({
        to: user.email,
        subject: "Réinitialisation de votre mot de passe",
        text: `Pour choisir un nouveau mot de passe, ouvrez ce lien (valable 1 heure) :\n${url}`,
      });
    },
  },

  // Login attempts limited in production, counters kept across restarts.
  rateLimit: { storage: "database" },

  // nextCookies last: it sets the session cookie from server actions.
  plugins: [admin(), nextCookies()],
});
