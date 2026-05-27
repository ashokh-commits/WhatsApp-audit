"use server";

import { createSupabaseServerClient, createSupabaseAdminClient } from "@/lib/supabase/server";
import { encrypt } from "@/lib/crypto";
import { revalidatePath } from "next/cache";
import type { Database } from "@/types/database";

type ClientRow = Database["public"]["Tables"]["clients"]["Row"];
type ClientInsert = Database["public"]["Tables"]["clients"]["Insert"];

export async function createClient(formData: FormData) {
  const name = formData.get("name") as string;
  const instanceName = formData.get("instance_name") as string;
  const instanceKey = formData.get("instance_key") as string;

  if (!name || !instanceName || !instanceKey) {
    return { error: "All fields are required." };
  }

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized." };

  const encryptedKey = encrypt(instanceKey);
  const admin = createSupabaseAdminClient();

  const insert: ClientInsert = {
    name: name.trim(),
    instance_name: instanceName.trim(),
    instance_key_encrypted: encryptedKey,
    created_by: user.id,
  };

  const { data, error } = await admin
    .from("clients")
    .insert(insert)
    .select("id")
    .single() as { data: Pick<ClientRow, "id"> | null; error: { message: string } | null };

  if (error) return { error: error.message };

  revalidatePath("/dashboard");
  return { success: true, clientId: data!.id };
}

export async function listClients() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("clients")
    .select("id, name, instance_name, created_at")
    .order("created_at", { ascending: false }) as {
      data: Array<Pick<ClientRow, "id" | "name" | "instance_name" | "created_at">> | null;
      error: { message: string } | null;
    };

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getClientWithAudit(clientId: string) {
  const supabase = await createSupabaseServerClient();
  type AuditRow = Database["public"]["Tables"]["audits"]["Row"];

  const { data: client, error: cErr } = await supabase
    .from("clients")
    .select("id, name, instance_name, created_at")
    .eq("id", clientId)
    .single() as {
      data: Pick<ClientRow, "id" | "name" | "instance_name" | "created_at"> | null;
      error: { message: string } | null;
    };
  if (cErr || !client) throw new Error(cErr?.message ?? "Client not found");

  const admin = createSupabaseAdminClient();
  const { data: lastAudit } = await admin
    .from("audits")
    .select("id, overall_score, status, created_at")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single() as {
      data: Pick<AuditRow, "id" | "overall_score" | "status" | "created_at"> | null;
      error: unknown;
    };

  const { count } = await admin
    .from("consent_records")
    .select("id", { count: "exact", head: true })
    .eq("client_id", clientId);

  return {
    id: client.id,
    name: client.name,
    instance_name: client.instance_name,
    created_at: client.created_at,
    lastAudit: lastAudit ?? null,
    hasConsent: (count ?? 0) > 0,
  };
}
