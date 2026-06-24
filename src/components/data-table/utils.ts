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

  // Auto-append attributes that aren't in the saved view yet (e.g. a column the
  // agent or a CSV import just created) so new columns appear in the grid
  // immediately instead of staying hidden until manually toggled on. A column the
  // user explicitly hid is in viewColumns with show:false, so it stays out.
  const configuredIds = new Set(viewColumns.map((vc) => vc.fieldId));
  for (const attr of attributes) {
    if (configuredIds.has(attr.id) || attr.isSystem || attr.isHiddenByDefault) continue;
    allCols.push({
      attribute: attr,
      viewColumn: {
        id: `virtual-${attr.id}`,
        fieldId: attr.id,
        title: attr.name,
        show: true,
        order: allCols.length,
      } as ViewColumn,
    });
  }

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
