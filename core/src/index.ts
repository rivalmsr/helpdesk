// Barrel for the `core` package. Convention: plain types/constants live in
// `<domain>.ts` (dependency-free) and Zod validation schemas live in
// `<domain>.schema.ts` (depend on zod). Re-export both here so consumers import
// everything from the bare package name (`import { ... } from "core"`).
export * from "./role";
export * from "./user.schema";
export * from "./ticket";
export * from "./ticket.schema";
