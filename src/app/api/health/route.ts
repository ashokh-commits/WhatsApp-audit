import { NextResponse } from "next/server";
import { createGlobalEvolutionClient } from "@/lib/evolution";

export async function GET() {
  try {
    const client = createGlobalEvolutionClient();
    const instances = await client.fetchInstances();
    const openInstances = instances.filter(
      (i) => i.instance.state === "open"
    );
    return NextResponse.json({
      connected: true,
      totalInstances: instances.length,
      openInstances: openInstances.length,
      instances: instances.map((i) => ({
        name: i.instance.instanceName,
        state: i.instance.state,
      })),
    });
  } catch (err) {
    return NextResponse.json(
      {
        connected: false,
        error: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 503 }
    );
  }
}
