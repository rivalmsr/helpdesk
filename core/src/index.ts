import { z } from "zod";

export * from "./role";

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

/**
 * Shared validation schema for editing a user (`PATCH /api/users/:id`).
 * Same as {@link createUserSchema} except the password is optional: an empty
 * or omitted password means "keep the current password", while a provided one
 * must still meet the minimum length.
 */
export const updateUserSchema = z.object({
  name: z.string().trim().min(3, "Name must be at least 3 characters"),
  email: z
    .string()
    .trim()
    .pipe(z.email("Enter a valid email address")),
  password: z
    .string()
    .refine((value) => value === "" || value.length >= 7, {
      message: "Password must be at least 7 characters",
    })
    .optional(),
});

export type UpdateUserInput = z.infer<typeof updateUserSchema>;
