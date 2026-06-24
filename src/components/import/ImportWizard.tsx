import { ArrowLeftIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { ImportColumnMapper } from "@/components/import/ImportColumnMapper";
import { ImportFileDropzone } from "@/components/import/ImportFileDropzone";
import { ImportMergeOptions } from "@/components/import/ImportMergeOptions";
import {
  ImportObjectSelector,
  NEW_GRID_VALUE,
} from "@/components/import/ImportObjectSelector";
import { ImportNewGrid } from "@/components/import/ImportNewGrid";
import { ImportPreviewTable } from "@/components/import/ImportPreviewTable";
import { ImportProgress } from "@/components/import/ImportProgress";
import type { ParsedCSV } from "@/components/import/import-utils";
import { useImport } from "@/hooks/use-import";
import { toast } from "sonner";

export function ImportWizard({
  initialObjectSlug,
  onComplete,
}: {
  initialObjectSlug?: string;
  /** fired when the user finishes the import (lets a host dialog close itself) */
  onComplete?: () => void;
} = {}) {
  const {
    state,
    setParsed,
    setObjectSlug,
    setMapping,
    addCustomFieldName,
    goToMerge,
    goBackFromMerge,
    goBackFromPreview,
    setMergeOptions,
    goToExecute,
    reset,
  } = useImport(initialObjectSlug);

  const handleParsed = (data: ParsedCSV) => {
    if (data.headers.length === 0) {
      toast.error("No headers found in CSV.");
      return;
    }
    if (data.rows.length === 0) {
      toast.error("No data rows found in CSV.");
      return;
    }
    setParsed(data);
  };

  const handleError = (msg: string) => toast.error(msg);

  if (state.step === "execute") {
    return (
      <ImportProgress
        state={state}
        onBack={() => reset()}
        onDone={() => {
          reset();
          onComplete?.();
        }}
      />
    );
  }

  if (state.step === "file") {
    return (
      <div className="flex flex-col gap-6">
        <ImportObjectSelector
          value={state.objectSlug}
          onChange={setObjectSlug}
        />
        <ImportFileDropzone onParsed={handleParsed} onError={handleError} />
      </div>
    );
  }

  // "Create a new grid from this CSV" — self-contained (creates the object +
  // bulk-imports), so it bypasses the map/merge/preview/execute steps.
  if (state.objectSlug === NEW_GRID_VALUE && state.parsed) {
    return (
      <ImportNewGrid
        parsed={state.parsed}
        onBack={() => setParsed(null)}
        onDone={reset}
      />
    );
  }

  if (state.step === "map") {
    return (
      <div className="flex flex-col gap-6">
        <Button
          variant="ghost"
          size="sm"
          className="w-fit"
          onClick={() => setParsed(null)}
        >
          <ArrowLeftIcon className="mr-1 size-4" />
          Back
        </Button>
        <ImportColumnMapper
          parsed={state.parsed!}
          objectSlug={state.objectSlug}
          mapping={state.mapping}
          customFieldNames={state.customFieldNames}
          onMappingChange={setMapping}
          onAddCustomField={addCustomFieldName}
          onNext={goToMerge}
        />
      </div>
    );
  }

  if (state.step === "merge") {
    return (
      <div className="flex flex-col gap-6">
        <Button
          variant="ghost"
          size="sm"
          className="w-fit"
          onClick={goBackFromMerge}
        >
          <ArrowLeftIcon className="mr-1 size-4" />
          Back
        </Button>
        <ImportMergeOptions
          objectSlug={state.objectSlug}
          mergeKey={state.mergeKey}
          conflictBehavior={state.conflictBehavior}
          onConfirm={(mergeKey, conflictBehavior) =>
            setMergeOptions(mergeKey, conflictBehavior)
          }
        />
      </div>
    );
  }

  // preview
  return (
    <div className="flex flex-col gap-6">
      <Button
        variant="ghost"
        size="sm"
        className="w-fit"
        onClick={goBackFromPreview}
      >
        <ArrowLeftIcon className="mr-1 size-4" />
        Back
      </Button>
      <ImportPreviewTable
        parsed={state.parsed!}
        mapping={state.mapping}
        customFieldNames={state.customFieldNames}
        onImport={goToExecute}
      />
    </div>
  );
}
