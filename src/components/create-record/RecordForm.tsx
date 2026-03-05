/**
 * RecordForm — a dynamic form generated from an array of Attributes.
 *
 * For each visible attribute the form renders a labelled `fieldType.FormInput`.
 * Primary attribute is always first, followed by the remaining fields sorted
 * by their `order` property.
 */

import React, { useMemo } from "react";
import { Label } from "@/components/ui/label";
import { getFieldType } from "@/field-types";
import type { Attribute } from "@/field-types/types";

export interface RecordFormProps {
  attributes: Attribute[];
  values: Record<string, any>;
  onChange: (fieldName: string, value: any) => void;
  errors?: Record<string, string>;
}

export function RecordForm({
  attributes,
  values,
  onChange,
  errors,
}: RecordFormProps) {
  const visibleAttributes = useMemo(() => {
    const filtered = attributes.filter(
      (attr) => !attr.isSystem && !attr.isHiddenByDefault,
    );

    return filtered.sort((a, b) => {
      if (a.isPrimary && !b.isPrimary) return -1;
      if (!a.isPrimary && b.isPrimary) return 1;
      return a.order - b.order;
    });
  }, [attributes]);

  return (
    <div className="flex flex-col gap-4">
      {visibleAttributes.map((attribute) => {
        const fieldType = getFieldType(attribute.uiType);
        const fieldValue = values[attribute.columnName];
        const fieldError = errors?.[attribute.columnName];
        const FormInput = fieldType.FormInput;

        return (
          <div key={attribute.id} className="flex flex-col gap-1.5">
            <Label htmlFor={`field-${attribute.id}`}>
              {attribute.name}
              {(attribute.isPrimary || attribute.isRequired) && (
                <span className="text-destructive ml-0.5" title="Required">*</span>
              )}
            </Label>

            <FormInput
              value={fieldValue}
              config={attribute.config}
              attribute={attribute}
              onChange={(newValue) => onChange(attribute.columnName, newValue)}
              error={fieldError}
            />

            {fieldError && (
              <p className="text-xs text-destructive">{fieldError}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
