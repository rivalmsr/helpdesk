import { createAuthClient } from "better-auth/react";
import { inferAdditionalFields } from "better-auth/client/plugins";
import type { auth } from "../../../server/src/lib/auth"

export const ROLES = ["admin", "agent"] as const;
export type Role = (typeof ROLES)[number];

export const authClient = createAuthClient({
  plugins: [
    inferAdditionalFields<typeof auth>(),
  ],
});

export const { useSession, signIn, signOut } = authClient;
