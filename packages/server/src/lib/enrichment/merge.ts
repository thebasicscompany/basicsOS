export function mergeEnrichmentData(
  existingCustomFields: Record<string, unknown>,
  newData: Record<string, unknown>,
  record: Record<string, unknown>,
): {
  mergedFields: Record<string, unknown>;
  fieldsUpdated: string[];
} {
  const mergedFields: Record<string, unknown> = {};
  const fieldsUpdated: string[] = [];

  for (const [key, value] of Object.entries(newData)) {
    if (key.startsWith("_")) continue; // Skip internal keys
    if (value === null || value === undefined || value === "") continue;

    // Check if the value already exists in custom fields or record
    const currentCustomVal = existingCustomFields[key];
    const currentRecordVal = record[key];

    const isEmpty = (val: unknown) =>
      val === null || val === undefined || val === "";

    if (isEmpty(currentCustomVal) && isEmpty(currentRecordVal)) {
      mergedFields[key] = value;
      fieldsUpdated.push(key);
    }
  }

  return { mergedFields, fieldsUpdated };
}
