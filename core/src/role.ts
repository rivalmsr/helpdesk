/**
 * The set of user roles — the single source of truth shared across the client
 * (UI + route guards), the server (authorization), and mirrored by the Prisma
 * `Role` enum in the database schema. Keep these values in sync with that enum.
 */
export const ROLE = { admin: "admin", agent: "agent" } as const;

export const ROLES = [ROLE.admin, ROLE.agent] as const;

export type Role = (typeof ROLES)[number];
