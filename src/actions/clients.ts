"use server";

import { encrypt } from "@/lib/crypto";
import { getSession } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import { revalidatePath } from "next/cache";
import type { Database } from "@/types/database";

type ClientRow = Database["public"]["Tables"]["clients"]["Row"];
type AuditRow = Database["public"]["Tables"]["audits"]["Row"];

export async function createClient(formData: FormData) {
  const name = formData.get("name") as string;
  const instanceName = formData.get("instance_name") as string;
  const instanceKey = formData.get("instance_key") as string;
  const ticketRaw = formData.get("avg_ticket_value") as string | null;

  if (!name || !instanceName || !instanceKey) {
    return { error: "All fields are required." };
  }

  try {
    const user = await getSession();
    if (!user) return { error: "Unauthorized." };

    const encryptedKey = encrypt(instanceKey);
    const avgTicket = ticketRaw ? parseFloat(ticketRaw) || 0 : 0;

    const row = await queryOne<{ id: string }>(
      `INSERT INTO clients (name, instance_name, instance_key_encrypted, avg_ticket_value, created_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [name.trim(), instanceName.trim(), encryptedKey, avgTicket, user.id]
    );

    if (!row) return { error: "Failed to create client." };

    revalidatePath("/dashboard");
    return { success: true, clientId: row.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected server error.";
    return { error: message };
  }
}

export async function listClients() {
  return query<Pick<ClientRow, "id" | "name" | "instance_name" | "created_at">>(
    `SELECT id, name, instance_name, created_at FROM clients ORDER BY created_at DESC`
  );
}

export async function getClientWithAudit(clientId: string) {
  const client = await queryOne<
    Pick<ClientRow, "id" | "name" | "instance_name" | "avg_ticket_value" | "created_at">
  >(
    `SELECT id, name, instance_name, avg_ticket_value, created_at FROM clients WHERE id = $1`,
    [clientId]
  );
  if (!client) throw new Error("Client not found");

  const lastAudit = await queryOne<
    Pick<AuditRow, "id" | "overall_score" | "status" | "created_at">
  >(
    `SELECT id, overall_score, status, created_at FROM audits
     WHERE client_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [clientId]
  );

  const consent = await queryOne<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM consent_records WHERE client_id = $1`,
    [clientId]
  );

  return {
    id: client.id,
    name: client.name,
    instance_name: client.instance_name,
    avg_ticket_value: Number(client.avg_ticket_value),
    created_at: client.created_at,
    lastAudit: lastAudit ?? null,
    hasConsent: parseInt(consent?.count ?? "0", 10) > 0,
  };
}
