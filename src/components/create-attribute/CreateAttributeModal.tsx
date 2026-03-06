/**
 * CreateAttributeModal — dialog for creating a new attribute (column).
 *
 * Two-step flow:
 *   Step 1 — Type selector: a grid of field type options grouped by category.
 *   Step 2 — Configuration: name, optional description, and any type-specific
 *            config rendered via the field type's TypeConfigComponent.
 */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  TextAaIcon,
  AlignLeftIcon,
  HashIcon,
  CurrencyDollarIcon,
  ListIcon,
  ListChecksIcon,
  CircleIcon,
  CheckSquareIcon,
  CalendarIcon,
  ClockIcon,
  StarIcon,
  EnvelopeIcon,
  GlobeIcon,
  PhoneIcon,
  MapPinIcon,
  UserIcon,
  LinkIcon,
} from "@phosphor-icons/react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { getFieldType } from "@/field-types";
import {
  useCreateColumn,
  type SchemaColumn,
} from "@/hooks/use-columns";

export interface CreateAttributeModalProps {
  resource: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (column: SchemaColumn) => void;
}

interface TypeOption {
  key: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  group: "standard" | "relational";
}

const TYPE_OPTIONS: TypeOption[] = [
  { key: "text", label: "Text", icon: TextAaIcon, group: "standard" },
  {
    key: "long-text",
    label: "Long Text",
    icon: AlignLeftIcon,
    group: "standard",
  },
  { key: "number", label: "Number", icon: HashIcon, group: "standard" },
  {
    key: "currency",
    label: "Currency",
    icon: CurrencyDollarIcon,
    group: "standard",
  },
  { key: "select", label: "Select", icon: ListIcon, group: "standard" },
  {
    key: "multi-select",
    label: "Multi Select",
    icon: ListChecksIcon,
    group: "standard",
  },
  { key: "status", label: "Status", icon: CircleIcon, group: "standard" },
  {
    key: "checkbox",
    label: "Checkbox",
    icon: CheckSquareIcon,
    group: "standard",
  },
  { key: "date", label: "Date", icon: CalendarIcon, group: "standard" },
  { key: "timestamp", label: "Timestamp", icon: ClockIcon, group: "standard" },
  { key: "rating", label: "Rating", icon: StarIcon, group: "standard" },
  { key: "email", label: "Email", icon: EnvelopeIcon, group: "standard" },
  { key: "domain", label: "Domain", icon: GlobeIcon, group: "standard" },
  { key: "phone", label: "Phone", icon: PhoneIcon, group: "standard" },
  { key: "location", label: "Location", icon: MapPinIcon, group: "standard" },
  { key: "user", label: "User", icon: UserIcon, group: "relational" },
  {
    key: "relationship",
    label: "Relationship",
    icon: LinkIcon,
    group: "relational",
  },
];

