/**
 * Node-only auth (server actions, API routes). Uses Postgres + bcrypt.
 */
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { queryOne } from "@/lib/db";
import {
  createSessionToken,
  verifySessionToken,
  SESSION_COOKIE_NAME,
  type SessionUser,
} from "@/lib/auth/session";

export type { SessionUser };
export { createSessionToken, verifySessionToken, SESSION_COOKIE_NAME };

const SESSION_DAYS = 7;

export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  return verifySessionToken(cookieStore.get(SESSION_COOKIE_NAME)?.value);
}

export async function setSessionCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
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
