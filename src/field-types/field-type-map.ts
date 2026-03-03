const UIDT_TO_FIELD_TYPE: Record<string, string> = {
  SingleLineText: "text",
  LongText: "long-text",
  Number: "number",
  Currency: "currency",
  Checkbox: "checkbox",
  Date: "date",
  DateTime: "timestamp",
  Rating: "rating",
  SingleSelect: "select",
  MultiSelect: "multi-select",
  Email: "email",
  URL: "domain",
  JSON: "text",
  Decimal: "number",
  Percent: "number",
  Duration: "number",
  CreatedTime: "timestamp",
  LastModifiedTime: "timestamp",
  PhoneNumber: "phone",
  LinkToAnotherRecord: "relationship",
};

const FIELD_TYPE_TO_UIDT: Record<string, string> = {};
for (const [uidt, fieldType] of Object.entries(UIDT_TO_FIELD_TYPE)) {
  // Only store first mapping (preferred) for reverse lookup
  if (!(fieldType in FIELD_TYPE_TO_UIDT)) {
    FIELD_TYPE_TO_UIDT[fieldType] = uidt;
  }
}

export function mapUidtToFieldType(uidt: string): string {
  return UIDT_TO_FIELD_TYPE[uidt] ?? "text";
}

export function mapFieldTypeToUidt(fieldTypeKey: string): string {
  return FIELD_TYPE_TO_UIDT[fieldTypeKey] ?? "SingleLineText";
}
