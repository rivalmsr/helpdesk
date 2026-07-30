import "dotenv/config";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "./prisma";
import { ROLE } from "core";

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  trustedOrigins: [process.env.CLIENT_ORIGIN ?? "http://localhost:5173"],
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
  },
  user: {
    additionalFields: {
      role: {
        type: [ROLE.admin, ROLE.agent],
        required: true,
        input: false,
      },
    },
  },
});
