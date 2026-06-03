"use server";

import { getSession } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import { revalidatePath } from "next/cache";
import type { Database } from "@/types/database";

type ConsentRow = Database["public"]["Tables"]["consent_records"]["Row"];

export async function recordConsent(formData: FormData) {
  const clientId = formData.get("client_id") as string;
  const authorizedBy = formData.get("authorized_by") as string;
  const notes = formData.get("notes") as string | null;
  const documentUrl = formData.get("document_url") as string | null;

  if (!clientId || !authorizedBy) {
    return { error: "Client and authorizing contact are required." };
  }

  const user = await getSession();
  if (!user) return { error: "Unauthorized." };

  try {
    await query(
      `INSERT INTO consent_records (client_id, authorized_by, notes, document_url, created_by)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        clientId,
        authorizedBy.trim(),
        notes?.trim() || null,
        documentUrl?.trim() || null,
        user.id,
      ]
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to save consent.";
    return { error: message };
  }

  revalidatePath(`/consent/${clientId}`);
  revalidatePath("/dashboard");
  return { success: true };
}

export async function getConsentRecord(clientId: string) {
  return queryOne<
    Pick<ConsentRow, "id" | "authorized_by" | "authorized_at" | "document_url" | "notes">
  >(
    `SELECT id, authorized_by, authorized_at, document_url, notes
     FROM consent_records WHERE client_id = $1
     ORDER BY authorized_at DESC LIMIT 1`,
    [clientId]
  );
}

export async function hasConsent(clientId: string): Promise<boolean> {
  const row = await queryOne<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM consent_records WHERE client_id = $1`,
    [clientId]
  );
  return parseInt(row?.count ?? "0", 10) > 0;
}
