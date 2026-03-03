import type { Attribute } from "@/field-types/types";
import type { ViewColumn } from "@/types/views";

export function isValueEmpty(val: unknown): boolean {
  return val == null || val === "" || val === false;
}

export function getVisibleAttributes(
  attributes: Attribute[],
  viewColumns: ViewColumn[],
  data: Record<string, unknown>[],
): {
  visible: Array<{ attribute: Attribute; viewColumn: ViewColumn }>;
  hiddenEmptyCount: number;
} {
  const attrMap = new Map(attributes.map((a) => [a.id, a]));
  const allCols = viewColumns
    .filter((vc) => vc.show)
    .sort((a, b) => a.order - b.order)
    .map((vc) => {
      const attribute = attrMap.get(vc.fieldId);
      if (!attribute) return null;
      return { attribute, viewColumn: vc };
    })
    .filter(Boolean) as Array<{ attribute: Attribute; viewColumn: ViewColumn }>;

  if (data.length === 0) {
    return { visible: allCols, hiddenEmptyCount: 0 };
  }

  const visible: typeof allCols = [];
  let hiddenEmptyCount = 0;

  for (const item of allCols) {
    const { attribute } = item;
    const hasNonEmpty = data.some(
      (row) => !isValueEmpty(row[attribute.columnName]),
    );
    if (attribute.isPrimary || hasNonEmpty) {
      visible.push(item);
    } else {
      hiddenEmptyCount++;
    }
  }

  return { visible, hiddenEmptyCount };
}

export function parseWidth(width: string | undefined): number {
  if (!width) return 150;
  const n = parseInt(width, 10);
  return Number.isNaN(n) ? 150 : n;
}
