import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Sidebar from "@/components/layout/Sidebar";
import TopBar from "@/components/layout/TopBar";
import Footer from "@/components/layout/Footer";
import ConsentForm from "./ConsentForm";
import Card, { CardTitle } from "@/components/ui/Card";
import type { Database } from "@/types/database";

interface Props {
  params: { clientId: string };
}

type ClientRow = Database["public"]["Tables"]["clients"]["Row"];
type ConsentRow = Database["public"]["Tables"]["consent_records"]["Row"];

async function getClientAndConsent(clientId: string) {
  const supabase = await createSupabaseServerClient();
  const { data: client } = await supabase
    .from("clients")
    .select("id, name")
    .eq("id", clientId)
    .single() as {
      data: Pick<ClientRow, "id" | "name"> | null;
      error: unknown;
    };

  const { data: consent } = await supabase
    .from("consent_records")
    .select("id, authorized_by, authorized_at, notes")
    .eq("client_id", clientId)
    .order("authorized_at", { ascending: false })
    .limit(1)
    .single() as {
      data: Pick<ConsentRow, "id" | "authorized_by" | "authorized_at" | "notes"> | null;
      error: unknown;
    };

  return { client, consent };
}

export default async function ConsentPage({ params }: Props) {
  const { clientId } = params;
  const { client, consent } = await getClientAndConsent(clientId);

  if (!client) redirect("/dashboard");

  return (
    <div className="flex h-screen overflow-hidden bg-g6-bg">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar title={`Consent — ${client.name}`} />
        <main className="flex-1 overflow-y-auto px-6 py-6">
          <div className="mx-auto max-w-lg space-y-6">
            {consent && (
              <Card className="border-emerald-500/30 bg-emerald-500/5">
                <CardTitle className="text-emerald-400 text-sm mb-2">
                  ✓ Consent on record
                </CardTitle>
                <p className="font-body text-sm text-gray-300">
                  Authorized by <strong>{consent.authorized_by}</strong> on{" "}
                  {new Date(consent.authorized_at).toLocaleDateString()}
                </p>
                {consent.notes && (
                  <p className="mt-1 font-body text-xs text-gray-400">{consent.notes}</p>
                )}
              </Card>
            )}

            <Card>
              <CardTitle className="mb-1">
                {consent ? "Update Consent Record" : "Record Client Consent"}
              </CardTitle>
              <p className="mb-6 font-body text-sm text-gray-400">
                Under Malaysia&apos;s PDPA 2010, you must obtain written authorization from the
                client before auditing their WhatsApp conversations. This record is mandatory.
              </p>
              <ConsentForm clientId={clientId} />
            </Card>
          </div>
        </main>
        <Footer />
      </div>
    </div>
  );
}
