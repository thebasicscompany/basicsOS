import type { ReactNode } from "react";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router";
import { toast } from "sonner";
import { showError } from "@/lib/show-error";
import { getFieldType } from "@/field-types";
import { getRecordValue } from "@/lib/crm/field-mapper";
import {
  getNameAttributes,
  getRecordDisplayName,
} from "@/lib/crm/display-name";
import {
  buildAttributeWritePayload,
  buildRecordWritePayload,
} from "@/lib/crm/field-utils";
import { useObject, useAttributes } from "@/hooks/use-object-registry";
import type { Attribute } from "@/types/objects";
import {
  useRecord,
  useRecords,
  useUpdateRecord,
  useDeleteRecord,
  useCreateRecord,
} from "@/hooks/use-records";
import { useToggleFavorite, useIsFavorite } from "@/hooks/use-favorites";
import { useRecentItems, type RecentItem } from "@/hooks/use-recent-items";
import { trackRecentRoute } from "@/lib/recent-routes";
import {
  usePageTitle,
  usePageHeaderBreadcrumb,
  usePageHeaderActions,
} from "@/contexts/page-header";
import { RecordDetailBreadcrumb } from "./RecordDetailBreadcrumb";
import type { ObjectConfig } from "@/types/objects";
import type { UseMutationResult } from "@tanstack/react-query";

export interface UseRecordDetailReturn {
  objectSlug: string;
  recordId: string | number;
  numericRecordId: number;
  obj: ObjectConfig | undefined;
  record: unknown;
  attributes: Attribute[];
  isPending: boolean;
  isError: boolean;
  displayName: string;
  nameFieldLabel: string;
  nameEditorMode: "single" | "split" | "none";
  nameSingleValue: string;
  nameFirstValue: string;
  nameLastValue: string;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  confirmDeleteOpen: boolean;
  setConfirmDeleteOpen: (open: boolean) => void;
  showAllFields: boolean;
  setShowAllFields: (show: boolean) => void;
  editableAttributes: Attribute[];
  visibleEditableAttributes: Attribute[];
  systemAttributes: Attribute[];
  hiddenCount: number;
  emptyFieldsCount: number;
  breadcrumbPortal: ReactNode;
  headerActionsPortal: ReactNode;
  handleNameSave: (value: {
    singleValue?: string;
    firstName?: string;
    lastName?: string;
  }) => void;
  handleFieldSave: (attr: Attribute) => (value: unknown) => void;
  handleDelete: () => Promise<void>;
  handleDuplicate: () => Promise<void>;
  listIdsLength: number;
  prevId: number | null;
  nextId: number | null;
  onPrev: () => void;
  onNext: () => void;
  deleteRecord: UseMutationResult<unknown, Error, string | number, unknown>;
}

