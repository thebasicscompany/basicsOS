"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Badge,
  Tabs,
  TabsList,
  TabsTrigger,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  PageHeader,
  addToast,
  Loader2,
  Upload,
  FileUp,
  AlertCircle,
  ArrowLeft,
  CheckCircle,
} from "@basicsos/ui";
import { parseCsv } from "../utils/csvImport";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type EntityType = "contacts" | "companies";
type WizardStep = 1 | 2 | 3 | 4;

interface ParsedCsv {
  headers: string[];
  rows: Record<string, string>[];
}

const CONTACT_FIELDS = [
  { value: "name", label: "Name (required)" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "skip", label: "— Skip —" },
] as const;

const COMPANY_FIELDS = [
  { value: "name", label: "Name (required)" },
  { value: "domain", label: "Domain" },
  { value: "industry", label: "Industry" },
  { value: "skip", label: "— Skip —" },
] as const;

// ---------------------------------------------------------------------------
// Step 1 — Upload
// ---------------------------------------------------------------------------

interface StepUploadProps {
  entityType: EntityType;
  onEntityTypeChange: (t: EntityType) => void;
  onFileParsed: (data: ParsedCsv) => void;
}

function StepUpload({ entityType, onEntityTypeChange, onFileParsed }: StepUploadProps): JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = useCallback(
    (file: File) => {
      if (!file.name.endsWith(".csv")) {
        setError("Please upload a .csv file.");
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result;
        if (typeof text !== "string") {
          setError("Could not read file.");
          return;
        }
        const parsed = parseCsv(text);
        if (parsed.headers.length === 0) {
          setError("CSV appears to be empty or has only one row.");
          return;
        }
        setError(null);
        onFileParsed(parsed);
      };
      reader.readAsText(file);
    },
    [onFileParsed],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-sm text-stone-500 dark:text-stone-400 mb-4">
          Choose what type of records you want to import, then upload a CSV file.
        </p>
        <Tabs value={entityType} onValueChange={(v) => onEntityTypeChange(v as EntityType)}>
          <TabsList>
            <TabsTrigger value="contacts">Contacts</TabsTrigger>
            <TabsTrigger value="companies">Companies</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div
        role="button"
        tabIndex={0}
        aria-label="Drop CSV file here or click to browse"
        className={`flex flex-col items-center justify-center gap-4 rounded-lg border-2 border-dashed p-12 transition-colors cursor-pointer ${
          dragOver
            ? "border-primary bg-primary/5"
            : "border-stone-300 dark:border-stone-600 hover:border-stone-400 dark:hover:border-stone-500"
        }`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") inputRef.current?.click(); }}
      >
        <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-stone-100 dark:bg-stone-800">
          <FileUp className="size-7 text-stone-500 dark:text-stone-400" />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-stone-900 dark:text-stone-100">
            Drop your CSV here, or click to browse
          </p>
          <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
            Supports .csv files up to 500 rows
          </p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".csv"
          className="sr-only"
          onChange={handleInputChange}
        />
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-md bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          <AlertCircle className="size-4 shrink-0" />
          {error}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 2 — Map Columns
// ---------------------------------------------------------------------------

interface StepMapColumnsProps {
  entityType: EntityType;
  headers: string[];
  mapping: Record<string, string>;
  onMappingChange: (m: Record<string, string>) => void;
  onBack: () => void;
  onNext: () => void;
}

function StepMapColumns({
  entityType,
  headers,
  mapping,
  onMappingChange,
  onBack,
  onNext,
}: StepMapColumnsProps): JSX.Element {
  const fields = entityType === "contacts" ? CONTACT_FIELDS : COMPANY_FIELDS;
  const nameIsMapped = Object.values(mapping).includes("name");

  const handleChange = (header: string, value: string) => {
    onMappingChange({ ...mapping, [header]: value });
  };

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-stone-500 dark:text-stone-400">
        Map each CSV column to a CRM field. The <strong>Name</strong> field is required.
      </p>

      <div className="flex flex-col gap-3">
        {headers.map((header) => (
          <div key={header} className="flex items-center gap-4">
            <div className="w-48 shrink-0">
              <Badge variant="outline" className="font-mono text-xs">
                {header}
              </Badge>
            </div>
            <div className="flex-1">
              <Select
                value={mapping[header] ?? "skip"}
                onValueChange={(v) => handleChange(header, v)}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="Select field..." />
                </SelectTrigger>
                <SelectContent>
                  {fields.map((f) => (
                    <SelectItem key={f.value} value={f.value}>
                      {f.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        ))}
      </div>

      {!nameIsMapped && (
        <div className="flex items-center gap-2 rounded-md bg-amber-50 dark:bg-amber-900/20 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
          <AlertCircle className="size-4 shrink-0" />
          Map at least one column to <strong className="ml-1">Name</strong> before continuing.
        </div>
      )}

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="mr-1.5 size-4" />
          Back
        </Button>
        <Button onClick={onNext} disabled={!nameIsMapped}>
          Next
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 3 — Preview
// ---------------------------------------------------------------------------

interface StepPreviewProps {
  entityType: EntityType;
  rows: Record<string, string>[];
  mapping: Record<string, string>;
  onBack: () => void;
  onImport: () => void;
  isImporting: boolean;
}

function buildMappedRow(
  row: Record<string, string>,
  mapping: Record<string, string>,
): Record<string, string> {
  const mapped: Record<string, string> = {};
  for (const [header, field] of Object.entries(mapping)) {
    if (field !== "skip" && field !== "") {
      const val = row[header];
      if (val !== undefined) mapped[field] = val;
    }
  }
  return mapped;
}

function StepPreview({
  entityType,
  rows,
  mapping,
  onBack,
  onImport,
  isImporting,
}: StepPreviewProps): JSX.Element {
  const previewRows = rows.slice(0, 5);
  const mappedFields = [...new Set(Object.values(mapping).filter((f) => f !== "skip" && f !== ""))];

  const entityLabel = entityType === "contacts" ? "contact" : "company";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <p className="text-sm text-stone-500 dark:text-stone-400">
          Previewing the first {Math.min(5, rows.length)} of{" "}
          <strong className="text-stone-900 dark:text-stone-100">{rows.length}</strong>{" "}
          {entityLabel}
          {rows.length === 1 ? "" : "s"} to import.
        </p>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {mappedFields.map((f) => (
                <TableHead key={f} className="capitalize">
                  {f}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {previewRows.map((row, i) => {
              const mapped = buildMappedRow(row, mapping);
              return (
                <TableRow key={i}>
                  {mappedFields.map((f) => (
                    <TableCell key={f} className="text-sm text-stone-700 dark:text-stone-300">
                      {mapped[f] ?? <span className="text-stone-400">—</span>}
                    </TableCell>
                  ))}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {rows.length > 5 && (
        <p className="text-xs text-stone-500 dark:text-stone-400">
          + {rows.length - 5} more rows not shown
        </p>
      )}

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack} disabled={isImporting}>
          <ArrowLeft className="mr-1.5 size-4" />
          Back
        </Button>
        <Button onClick={onImport} disabled={isImporting}>
          {isImporting ? (
            <>
              <Loader2 className="mr-1.5 size-4 animate-spin" />
              Importing…
            </>
          ) : (
            <>
              <Upload className="mr-1.5 size-4" />
              Import {rows.length} {entityLabel}
              {rows.length === 1 ? "" : "s"}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 4 — Results
// ---------------------------------------------------------------------------

interface StepResultsProps {
  entityType: EntityType;
  importedCount: number | null;
  error: string | null;
}

function StepResults({ entityType, importedCount, error }: StepResultsProps): JSX.Element {
  const router = useRouter();
  const listHref = entityType === "contacts" ? "/crm?view=contacts" : "/crm?view=companies";

  if (error) {
    return (
      <div className="flex flex-col items-center gap-6 py-8 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
          <AlertCircle className="size-8 text-red-600 dark:text-red-400" />
        </div>
        <div>
          <p className="text-base font-semibold text-stone-900 dark:text-stone-100">Import failed</p>
          <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">{error}</p>
        </div>
        <Button variant="outline" onClick={() => router.push(listHref)}>
          Back to CRM
        </Button>
      </div>
    );
  }

  if (importedCount === null) {
    return (
      <div className="flex flex-col items-center gap-4 py-12">
        <Loader2 className="size-8 animate-spin text-stone-400" />
        <p className="text-sm text-stone-500 dark:text-stone-400">Importing records…</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-6 py-8 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
        <CheckCircle className="size-8 text-emerald-600 dark:text-emerald-400" />
      </div>
      <div>
        <p className="text-base font-semibold text-stone-900 dark:text-stone-100">
          Imported {importedCount} record{importedCount === 1 ? "" : "s"}
        </p>
        <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
          Your {entityType} have been added to the CRM.
        </p>
      </div>
      <Button onClick={() => router.push(listHref)}>
        View {entityType}
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main wizard
// ---------------------------------------------------------------------------

const STEP_LABELS: Record<WizardStep, string> = {
  1: "Upload",
  2: "Map Columns",
  3: "Preview",
  4: "Done",
};

function buildDefaultMapping(headers: string[], entityType: EntityType): Record<string, string> {
  const fieldNames =
    entityType === "contacts" ? ["name", "email", "phone"] : ["name", "domain", "industry"];
  const mapping: Record<string, string> = {};
  for (const header of headers) {
    const normalized = header.toLowerCase().replace(/\s+/g, "");
    const matched = fieldNames.find((f) => normalized.includes(f));
    mapping[header] = matched ?? "skip";
  }
  return mapping;
}

const ImportPage = (): JSX.Element => {
  const [step, setStep] = useState<WizardStep>(1);
  const [entityType, setEntityType] = useState<EntityType>("contacts");
  const [csvData, setCsvData] = useState<ParsedCsv | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [importedCount, setImportedCount] = useState<number | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const importContacts = trpc.crm.contacts.import.useMutation({
    onSuccess: (result) => {
      setImportedCount(result.imported);
      addToast({
        title: `Imported ${result.imported} contact${result.imported === 1 ? "" : "s"}`,
        variant: "success",
      });
    },
    onError: (err) => {
      setImportError(err.message);
      addToast({ title: "Import failed", description: err.message, variant: "destructive" });
    },
  });

  const importCompanies = trpc.crm.companies.import.useMutation({
    onSuccess: (result) => {
      setImportedCount(result.imported);
      addToast({
        title: `Imported ${result.imported} compan${result.imported === 1 ? "y" : "ies"}`,
        variant: "success",
      });
    },
    onError: (err) => {
      setImportError(err.message);
      addToast({ title: "Import failed", description: err.message, variant: "destructive" });
    },
  });

  const handleFileParsed = (data: ParsedCsv) => {
    setCsvData(data);
    setMapping(buildDefaultMapping(data.headers, entityType));
    setStep(2);
  };

  const handleEntityTypeChange = (t: EntityType) => {
    setEntityType(t);
    if (csvData) {
      setMapping(buildDefaultMapping(csvData.headers, t));
    }
  };

  const handleImport = useCallback(() => {
    if (!csvData) return;
    setStep(4);
    setImportedCount(null);
    setImportError(null);

    const filteredRows = csvData.rows
      .map((row) => buildMappedRow(row, mapping))
      .filter((r): r is Record<string, string> & { name: string } => Boolean(r["name"]));

    if (entityType === "contacts") {
      importContacts.mutate({
        rows: filteredRows.map((r) => {
          const row: { name: string; email?: string; phone?: string } = { name: r.name };
          const email = r["email"];
          const phone = r["phone"];
          if (email) row.email = email;
          if (phone) row.phone = phone;
          return row;
        }),
      });
    } else {
      importCompanies.mutate({
        rows: filteredRows.map((r) => {
          const row: { name: string; domain?: string; industry?: string } = { name: r.name };
          const domain = r["domain"];
          const industry = r["industry"];
          if (domain) row.domain = domain;
          if (industry) row.industry = industry;
          return row;
        }),
      });
    }
  }, [csvData, entityType, mapping, importContacts, importCompanies]);

  const isImporting = importContacts.isPending || importCompanies.isPending;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Import Records"
        description="Bulk-import contacts or companies from a CSV file."
        backHref="/crm"
        backLabel="CRM"
      />

      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {([1, 2, 3, 4] as WizardStep[]).map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${
                step === s
                  ? "bg-primary text-primary-foreground"
                  : step > s
                    ? "bg-emerald-500 text-white"
                    : "bg-stone-200 dark:bg-stone-700 text-stone-500 dark:text-stone-400"
              }`}
            >
              {step > s ? <CheckCircle className="size-3.5" /> : s}
            </div>
            <span
              className={`text-sm ${
                step === s
                  ? "font-medium text-stone-900 dark:text-stone-100"
                  : "text-stone-500 dark:text-stone-400"
              }`}
            >
              {STEP_LABELS[s]}
            </span>
            {s < 4 && (
              <div className="mx-1 h-px w-8 bg-stone-200 dark:bg-stone-700" />
            )}
          </div>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{STEP_LABELS[step]}</CardTitle>
        </CardHeader>
        <CardContent>
          {step === 1 && (
            <StepUpload
              entityType={entityType}
              onEntityTypeChange={handleEntityTypeChange}
              onFileParsed={handleFileParsed}
            />
          )}
          {step === 2 && csvData && (
            <StepMapColumns
              entityType={entityType}
              headers={csvData.headers}
              mapping={mapping}
              onMappingChange={setMapping}
              onBack={() => setStep(1)}
              onNext={() => setStep(3)}
            />
          )}
          {step === 3 && csvData && (
            <StepPreview
              entityType={entityType}
              rows={csvData.rows}
              mapping={mapping}
              onBack={() => setStep(2)}
              onImport={handleImport}
              isImporting={isImporting}
            />
          )}
          {step === 4 && (
            <StepResults
              entityType={entityType}
              importedCount={importedCount}
              error={importError}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ImportPage;
