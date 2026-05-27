"use client";

import { useState } from "react";
import { parseSpreadsheet } from "@/lib/utils/parseSpreadsheet";
import { uploadMetaRows } from "@/actions/audit";
import type { ColumnMapping } from "@/types/ctwa";
import Card, { CardTitle } from "@/components/ui/Card";
import Button from "@/components/ui/Button";

type Step = "upload" | "preview" | "map" | "confirm";

const REQUIRED_FIELDS: Array<keyof ColumnMapping> = [
  "campaign_name",
  "adset_name",
  "ad_name",
  "spend",
  "impressions",
  "clicks",
  "results",
];

const FIELD_LABELS: Record<keyof ColumnMapping, string> = {
  campaign_name: "Campaign Name",
  adset_name:    "Ad Set Name",
  ad_name:       "Ad Name",
  spend:         "Amount Spent",
  impressions:   "Impressions",
  clicks:        "Clicks",
  results:       "Results",
};

export default function CTWAImportWizard() {
  const [step, setStep] = useState<Step>("upload");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Array<Record<string, string | number | null>>>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({
    campaign_name: null,
    adset_name:    null,
    ad_name:       null,
    spend:         null,
    impressions:   null,
    clicks:        null,
    results:       null,
  });
  const [auditId, setAuditId] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success?: boolean; rowCount?: number; error?: string } | null>(null);
  const [parseError, setParseError] = useState("");

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setParseError("");
    setLoading(true);
    try {
      const parsed = await parseSpreadsheet(file);
      setHeaders(parsed.headers);
      setRows(parsed.rows);
      setMapping(parsed.suggestedMapping);
      setStep("preview");
    } catch (err) {
      setParseError(err instanceof Error ? err.message : "Failed to parse file.");
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirm() {
    if (!auditId.trim()) {
      alert("Please enter an Audit ID to attach this data to.");
      return;
    }
    setLoading(true);
    const res = await uploadMetaRows(auditId.trim(), rows, mapping);
    setResult(res);
    setStep("confirm");
    setLoading(false);
  }

  if (step === "confirm") {
    return (
      <Card>
        {result?.success ? (
          <div className="text-center space-y-3">
            <p className="text-2xl">✓</p>
            <p className="font-heading text-white">Import successful</p>
            <p className="font-body text-sm text-gray-400">
              {result.rowCount} ad rows imported. Re-run the audit to update the Paid
              Conversation Performance score.
            </p>
            <Button onClick={() => { setStep("upload"); setResult(null); }}>
              Import another file
            </Button>
          </div>
        ) : (
          <div className="text-center space-y-3">
            <p className="font-heading text-red-400">Import failed</p>
            <p className="font-body text-sm text-gray-400">{result?.error}</p>
            <Button variant="secondary" onClick={() => setStep("map")}>
              Back
            </Button>
          </div>
        )}
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {step === "upload" && (
        <Card>
          <CardTitle className="mb-4">Step 1 — Upload File</CardTitle>
          <label className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-g6-border p-10 cursor-pointer hover:border-g6-accent transition-colors">
            <span className="font-body text-gray-400 text-sm">
              Drag & drop or click to upload
            </span>
            <span className="font-body text-xs text-gray-500 mt-1">.csv or .xlsx</span>
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleFile}
              className="hidden"
            />
          </label>
          {loading && <p className="mt-2 text-sm text-gray-400">Parsing file...</p>}
          {parseError && (
            <p className="mt-2 text-sm text-red-400">{parseError}</p>
          )}
        </Card>
      )}

      {step === "preview" && (
        <Card>
          <CardTitle className="mb-4">Step 2 — Preview ({rows.length} rows)</CardTitle>
          <div className="overflow-x-auto rounded-md border border-g6-border">
            <table className="min-w-full text-xs text-gray-300 font-body">
              <thead className="bg-g6-surface">
                <tr>
                  {headers.slice(0, 6).map((h) => (
                    <th key={h} className="px-3 py-2 text-left font-medium text-gray-400">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 5).map((row, i) => (
                  <tr key={i} className="border-t border-g6-border">
                    {headers.slice(0, 6).map((h) => (
                      <td key={h} className="px-3 py-2 truncate max-w-[120px]">
                        {String(row[h] ?? "")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex gap-3">
            <Button variant="secondary" onClick={() => setStep("upload")}>Back</Button>
            <Button onClick={() => setStep("map")} className="flex-1">
              Map Columns →
            </Button>
          </div>
        </Card>
      )}

      {step === "map" && (
        <Card>
          <CardTitle className="mb-4">Step 3 — Map Columns</CardTitle>
          <div className="space-y-3">
            {REQUIRED_FIELDS.map((field) => (
              <div key={field} className="flex items-center gap-3">
                <label className="w-40 text-sm font-body text-gray-300 shrink-0">
                  {FIELD_LABELS[field]}
                </label>
                <select
                  value={mapping[field] ?? ""}
                  onChange={(e) =>
                    setMapping((m) => ({
                      ...m,
                      [field]: e.target.value || null,
                    }))
                  }
                  className="flex-1 rounded border border-g6-border bg-g6-surface px-2 py-1.5 text-sm text-white focus:outline-none"
                >
                  <option value="">(skip)</option>
                  {headers.map((h) => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          <div className="mt-4 space-y-3">
            <div>
              <label className="block text-sm font-body text-gray-300 mb-1">
                Audit ID (from audit URL or dashboard)
              </label>
              <input
                value={auditId}
                onChange={(e) => setAuditId(e.target.value)}
                placeholder="e.g. 550e8400-e29b-41d4-a716-446655440000"
                className="w-full rounded border border-g6-border bg-g6-surface px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-g6-accent"
              />
            </div>
            <div className="flex gap-3">
              <Button variant="secondary" onClick={() => setStep("preview")}>Back</Button>
              <Button loading={loading} onClick={handleConfirm} className="flex-1">
                Import {rows.length} rows →
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
