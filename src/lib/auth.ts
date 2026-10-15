import { NextRequest } from "next/server";
import jwt from "jsonwebtoken";
import { db } from "./db";

const JWT_SECRET = process.env.JWT_SECRET || "dev-only-insecure-secret-change-me";
const JWT_EXPIRES = "7d";

export interface JwtPayload {
  id: string;
  role: "admin" | "patient";
  name: string;
}

/** Sign a JWT for a user. */
export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES });
}

/** Verify a JWT and return the payload (or null). */
export function verifyToken(token: string): JwtPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    return decoded;
  } catch {
    return null;
  }
}

/** Extract the Bearer token from a request. */
export function getTokenFromRequest(req: NextRequest): string | null {
  const auth = req.headers.get("authorization");
  if (auth && auth.toLowerCase().startsWith("bearer ")) {
    return auth.slice(7).trim();
  }
  const xToken = req.headers.get("x-auth-token");
  if (xToken) return xToken.trim();
  return null;
}

/** Authenticate a request → returns the user row (or null). */
export async function authenticate(req: NextRequest) {
  const token = getTokenFromRequest(req);
  if (!token) return null;
  const payload = verifyToken(token);
  if (!payload) return null;
  const user = await db.user.findUnique({ where: { id: payload.id } });
  if (!user || user.status !== "active") return null;
  return user;
}

/** Require admin role — returns {user} or {error:Response}. */
export async function requireAdmin(req: NextRequest) {
  const user = await authenticate(req);
  if (!user) {
    return {
      error: new Response(
        JSON.stringify({ success: false, error: { code: "AUTH_REQUIRED", message: "Authentication required." } }),
        { status: 401, headers: { "content-type": "application/json" } }
      ),
    };
  }
  if (user.role !== "admin") {
    return {
      error: new Response(
        JSON.stringify({ success: false, error: { code: "AUTH_FORBIDDEN", message: "Admin access required." } }),
        { status: 403, headers: { "content-type": "application/json" } }
      ),
    };
  }
  return { user };
}

/** Require any authenticated user — returns {user} or {error:Response}. */
export async function requireAuth(req: NextRequest) {
  const user = await authenticate(req);
  if (!user) {
    return {
      error: new Response(
        JSON.stringify({ success: false, error: { code: "AUTH_REQUIRED", message: "Authentication required." } }),
        { status: 401, headers: { "content-type": "application/json" } }
      ),
    };
  }
  return { user };
}
