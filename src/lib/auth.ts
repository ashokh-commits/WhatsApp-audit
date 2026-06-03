import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { type NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { queryOne } from "@/lib/db";

const COOKIE_NAME = "g6_session";
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

export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  return verifySessionToken(cookieStore.get(COOKIE_NAME)?.value);
}

export async function getSessionFromRequest(
  request: NextRequest
): Promise<SessionUser | null> {
  return verifySessionToken(request.cookies.get(COOKIE_NAME)?.value);
}

export async function setSessionCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function verifyPassword(
  email: string,
  password: string
): Promise<SessionUser | null> {
  const row = await queryOne<{ id: string; email: string; password_hash: string }>(
    "SELECT id, email, password_hash FROM users WHERE email = $1",
    [email.trim().toLowerCase()]
  );
  if (!row) return null;
  const ok = await bcrypt.compare(password, row.password_hash);
  if (!ok) return null;
  return { id: row.id, email: row.email };
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}