export function useRecordDetail(): UseRecordDetailReturn {
  const { objectSlug = "", recordId: recordIdParam = "" } = useParams<{
    objectSlug: string;
    recordId: string;
  }>();
  const navigate = useNavigate();
  const recordId = /^\d+$/.test(recordIdParam)
    ? parseInt(recordIdParam, 10)
    : recordIdParam;

  const obj = useObject(objectSlug);
  const attributes = useAttributes(objectSlug);

  const {
    data: record,
    isPending,
    isError,
  } = useRecord(objectSlug, recordId ?? "");
  const updateRecord = useUpdateRecord(objectSlug);
  const deleteRecord = useDeleteRecord(objectSlug);
  const createRecord = useCreateRecord(objectSlug);

  const numericRecordId =
    typeof recordId === "number"
      ? recordId
      : parseInt(String(recordId), 10) || 0;
  const _isFavorite = useIsFavorite(objectSlug, numericRecordId);
  const toggleFavoriteMutation = useToggleFavorite();

  const [, addRecentItem] = useRecentItems();

  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [showAllFields, setShowAllFields] = useState(false);
  const [activeTab, setActiveTab] = useState(() =>
    typeof window !== "undefined" && window.location.hash === "#notes"
      ? "notes"
      : "overview",
  );

  useEffect(() => {
    const hash = window.location.hash;
    if (hash === "#notes") setActiveTab("notes");
  }, []);

  const { primaryAttr, firstNameAttr, lastNameAttr, usesSplitName } = useMemo(
    () => getNameAttributes(attributes),
    [attributes],
  );

  const displayName = useMemo(() => {
    if (!record) return "\u2026";
    return getRecordDisplayName(record as Record<string, unknown>, attributes);
  }, [record, attributes]);
  const nameFieldLabel = usesSplitName ? "Name" : primaryAttr?.name ?? "Name";
  const nameEditorMode = usesSplitName
    ? "split"
    : primaryAttr
      ? "single"
      : "none";
  const nameSingleValue =
    record && primaryAttr
      ? String(
          getRecordValue(record as Record<string, unknown>, primaryAttr.columnName) ??
            "",
        )
      : "";
  const nameFirstValue =
    record && firstNameAttr
      ? String(
          getRecordValue(
            record as Record<string, unknown>,
            firstNameAttr.columnName,
          ) ?? "",
        )
      : "";
  const nameLastValue =
    record && lastNameAttr
      ? String(
          getRecordValue(
            record as Record<string, unknown>,
            lastNameAttr.columnName,
          ) ?? "",
        )
      : "";

  usePageTitle("");

  const { data: listData } = useRecords(objectSlug, {
    page: 1,
    perPage: 200,
  });
  const listIds = useMemo(
    () =>
      (listData?.data ?? []).map(
        (r) => (r as Record<string, unknown>).Id as number,
      ),
    [listData],
  );
  const currentIndex = listIds.indexOf(recordId as number);
  const prevId = currentIndex > 0 ? listIds[currentIndex - 1] : null;
  const nextId =
    currentIndex >= 0 && currentIndex < listIds.length - 1
      ? listIds[currentIndex + 1]
      : null;

  const _handleToggleFavorite = useCallback(() => {
    if (!numericRecordId) return;
    toggleFavoriteMutation.mutate({
      objectSlug,
      recordId: numericRecordId,
    });
  }, [objectSlug, numericRecordId, toggleFavoriteMutation]);

  const handleDuplicate = useCallback(async () => {
    if (!record || !obj || !primaryAttr) return;
    const rec = record as Record<string, unknown>;
    const data: Record<string, unknown> = {};
    for (const attr of attributes) {
      if (attr.isSystem || attr.columnName === "Id") continue;
      const value = getRecordValue(rec, attr.columnName);
      if (value != null) {
        data[attr.columnName] = value;
      }
    }
    const primaryVal = getRecordValue(rec, primaryAttr.columnName);
    if (typeof primaryVal === "string") {
      data[primaryAttr.columnName] = `${primaryVal} (copy)`;
    }
    try {
      const created = await createRecord.mutateAsync(
        buildRecordWritePayload(attributes, data),
      );
      const newId = (created as Record<string, unknown>).Id;
      if (newId != null) {
        navigate(`/objects/${objectSlug}/${newId}`);
        toast.success("Record duplicated");
      }
    } catch (err) {
      showError(err, "Failed to duplicate record");
    }
  }, [
    record,
    obj,
    primaryAttr,
    attributes,
    createRecord,
    navigate,
    objectSlug,
  ]);

  const breadcrumbForHeader =
    obj && !isPending && !isError && record ? (
      <RecordDetailBreadcrumb
        objectSlug={objectSlug}
        obj={obj}
        recordName={displayName}
      />
    ) : null;
  const breadcrumbPortal = usePageHeaderBreadcrumb(breadcrumbForHeader);

  const headerActionsPortal = usePageHeaderActions(null);

  useEffect(() => {
    if (!record || !obj || !recordId) return;
    if (!displayName || displayName === "\u2026") return;
    const slugToType: Record<string, "contact" | "company" | "deal"> = {
      contacts: "contact",
      companies: "company",
      deals: "deal",
    };
    const recentType = slugToType[objectSlug];
    if (recentType) {
      const numId =
        typeof recordId === "number"
          ? recordId
          : parseInt(String(recordId), 10);
      addRecentItem({
        type: recentType,
        id: numId,
        name: displayName,
      } as RecentItem);
    }
    trackRecentRoute({
      path: `/objects/${objectSlug}/${recordId}`,
      title: displayName,
      objectType: objectSlug,
    });
  }, [record, obj, recordId, objectSlug, displayName, addRecentItem]);

  useEffect(() => {
    if (displayName && displayName !== "\u2026") {
      document.title = `${displayName} | Basics CRM`;
    }
    return () => {
      document.title = "Basics CRM";
    };
  }, [displayName]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !confirmDeleteOpen) {
        navigate(`/objects/${objectSlug}`);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [navigate, objectSlug, confirmDeleteOpen]);

  const handleNameSave = useCallback(
    (value: {
      singleValue?: string;
      firstName?: string;
      lastName?: string;
    }) => {
      if (!recordId) return;

      const data =
        usesSplitName && (firstNameAttr || lastNameAttr)
          ? buildRecordWritePayload(attributes, {
              ...(firstNameAttr && {
                [firstNameAttr.columnName]: value.firstName ?? "",
              }),
              ...(lastNameAttr && {
                [lastNameAttr.columnName]: value.lastName ?? "",
              }),
            })
          : primaryAttr
            ? buildAttributeWritePayload(primaryAttr, value.singleValue ?? "")
            : null;

      if (!data) return;

      updateRecord.mutate(
        { id: recordId, data },
        {
          onError: () => {
            toast.error("Failed to save name");
          },
        },
      );
    },
    [recordId, usesSplitName, firstNameAttr, lastNameAttr, attributes, primaryAttr, updateRecord],
  );

  const handleFieldSave = useCallback(
    (attr: Attribute) => (value: unknown) => {
      if (!recordId) return;
      updateRecord.mutate(
        { id: recordId, data: buildAttributeWritePayload(attr, value) },
        {
          onError: () => {
            toast.error("Failed to save field");
          },
        },
      );
    },
    [recordId, updateRecord],
  );

  const handleDelete = useCallback(async () => {
    if (!recordId) return;
    try {
      await deleteRecord.mutateAsync(recordId);
      navigate(`/objects/${objectSlug}`);
    } catch (err) {
      showError(
        err,
        `Failed to delete ${obj?.singularName?.toLowerCase() ?? "record"}`,
      );
    }
  }, [recordId, deleteRecord, navigate, objectSlug, obj]);

  const hiddenNameColumns = useMemo(
    () =>
      new Set(
        [
          primaryAttr?.columnName,
          usesSplitName ? firstNameAttr?.columnName : undefined,
          usesSplitName ? lastNameAttr?.columnName : undefined,
        ].filter((columnName): columnName is string => Boolean(columnName)),
      ),
    [primaryAttr, usesSplitName, firstNameAttr, lastNameAttr],
  );

  const editableAttributes = useMemo(
    () =>
      attributes
        .filter((a) => !a.isSystem && !hiddenNameColumns.has(a.columnName))
        .sort((a, b) => a.order - b.order),
    [attributes, hiddenNameColumns],
  );

  const systemAttributes = useMemo(
    () =>
      attributes
        .filter((a) => a.isSystem && a.columnName !== "Id")
        .sort((a, b) => a.order - b.order),
    [attributes],
  );

  const isValueEmpty = useCallback(
    (attr: Attribute, val: unknown) => {
      const fieldType = getFieldType(attr.uiType);
      return fieldType.isEmpty(val);
    },
    [],
  );

  const visibleEditableAttributes = useMemo(() => {
    if (showAllFields) return editableAttributes;
    return editableAttributes.filter((attr) => {
      if (!record) return true;
      const rec = record as Record<string, unknown>;
      return !isValueEmpty(attr, getRecordValue(rec, attr.columnName));
    });
  }, [editableAttributes, record, showAllFields, isValueEmpty]);

  const emptyFieldsCount = useMemo(() => {
    if (!record) return 0;
    const rec = record as Record<string, unknown>;
    return editableAttributes.filter((attr) =>
      isValueEmpty(attr, getRecordValue(rec, attr.columnName)),
    ).length;
  }, [editableAttributes, record, isValueEmpty]);

  const hiddenCount =
    editableAttributes.length - visibleEditableAttributes.length;

  return {
    objectSlug,
    recordId,
    numericRecordId,
    obj,
    record,
    attributes,
    isPending,
    isError,
    displayName,
    nameFieldLabel,
    nameEditorMode,
    nameSingleValue,
    nameFirstValue,
    nameLastValue,
    activeTab,
    setActiveTab,
    confirmDeleteOpen,
    setConfirmDeleteOpen,
    showAllFields,
    setShowAllFields,
    editableAttributes,
    visibleEditableAttributes,
    systemAttributes,
    hiddenCount,
    emptyFieldsCount,
    breadcrumbPortal,
    headerActionsPortal,
    handleNameSave,
    handleFieldSave,
    handleDelete,
    handleDuplicate,
    listIdsLength: listIds.length,
    prevId,
    nextId,
    onPrev: () => prevId != null && navigate(`/objects/${objectSlug}/${prevId}`),
    onNext: () => nextId != null && navigate(`/objects/${objectSlug}/${nextId}`),
    updateRecord,
    deleteRecord,
  };
}
