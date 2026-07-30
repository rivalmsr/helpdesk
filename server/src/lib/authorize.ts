import type { NextFunction, Request, Response } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "./auth";
import type { Role } from "core";

type Session = NonNullable<Awaited<ReturnType<typeof auth.api.getSession>>>;

declare global {
  namespace Express {
    interface Request {
      session?: Session;
    }
  }
}

/** Re-derives the session from the request's cookies; never trust a client-supplied role. */
export function requireRole(...roles: Role[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });

    if (!session) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    if (roles.length > 0 && !roles.includes(session.user.role as Role)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    req.session = session;
    next();
  };
}

export const requireAuth = requireRole();
