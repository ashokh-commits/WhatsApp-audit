import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { queryOne } from "@/lib/db";
import { hasConsent } from "@/actions/consent";
import { runAuditJob } from "@/lib/auditJob";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const user = await getSession();
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

  const audit = await queryOne<{ id: string }>(
    `INSERT INTO audits (client_id, window_days, status, created_by)
     VALUES ($1, $2, 'pending', $3)
     RETURNING id`,
    [clientId, windowDays, user.id]
  );

  if (!audit) {
    return NextResponse.json({ error: "Failed to create audit" }, { status: 500 });
  }

  void runAuditJob(audit.id, clientId, windowDays).catch((err) =>
    console.error("Audit job error:", err)
  );

  return NextResponse.json({ auditId: audit.id }, { status: 202 });
}
