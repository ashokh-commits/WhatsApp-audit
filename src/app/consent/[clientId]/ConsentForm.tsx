"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { recordConsent } from "@/actions/consent";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

export default function ConsentForm({ clientId }: { clientId: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const form = e.currentTarget;
    const formData = new FormData(form);
    formData.set("client_id", clientId);
    const result = await recordConsent(formData);
    if (result.error) {
      setError(result.error);
      setLoading(false);
    } else {
      router.push("/dashboard");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        id="authorized_by"
        name="authorized_by"
        label="Authorized by (name / email of client contact)"
        placeholder="e.g. Farah Azman, clinic@example.com"
        required
      />
      <Input
        id="document_url"
        name="document_url"
        label="Consent document URL (optional)"
        placeholder="https://drive.google.com/..."
        type="url"
      />
      <div className="space-y-1">
        <label htmlFor="notes" className="block text-sm font-medium text-gray-300 font-body">
          Notes (optional)
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={3}
          placeholder="e.g. Verbal consent obtained via email on 27 May 2026"
          className="w-full rounded-md border border-g6-border bg-g6-surface px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-g6-accent focus:outline-none focus:ring-1 focus:ring-g6-accent"
        />
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
          Save Consent Record
        </Button>
      </div>
    </form>
  );
}
