import type { FieldTypeDefinition } from "./types";

import { TextFieldType } from "./types/text";
import { LongTextFieldType } from "./types/long-text";
import { NumberFieldType } from "./types/number";
import { CurrencyFieldType } from "./types/currency";
import { SelectFieldType } from "./types/select";
import { MultiSelectFieldType } from "./types/multi-select";
import { StatusFieldType } from "./types/status";
import { CheckboxFieldType } from "./types/checkbox";
import { DateFieldType } from "./types/date";
import { TimestampFieldType } from "./types/timestamp";
import { RatingFieldType } from "./types/rating";
import { EmailFieldType } from "./types/email";
import { DomainFieldType } from "./types/domain";
import { PhoneFieldType } from "./types/phone";
import { LocationFieldType } from "./types/location";
import { UserFieldType } from "./types/user";
import { RelationshipFieldType } from "./types/relationship";
import { CompanyFieldType } from "./types/company";

const FIELD_TYPE_REGISTRY: Map<string, FieldTypeDefinition> = new Map([
  ["text", TextFieldType],
  ["long-text", LongTextFieldType],
  ["number", NumberFieldType],
  ["currency", CurrencyFieldType],
  ["select", SelectFieldType],
  ["multi-select", MultiSelectFieldType],
  ["status", StatusFieldType],
  ["checkbox", CheckboxFieldType],
  ["date", DateFieldType],
  ["timestamp", TimestampFieldType],
  ["rating", RatingFieldType],
  ["email", EmailFieldType],
  ["domain", DomainFieldType],
  ["phone", PhoneFieldType],
  ["location", LocationFieldType],
  ["user", UserFieldType],
  ["relationship", RelationshipFieldType],
  ["company", CompanyFieldType],
]);

/**
 * Get a field type definition by key.
 * Falls back to 'text' if the key is not found.
 */
export function getFieldType(key: string): FieldTypeDefinition {
  return FIELD_TYPE_REGISTRY.get(key) ?? TextFieldType;
}

/**
 * Get all registered field type definitions.
 */
export function getAllFieldTypes(): FieldTypeDefinition[] {
  return Array.from(FIELD_TYPE_REGISTRY.values());
}

/**
 * Get all field types grouped by their category.
 */
export function getFieldTypesByGroup(): Record<string, FieldTypeDefinition[]> {
  const groups: Record<string, FieldTypeDefinition[]> = {
    standard: [],
    relational: [],
    "ai-autofill": [],
  };
  for (const ft of FIELD_TYPE_REGISTRY.values()) {
    groups[ft.group].push(ft);
  }
  return groups;
}

/**
 * Check if a field type key is registered.
 */
export function hasFieldType(key: string): boolean {
  return FIELD_TYPE_REGISTRY.has(key);
}

/**
 * Register a custom field type.
 */
export function registerFieldType(definition: FieldTypeDefinition): void {
  FIELD_TYPE_REGISTRY.set(definition.key, definition);
}

export { FIELD_TYPE_REGISTRY };
