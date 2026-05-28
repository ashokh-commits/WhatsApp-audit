import { createSupabaseServerClient, createSupabaseAdminClient } from "@/lib/supabase/server";
import Sidebar from "@/components/layout/Sidebar";
import TopBar from "@/components/layout/TopBar";
import Footer from "@/components/layout/Footer";
import ClientCard from "./ClientCard";
import Link from "next/link";
import Button from "@/components/ui/Button";
import type { Database } from "@/types/database";

export const dynamic = "force-dynamic";

type ClientRow = Database["public"]["Tables"]["clients"]["Row"];
type AuditRow = Database["public"]["Tables"]["audits"]["Row"];

interface ClientWithLastAudit {
  id: string;
  name: string;
  instance_name: string;
  created_at: string;
  lastAudit: Pick<AuditRow, "id" | "overall_score" | "status" | "created_at"> | null;
  hasConsent: boolean;
}

async function getClientsWithAudits(): Promise<ClientWithLastAudit[]> {
  const supabase = await createSupabaseServerClient();
  const { data: clients, error } = await supabase
    .from("clients")
    .select("id, name, instance_name, created_at")
    .order("created_at", { ascending: false }) as {
      data: Array<Pick<ClientRow, "id" | "name" | "instance_name" | "created_at">> | null;
      error: unknown;
    };

  if (error || !clients) return [];

  const admin = createSupabaseAdminClient();

  return Promise.all(
    clients.map(async (client) => {
      const { data: lastAudit } = await admin
        .from("audits")
        .select("id, overall_score, status, created_at")
        .eq("client_id", client.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single() as {
          data: Pick<AuditRow, "id" | "overall_score" | "status" | "created_at"> | null;
          error: unknown;
        };

      const { count } = await admin
        .from("consent_records")
        .select("id", { count: "exact", head: true })
        .eq("client_id", client.id);

      return {
        id: client.id,
        name: client.name,
        instance_name: client.instance_name,
        created_at: client.created_at,
        lastAudit: lastAudit ?? null,
        hasConsent: (count ?? 0) > 0,
      };
    })
  );
}

export default async function DashboardPage() {
  const clients = await getClientsWithAudits();

  return (
    <div className="flex min-h-screen md:h-screen md:overflow-hidden bg-g6-bg">
      <Sidebar />
      <div className="flex flex-1 flex-col md:overflow-hidden">
        <TopBar title="Dashboard" />
        <main className="flex-1 overflow-y-auto px-4 py-4 md:px-6 md:py-6 pb-20 md:pb-6">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="font-heading text-xl font-bold text-white">Clients</h2>
            <Link href="/clients/new">
              <Button size="sm">+ Add Client</Button>
            </Link>
          </div>

          {clients.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-g6-border py-20 text-center">
              <p className="font-body text-gray-400">No clients yet.</p>
              <Link href="/clients/new" className="mt-4">
                <Button>Add your first client</Button>
              </Link>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {clients.map((client) => (
                <ClientCard key={client.id} client={client} />
              ))}
            </div>
          )}
        </main>
        <Footer />
      </div>
    </div>
  );
}
