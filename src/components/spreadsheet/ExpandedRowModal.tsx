import { useState, useMemo, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Trash2,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  X,
} from "lucide-react";
import {
  useTableColumns,
  type NocoDBColumn,
} from "@/hooks/use-columns";
import { getTypeIcon } from "./type-icons";
import { ExpandedFieldEditor } from "./SpreadsheetCell";
import { cn } from "@/lib/utils";

type Row = Record<string, unknown> & { id?: number | string };

export interface ExpandedRowTab {
  value: string;
  label: string;
  content: React.ReactNode;
}

export interface ExpandedRowModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resource: string;
  row: Row | null;
  title?: string;
  onFieldUpdate?: (
    rowId: number | string,
    field: string,
    value: unknown,
  ) => void;
  onDelete?: (id: number) => void;
  readOnlyColumns?: string[];
  hiddenColumns?: string[];
  extraTabs?: ExpandedRowTab[];
  /** All rows for prev/next navigation */
  allRows?: Row[];
  /** Called to navigate between rows */
  onNavigateRow?: (row: Row) => void;
  /** Sidebar content (e.g., notes) */
  sidebarContent?: React.ReactNode;
}

/** System/metadata columns to hide in the modal */
const HIDDEN_FIELDS = new Set([
  "nc_order",
  "created_at",
  "updated_at",
  "CreatedAt",
  "UpdatedAt",
  "sales_id",
  "salesId",
  "avatar",
  "email_jsonb",
  "phone_jsonb",
  "custom_fields",
  "tags",
  "logo",
  "context_links",
]);

/** Columns that are always read-only */
const ALWAYS_READONLY = new Set(["id", "Id", "created_at", "updated_at"]);

function toCamelCase(str: string): string {
  return str.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
}