export function CreateAttributeModal({
  resource,
  open,
  onOpenChange,
  onCreated,
}: CreateAttributeModalProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [typeConfig, setTypeConfig] = useState<Record<string, any>>({});

  const nameInputRef = useRef<HTMLInputElement>(null);
  const createColumn = useCreateColumn();

  const standardTypes = useMemo(
    () => TYPE_OPTIONS.filter((t) => t.group === "standard"),
    [],
  );
  const relationalTypes = useMemo(
    () => TYPE_OPTIONS.filter((t) => t.group === "relational"),
    [],
  );

  useEffect(() => {
    if (open) {
      setStep(1);
      setSelectedType(null);
      setName("");
      setDescription("");
      setTypeConfig({});
    }
  }, [open]);

  useEffect(() => {
    if (step === 2) {
      // Small delay so dialog animation completes
      const timer = setTimeout(() => nameInputRef.current?.focus(), 50); // let dialog settle
      return () => clearTimeout(timer);
    }
  }, [step]);

  // Keyboard: Escape always cancels
  useEffect(() => {
    if (!open) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onOpenChange(false);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onOpenChange]);

  const handleSelectType = useCallback((typeKey: string) => {
    setSelectedType(typeKey);
    setStep(2);
  }, []);

  const handleBack = useCallback(() => {
    setStep(1);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!name.trim() || !selectedType) return;

    try {
      const createdColumn = await createColumn.mutateAsync({
        resource,
        title: name.trim(),
        fieldType: selectedType,
        options: typeConfig.options,
      });
      onCreated?.(createdColumn);
      onOpenChange(false);
    } catch {
      // Validation or API error; form stays open
    }
  }, [
    name,
    selectedType,
    resource,
    typeConfig,
    createColumn,
    onCreated,
    onOpenChange,
  ]);

  // ---- render: type selector grid ------------------------------------------

  const fieldTypeDef = selectedType ? getFieldType(selectedType) : null;
  const hasTypeConfig = fieldTypeDef?.hasTypeConfig ?? false;
  const TypeConfigComponent = fieldTypeDef?.TypeConfigComponent ?? null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {step === 1 ? (
          <>
            <DialogHeader>
              <DialogTitle>Add a field</DialogTitle>
              <DialogDescription>
                Choose a field type to add to your table.
              </DialogDescription>
            </DialogHeader>

            <ScrollArea className="max-h-[70vh]">
              <div className="pb-6 space-y-0">
              {/* Standard section */}
              <div className="space-y-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Standard
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {standardTypes.map((typeOpt) => (
                    <TypeCard
                      key={typeOpt.key}
                      typeOption={typeOpt}
                      onClick={() => handleSelectType(typeOpt.key)}
                    />
                  ))}
                </div>
              </div>

              <Separator className="my-4" />

              {/* Relational section */}
              <div className="space-y-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Relational
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {relationalTypes.map((typeOpt) => (
                    <TypeCard
                      key={typeOpt.key}
                      typeOption={typeOpt}
                      onClick={() => handleSelectType(typeOpt.key)}
                    />
                  ))}
                </div>
              </div>
              </div>
            </ScrollArea>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Configure field</DialogTitle>
              <DialogDescription>
                Set a name and configure your{" "}
                {TYPE_OPTIONS.find((t) => t.key === selectedType)?.label ?? ""}{" "}
                field.
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-4">
              {/* Name */}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="attr-name">
                  Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  ref={nameInputRef}
                  id="attr-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Field name"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && name.trim()) {
                      e.preventDefault();
                      handleSubmit();
                    }
                  }}
                />
              </div>

              {/* Description */}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="attr-desc">Description</Label>
                <Textarea
                  id="attr-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional description"
                  rows={2}
                />
              </div>

              {/* Type-specific config */}
              {hasTypeConfig && TypeConfigComponent && (
                <div className="flex flex-col gap-1.5">
                  <Separator />
                  <TypeConfigComponent
                    config={typeConfig}
                    onChange={setTypeConfig}
                  />
                </div>
              )}
            </div>

            {createColumn.error && (
              <p className="text-sm text-destructive">
                {(createColumn.error as Error).message ??
                  "Failed to create field."}
              </p>
            )}

            <DialogFooter>
              <Button
                variant="outline"
                onClick={handleBack}
                disabled={createColumn.isPending}
              >
                Back
              </Button>
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={createColumn.isPending}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={!name.trim() || createColumn.isPending}
              >
                {createColumn.isPending ? "Creating..." : "Create attribute"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

interface TypeCardProps {
  typeOption: TypeOption;
  onClick: () => void;
}

function TypeCard({ typeOption, onClick }: TypeCardProps) {
  const Icon = typeOption.icon;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col items-center justify-center gap-1.5 rounded-md border p-3",
        "text-sm text-muted-foreground transition-colors",
        "hover:bg-accent hover:text-accent-foreground hover:border-accent-foreground/20",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "cursor-pointer",
      )}
    >
      <Icon className="size-5" />
      <span className="text-xs font-medium">{typeOption.label}</span>
    </button>
  );
}
