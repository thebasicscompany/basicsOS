import type { Attribute } from "@/field-types/types";

export function isCustomAttribute(attribute: Attribute): boolean {
  return attribute.id.startsWith("custom_");
}

export function buildAttributeWritePayload(
  attribute: Attribute,
  value: unknown,
): Record<string, unknown> {
  if (isCustomAttribute(attribute)) {
    return { customFields: { [attribute.columnName]: value } };
  }

  return { [attribute.columnName]: value };
}

export function buildRecordWritePayload(
  attributes: Attribute[],
  values: Record<string, unknown>,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  const customFields: Record<string, unknown> = {};
  const attributeByColumn = new Map(
    attributes.map((attribute) => [attribute.columnName, attribute]),
  );

  for (const [columnName, value] of Object.entries(values)) {
    if (value === undefined) continue;

    const attribute = attributeByColumn.get(columnName);
    if (attribute && isCustomAttribute(attribute)) {
      customFields[columnName] = value;
      continue;
    }

    payload[columnName] = value;
  }

  if (Object.keys(customFields).length > 0) {
    payload.customFields = customFields;
  }

  return payload;
}

export function normalizeFilterOperator(
  operator: string,
  attribute: Attribute,
): string {
  switch (operator) {
    case "contains":
      return "like";
    case "not_contains":
      return "nlike";
    case "is_empty":
      return "blank";
    case "is_not_empty":
      return "notblank";
    default:
      if (attribute.uiType === "checkbox" && (operator === "eq" || operator === "neq")) {
        return operator;
      }
      return operator;
  }
}

export function normalizeFilterValue(
  operator: string,
  value: unknown,
  attribute: Attribute,
): string {
  if (attribute.uiType === "checkbox" && (operator === "eq" || operator === "neq")) {
    return "true";
  }

  if (value == null) return "";
  if (Array.isArray(value)) return value.join(",");
  return String(value);
}
