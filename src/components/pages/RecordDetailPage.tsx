import { useParams, Link, useNavigate } from "react-router";
import {
  ArrowLeftIcon,
  NoteIcon,
  CheckCircleIcon,
  EnvelopeSimpleIcon,
  CaretRightIcon,
  CaretLeftIcon,
  DotsThreeIcon,
  CopyIcon,
  TrashIcon,
  ArrowsClockwiseIcon,
  SparkleIcon,
  CircleNotchIcon,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useMemo } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DetailSkeleton,
  EditableRecordName,
  NotesTabContent,
  EmailsTabContent,
  CallsTabContent,
  TasksTabContent,
  ActivityTabContent,
  RecordDetailDetailsSidebar,
  RecordDetailDeleteDialog,
  useRecordDetail,
} from "@/components/record-detail";
import { getMockCalls } from "@/components/record-detail/mock-data/calls";
import { useRefreshCrm } from "@/hooks/use-records";
import { useContactEmails } from "@/hooks/use-email-sync";
import { useEnrich } from "@/hooks/use-enrichment";
import { toast } from "sonner";

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

  const refreshCrm = useRefreshCrm(objectSlug);
  const enrich = useEnrich();

  const isEnrichable =
    objectSlug === "contacts" || objectSlug === "companies";

  const handleEnrich = () => {
    if (!numericRecordId) return;
    enrich.mutate(
      {
        entityType: objectSlug === "contacts" ? "contact" : "company",
        entityId: numericRecordId,
      },
      {
        onSuccess: () => {
          toast.success("Record enriched successfully");
        },
        onError: (error) => {
          toast.error(
            error instanceof Error ? error.message : "Failed to enrich record",
          );
        },
      },
    );
  };

  const { data: emailsData } = useContactEmails(numericRecordId || undefined);
  const emailCount = emailsData?.total ?? 0;
  const callCount = useMemo(
    () => getMockCalls(numericRecordId).length,
    [numericRecordId],
  );

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

      <div className="flex min-h-0 flex-1 flex-col gap-5">
        {/* Record header — single line with inline actions */}
        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="size-7 shrink-0"
            onClick={() => navigate(-1)}
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
            {isEnrichable && (
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7"
                onClick={handleEnrich}
                disabled={enrich.isPending}
                title="Enrich record"
              >
                {enrich.isPending ? (
                  <CircleNotchIcon className="size-3.5 animate-spin" />
                ) : (
                  <SparkleIcon className="size-3.5" />
                )}
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="h-7 w-7">
                  <DotsThreeIcon className="size-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={refreshCrm}>
                  <ArrowsClockwiseIcon className="mr-2 h-4 w-4" />
                  Refresh to see updates
                </DropdownMenuItem>
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
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_400px] xl:grid-cols-[minmax(0,1fr)_440px]">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex min-h-0 flex-col">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="activity">Activity</TabsTrigger>
              <TabsTrigger value="emails" className="gap-1">
                Emails
                {emailCount > 0 && (
                  <span className="text-[10px] text-muted-foreground">
                    {emailCount}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="calls" className="gap-1">
                Calls
                {callCount > 0 && (
                  <span className="text-[10px] text-muted-foreground">
                    {callCount}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="notes">Notes</TabsTrigger>
              <TabsTrigger value="tasks">Tasks</TabsTrigger>
            </TabsList>

            {/* Overview: recent activity feed + quick links */}
            <TabsContent value="overview" className="mt-4 min-h-0 flex-1 space-y-5 overflow-y-auto">
              {/* Recent Emails */}
              <div>
                <button
                  type="button"
                  onClick={() => setActiveTab("emails")}
                  className="group mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground hover:text-foreground"
                >
                  <EnvelopeSimpleIcon className="size-3.5" />
                  Emails
                  <CaretRightIcon className="size-3 opacity-0 transition-opacity group-hover:opacity-100" />
                </button>
                {emailCount > 0 ? (
                  <div className="rounded-lg border p-3 text-xs text-muted-foreground">
                    {emailCount} email{emailCount !== 1 ? "s" : ""} in thread
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
                    No emails yet. Connect Gmail in Settings.
                  </div>
                )}
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

            <TabsContent value="activity" className="mt-4 min-h-0 flex-1 overflow-y-auto">
              <ActivityTabContent
                objectSlug={objSlug}
                recordId={numericRecordId}
                onSwitchToTab={setActiveTab}
              />
            </TabsContent>

            <TabsContent value="emails" className="mt-4 min-h-0 flex-1 overflow-y-auto">
              <EmailsTabContent recordId={numericRecordId} />
            </TabsContent>

            <TabsContent value="calls" className="mt-4 min-h-0 flex-1 overflow-y-auto">
              <CallsTabContent
                recordId={numericRecordId}
                objectSlug={objSlug}
                onSwitchToTab={setActiveTab}
              />
            </TabsContent>

            <TabsContent value="notes" className="mt-4 min-h-0 flex-1 overflow-y-auto">
              <NotesTabContent
                objectSlug={objSlug}
                recordId={numericRecordId}
              />
            </TabsContent>

            <TabsContent value="tasks" className="mt-4 min-h-0 flex-1 overflow-y-auto">
              <TasksTabContent
                objectSlug={objSlug}
                recordId={numericRecordId}
              />
            </TabsContent>
          </Tabs>

          <div className="min-h-0 overflow-y-auto">
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
