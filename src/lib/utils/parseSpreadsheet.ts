import Papa from "papaparse";
import * as XLSX from "xlsx";
import type { ColumnMapping, ParsedSpreadsheetRow } from "@/types/ctwa";

export interface SpreadsheetParseResult {
  headers: string[];
  rows: Array<Record<string, string | number | null>>;
  suggestedMapping: ColumnMapping;
}

const COLUMN_HINTS: Record<keyof ColumnMapping, string[]> = {
  campaign_name: ["campaign name", "campaign"],
  adset_name:    ["ad set name", "adset name", "adset"],
  ad_name:       ["ad name", "advertisement name", "ad"],
  spend:         ["amount spent", "spend", "cost"],
  impressions:   ["impressions", "reach"],
  clicks:        ["link clicks", "clicks"],
  results:       ["results", "conversations", "leads", "messages"],
};

function detectColumn(headers: string[], hints: string[]): string | null {
  const normalized = headers.map((h) => h.toLowerCase().trim());
  for (const hint of hints) {
    const idx = normalized.findIndex((h) => h.includes(hint));
    if (idx !== -1) return headers[idx];
  }
  return null;
}

export function detectColumnMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {
    campaign_name: null,
    adset_name:    null,
    ad_name:       null,
    spend:         null,
    impressions:   null,
    clicks:        null,
    results:       null,
  };
  for (const key of Object.keys(mapping) as Array<keyof ColumnMapping>) {
    mapping[key] = detectColumn(headers, COLUMN_HINTS[key]);
  }
  return mapping;
}

function toNumber(val: unknown): number | null {
  if (val === null || val === undefined || val === "") return null;
  const n = Number(String(val).replace(/[^0-9.-]/g, ""));
  return isNaN(n) ? null : n;
}

export function applyMapping(
  rows: Array<Record<string, string | number | null>>,
  mapping: ColumnMapping
): ParsedSpreadsheetRow[] {
  return rows.map((row) => ({
    campaign_name: mapping.campaign_name ? String(row[mapping.campaign_name] ?? "") || null : null,
    adset_name:    mapping.adset_name    ? String(row[mapping.adset_name]    ?? "") || null : null,
    ad_name:       mapping.ad_name       ? String(row[mapping.ad_name]       ?? "") || null : null,
    spend:         mapping.spend         ? toNumber(row[mapping.spend])         : null,
    impressions:   mapping.impressions   ? toNumber(row[mapping.impressions])   : null,
    clicks:        mapping.clicks        ? toNumber(row[mapping.clicks])        : null,
    results:       mapping.results       ? toNumber(row[mapping.results])       : null,
    raw_row: row as Record<string, string | number | null>,
  }));
}

export async function parseCSV(file: File): Promise<SpreadsheetParseResult> {
  const text = await file.text();
  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
  });

  const headers = result.meta.fields ?? [];
  const rows = result.data as Array<Record<string, string | number | null>>;

  return {
    headers,
    rows: rows.slice(0, 500),
    suggestedMapping: detectColumnMapping(headers),
  };
}

export async function parseXLSX(file: File): Promise<SpreadsheetParseResult> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, {
    type: "buffer",
    cellFormula: false,
    cellHTML: false,
  });

  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  const rawData = XLSX.utils.sheet_to_json<Record<string, string | number | null>>(
    sheet,
    { defval: null }
  );

  if (rawData.length === 0) {
    return { headers: [], rows: [], suggestedMapping: detectColumnMapping([]) };
  }

  const headers = Object.keys(rawData[0]);
  return {
    headers,
    rows: rawData.slice(0, 500),
    suggestedMapping: detectColumnMapping(headers),
  };
}

export async function parseSpreadsheet(file: File): Promise<SpreadsheetParseResult> {
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ext === "csv") return parseCSV(file);
  if (ext === "xlsx" || ext === "xls") return parseXLSX(file);
  throw new Error(`Unsupported file type: .${ext}. Please upload a .csv or .xlsx file.`);
}
