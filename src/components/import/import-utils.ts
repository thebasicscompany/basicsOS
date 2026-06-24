import Papa from "papaparse";

export interface ParsedCSV {
  headers: string[];
  rows: string[][];
  errors: { row: number; message: string }[];
}

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
const MAX_ROWS = 2000;

/** Per-object CSV header aliases → schema field (camelCase) */
const CONTACT_HEADER_ALIASES: Record<string, string> = {
  "first name": "firstName",
  firstname: "firstName",
  first_name: "firstName",
  "last name": "lastName",
  lastname: "lastName",
  last_name: "lastName",
  email: "email",
  "e-mail": "email",
  linkedin: "linkedinUrl",
  "linkedin url": "linkedinUrl",
  linkedin_url: "linkedinUrl",
};

const COMPANY_HEADER_ALIASES: Record<string, string> = {
  name: "name",
  "company name": "name",
  company: "name",
  domain: "domain",
  website: "domain",
  url: "domain",
  description: "description",
  category: "category",
  sector: "category",
  industry: "category",
};

const DEAL_HEADER_ALIASES: Record<string, string> = {
  name: "name",
  "deal name": "name",
  status: "status",
  stage: "status",
  amount: "amount",
  value: "amount",
};

const ALIASES_BY_OBJECT: Record<string, Record<string, string>> = {
  contacts: CONTACT_HEADER_ALIASES,
  companies: COMPANY_HEADER_ALIASES,
  deals: DEAL_HEADER_ALIASES,
};

export function suggestColumnMapping(
  csvHeader: string,
  objectSlug: string,
): string | null {
  const normalized = csvHeader.trim().toLowerCase();
  const aliases = ALIASES_BY_OBJECT[objectSlug];
  return aliases?.[normalized] ?? null;
}

export function parseCSVFile(file: File): Promise<ParsedCSV> {
  return new Promise((resolve, reject) => {
    if (file.size > MAX_FILE_SIZE_BYTES) {
      reject(
        new Error(
          `File too large. Max size is ${MAX_FILE_SIZE_BYTES / 1024 / 1024}MB.`,
        ),
      );
      return;
    }

    Papa.parse(file, {
      skipEmptyLines: true,
      complete(result) {
        const errors: { row: number; message: string }[] = (
          result.errors ?? []
        ).map((e) => ({
          row: (e.row ?? 0) + 1,
          message: e.message ?? "Parse error",
        }));
        const rows = (result.data ?? []) as string[][];
        const headers = rows.length > 0 ? rows[0] : [];
        const dataRows = rows.slice(1);

        if (dataRows.length > MAX_ROWS) {
          errors.push({
            row: 0,
            message: `File has ${dataRows.length} rows. Max ${MAX_ROWS} rows per import.`,
          });
        }

        resolve({
          headers: headers.map((h) =>
            (typeof h === "string" ? h : String(h)).trim(),
          ),
          rows: dataRows,
          errors,
        });
      },
      error(err) {
        reject(new Error(err.message ?? "Failed to parse CSV"));
      },
    });
  });
}

function buildContactPayload(
  row: string[],
  mapping: Record<string, number>,
  customFieldNames: Set<string>,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  const customFields: Record<string, unknown> = {};

  for (const [targetCol, csvIndex] of Object.entries(mapping)) {
    const value = row[csvIndex]?.trim();
    if (value === "" || value === undefined) continue;

    if (customFieldNames.has(targetCol)) {
      customFields[targetCol] = value;
    } else if (targetCol === "email") {
      payload.email = value;
    } else {
      payload[targetCol] = value;
    }
  }

  if (Object.keys(customFields).length > 0) {
    payload.customFields = customFields;
  }

  return payload;
}

