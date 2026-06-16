import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { queryOne } from "@/lib/db";
import type { Database } from "@/types/database";

type AuditRow = Database["public"]["Tables"]["audits"]["Row"];
type ClientRow = Database["public"]["Tables"]["clients"]["Row"];

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const audit = await queryOne<AuditRow>(
    `SELECT id, client_id, overall_score, dimension_scores, metrics, status FROM audits WHERE id = $1`,
    [params.id]
  );

  if (!audit) {
    return NextResponse.json({ error: "Audit not found" }, { status: 404 });
  }
  if (audit.status !== "complete") {
    return NextResponse.json({ error: "Audit not complete" }, { status: 400 });
  }

  const client = await queryOne<Pick<ClientRow, "name" | "avg_ticket_value">>(
    `SELECT name, avg_ticket_value FROM clients WHERE id = $1`,
    [audit.client_id]
  );

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "OPENAI_API_KEY not configured" }, { status: 500 });
  }

  const metrics = audit.metrics as Record<string, unknown> | null;
  const dims = audit.dimension_scores as Record<string, unknown> | null;
  const bizProfile = metrics?.businessProfile as Record<string, unknown> | null;

  // Build a context summary for the prompt
  const context = {
    businessName: client?.name ?? "Unknown Business",
    avgTicketValue: Number(client?.avg_ticket_value ?? 0),
    overallScore: audit.overall_score,
    // Business profile from WhatsApp
    whatsappProfile: {
      description: bizProfile?.description ?? null,
      category: bizProfile?.category ?? null,
      address: bizProfile?.address ?? null,
      email: bizProfile?.email ?? null,
      websites: bizProfile?.websites ?? null,
      businessHours: bizProfile?.businessHours ?? null,
    },
    // Conversation metrics
    conversations: {
      totalChats: metrics?.chatCount ?? 0,
      windowDays: metrics?.windowDays ?? 30,
      bookingIntentCount: metrics?.bookingIntentCount ?? 0,
      confirmedCount: metrics?.confirmedCount ?? 0,
      businessGhostCount: metrics?.businessGhostCount ?? 0,
      priceDropoffCount: metrics?.priceDropoffCount ?? 0,
      postIntentDropoffCount: metrics?.postIntentDropoffCount ?? 0,
      engagedThenGhostedCount: metrics?.engagedThenGhostedCount ?? 0,
    },
    // Peak activity hours (0-23 index)
    peakHours: (() => {
      const hourly = metrics?.hourlyActivity as number[] | undefined;
      if (!hourly) return null;
      const max = Math.max(...hourly, 1);
      const threshold = max * 0.65;
      const peaks = hourly
        .map((v, h) => (v >= threshold && v > 0 ? h : -1))
        .filter((h) => h !== -1);
      return peaks;
    })(),
    // Dimension scores
    answerRateScore: (dims?.answerRate as Record<string, unknown> | null)?.score ?? null,
    responseTimeScore: (dims?.responseTime as Record<string, unknown> | null)?.score ?? null,
  };

  const systemPrompt = `You are an AI assistant that analyses WhatsApp Business conversation data to generate chatbot configuration settings for a business.
You produce concise, practical settings that reflect the business's actual behaviour and communication patterns.
Always respond with valid JSON only — no markdown, no explanation.`;

  const userPrompt = `Based on this WhatsApp audit data for a business, generate 4 AI chatbot settings sections.

AUDIT DATA:
${JSON.stringify(context, null, 2)}

Generate a JSON object with exactly these 4 keys:
1. "identityAndPersona" - Who is the assistant? Include: a friendly name that fits the business, their role, and a natural first greeting (2-3 sentences). Infer industry from the business category/description. Keep it warm but professional.

2. "conversationalStyle" - Tone, language, message length, emoji guidance (2-3 sentences). Infer language from the business name and WhatsApp description (Malaysian businesses often use English + Malay). Keep replies short (2-3 lines) mirroring WhatsApp norms. If price discussions had high drop-off, note to handle pricing carefully.

3. "businessDetails" - Facts the AI can reference: business name, category, address, email, website, hours (from the WhatsApp profile). Format as bullet points. Only include fields that have data. Add a note about average ticket value if > 0.

4. "instructionsAndRules" - What the AI must and must not do. Base rules on the drop-off patterns:
  - If priceDropoffCount > 3: "Do not quote prices directly — say the team will follow up with a custom quote"
  - If businessGhostCount > 5: "Always respond within the conversation — never leave a customer's question unanswered"
  - If postIntentDropoffCount > 3: "When a customer shows booking intent, immediately collect their name and preferred time"
  - Always include: escalation rule (hand off to human for complaints), name collection early, and no medical/legal advice.
  Write as clear, actionable bullet points.

Return ONLY the JSON object.`;

  try {
    const openai = new OpenAI({ apiKey });
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.4,
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    const result = JSON.parse(raw);

    return NextResponse.json({
      identityAndPersona: result.identityAndPersona ?? "",
      conversationalStyle: result.conversationalStyle ?? "",
      businessDetails: result.businessDetails ?? "",
      instructionsAndRules: result.instructionsAndRules ?? "",
    });
  } catch (err) {
    console.error("OpenAI ai-settings error:", err);
    return NextResponse.json({ error: "Failed to generate settings" }, { status: 500 });
  }
}
