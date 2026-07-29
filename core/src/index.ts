import { z } from "zod";

/**
 * Shared validation schema for creating a user.
 * Used by the server to validate `POST /api/users` request bodies and by the
 * client to drive the "New user" form (via `zodResolver`), so both sides stay
 * in sync on a single source of truth.
 */
export const createUserSchema = z.object({
  name: z.string().trim().min(3, "Name must be at least 3 characters"),
  email: z
    .string()
    .trim()
    .pipe(z.email("Enter a valid email address")),
  password: z.string().min(7, "Password must be at least 7 characters"),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
