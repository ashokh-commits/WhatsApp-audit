"use server";

import { createSupabaseServerClient, createSupabaseAdminClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { Database } from "@/types/database";

type ConsentRow = Database["public"]["Tables"]["consent_records"]["Row"];
type ConsentInsert = Database["public"]["Tables"]["consent_records"]["Insert"];

export async function recordConsent(formData: FormData) {
  const clientId = formData.get("client_id") as string;
  const authorizedBy = formData.get("authorized_by") as string;
  const notes = formData.get("notes") as string | null;
  const documentUrl = formData.get("document_url") as string | null;

  if (!clientId || !authorizedBy) {
    return { error: "Client and authorizing contact are required." };
  }

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized." };

  const insert: ConsentInsert = {
    client_id: clientId,
    authorized_by: authorizedBy.trim(),
    notes: notes?.trim() || null,
    document_url: documentUrl?.trim() || null,
    created_by: user.id,
  };

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("consent_records")
    .insert(insert) as { error: { message: string } | null };

  if (error) return { error: error.message };

  revalidatePath(`/consent/${clientId}`);
  revalidatePath("/dashboard");
  return { success: true };
}

export async function getConsentRecord(clientId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("consent_records")
    .select("id, authorized_by, authorized_at, document_url, notes")
    .eq("client_id", clientId)
    .order("authorized_at", { ascending: false })
    .limit(1)
    .single() as {
      data: Pick<ConsentRow, "id" | "authorized_by" | "authorized_at" | "document_url" | "notes"> | null;
      error: unknown;
    };
  return data;
}

export async function hasConsent(clientId: string): Promise<boolean> {
  const supabase = await createSupabaseServerClient();
  const { count } = await supabase
    .from("consent_records")
    .select("id", { count: "exact", head: true })
    .eq("client_id", clientId);
  return (count ?? 0) > 0;
}
