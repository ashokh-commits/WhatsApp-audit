import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";

const SALT = "g6-whatsapp-audit-salt";
const KEY_LEN = 32;
const IV_LEN = 12;
const AUTH_TAG_LEN = 16;
const ALGO = "aes-256-gcm";

function getKey(): Buffer {
  const envKey = process.env.ENCRYPTION_KEY;
  if (!envKey || envKey.length < 16) {
    throw new Error("ENCRYPTION_KEY must be set and at least 16 characters");
  }
  return scryptSync(envKey, SALT, KEY_LEN) as Buffer;
}

export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, encrypted, authTag]).toString("base64");
}

export function decrypt(ciphertext: string): string {
  const key = getKey();
  const buf = Buffer.from(ciphertext, "base64");
  const iv = buf.subarray(0, IV_LEN);
  const authTag = buf.subarray(buf.length - AUTH_TAG_LEN);
  const encrypted = buf.subarray(IV_LEN, buf.length - AUTH_TAG_LEN);
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(authTag);
  return decipher.update(encrypted).toString("utf8") + decipher.final("utf8");
}
