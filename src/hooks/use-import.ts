import { useCallback, useState } from "react";
import type { ParsedCSV } from "@/components/import/import-utils";

/** Map: target column name -> CSV header index */
export type ColumnMapping = Record<string, number>;

export type ConflictBehavior =
  | "create_only"
  | "update_existing"
  | "skip_duplicates";

export interface ImportState {
  step: "file" | "map" | "merge" | "preview" | "execute";
  parsed: ParsedCSV | null;
  objectSlug: string;
  mapping: ColumnMapping;
  /** Custom field column names (from custom_field_defs.name) */
  customFieldNames: Set<string>;
  mergeKey: string;
  conflictBehavior: ConflictBehavior;
}

const DEFAULT_MERGE_KEY: Record<string, string> = {
  contacts: "email",
  companies: "name",
  deals: "",
};

const INITIAL_STATE: ImportState = {
  step: "file",
  parsed: null,
  objectSlug: "contacts",
  mapping: {},
  customFieldNames: new Set(),
  mergeKey: "email",
  conflictBehavior: "update_existing",
};

export function useImport() {
  const [state, setState] = useState<ImportState>(INITIAL_STATE);

  const setParsed = useCallback((parsed: ParsedCSV | null) => {
    setState((s) => ({ ...s, parsed, step: parsed ? "map" : "file" }));
  }, []);

  const setObjectSlug = useCallback((objectSlug: string) => {
    setState((s) => {
      const mergeKey = DEFAULT_MERGE_KEY[objectSlug] ?? "";
      return {
        ...s,
        objectSlug,
        mergeKey,
        conflictBehavior: mergeKey === "" ? "create_only" : s.conflictBehavior,
      };
    });
  }, []);

  const setMapping = useCallback((mapping: ColumnMapping) => {
    setState((s) => ({ ...s, mapping }));
  }, []);

  const addCustomFieldName = useCallback((name: string) => {
    setState((s) => ({
      ...s,
      customFieldNames: new Set([...s.customFieldNames, name]),
    }));
  }, []);

  const goToMerge = useCallback(() => {
    setState((s) => ({ ...s, step: "merge" }));
  }, []);

  const goToMap = useCallback(() => {
    setState((s) => ({ ...s, step: "map" }));
  }, []);

  const goBackFromMerge = useCallback(() => {
    setState((s) => ({ ...s, step: "map" }));
  }, []);

  const goBackFromPreview = useCallback(() => {
    setState((s) => ({ ...s, step: "merge" }));
  }, []);

  const setMergeOptions = useCallback(
    (mergeKey: string, conflictBehavior: ConflictBehavior) => {
      setState((s) => ({ ...s, mergeKey, conflictBehavior, step: "preview" }));
    },
    [],
  );

  const goToPreview = useCallback(() => {
    setState((s) => ({ ...s, step: "preview" }));
  }, []);

  const goToExecute = useCallback(() => {
    setState((s) => ({ ...s, step: "execute" }));
  }, []);

  const reset = useCallback(() => {
    setState(INITIAL_STATE);
  }, []);

  return {
    state,
    setParsed,
    setObjectSlug,
    setMapping,
    addCustomFieldName,
    goToMerge,
    goToMap,
    goBackFromMerge,
    goBackFromPreview,
    setMergeOptions,
    goToPreview,
    goToExecute,
    reset,
  };
}
