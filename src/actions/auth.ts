"use server";

import {
  clearSessionCookie,
  createSessionToken,
  setSessionCookie,
  verifyPassword,
} from "@/lib/auth";

export async function login(
  email: string,
  password: string
): Promise<{ error?: string }> {
  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  try {
    const user = await verifyPassword(email, password);
    if (!user) {
      return { error: "Invalid email or password." };
    }
    const token = await createSessionToken(user);
    await setSessionCookie(token);
    return {};
  } catch (err) {
    const message = err instanceof Error ? err.message : "Login failed.";
    return { error: message };
  }
}

export async function logout(): Promise<void> {
  await clearSessionCookie();
}
