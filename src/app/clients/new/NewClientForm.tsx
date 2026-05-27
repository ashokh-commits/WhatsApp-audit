"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/actions/clients";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Card, { CardTitle } from "@/components/ui/Card";

export default function NewClientForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const form = e.currentTarget;
    const formData = new FormData(form);
    const result = await createClient(formData);
    if (result.error) {
      setError(result.error);
      setLoading(false);
    } else {
      router.push(`/consent/${result.clientId}`);
    }
  }

  return (
    <Card>
      <CardTitle className="mb-6">New Client</CardTitle>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          id="name"
          name="name"
          label="Client Name"
          placeholder="e.g. Glow Medispa"
          required
        />
        <Input
          id="instance_name"
          name="instance_name"
          label="Evolution Instance Name"
          placeholder="e.g. glow-medispa-wa"
          required
        />
        <div className="space-y-1">
          <label htmlFor="instance_key" className="block text-sm font-medium text-gray-300 font-body">
            Instance API Key
          </label>
          <input
            id="instance_key"
            name="instance_key"
            type="password"
            autoComplete="off"
            required
            placeholder="Paste instance key (stored encrypted)"
            className="w-full rounded-md border border-g6-border bg-g6-surface px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-g6-accent focus:outline-none focus:ring-1 focus:ring-g6-accent"
          />
          <p className="text-xs text-gray-500 font-body">
            Encrypted at rest with AES-256-GCM. Never stored in plaintext.
          </p>
        </div>

        {error && (
          <p className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-400 border border-red-500/20">
            {error}
          </p>
        )}

        <div className="flex gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" loading={loading} className="flex-1">
            Save & Record Consent →
          </Button>
        </div>
      </form>
    </Card>
  );
}
