/**
 * Edge-safe session helpers (middleware). No pg, no bcrypt.
 */
import { SignJWT, jwtVerify } from "jose";
import { type NextRequest } from "next/server";

export const SESSION_COOKIE_NAME = "g6_session";
const SESSION_DAYS = 7;

export interface SessionUser {
  id: string;
  email: string;
}

function getSecret(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET must be set and at least 32 characters");
  }
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(user: SessionUser): Promise<string> {
  return new SignJWT({ sub: user.id, email: user.email })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(getSecret());
}

export async function verifySessionToken(
  token: string | undefined
): Promise<SessionUser | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret());
    const id = payload.sub;
    const email = payload.email;
    if (typeof id !== "string" || typeof email !== "string") return null;
    return { id, email };
  } catch {
    return null;
  }
}

export async function getSessionFromRequest(
  request: NextRequest
): Promise<SessionUser | null> {
  return verifySessionToken(request.cookies.get(SESSION_COOKIE_NAME)?.value);
}
