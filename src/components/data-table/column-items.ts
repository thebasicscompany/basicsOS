import type { Attribute } from "@/field-types/types";
import type { ViewColumn } from "@/types/views";
import { shouldHideSplitNameAttribute } from "@/lib/crm/display-name";

export interface ColumnItem {
  vc: ViewColumn;
  attr: Attribute;
}

export function buildColumnItems(
  viewColumns: ViewColumn[] | undefined,
  attributes: Attribute[],
): ColumnItem[] {
  const isHiddenName = (attr: Attribute) =>
    shouldHideSplitNameAttribute(attr, attributes);

  if (!viewColumns?.length) {
    return attributes
      .filter((attr) => !isHiddenName(attr))
      .map((attr, index) => ({
        vc: {
          id: `virtual-${attr.id}`,
          fieldId: attr.id,
          title: attr.name,
          show: !attr.isHiddenByDefault && !attr.isSystem,
          order: index,
        } as ViewColumn,
        attr,
      }));
  }
  const attrMap = new Map(attributes.map((a) => [a.id, a]));
  const vcMap = new Map(viewColumns.map((vc) => [vc.fieldId, vc]));
  const matched: ColumnItem[] = [];
  const sortedVcs = [...viewColumns].sort((a, b) => a.order - b.order);
  for (const vc of sortedVcs) {
    const attr = attrMap.get(vc.fieldId);
    if (attr && !isHiddenName(attr)) matched.push({ vc, attr });
  }
  for (const attr of attributes) {
    if (!vcMap.has(attr.id) && !isHiddenName(attr)) {
      matched.push({
        vc: {
          id: `virtual-${attr.id}`,
          fieldId: attr.id,
          title: attr.name,
          show: false,
          order: matched.length,
        } as ViewColumn,
        attr,
      });
    }
  }
  return matched;
}
