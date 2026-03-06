import type { Attribute } from "@/field-types/types";
import type { ViewColumn } from "@/types/views";
import { getNameAttributes } from "@/lib/crm/display-name";
export function getVisibleAttributes(
  attributes: Attribute[],
  viewColumns: ViewColumn[],
  _data: Record<string, unknown>[],
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

  // Never show organization_id in grids — it's internal tenant scope, not user-relevant
  const colsWithoutOrgId = allCols.filter(
    (item) => item.attribute.columnName !== "organization_id",
  );

  const { lastNameAttr, usesSplitName } = getNameAttributes(attributes);
  const visible = colsWithoutOrgId.filter(
    (item) =>
      !(
        usesSplitName &&
        lastNameAttr &&
        item.attribute.columnName === lastNameAttr.columnName
      ),
  );

  // Ensure primary attribute is always first
  const primaryIdx = visible.findIndex((item) => item.attribute.isPrimary);
  if (primaryIdx > 0) {
    const [primary] = visible.splice(primaryIdx, 1);
    visible.unshift(primary);
  }

  return { visible, hiddenEmptyCount: 0 };
}

export function parseWidth(width: string | undefined): number {
  if (!width) return 150;
  const n = parseInt(width, 10);
  return Number.isNaN(n) ? 150 : n;
}
