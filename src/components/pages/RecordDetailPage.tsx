import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router";
import {
  ArrowLeft,
  Star,
  MoreHorizontal,
  Pencil,
  Trash2,
  Copy,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { HugeiconsIcon } from "@hugeicons/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DetailField } from "@/components/cells";
import { getObjectIcon } from "@/lib/object-icon-map";
import {
  useObject,
  useAttributes,
} from "@/hooks/use-object-registry";
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
import { cn } from "@/lib/utils";
import { usePageTitle } from "@/contexts/page-header";

/* ------------------------------------------------------------------ */
/*  Loading skeleton                                                   */
/* ------------------------------------------------------------------ */

function DetailSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-6 w-48" />
      <div className="flex items-center gap-4">
        <Skeleton className="h-16 w-16 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-7 w-56" />
          <Skeleton className="h-4 w-36" />
        </div>
      </div>
      <Separator />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-3">
          <Skeleton className="h-9 w-72" />
          <Skeleton className="h-64 w-full" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  RecordDetailPage                                                   */
/* ------------------------------------------------------------------ */

export function RecordDetailPage() {
  const { objectSlug = "", recordId: recordIdParam = "" } = useParams<{
    objectSlug: string;
    recordId: string;
  }>();
  const navigate = useNavigate();
  const recordId = /^\d+$/.test(recordIdParam)
    ? parseInt(recordIdParam, 10)
    : recordIdParam;

  // Object registry
  const obj = useObject(objectSlug);
  const attributes = useAttributes(objectSlug);

  // Record data
  const {
    data: record,
    isPending,
    isError,
  } = useRecord(objectSlug, recordId || null);
  const updateRecord = useUpdateRecord(objectSlug);
  const deleteRecord = useDeleteRecord(objectSlug);
  const createRecord = useCreateRecord(objectSlug);

  // Favorites
  const numericRecordId =
    typeof recordId === "number"
      ? recordId
      : parseInt(String(recordId), 10) || 0;
  const isFavorite = useIsFavorite(objectSlug, numericRecordId);
  const toggleFavoriteMutation = useToggleFavorite();

  // Recent items
  const [, addRecentItem] = useRecentItems();

  // Delete confirmation
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  // Hide empty fields toggle
  const [showAllFields, setShowAllFields] = useState(false);

  // Find the primary attribute
  const primaryAttr = useMemo(
    () => attributes.find((a) => a.isPrimary),
    [attributes],
  );

  // Derive the record display name from the primary attribute
  const displayName = useMemo(() => {
    if (!record || !primaryAttr) return "\u2026";
    const val = (record as Record<string, unknown>)[primaryAttr.columnName];
    return typeof val === "string" && val ? val : "Unnamed";
  }, [record, primaryAttr]);

  // Register record name in the layout header
  usePageTitle(displayName === "\u2026" ? "" : displayName)

  // Track as recent item
  useEffect(() => {
    if (!record || !obj || !recordId) return;
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
  }, [record, obj, recordId, objectSlug, displayName, addRecentItem]);

  // Document title
  useEffect(() => {
    if (displayName && displayName !== "\u2026") {
      document.title = `${displayName} | Basics CRM`;
    }
    return () => {
      document.title = "Basics CRM";
    };
  }, [displayName]);

  // Keyboard escape -> back to list
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !confirmDeleteOpen) {
        navigate(`/objects/${objectSlug}`);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [navigate, objectSlug, confirmDeleteOpen]);

  // ----- Prev/Next navigation -----
  const { data: listData } = useRecords(objectSlug, {
    page: 1,
    perPage: 200,
  });

  const listIds = useMemo(
    () => (listData?.data ?? []).map((r) => (r as Record<string, unknown>).Id as number),
    [listData],
  );

  const currentIndex = listIds.indexOf(recordId as number);
  const prevId = currentIndex > 0 ? listIds[currentIndex - 1] : null;
  const nextId =
    currentIndex >= 0 && currentIndex < listIds.length - 1
      ? listIds[currentIndex + 1]
      : null;

  // ----- Handlers -----

  const handleFieldSave = useCallback(
    (attr: Attribute) => (value: unknown) => {
      if (!recordId) return;
      updateRecord.mutate(
        { id: recordId, data: { [attr.columnName]: value } },
        {
          onError: () => {
            toast.error("Failed to save field");
          },
        },
      );
    },
    [recordId, updateRecord],
  );

  const handleToggleFavorite = useCallback(() => {
    if (!numericRecordId) return;
    toggleFavoriteMutation.mutate({
      objectSlug,
      recordId: numericRecordId,
    });
  }, [objectSlug, numericRecordId, toggleFavoriteMutation]);

  const handleDelete = useCallback(async () => {
    if (!recordId) return;
    try {
      await deleteRecord.mutateAsync(recordId);
      navigate(`/objects/${objectSlug}`);
    } catch {
      toast.error(
        `Failed to delete ${obj?.singularName?.toLowerCase() ?? "record"}`,
      );
    }
  }, [recordId, deleteRecord, navigate, objectSlug, obj]);

  const handleDuplicate = useCallback(async () => {
    if (!record || !obj || !primaryAttr) return;
    const rec = record as Record<string, unknown>;
    const data: Record<string, unknown> = {};
    for (const attr of attributes) {
      if (attr.isSystem || attr.columnName === "Id") continue;
      if (rec[attr.columnName] != null) {
        data[attr.columnName] = rec[attr.columnName];
      }
    }
    // Prefix the primary field with "(copy)"
    const primaryVal = rec[primaryAttr.columnName];
    if (typeof primaryVal === "string") {
      data[primaryAttr.columnName] = `${primaryVal} (copy)`;
    }
    try {
      const created = await createRecord.mutateAsync(data);
      const newId = (created as Record<string, unknown>).Id;
      if (newId != null) {
        navigate(`/objects/${objectSlug}/${newId}`);
        toast.success("Record duplicated");
      }
    } catch {
      toast.error("Failed to duplicate record");
    }
  }, [record, obj, primaryAttr, attributes, createRecord, navigate, objectSlug]);

  // ----- Attribute grouping -----

  const editableAttributes = useMemo(
    () =>
      attributes
        .filter((a) => !a.isSystem && !a.isPrimary)
        .sort((a, b) => a.order - b.order),
    [attributes],
  );

  const systemAttributes = useMemo(
    () =>
      attributes
        .filter((a) => a.isSystem && a.columnName !== "Id")
        .sort((a, b) => a.order - b.order),
    [attributes],
  );

  // Filter visible fields based on showAllFields toggle
  const visibleEditableAttributes = useMemo(() => {
    if (showAllFields) return editableAttributes;
    return editableAttributes.filter((attr) => {
      if (!record) return true;
      const rec = record as Record<string, unknown>;
      const val = rec[attr.columnName];
      return val != null && val !== "" && val !== false;
    });
  }, [editableAttributes, record, showAllFields]);

  const hiddenCount =
    editableAttributes.length - visibleEditableAttributes.length;

  // ----- Render -----

  if (!obj) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
        <p className="text-lg font-medium">Object not found</p>
        <p className="text-sm text-muted-foreground">
          No object with slug &ldquo;{objectSlug}&rdquo; exists.
        </p>
        <Button variant="outline" size="sm" asChild>
          <Link to="/dashboard">
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Back to dashboard
          </Link>
        </Button>
      </div>
    );
  }

  if (isPending) {
    return <DetailSkeleton />;
  }

  if (isError || !record) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
        <p className="text-lg font-medium">{obj.singularName} not found</p>
        <Button variant="outline" size="sm" asChild>
          <Link to={`/objects/${objectSlug}`}>
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Back to {obj.pluralName}
          </Link>
        </Button>
      </div>
    );
  }

  const IconComponent = getObjectIcon(obj.icon);
  const rec = record as Record<string, unknown>;

  return (
    <>
      <div className="space-y-6 pt-4 pb-8">
        {/* ---- Breadcrumb ---- */}
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to="/dashboard">Objects</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to={`/objects/${objectSlug}`}>{obj.pluralName}</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{displayName}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {/* ---- Header ---- */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            {/* Back button */}
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0 h-10 w-10"
              onClick={() => navigate(`/objects/${objectSlug}`)}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>

            {/* Icon */}
            <div
              className={cn(
                "flex h-12 w-12 shrink-0 items-center justify-center rounded-lg",
                "bg-primary/10",
              )}
            >
              <HugeiconsIcon
                icon={IconComponent}
                className={cn("h-6 w-6", obj.iconColor)}
              />
            </div>

            {/* Title */}
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold tracking-tight truncate">
                {displayName}
              </h1>
              <p className="text-sm text-muted-foreground">
                {obj.singularName}
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Prev / Next */}
            {listIds.length > 1 && (
              <div className="flex">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 rounded-r-none"
                  disabled={prevId == null}
                  onClick={() =>
                    prevId != null &&
                    navigate(`/objects/${objectSlug}/${prevId}`)
                  }
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 rounded-l-none border-l-0"
                  disabled={nextId == null}
                  onClick={() =>
                    nextId != null &&
                    navigate(`/objects/${objectSlug}/${nextId}`)
                  }
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}

            {/* Favorite */}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handleToggleFavorite}
            >
              <Star
                className={cn(
                  "h-4 w-4",
                  isFavorite
                    ? "fill-amber-400 text-amber-400"
                    : "text-muted-foreground",
                )}
              />
            </Button>

            {/* Actions dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="h-8 w-8">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => navigate(`/objects/${objectSlug}/${recordId}`)}
                >
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleDuplicate}>
                  <Copy className="mr-2 h-4 w-4" />
                  Duplicate
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => setConfirmDeleteOpen(true)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <Separator />

        {/* ---- Body: Main Content + Details Sidebar ---- */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
          {/* ---- Main Content (Tabs) ---- */}
          <Tabs defaultValue="overview">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="activity">Activity</TabsTrigger>
              <TabsTrigger value="notes">Notes</TabsTrigger>
              <TabsTrigger value="tasks">Tasks</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="mt-4 space-y-6">
              {/* All editable fields rendered as DetailField */}
              <div className="space-y-0.5">
                {editableAttributes.map((attr) => (
                  <DetailField
                    key={attr.id}
                    attribute={attr}
                    value={rec[attr.columnName]}
                    onSave={handleFieldSave(attr)}
                  />
                ))}
              </div>
            </TabsContent>

            <TabsContent value="activity" className="mt-4">
              <div className="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">
                No activity yet.
              </div>
            </TabsContent>

            <TabsContent value="notes" className="mt-4">
              <div className="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">
                No notes yet.
              </div>
            </TabsContent>

            <TabsContent value="tasks" className="mt-4">
              <div className="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">
                No tasks yet.
              </div>
            </TabsContent>
          </Tabs>

          {/* ---- Details Sidebar ---- */}
          <aside className="space-y-1 lg:border-l lg:pl-6">
            <h3 className="pb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Details
            </h3>

            {/* Editable fields */}
            {visibleEditableAttributes.map((attr) => (
              <DetailField
                key={attr.id}
                attribute={attr}
                value={rec[attr.columnName]}
                onSave={handleFieldSave(attr)}
              />
            ))}

            {/* Show/hide toggle */}
            {!showAllFields && hiddenCount > 0 && (
              <div className="pt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-muted-foreground"
                  onClick={() => setShowAllFields(true)}
                >
                  Show {hiddenCount} empty{" "}
                  {hiddenCount === 1 ? "field" : "fields"}
                </Button>
              </div>
            )}
            {showAllFields && (
              <div className="pt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-muted-foreground"
                  onClick={() => setShowAllFields(false)}
                >
                  Hide empty fields
                </Button>
              </div>
            )}

            {/* System fields (read-only) */}
            {systemAttributes.length > 0 && (
              <>
                <Separator className="my-2" />
                <h3 className="pb-1 pt-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  System
                </h3>
                {systemAttributes.map((attr) => (
                  <DetailField
                    key={attr.id}
                    attribute={attr}
                    value={rec[attr.columnName]}
                    onSave={handleFieldSave(attr)}
                    isReadOnly
                  />
                ))}
              </>
            )}
          </aside>
        </div>
      </div>

      {/* ---- Delete confirmation ---- */}
      <Dialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete {displayName}?</DialogTitle>
            <DialogDescription>This action cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmDeleteOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteRecord.isPending}
            >
              {deleteRecord.isPending ? "Deleting\u2026" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
