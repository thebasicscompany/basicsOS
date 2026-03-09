import { ArrowRightIcon } from "@phosphor-icons/react";
import { useCallback, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { ConflictBehavior } from "@/hooks/use-import";

const MERGE_KEY_OPTIONS: Record<
  string,
  Array<{ value: string; label: string }>
> = {
  contacts: [{ value: "email", label: "Email" }],
  companies: [{ value: "name", label: "Company Name" }],
  deals: [],
};

const OBJECT_LABELS: Record<string, string> = {
  contacts: "contact",
  companies: "company",
  deals: "deal",
};

export interface ImportMergeOptionsProps {
  objectSlug: string;
  mergeKey: string;
  conflictBehavior: ConflictBehavior;
  onConfirm: (mergeKey: string, conflictBehavior: ConflictBehavior) => void;
}

export function ImportMergeOptions({
  objectSlug,
  mergeKey,
  conflictBehavior,
  onConfirm,
}: ImportMergeOptionsProps) {
  const [localKey, setLocalKey] = useState(mergeKey);
  const [localBehavior, setLocalBehavior] =
    useState<ConflictBehavior>(conflictBehavior);

  const mergeKeyOptions = useMemo(
    () => MERGE_KEY_OPTIONS[objectSlug] ?? [],
    [objectSlug],
  );
  const hasMergeKey = mergeKeyOptions.length > 0;
  const objLabel = OBJECT_LABELS[objectSlug] ?? "record";

  const handleConfirm = useCallback(() => {
    onConfirm(localKey, localBehavior);
  }, [localKey, localBehavior, onConfirm]);

  return (
    <div className="flex flex-col gap-6 max-w-lg">
      {hasMergeKey ? (
        <p className="text-[12px] text-muted-foreground">
          When a row has the same {localKey} as an existing {objLabel}, how
          should we handle it?
        </p>
      ) : (
        <p className="text-[12px] text-muted-foreground">
          Deals do not support duplicate detection. All rows will be created as
          new records.
        </p>
      )}
      {hasMergeKey && (
        <div className="space-y-3">
          <Label>Match by</Label>
          <RadioGroup
            value={localKey}
            onValueChange={setLocalKey}
            className="flex flex-col gap-2"
          >
            {mergeKeyOptions.map((opt) => (
              <div key={opt.value} className="flex items-center space-x-2">
                <RadioGroupItem value={opt.value} id={`merge-${opt.value}`} />
                <Label
                  htmlFor={`merge-${opt.value}`}
                  className="font-normal cursor-pointer"
                >
                  {opt.label}
                </Label>
              </div>
            ))}
          </RadioGroup>
        </div>
      )}
      <div className="space-y-3">
        <Label>{hasMergeKey ? "If a match is found" : "Import behavior"}</Label>
        <RadioGroup
          value={localBehavior}
          onValueChange={(v) => setLocalBehavior(v as ConflictBehavior)}
          className="flex flex-col gap-2"
        >
          {hasMergeKey && (
            <>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="update_existing" id="behavior-update" />
                <Label
                  htmlFor="behavior-update"
                  className="font-normal cursor-pointer"
                >
                  Update the existing {objLabel} with new data
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="skip_duplicates" id="behavior-skip" />
                <Label
                  htmlFor="behavior-skip"
                  className="font-normal cursor-pointer"
                >
                  Skip (keep existing {objLabel} unchanged)
                </Label>
              </div>
            </>
          )}
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="create_only" id="behavior-create" />
            <Label
              htmlFor="behavior-create"
              className="font-normal cursor-pointer"
            >
              {hasMergeKey
                ? "Always create new (ignore matches)"
                : "Create new records"}
            </Label>
          </div>
        </RadioGroup>
      </div>
      <Button onClick={handleConfirm} className="w-fit">
        Continue to preview
        <ArrowRightIcon className="ml-1 size-4" />
      </Button>
    </div>
  );
}
