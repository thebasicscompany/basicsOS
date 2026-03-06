import { useParams, Link, useNavigate } from "react-router";
import {
  ArrowLeftIcon,
  NoteIcon,
  ClockIcon,
  CheckCircleIcon,
  CaretRightIcon,
  CaretLeftIcon,
  DotsThreeIcon,
  CopyIcon,
  TrashIcon,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getRecordValue } from "@/lib/crm/field-mapper";
import {
  DetailSkeleton,
  EditableRecordName,
  NotesTabContent,
  RecordDetailDetailsSidebar,
  RecordDetailDeleteDialog,
  useRecordDetail,
} from "@/components/record-detail";

export function RecordDetailPage() {
  const { objectSlug = "" } = useParams<{ objectSlug: string }>();
  const navigate = useNavigate();
  const {
    objectSlug: objSlug,
    numericRecordId,
    obj,
    record,
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
    listIdsLength,
    prevId,
    nextId,
    onPrev,
    onNext,
    deleteRecord,
  } = useRecordDetail();

  if (!obj) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
        <p className="text-lg font-medium">Object not found</p>
        <p className="text-sm text-muted-foreground">
          No object with slug &ldquo;{objectSlug}&rdquo; exists.
        </p>
        <Button variant="outline" size="sm" asChild>
          <Link to="/home">
            <ArrowLeftIcon className="mr-1.5 h-4 w-4" />
            Back to home
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
            <ArrowLeftIcon className="mr-1.5 h-4 w-4" />
            Back to {obj.pluralName}
          </Link>
        </Button>
      </div>
    );
  }

  const rec = record as Record<string, unknown>;

  return (
    <>
      {breadcrumbPortal}
      {headerActionsPortal}

      <div className="space-y-5 pb-8">
        {/* Record header — single line with inline actions */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="size-7 shrink-0"
            onClick={() => navigate(`/objects/${objectSlug}`)}
          >
            <ArrowLeftIcon className="size-4" />
          </Button>
          <EditableRecordName
            variant="heading"
            displayName={displayName}
            label={nameFieldLabel}
            mode={nameEditorMode}
            singleValue={nameSingleValue}
            firstName={nameFirstValue}
            lastName={nameLastValue}
            onSave={handleNameSave}
          />
          <span className="shrink-0 text-xs text-muted-foreground">
            {obj.singularName}
          </span>
          <div className="ml-auto flex shrink-0 items-center gap-1">
            {listIdsLength > 1 && (
              <div className="flex">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7 rounded-r-none"
                  disabled={prevId == null}
                  onClick={onPrev}
                >
                  <CaretLeftIcon className="size-3.5" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7 rounded-l-none border-l-0"
                  disabled={nextId == null}
                  onClick={onNext}
                >
                  <CaretRightIcon className="size-3.5" />
                </Button>
              </div>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="h-7 w-7">
                  <DotsThreeIcon className="size-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleDuplicate}>
                  <CopyIcon className="mr-2 h-4 w-4" />
                  Duplicate
                </DropdownMenuItem>
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => setConfirmDeleteOpen(true)}
                >
                  <TrashIcon className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Main content grid */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_400px] xl:grid-cols-[minmax(0,1fr)_440px]">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="activity">Activity</TabsTrigger>
              <TabsTrigger value="notes">Notes</TabsTrigger>
              <TabsTrigger value="tasks">Tasks</TabsTrigger>
            </TabsList>

            {/* Overview: recent activity feed + quick links */}
            <TabsContent value="overview" className="mt-4 space-y-5">
              {/* Recent Activity */}
              <div>
                <button
                  type="button"
                  onClick={() => setActiveTab("activity")}
                  className="group mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground hover:text-foreground"
                >
                  <ClockIcon className="size-3.5" />
                  Activity
                  <CaretRightIcon className="size-3 opacity-0 transition-opacity group-hover:opacity-100" />
                </button>
                <div className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
                  No recent activity.
                </div>
              </div>

              {/* Recent Notes */}
              <div>
                <button
                  type="button"
                  onClick={() => setActiveTab("notes")}
                  className="group mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground hover:text-foreground"
                >
                  <NoteIcon className="size-3.5" />
                  Notes
                  <CaretRightIcon className="size-3 opacity-0 transition-opacity group-hover:opacity-100" />
                </button>
                <div className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
                  No notes yet.
                </div>
              </div>

              {/* Recent Tasks */}
              <div>
                <button
                  type="button"
                  onClick={() => setActiveTab("tasks")}
                  className="group mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground hover:text-foreground"
                >
                  <CheckCircleIcon className="size-3.5" />
                  Tasks
                  <CaretRightIcon className="size-3 opacity-0 transition-opacity group-hover:opacity-100" />
                </button>
                <div className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
                  No tasks yet.
                </div>
              </div>
            </TabsContent>

            <TabsContent value="activity" className="mt-4">
              <div className="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">
                No activity yet.
              </div>
            </TabsContent>

            <TabsContent value="notes" className="mt-4">
              <NotesTabContent
                objectSlug={objSlug}
                recordId={numericRecordId}
              />
            </TabsContent>

            <TabsContent value="tasks" className="mt-4">
              <div className="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">
                No tasks yet.
              </div>
            </TabsContent>
          </Tabs>

          <RecordDetailDetailsSidebar
            displayName={displayName}
            nameFieldLabel={nameFieldLabel}
            nameEditorMode={nameEditorMode}
            nameSingleValue={nameSingleValue}
            nameFirstValue={nameFirstValue}
            nameLastValue={nameLastValue}
            record={rec}
            visibleEditableAttributes={visibleEditableAttributes}
            systemAttributes={systemAttributes}
            showAllFields={showAllFields}
            hiddenCount={hiddenCount}
            onNameSave={handleNameSave}
            onFieldSave={handleFieldSave}
            onShowAllFields={() => setShowAllFields(true)}
            onHideEmptyFields={() => setShowAllFields(false)}
          />
        </div>
      </div>

      <RecordDetailDeleteDialog
        open={confirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
        displayName={displayName}
        onConfirm={handleDelete}
        isDeleting={deleteRecord.isPending}
      />
    </>
  );
}
