import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeftIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { fetchApi } from "@/lib/api";
import * as crmApi from "@/lib/api/crm";
import {
  inferGridFields,
  type InferredField,
  type ParsedCSV,
} from "@/components/import/import-utils";

const FIELD_TYPES = [
  { value: "text", label: "Text" },
  { value: "long-text", label: "Long Text" },
  { value: "number", label: "Number" },
  { value: "currency", label: "Currency" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "date", label: "Date" },
  { value: "checkbox", label: "Checkbox" },
  { value: "select", label: "Select" },
] as const;

const BULK_CHUNK = 250;

export interface ImportNewGridProps {
  parsed: ParsedCSV;
  onBack: () => void;
  onDone: () => void;
}

/**
 * "Import as a new grid": derive a custom object from the CSV headers (with
 * inferred field types), create it via POST /api/object-config (which auto-
 * reloads the agent), then bulk-insert the rows. The chosen "name" column maps
 * to the object's built-in primary; every other column becomes a custom field.
 */
export function ImportNewGrid({ parsed, onBack, onDone }: ImportNewGridProps) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const inferred = useMemo(() => inferGridFields(parsed), [parsed]);

  const [gridName, setGridName] = useState("");
  const [fields, setFields] = useState<InferredField[]>(inferred);
  const [nameIndex, setNameIndex] = useState<number>(() => {
    const firstText = inferred.find((f) => f.fieldType === "text");
    return firstText ? firstText.index : (inferred[0]?.index ?? 0);
  });
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{
    created: number;
    errors: number;
    slug: string;
  } | null>(null);

  const setType = (index: number, fieldType: string) =>
    setFields((prev) =>
      prev.map((f) => (f.index === index ? { ...f, fieldType } : f)),
    );

  const handleCreate = async () => {
    const trimmed = gridName.trim();
    if (!trimmed) {
      toast.error("Give the grid a name");
      return;
    }
    setRunning(true);
    try {
      const singular = trimmed.replace(/s$/i, "") || trimmed;
      const apiFields = fields
        .filter((f) => f.index !== nameIndex)
        .map((f) => ({ name: f.name, label: f.label, fieldType: f.fieldType }));

      const created = await fetchApi<{ slug: string }>("/api/object-config", {
        method: "POST",
        body: JSON.stringify({
          singularName: singular,
          pluralName: trimmed,
          icon: "table",
          fields: apiFields,
        }),
      });
      const slug = created.slug;

      // name column → built-in name; other columns → folded into custom_fields server-side.
      const records = parsed.rows
        .map((row) => {
          const rec: Record<string, unknown> = {};
          const nameVal = row[nameIndex]?.trim();
          if (nameVal) rec.name = nameVal;
          for (const f of fields) {
            if (f.index === nameIndex) continue;
            const v = row[f.index]?.trim();
            if (v !== "" && v !== undefined) rec[f.name] = v;
          }
          return rec;
        })
        .filter((r) => Object.keys(r).length > 0);

      let createdCount = 0;
      let errCount = 0;
      for (let i = 0; i < records.length; i += BULK_CHUNK) {
        const res = await crmApi.bulkCreate(slug, records.slice(i, i + BULK_CHUNK));
        createdCount += res.created.length;
        errCount += res.errors.length;
      }

      qc.invalidateQueries({ queryKey: ["object-config"] });
      setResult({ created: createdCount, errors: errCount, slug });
      toast.success(
        `Created grid "${trimmed}" with ${createdCount} record${createdCount === 1 ? "" : "s"}`,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create grid");
    } finally {
      setRunning(false);
    }
  };

  if (result) {
    return (
      <div className="flex flex-col gap-4">
        <div className="rounded-md border p-4">
          <p className="text-sm font-medium">Grid created</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {result.created} record{result.created === 1 ? "" : "s"} imported
            {result.errors ? `, ${result.errors} failed` : ""}.
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => navigate(`/objects/${result.slug}`)}>
            Open grid
          </Button>
          <Button variant="outline" onClick={onDone}>
            Import another
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <Button variant="ghost" size="sm" className="w-fit" onClick={onBack}>
        <ArrowLeftIcon className="mr-1 size-4" />
        Back
      </Button>

      <div className="space-y-1.5">
        <Label htmlFor="grid-name">Grid name</Label>
        <Input
          id="grid-name"
          autoFocus
          placeholder="e.g. Leads"
          value={gridName}
          onChange={(e) => setGridName(e.target.value)}
          className="max-w-xs"
        />
      </div>

      <div className="space-y-2">
        <Label>
          Columns ({fields.length}) — pick the primary name column and field types
        </Label>
        <div className="space-y-2">
          {fields.map((f) => (
            <div
              key={f.index}
              className="flex items-center gap-3 rounded-md border p-2.5"
            >
              <span className="min-w-[140px] truncate text-[13px] font-medium">
                {f.header}
              </span>
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <input
                  type="radio"
                  name="namecol"
                  checked={nameIndex === f.index}
                  onChange={() => setNameIndex(f.index)}
                />
                Name
              </label>
              <div className="flex-1" />
              {nameIndex === f.index ? (
                <span className="pr-2 text-xs text-muted-foreground">
                  Primary (text)
                </span>
              ) : (
                <Select
                  value={f.fieldType}
                  onValueChange={(v) => setType(f.index, v)}
                >
                  <SelectTrigger className="h-8 w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent position="popper">
                    {FIELD_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between pt-1">
        <span className="text-[12px] text-muted-foreground">
          {parsed.rows.length} rows will be imported
        </span>
        <Button onClick={handleCreate} disabled={running || !gridName.trim()}>
          {running ? "Creating…" : "Create grid & import"}
        </Button>
      </div>
    </div>
  );
}
