import type {
  EvolutionInstance,
  EvolutionChat,
  EvolutionMessage,
  EvolutionReferral,
  EvolutionBusinessProfile,
  SanitizedMessage,
} from "@/types/evolution";

const ENDPOINTS = {
  FETCH_INSTANCES:   "/instance/fetchInstances",
  FIND_CHATS:        (i: string) => `/chat/findChats/${i}`,
  FIND_MESSAGES:     (i: string) => `/chat/findMessages/${i}`,
  FETCH_PROFILE:     (i: string) => `/chat/fetchProfile/${i}`,
  FETCH_BIZ_PROFILE: (i: string) => `/chat/fetchBusinessProfile/${i}`,
} as const;

const PAGE_LIMIT = 100;
const INTER_PAGE_DELAY_MS = 300;
const RATE_LIMIT_DELAY_MS = 300;
const REQUEST_TIMEOUT_MS = 15_000;
const MAX_RETRIES = 3;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function extractReferral(msg: EvolutionMessage): EvolutionReferral | null {
  const ctx =
    msg.message?.extendedTextMessage?.contextInfo ??
    msg.message?.imageMessage?.contextInfo ??
    msg.message?.videoMessage?.contextInfo ??
    null;
  return ctx?.referral ?? null;
}

function hasMedia(msg: EvolutionMessage): boolean {
  const mediaTypes = [
    "imageMessage",
    "videoMessage",
    "audioMessage",
    "documentMessage",
    "stickerMessage",
  ];
  return mediaTypes.some((t) => t in (msg.message ?? {}));
}

export function sanitizeMessages(messages: EvolutionMessage[]): SanitizedMessage[] {
  const storeRaw = process.env.STORE_RAW === "true";
  return messages.map((msg) => ({
    id:          msg.key.id,
    remoteJid:   msg.key.remoteJid,
    fromMe:      msg.key.fromMe,
    timestamp:   msg.messageTimestamp,
    messageType: Object.keys(msg.message ?? {})[0] ?? "unknown",
    referral:    extractReferral(msg),
    hasMedia:    hasMedia(msg),
    ...(storeRaw && {
      textSnippet:
        msg.message?.conversation ??
        msg.message?.extendedTextMessage?.text ??
        undefined,
    }),
  }));
}

export class EvolutionClient {
  private baseUrl: string;
  private apiKey: string;

  constructor(baseUrl: string, apiKey: string) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.apiKey = apiKey;
  }

  private async request<T>(
    path: string,
    options: RequestInit = {},
    retries = 0
  ): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const res = await fetch(`${this.baseUrl}${path}`, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          apikey: this.apiKey,
          ...(options.headers ?? {}),
        },
        signal: controller.signal,
      });

      if (res.status === 429 && retries < MAX_RETRIES) {
        await delay(Math.pow(2, retries + 1) * 1000);
        return this.request<T>(path, options, retries + 1);
      }

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`Evolution API ${res.status}: ${path} — ${body}`);
      }

      return res.json() as Promise<T>;
    } finally {
      clearTimeout(timeout);
    }
  }

  async fetchInstances(): Promise<EvolutionInstance[]> {
    const data = await this.request<EvolutionInstance[]>(
      ENDPOINTS.FETCH_INSTANCES
    );
    return Array.isArray(data) ? data : [];
  }

  async findChats(instanceName: string): Promise<EvolutionChat[]> {
    const data = await this.request<EvolutionChat[] | { chats?: EvolutionChat[] }>(
      ENDPOINTS.FIND_CHATS(instanceName)
    );
    if (Array.isArray(data)) return data;
    return (data as { chats?: EvolutionChat[] }).chats ?? [];
  }

  async findMessages(
    instanceName: string,
    remoteJid: string,
    sinceTimestamp?: number
  ): Promise<EvolutionMessage[]> {
    const allMessages: EvolutionMessage[] = [];
    let page = 1;

    while (true) {
      const body: Record<string, unknown> = {
        where: {
          key: { remoteJid },
          ...(sinceTimestamp && {
            messageTimestamp: { $gte: sinceTimestamp },
          }),
        },
        limit: PAGE_LIMIT,
        page,
      };

      const data = await this.request<
        EvolutionMessage[] | { messages?: EvolutionMessage[] }
      >(ENDPOINTS.FIND_MESSAGES(instanceName), {
        method: "POST",
        body: JSON.stringify(body),
      });

      const msgs = Array.isArray(data)
        ? data
        : (data as { messages?: EvolutionMessage[] }).messages ?? [];

      allMessages.push(...msgs);

      if (msgs.length < PAGE_LIMIT) break;
      page++;
      await delay(INTER_PAGE_DELAY_MS);
    }

    return allMessages;
  }

  async fetchBusinessProfile(
    instanceName: string
  ): Promise<EvolutionBusinessProfile | null> {
    try {
      const data = await this.request<
        EvolutionBusinessProfile | { profile?: EvolutionBusinessProfile }
      >(ENDPOINTS.FETCH_BIZ_PROFILE(instanceName));
      if ("profile" in (data as Record<string, unknown>)) {
        return (data as { profile: EvolutionBusinessProfile }).profile;
      }
      return data as EvolutionBusinessProfile;
    } catch {
      return null;
    }
  }

  async verifyInstanceConnected(instanceName: string): Promise<boolean> {
    const instances = await this.fetchInstances();
    const found = instances.find(
      (inst) => inst.instance.instanceName === instanceName
    );
    if (!found) return false;
    if (found.instance.state !== "open") {
      console.warn(
        `Instance ${instanceName} is in state "${found.instance.state}" — skipping`
      );
      return false;
    }
    return true;
  }
}

export function createGlobalEvolutionClient(): EvolutionClient {
  const url = process.env.EVOLUTION_API_URL;
  const key = process.env.EVOLUTION_GLOBAL_KEY;
  if (!url || !key) {
    throw new Error(
      "EVOLUTION_API_URL and EVOLUTION_GLOBAL_KEY must be set"
    );
  }
  return new EvolutionClient(url, key);
}

export function createInstanceEvolutionClient(instanceKey: string): EvolutionClient {
  const url = process.env.EVOLUTION_API_URL;
  if (!url) throw new Error("EVOLUTION_API_URL must be set");
  return new EvolutionClient(url, instanceKey);
}

export { RATE_LIMIT_DELAY_MS };
