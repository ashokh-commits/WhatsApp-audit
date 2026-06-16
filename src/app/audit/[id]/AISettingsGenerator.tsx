"use client";

import { useState } from "react";
import Card, { CardTitle } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Spinner from "@/components/ui/Spinner";

interface AISettings {
  identityAndPersona: string;
  conversationalStyle: string;
  businessDetails: string;
  instructionsAndRules: string;
}

const SECTIONS: { key: keyof AISettings; label: string; sub: string }[] = [
  {
    key: "identityAndPersona",
    label: "Identity & Persona",
    sub: "Who is the assistant? Name, role, first greeting.",
  },
  {
    key: "conversationalStyle",
    label: "Conversational Style",
    sub: "Tone, language rules, message length, emoji usage.",
  },
  {
    key: "businessDetails",
    label: "Business Details",
    sub: "Address, hours, services, prices — facts the AI may quote.",
  },
  {
    key: "instructionsAndRules",
    label: "Instructions & Rules",
    sub: "What the AI must and must not do. Escalation, forbidden topics.",
  },
];

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      onClick={handleCopy}
      className="shrink-0 rounded-md px-2.5 py-1 font-body text-xs font-medium border border-g6-border text-gray-400 hover:text-white hover:border-gray-500 transition-colors"
    >
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}

function SettingSection({
  label,
  sub,
  value,
}: {
  label: string;
  sub: string;
  value: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-heading text-sm font-semibold text-white">{label}</p>
          <p className="font-body text-xs text-gray-500">{sub}</p>
        </div>
        <CopyButton text={value} />
      </div>
      <div className="rounded-lg bg-g6-surface border border-g6-border p-3">
        <p className="font-body text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">
          {value}
        </p>
      </div>
    </div>
  );
}

export default function AISettingsGenerator({ auditId }: { auditId: string }) {
  const [settings, setSettings] = useState<AISettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/audit/${auditId}/ai-settings`, {
        method: "POST",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Request failed");
      }
      const data: AISettings = await res.json();
      setSettings(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <CardTitle>AI Chatbot Settings</CardTitle>
          <p className="font-body text-xs text-gray-500 mt-0.5">
            Generate ready-to-paste settings for your GChat AI assistant based on this audit
          </p>
        </div>
        <Button
          onClick={generate}
          disabled={loading}
          className="shrink-0 flex items-center gap-2"
        >
          {loading && <Spinner className="w-4 h-4" />}
          {loading ? "Generating…" : settings ? "Regenerate" : "Generate AI Settings"}
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2">
          <p className="font-body text-sm text-red-400">{error}</p>
        </div>
      )}

      {settings && (
        <div className="flex flex-col gap-5 divide-y divide-g6-border">
          {SECTIONS.map(({ key, label, sub }) => (
            <div key={key} className="pt-5 first:pt-0">
              <SettingSection label={label} sub={sub} value={settings[key]} />
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
