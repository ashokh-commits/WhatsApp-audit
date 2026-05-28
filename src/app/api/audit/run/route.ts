import { NextRequest, NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { createSupabaseServerClient, createSupabaseAdminClient } from "@/lib/supabase/server";
import { hasConsent } from "@/actions/consent";
import { runAuditJob } from "@/lib/auditJob";
import type { Database } from "@/types/database";

export const maxDuration = 300;
export const runtime = "nodejs";

type AuditInsert = Database["public"]["Tables"]["audits"]["Insert"];

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json() as { clientId?: string; windowDays?: number };
  const { clientId, windowDays = 90 } = body;

  if (!clientId) {
    return NextResponse.json({ error: "clientId is required" }, { status: 400 });
  }

  const consentExists = await hasConsent(clientId);
  if (!consentExists) {
    return NextResponse.json(
      { error: "No consent record found for this client. Record consent before running an audit." },
      { status: 403 }
    );
  }

  const admin = createSupabaseAdminClient();
  const insert: AuditInsert = {
    client_id: clientId,
    window_days: windowDays,
    status: "pending",
    created_by: user.id,
  };

  const { data: audit, error } = await admin
    .from("audits")
    .insert(insert)
    .select("id")
    .single() as {
      data: { id: string } | null;
      error: { message: string } | null;
    };

  if (error || !audit) {
    return NextResponse.json({ error: error?.message ?? "Failed to create audit" }, { status: 500 });
  }

  waitUntil(
    runAuditJob(audit.id, clientId, windowDays).catch((err) =>
      console.error("Audit job error:", err)
    )
  );

  return NextResponse.json({ auditId: audit.id }, { status: 202 });
}
