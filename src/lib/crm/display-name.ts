import type { Attribute } from "@/field-types/types";
import { getRecordValue } from "@/lib/crm/field-mapper";

export interface NameAttributes {
  primaryAttr?: Attribute;
  firstNameAttr?: Attribute;
  lastNameAttr?: Attribute;
  usesSplitName: boolean;
}

export function getNameAttributes(attributes: Attribute[]): NameAttributes {
  const primaryAttr = attributes.find((attribute) => attribute.isPrimary);
  const firstNameAttr = attributes.find(
    (attribute) =>
      attribute.columnName === "first_name" || attribute.columnName === "firstName",
  );
  const lastNameAttr = attributes.find(
    (attribute) =>
      attribute.columnName === "last_name" || attribute.columnName === "lastName",
  );

  return {
    primaryAttr,
    firstNameAttr,
    lastNameAttr,
    usesSplitName: Boolean(firstNameAttr || lastNameAttr),
  };
}

export function getRecordDisplayName(
  record: Record<string, unknown> | null | undefined,
  attributes: Attribute[],
  fallback = "Unnamed",
): string {
  if (!record) return fallback;

  const { primaryAttr, firstNameAttr, lastNameAttr, usesSplitName } =
    getNameAttributes(attributes);

  if (usesSplitName) {
    const parts = [
      firstNameAttr ? getRecordValue(record, firstNameAttr.columnName) : undefined,
      lastNameAttr ? getRecordValue(record, lastNameAttr.columnName) : undefined,
    ]
      .map((value) => (typeof value === "string" ? value.trim() : ""))
      .filter(Boolean);

    if (parts.length > 0) {
      return parts.join(" ");
    }
  }

  if (!primaryAttr) return fallback;

  const value = getRecordValue(record, primaryAttr.columnName);
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

export function parseCombinedName(value: unknown): {
  firstName: string;
  lastName: string;
} {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) {
    return { firstName: "", lastName: "" };
  }

  const [firstName, ...rest] = trimmed.split(/\s+/);
  return {
    firstName,
    lastName: rest.join(" "),
  };
}

export function getAttributeDisplayName(
  attribute: Attribute | undefined,
  attributes: Attribute[],
  verbose = false,
): string {
  if (!attribute) return "";

  const { firstNameAttr, lastNameAttr, usesSplitName } =
    getNameAttributes(attributes);

  if (usesSplitName) {
    if (firstNameAttr && attribute.id === firstNameAttr.id) {
      return verbose ? "First Name" : "Name";
    }
    if (lastNameAttr && attribute.id === lastNameAttr.id) {
      return verbose ? "Last Name" : "Name";
    }
  }

  return attribute.name;
}

export function isNameFieldId(
  fieldId: string,
  attributes: Attribute[],
): boolean {
  const { firstNameAttr, lastNameAttr, usesSplitName } =
    getNameAttributes(attributes);
  if (!usesSplitName) return false;
  return (
    (firstNameAttr != null && firstNameAttr.id === fieldId) ||
    (lastNameAttr != null && lastNameAttr.id === fieldId)
  );
}

export function shouldHideSplitNameAttribute(
  attribute: Attribute,
  attributes: Attribute[],
): boolean {
  const { lastNameAttr, usesSplitName } = getNameAttributes(attributes);
  return Boolean(
    usesSplitName && lastNameAttr && attribute.id === lastNameAttr.id,
  );
}