export function ExpandedRowModal({
  open,
  onOpenChange,
  resource,
  row,
  title,
  onFieldUpdate,
  onDelete,
  readOnlyColumns = [],
  hiddenColumns = [],
  extraTabs = [],
  allRows,
  onNavigateRow,
  sidebarContent,
}: ExpandedRowModalProps) {
  const { data: nocoColumns } = useTableColumns(resource);
  const [hiddenFieldsOpen, setHiddenFieldsOpen] = useState(false);
  const [changedFields, setChangedFields] = useState<Set<string>>(new Set());

  const readOnlySet = useMemo(
    () => new Set(readOnlyColumns),
    [readOnlyColumns],
  );
  const hiddenSet = useMemo(() => new Set(hiddenColumns), [hiddenColumns]);

  // Navigation
  const currentIndex = useMemo(() => {
    if (!allRows || !row) return -1;
    return allRows.findIndex((r) => r.id === row.id);
  }, [allRows, row]);

  const canGoPrev = currentIndex > 0;
  const canGoNext = allRows ? currentIndex < allRows.length - 1 : false;
  const totalRecords = allRows?.length ?? 0;

  const goPrev = useCallback(() => {
    if (canGoPrev && allRows && onNavigateRow) {
      onNavigateRow(allRows[currentIndex - 1]);
    }
  }, [canGoPrev, allRows, currentIndex, onNavigateRow]);

  const goNext = useCallback(() => {
    if (canGoNext && allRows && onNavigateRow) {
      onNavigateRow(allRows[currentIndex + 1]);
    }
  }, [canGoNext, allRows, currentIndex, onNavigateRow]);

  if (!row) return null;

  const rowId = row.id;

  // Split columns into visible and hidden
  const allVisibleCols = (nocoColumns ?? [])
    .filter((col) => {
      if (col.system && col.column_name !== "id") return false;
      if (HIDDEN_FIELDS.has(col.column_name)) return false;
      if (hiddenSet.has(col.column_name)) return false;
      if (hiddenSet.has(toCamelCase(col.column_name))) return false;
      return true;
    })
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  const hiddenCols = (nocoColumns ?? [])
    .filter((col) => {
      if (col.system && col.column_name !== "id") return false;
      if (HIDDEN_FIELDS.has(col.column_name)) return false;
      return (
        hiddenSet.has(col.column_name) ||
        hiddenSet.has(toCamelCase(col.column_name))
      );
    })
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  // Find primary column value for display
  const pvCol = nocoColumns?.find((c) => c.pv);
  const displayValue = pvCol
    ? (row[toCamelCase(pvCol.column_name)] ??
        row[pvCol.column_name] ??
        title)
    : title;

  const hasTabs = extraTabs.length > 0;
  const hasSidebar = !!sidebarContent;

  const handleFieldUpdate = (col: NocoDBColumn, newValue: unknown) => {
    if (onFieldUpdate && rowId != null) {
      onFieldUpdate(rowId, col.column_name, newValue);
      setChangedFields((prev) => new Set(prev).add(col.column_name));
    }
  };

  const fieldsContent = (
    <div className="mx-auto w-full max-w-[588px] space-y-0.5">
      {allVisibleCols.map((col) => {
        const accessor = toCamelCase(col.column_name);
        const value = row[accessor] ?? row[col.column_name];
        const isReadOnly =
          col.pk ||
          col.ai ||
          ALWAYS_READONLY.has(col.column_name) ||
          readOnlySet.has(col.column_name) ||
          readOnlySet.has(accessor);
        const isChanged = changedFields.has(col.column_name);

        return (
          <FieldRow
            key={col.id}
            column={col}
            value={value}
            readOnly={isReadOnly}
            isChanged={isChanged}
            onUpdate={(newValue) => handleFieldUpdate(col, newValue)}
          />
        );
      })}

      {/* Hidden fields collapsible */}
      {hiddenCols.length > 0 && (
        <Collapsible
          open={hiddenFieldsOpen}
          onOpenChange={setHiddenFieldsOpen}
          className="mt-4"
        >
          <CollapsibleTrigger asChild>
            <button className="flex w-full items-center gap-2 rounded-sm px-2 py-2 text-sm text-muted-foreground hover:bg-muted/30">
              <ChevronsUpDown className="size-3.5" />
              <span>
                {hiddenCols.length} hidden field
                {hiddenCols.length !== 1 ? "s" : ""}
              </span>
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-0.5">
            {hiddenCols.map((col) => {
              const accessor = toCamelCase(col.column_name);
              const value = row[accessor] ?? row[col.column_name];
              const isReadOnly =
                col.pk ||
                col.ai ||
                ALWAYS_READONLY.has(col.column_name) ||
                readOnlySet.has(col.column_name) ||
                readOnlySet.has(accessor);

              return (
                <FieldRow
                  key={col.id}
                  column={col}
                  value={value}
                  readOnly={isReadOnly}
                  isChanged={false}
                  isMuted
                  onUpdate={(newValue) => handleFieldUpdate(col, newValue)}
                />
              );
            })}
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] max-w-[min(70vw,768px)] flex-col gap-0 p-0">
        {/* Header bar */}
        <DialogHeader className="border-b px-6 py-3">
          <div className="flex items-center gap-3">
            {/* Prev/Next navigation */}
            {allRows && allRows.length > 1 && onNavigateRow && (
              <div className="flex flex-col">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5"
                  disabled={!canGoPrev}
                  onClick={goPrev}
                >
                  <ChevronUp className="size-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5"
                  disabled={!canGoNext}
                  onClick={goNext}
                >
                  <ChevronDown className="size-3.5" />
                </Button>
              </div>
            )}

            <div className="flex-1">
              <DialogTitle className="text-base font-semibold">
                {String(displayValue ?? `Record #${rowId}`)}
              </DialogTitle>
              {allRows && totalRecords > 0 && (
                <p className="text-xs text-muted-foreground">
                  Record {currentIndex + 1} of {totalRecords}
                </p>
              )}
            </div>

            <div className="flex items-center gap-1">
              {onDelete && rowId != null && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  onClick={() => {
                    onDelete(Number(rowId));
                    onOpenChange(false);
                  }}
                >
                  <Trash2 className="size-4" />
                </Button>
              )}
            </div>
          </div>
        </DialogHeader>

        {/* Body */}
        {hasTabs ? (
          <Tabs
            defaultValue="fields"
            className="flex flex-1 flex-col overflow-hidden"
          >
            <TabsList className="mx-6 mt-2 w-fit border-b-0">
              <TabsTrigger value="fields">Fields</TabsTrigger>
              {extraTabs.map((tab) => (
                <TabsTrigger key={tab.value} value={tab.value}>
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
            <TabsContent
              value="fields"
              className="mt-0 flex-1 overflow-y-auto px-6 py-4"
            >
              {hasSidebar ? (
                <div className="flex gap-6">
                  <div className="flex-[2]">{fieldsContent}</div>
                  <div className="flex-1 border-l pl-6">{sidebarContent}</div>
                </div>
              ) : (
                fieldsContent
              )}
            </TabsContent>
            {extraTabs.map((tab) => (
              <TabsContent
                key={tab.value}
                value={tab.value}
                className="mt-0 flex-1 overflow-y-auto px-6 py-4"
              >
                {tab.content}
              </TabsContent>
            ))}
          </Tabs>
        ) : (
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {hasSidebar ? (
              <div className="flex gap-6">
                <div className="flex-[2]">{fieldsContent}</div>
                <div className="flex-1 border-l pl-6">{sidebarContent}</div>
              </div>
            ) : (
              fieldsContent
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function FieldRow({
  column,
  value,
  readOnly,
  isChanged,
  isMuted,
  onUpdate,
}: {
  column: NocoDBColumn;
  value: unknown;
  readOnly: boolean;
  isChanged: boolean;
  isMuted?: boolean;
  onUpdate: (value: unknown) => void;
}) {
  const Icon = getTypeIcon(column.uidt);
  const label = column.title || column.column_name;

  return (
    <div
      className={cn(
        "flex min-h-[36px] items-start gap-3 rounded-sm px-2 py-1.5 hover:bg-muted/30",
        isChanged && "border-l-2 border-l-blue-400",
        isMuted && "opacity-60",
        readOnly && "bg-muted/10",
      )}
    >
      <div className="flex w-[180px] shrink-0 items-center gap-1.5 pt-1.5 text-sm text-muted-foreground">
        {Icon && <Icon className="size-3.5" />}
        <span className="truncate">{label}</span>
      </div>
      <div className="min-w-0 flex-1">
        <ExpandedFieldEditor
          value={value}
          uidt={column.uidt}
          readOnly={readOnly}
          dtxp={column.dtxp}
          onUpdate={onUpdate}
        />
      </div>
    </div>
  );
}
