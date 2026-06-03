/** @deprecated Import from `@/lib/auth/server` or `@/lib/auth/session` (middleware). */
export {
  getSession,
  setSessionCookie,
  clearSessionCookie,
  verifyPassword,
  hashPassword,
  createSessionToken,
  verifySessionToken,
  SESSION_COOKIE_NAME,
  type SessionUser,
} from "@/lib/auth/server";

export { getSessionFromRequest } from "@/lib/auth/session";
