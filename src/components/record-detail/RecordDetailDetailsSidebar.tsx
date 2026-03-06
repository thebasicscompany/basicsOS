import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { DetailField } from "@/components/cells";
import { getRecordValue } from "@/lib/crm/field-mapper";
import type { Attribute } from "@/types/objects";
import { EditableRecordName } from "./EditableRecordName";

export interface RecordDetailDetailsSidebarProps {
  displayName: string;
  nameFieldLabel: string;
  nameEditorMode: "single" | "split" | "none";
  nameSingleValue: string;
  nameFirstValue: string;
  nameLastValue: string;
  record: Record<string, unknown>;
  visibleEditableAttributes: Attribute[];
  systemAttributes: Attribute[];
  showAllFields: boolean;
  hiddenCount: number;
  onNameSave: (value: {
    singleValue?: string;
    firstName?: string;
    lastName?: string;
  }) => void;
  onFieldSave: (attr: Attribute) => (value: unknown) => void;
  onShowAllFields: () => void;
  onHideEmptyFields: () => void;
}

export function RecordDetailDetailsSidebar({
  displayName,
  nameFieldLabel,
  nameEditorMode,
  nameSingleValue,
  nameFirstValue,
  nameLastValue,
  record,
  visibleEditableAttributes,
  systemAttributes,
  showAllFields,
  hiddenCount,
  onNameSave,
  onFieldSave,
  onShowAllFields,
  onHideEmptyFields,
}: RecordDetailDetailsSidebarProps) {
  return (
    <aside className="space-y-1 overflow-hidden lg:max-h-[calc(100vh-8.5rem)] lg:overflow-y-auto lg:border-l lg:pl-6 lg:pr-2">
      <h3 className="pb-2 pt-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Details
      </h3>

      <EditableRecordName
        variant="field"
        label={nameFieldLabel}
        displayName={displayName}
        mode={nameEditorMode}
        singleValue={nameSingleValue}
        firstName={nameFirstValue}
        lastName={nameLastValue}
        onSave={onNameSave}
      />

      {visibleEditableAttributes.map((attr) => (
        <DetailField
          key={attr.id}
          attribute={attr}
          value={getRecordValue(record, attr.columnName)}
          onSave={onFieldSave(attr)}
        />
      ))}

      {!showAllFields && hiddenCount > 0 && (
        <div className="pt-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-muted-foreground"
            onClick={onShowAllFields}
          >
            Show {hiddenCount} empty {hiddenCount === 1 ? "field" : "fields"}
          </Button>
        </div>
      )}
      {showAllFields && (
        <div className="pt-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-muted-foreground"
            onClick={onHideEmptyFields}
          >
            Hide empty fields
          </Button>
        </div>
      )}

      {systemAttributes.length > 0 && (
        <>
          <Separator className="my-2" />
          <h3 className="pb-1 pt-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            System
          </h3>
          {systemAttributes.map((attr) => (
            <DetailField
              key={attr.id}
              attribute={attr}
              value={getRecordValue(record, attr.columnName)}
              onSave={onFieldSave(attr)}
              isReadOnly
            />
          ))}
        </>
      )}
    </aside>
  );
}