function buildCompanyPayload(
  row: string[],
  mapping: Record<string, number>,
  customFieldNames: Set<string>,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  const customFields: Record<string, unknown> = {};

  for (const [targetCol, csvIndex] of Object.entries(mapping)) {
    const value = row[csvIndex]?.trim();
    if (value === "" || value === undefined) continue;

    if (customFieldNames.has(targetCol)) {
      customFields[targetCol] = value;
    } else {
      payload[targetCol] = value;
    }
  }

  if (Object.keys(customFields).length > 0) {
    payload.customFields = customFields;
  }

  return payload;
}

function buildDealPayload(
  row: string[],
  mapping: Record<string, number>,
  customFieldNames: Set<string>,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  const customFields: Record<string, unknown> = {};

  for (const [targetCol, csvIndex] of Object.entries(mapping)) {
    const value = row[csvIndex]?.trim();
    if (value === "" || value === undefined) continue;

    if (customFieldNames.has(targetCol)) {
      customFields[targetCol] = value;
    } else if (targetCol === "amount") {
      const num = parseFloat(value.replace(/[^0-9.-]/g, ""));
      payload.amount = Number.isNaN(num) ? undefined : num;
    } else {
      payload[targetCol] = value;
    }
  }

  if (Object.keys(customFields).length > 0) {
    payload.customFields = customFields;
  }

  return payload;
}

export function buildImportPayload(
  objectSlug: string,
  row: string[],
  mapping: Record<string, number>,
  customFieldNames: Set<string>,
): Record<string, unknown> {
  switch (objectSlug) {
    case "contacts":
      return buildContactPayload(row, mapping, customFieldNames);
    case "companies":
      return buildCompanyPayload(row, mapping, customFieldNames);
    case "deals":
      return buildDealPayload(row, mapping, customFieldNames);
    default:
      // Custom objects: name → top-level; every other mapped column is folded
      // into custom_fields server-side (insertCustomRecord), so a flat payload is fine.
      return buildCompanyPayload(row, mapping, customFieldNames);
  }
}

// ── CSV → new grid: column-type inference ────────────────────────────────────

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NUMBER_RE = /^-?\$?\s*\d{1,3}(,\d{3})*(\.\d+)?\s*%?$|^-?\$?\s*\d+(\.\d+)?\s*%?$/;
const DATE_RE = /^\d{4}-\d{1,2}-\d{1,2}([ T]\d{2}:\d{2})?$|^\d{1,2}\/\d{1,2}\/\d{2,4}$/;
const BOOL_RE = /^(true|false|yes|no)$/i;

/** Infer a custom_field_defs fieldType from sampled CSV values. */
export function inferFieldType(samples: string[]): string {
  const vals = samples.map((s) => (s ?? "").trim()).filter((s) => s !== "");
  if (vals.length === 0) return "text";
  const every = (re: RegExp) => vals.every((v) => re.test(v));
  if (every(EMAIL_RE)) return "email";
  if (every(BOOL_RE)) return "checkbox";
  if (every(NUMBER_RE)) return "number";
  if (every(DATE_RE)) return "date";
  if (vals.some((v) => v.length > 80)) return "long-text";
  return "text";
}

/** Turn a CSV header into a safe snake_case field name. */
export function headerToFieldName(header: string): string {
  return (
    header
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "") || "field"
  );
}

export interface InferredField {
  /** original CSV header */
  header: string;
  /** CSV column index */
  index: number;
  /** snake_case field name (custom_field_defs.name) */
  name: string;
  /** human label */
  label: string;
  /** inferred field type */
  fieldType: string;
}

/** Derive grid fields (name + inferred type) from CSV headers + sampled rows. */
export function inferGridFields(parsed: ParsedCSV, sampleSize = 25): InferredField[] {
  const sample = parsed.rows.slice(0, sampleSize);
  return parsed.headers.map((header, index) => ({
    header,
    index,
    name: headerToFieldName(header),
    label: header || `Column ${index + 1}`,
    fieldType: inferFieldType(sample.map((r) => r[index] ?? "")),
  }));
}
