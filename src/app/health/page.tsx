import { createGlobalEvolutionClient } from "@/lib/evolution";
import Sidebar from "@/components/layout/Sidebar";
import TopBar from "@/components/layout/TopBar";
import Footer from "@/components/layout/Footer";

export const dynamic = "force-dynamic";

interface InstanceInfo {
  name: string;
  state: string;
}

async function getHealthData(): Promise<{
  connected: boolean;
  totalInstances: number;
  openInstances: number;
  instances: InstanceInfo[];
  error?: string;
  latencyMs?: number;
}> {
  const t0 = Date.now();
  try {
    const client = createGlobalEvolutionClient();
    const instances = await client.fetchInstances();
    const openInstances = instances.filter((i) => i.instance.state === "open");
    return {
      connected: true,
      totalInstances: instances.length,
      openInstances: openInstances.length,
      latencyMs: Date.now() - t0,
      instances: instances.map((i) => ({
        name: i.instance.instanceName,
        state: i.instance.state,
      })),
    };
  } catch (err) {
    return {
      connected: false,
      totalInstances: 0,
      openInstances: 0,
      instances: [],
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

function StateChip({ state }: { state: string }) {
  const color =
    state === "open"
      ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
      : state === "connecting"
      ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
      : "bg-red-500/15 text-red-400 border-red-500/30";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-body ${color}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${state === "open" ? "bg-emerald-400" : state === "connecting" ? "bg-amber-400" : "bg-red-400"}`} />
      {state}
    </span>
  );
}

export default async function HealthPage() {
  const health = await getHealthData();

  return (
    <div className="flex min-h-screen md:h-screen md:overflow-hidden bg-g6-bg">
      <Sidebar />
      <div className="flex flex-1 flex-col md:overflow-hidden">
        <TopBar title="API Health" />
        <main className="flex-1 overflow-y-auto px-4 py-4 md:px-6 md:py-6 pb-20 md:pb-6 space-y-6">

          {/* Status banner */}
          <div className={`rounded-xl border p-4 flex items-center gap-3 ${
            health.connected
              ? "border-emerald-500/30 bg-emerald-500/5"
              : "border-red-500/30 bg-red-500/10"
          }`}>
            <span className={`h-3 w-3 rounded-full flex-shrink-0 ${health.connected ? "bg-emerald-400" : "bg-red-400"}`} />
            <div className="flex-1">
              <p className={`font-heading text-sm font-semibold ${health.connected ? "text-emerald-400" : "text-red-400"}`}>
                Evolution API {health.connected ? "connected" : "unreachable"}
              </p>
              {health.connected && (
                <p className="font-body text-xs text-gray-500 mt-0.5">
                  {health.openInstances}/{health.totalInstances} instances open
                  {health.latencyMs != null ? ` · ${health.latencyMs}ms` : ""}
                </p>
              )}
              {!health.connected && health.error && (
                <p className="font-body text-xs text-gray-400 mt-0.5">{health.error}</p>
              )}
            </div>
          </div>

          {/* Instance table */}
          {health.instances.length > 0 && (
            <div>
              <h2 className="font-heading text-base font-semibold text-white mb-3">Instances</h2>
              <div className="rounded-xl border border-g6-border overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-g6-border bg-g6-surface">
                      <th className="px-4 py-2.5 text-left font-heading text-xs text-gray-400">Instance</th>
                      <th className="px-4 py-2.5 text-left font-heading text-xs text-gray-400">State</th>
                    </tr>
                  </thead>
                  <tbody>
                    {health.instances.map((inst) => (
                      <tr key={inst.name} className="border-b border-g6-border/50 last:border-0">
                        <td className="px-4 py-3 font-body text-white">{inst.name}</td>
                        <td className="px-4 py-3">
                          <StateChip state={inst.state} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* No instances */}
          {health.connected && health.instances.length === 0 && (
            <p className="font-body text-sm text-gray-500">No instances found on this Evolution server.</p>
          )}

          {/* Troubleshooting when disconnected */}
          {!health.connected && (
            <div className="rounded-xl border border-g6-border bg-g6-surface p-4 space-y-2">
              <p className="font-heading text-sm font-semibold text-white">Troubleshooting</p>
              <ul className="font-body text-sm text-gray-400 space-y-1 list-disc list-inside">
                <li>Verify <code className="text-gray-300">EVOLUTION_API_URL</code> in your environment variables</li>
                <li>Verify <code className="text-gray-300">EVOLUTION_API_KEY</code> matches your Evolution server</li>
                <li>Ensure the Evolution API server is running and reachable from Vercel</li>
              </ul>
            </div>
          )}

          <p className="font-body text-xs text-gray-600">
            Page refreshed on each load. Results reflect current Evolution API state.
          </p>
        </main>
        <Footer />
      </div>
    </div>
  );
}
