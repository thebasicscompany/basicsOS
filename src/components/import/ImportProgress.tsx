import { CheckCircleIcon, WarningIcon } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { executeImport } from "@/hooks/use-import-execute";
import type { ImportState } from "@/hooks/use-import";
import type { ImportResult } from "@/hooks/use-import-execute";

export interface ImportProgressProps {
  state: ImportState;
  onBack: () => void;
  onDone: () => void;
}

export function ImportProgress({ state, onBack, onDone }: ImportProgressProps) {
  const qc = useQueryClient();
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const parsed = state.parsed;
    if (!parsed || result !== null) return;
    let cancelled = false;
    (async () => {
      try {
        setProgress(10);
        const res = await executeImport(
          state.objectSlug,
          parsed,
          state.mapping,
          state.customFieldNames,
          state.mergeKey,
          state.conflictBehavior,
        );
        if (!cancelled) {
          setResult(res);
          setProgress(100);
          qc.invalidateQueries({ queryKey: ["records", state.objectSlug] });
          qc.invalidateQueries({ queryKey: ["object-config"] });
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Import failed");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    state.objectSlug,
    state.parsed,
    state.mapping,
    state.customFieldNames,
    state.mergeKey,
    state.conflictBehavior,
    result,
    qc,
  ]);

  if (error) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2 text-destructive">
          <WarningIcon className="size-5" />
          <span className="font-medium">Import failed</span>
        </div>
        <p className="text-sm text-muted-foreground">{error}</p>
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
      </div>
    );
  }

  if (result) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-2 text-green-600">
          <CheckCircleIcon className="size-5" />
          <span className="font-medium">Import complete</span>
        </div>
        <div className="flex flex-wrap gap-4 text-[13px]">
          <span className="text-muted-foreground">
            Created:{" "}
            <span className="font-medium text-foreground">
              {result.created}
            </span>
          </span>
          <span className="text-muted-foreground">
            Updated:{" "}
            <span className="font-medium text-foreground">
              {result.updated}
            </span>
          </span>
          <span className="text-muted-foreground">
            Skipped:{" "}
            <span className="font-medium text-foreground">
              {result.skipped}
            </span>
          </span>
          {result.errors.length > 0 && (
            <span className="text-destructive">
              Errors:{" "}
              <span className="font-medium">{result.errors.length}</span>
            </span>
          )}
        </div>
        {result.errors.length > 0 && (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3">
            <p className="text-[12px] font-medium text-destructive mb-2">
              Errors:
            </p>
            <ul className="text-[12px] text-muted-foreground list-disc list-inside max-h-32 overflow-y-auto">
              {result.errors.slice(0, 20).map((e, i) => (
                <li key={i}>
                  Row {e.row}: {e.message}
                </li>
              ))}
              {result.errors.length > 20 && (
                <li>... and {result.errors.length - 20} more</li>
              )}
            </ul>
          </div>
        )}
        <Button onClick={onDone}>Done</Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[13px] font-medium">Importing...</p>
      <Progress value={progress} className="h-2" />
      <p className="text-[12px] text-muted-foreground">
        Processing {state.parsed?.rows.length ?? 0} rows
      </p>
    </div>
  );
}
