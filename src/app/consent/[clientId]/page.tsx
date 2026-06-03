import { queryOne } from "@/lib/db";
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
  const client = await queryOne<Pick<ClientRow, "id" | "name">>(
    `SELECT id, name FROM clients WHERE id = $1`,
    [clientId]
  );

  const consent = await queryOne<
    Pick<ConsentRow, "id" | "authorized_by" | "authorized_at" | "notes">
  >(
    `SELECT id, authorized_by, authorized_at, notes FROM consent_records
     WHERE client_id = $1 ORDER BY authorized_at DESC LIMIT 1`,
    [clientId]
  );

  return { client, consent };
}

export default async function ConsentPage({ params }: Props) {
  const { clientId } = params;
  const { client, consent } = await getClientAndConsent(clientId);

  if (!client) redirect("/dashboard");

  return (
    <div className="flex min-h-screen md:h-screen md:overflow-hidden bg-g6-bg">
      <Sidebar />
      <div className="flex flex-1 flex-col md:overflow-hidden">
        <TopBar title={`Consent — ${client.name}`} />
        <main className="flex-1 overflow-y-auto px-4 py-4 md:px-6 md:py-6 pb-20 md:pb-6">
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
