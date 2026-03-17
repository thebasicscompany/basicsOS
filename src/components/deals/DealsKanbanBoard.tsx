import { useCallback, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from "@hello-pangea/dnd";
import { PlusIcon, GearSix, TrashSimple } from "@phosphor-icons/react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from "@/components/ui/context-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useRecords, useUpdateRecord } from "@/hooks/use-records";
import {
  useAttributes,
  useUpsertAttributeOverride,
} from "@/hooks/use-object-registry";
import { DealStageBadge } from "@/components/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  EditPipelineDialog,
  type StageOption,
} from "@/components/deals/EditPipelineDialog";

function formatCurrency(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
}

export function DealsKanbanBoard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data, isPending } = useRecords("deals", {
    perPage: 200,
    page: 1,
  });
  const updateRecord = useUpdateRecord("deals");
  const attributes = useAttributes("deals");
  const upsertOverride = useUpsertAttributeOverride("deals");

  const [addStageOpen, setAddStageOpen] = useState(false);
  const [newStageName, setNewStageName] = useState("");
  const [pendingDealId, setPendingDealId] = useState<number | null>(null);
  const [editPipelineOpen, setEditPipelineOpen] = useState(false);

  const stageAttr = useMemo(
    () =>
      attributes.find(
        (a) => a.columnName === "status" || a.columnName === "Status",
      ),
    [attributes],
  );

  const stageOptions = useMemo<StageOption[]>(() => {
    const raw = (stageAttr?.config?.options ?? []) as Array<
      string | StageOption
    >;
    return raw
      .map((o, i) =>
        typeof o === "string"
          ? { id: o, label: o, order: i }
          : { id: o.id, label: o.label, color: o.color, order: o.order ?? i },
      )
      .filter((o) => o.id);
  }, [stageAttr]);

  const configuredStageIds = useMemo(
    () => stageOptions.map((o) => o.id),
    [stageOptions],
  );

  const deals = useMemo(
    () => (data?.data ?? []) as Record<string, unknown>[],
    [data?.data],
  );

  const allStageIds = useMemo(() => {
    const ordered = [...configuredStageIds];
    const known = new Set(ordered);
    for (const d of deals) {
      const s = (d.status ?? d.Status) as string | undefined;
      if (s && !known.has(s)) {
        ordered.push(s);
        known.add(s);
      }
    }
    return ordered;
  }, [configuredStageIds, deals]);

  const dealsByStage = useMemo(() => {
    const map: Record<string, typeof deals> = {};
    for (const s of allStageIds) map[s] = [];
    for (const d of deals) {
      const s = ((d.status ?? d.Status) as string) || allStageIds[0] || "new";
      if (!map[s]) map[s] = [];
      map[s].push(d);
    }
    return map;
  }, [deals, allStageIds]);

  const [localColumns, setLocalColumns] = useState<Record<
    string,
    Record<string, unknown>[]
  > | null>(null);

  const [localStageOrder, setLocalStageOrder] = useState<string[] | null>(null);
  const displayStageIds = localStageOrder ?? allStageIds;

  // Poll pipeline config while board is open so other members see add/delete/reorder without restart
  useEffect(() => {
    queryClient.refetchQueries({ queryKey: ["object-config"] });
    const interval = setInterval(() => {
      queryClient.refetchQueries({ queryKey: ["object-config"] });
    }, 8000);
    return () => clearInterval(interval);
  }, [queryClient]);

  useEffect(() => {
    setLocalStageOrder(null);
  }, [allStageIds]);

  useEffect(() => {
    setLocalColumns((prev) => {
      if (!prev) return dealsByStage;
      const next: Record<string, Record<string, unknown>[]> = {};

      for (const stage of allStageIds) {
        const apiDeals = dealsByStage[stage] || [];
        const prevDeals = prev[stage] || [];
        const prevDealMap = new Map(
          prevDeals.map((d) => [(d.id ?? d.Id) as number, d]),
        );

        const newDeals: Record<string, unknown>[] = [];
        for (const d of prevDeals) {
          const apiDeal = apiDeals.find(
            (ad) => (ad.id ?? ad.Id) === (d.id ?? d.Id),
          );
          if (apiDeal) newDeals.push(apiDeal);
        }
        for (const ad of apiDeals) {
          if (!prevDealMap.has((ad.id ?? ad.Id) as number)) {
            newDeals.push(ad);
          }
        }
        next[stage] = newDeals;
      }
      return next;
    });
  }, [dealsByStage, allStageIds]);

  const persistStageOptions = useCallback(
    (updatedOptions: StageOption[]) => {
      upsertOverride.mutate(
        {
          columnName: "status",
          config: { ...stageAttr?.config, options: updatedOptions },
        },
        {
          onError: () => toast.error("Failed to save pipeline changes"),
        },
      );
    },
    [stageAttr, upsertOverride],
  );

  const handleDragEnd = useCallback(
    (result: DropResult) => {
      if (!result.destination) return;

      if (result.type === "COLUMN") {
        const sourceIdx = result.source.index;
        const destIdx = result.destination.index;
        if (sourceIdx === destIdx) return;

        const reordered = [...displayStageIds];
        const [moved] = reordered.splice(sourceIdx, 1);
        reordered.splice(destIdx, 0, moved);
        setLocalStageOrder(reordered);

        const updatedOptions = reordered.map((id, i) => {
          const existing = stageOptions.find((o) => o.id === id);
          return existing
            ? { ...existing, order: i }
            : { id, label: id, color: "gray", order: i };
        });
        persistStageOptions(updatedOptions);
        return;
      }

      const dealId = result.draggableId.replace(/^deal-/, "");
      const sourceStage = result.source.droppableId;
      const targetStage = result.destination.droppableId;
      const sourceIndex = result.source.index;
      const destinationIndex = result.destination.index;

      const id = parseInt(dealId, 10);
      if (isNaN(id)) return;

      if (targetStage === "add-stage") {
        setPendingDealId(id);
        setNewStageName("");
        setAddStageOpen(true);
        return;
      }

      if (sourceStage === targetStage && sourceIndex === destinationIndex) {
        return;
      }

      setLocalColumns((prev) => {
        if (!prev) return prev;
        const newCols = { ...prev };
        const sourceList = [...(newCols[sourceStage] || [])];
        const [movedItem] = sourceList.splice(sourceIndex, 1);

        if (!movedItem) return prev;

        if (sourceStage === targetStage) {
          sourceList.splice(destinationIndex, 0, movedItem);
          newCols[sourceStage] = sourceList;
        } else {
          const targetList = [...(newCols[targetStage] || [])];
          const updatedItem = {
            ...movedItem,
            status: targetStage,
            Status: targetStage,
          };
          targetList.splice(destinationIndex, 0, updatedItem);
          newCols[sourceStage] = sourceList;
          newCols[targetStage] = targetList;
        }
        return newCols;
      });

      if (sourceStage !== targetStage) {
        updateRecord.mutate({ id, data: { status: targetStage } });
      }
    },
    [updateRecord, displayStageIds, stageOptions, persistStageOptions],
  );

  const handleDeleteStage = useCallback(
    (stageId: string) => {
      const stageDeals =
        (localColumns?.[stageId] || dealsByStage[stageId]) ?? [];
      const remaining = displayStageIds.filter((s) => s !== stageId);
      if (remaining.length === 0) {
        toast.error("Cannot delete the only stage");
        return;
      }

      const idx = displayStageIds.indexOf(stageId);
      const targetStage =
        remaining[Math.min(idx, remaining.length - 1)] ?? remaining[0];

      if (stageDeals.length > 0) {
        for (const deal of stageDeals) {
          const id = (deal.id ?? deal.Id) as number;
          updateRecord.mutate({ id, data: { status: targetStage } });
        }

        setLocalColumns((prev) => {
          if (!prev) return prev;
          const newCols = { ...prev };
          const movedDeals = (newCols[stageId] || []).map((d) => ({
            ...d,
            status: targetStage,
            Status: targetStage,
          }));
          newCols[targetStage] = [
            ...(newCols[targetStage] || []),
            ...movedDeals,
          ];
          delete newCols[stageId];
          return newCols;
        });
      } else {
        setLocalColumns((prev) => {
          if (!prev) return prev;
          const newCols = { ...prev };
          delete newCols[stageId];
          return newCols;
        });
      }

      setLocalStageOrder(remaining);

      const updatedOptions = remaining.map((id, i) => {
        const existing = stageOptions.find((o) => o.id === id);
        return existing
          ? { ...existing, order: i }
          : { id, label: id, color: "gray", order: i };
      });
      persistStageOptions(updatedOptions);
      toast.success(
        stageDeals.length > 0
          ? `Deleted stage and moved ${stageDeals.length} deal${stageDeals.length === 1 ? "" : "s"}`
          : "Stage deleted",
      );
    },
    [
      displayStageIds,
      localColumns,
      dealsByStage,
      stageOptions,
      updateRecord,
      persistStageOptions,
    ],
  );

  const handleAddStageSubmit = useCallback(() => {
    const slug = newStageName
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "");
    if (!slug) return;

    if (pendingDealId != null) {
      updateRecord.mutate({ id: pendingDealId, data: { status: slug } });
    }

    const alreadyExists = stageOptions.some((o) => o.id === slug);
    if (!alreadyExists) {
      const updatedOptions: StageOption[] = [
        ...stageOptions,
        {
          id: slug,
          label: newStageName.trim(),
          color: "gray",
          order: stageOptions.length,
        },
      ];
      upsertOverride.mutate(
        {
          columnName: "status",
          config: { ...stageAttr?.config, options: updatedOptions },
        },
        {
          onSuccess: () =>
            toast.success(`Stage "${newStageName.trim()}" added`),
          onError: () => toast.error("Failed to save stage"),
        },
      );
    }

    setPendingDealId(null);
    setNewStageName("");
    setAddStageOpen(false);
  }, [
    newStageName,
    pendingDealId,
    updateRecord,
    stageOptions,
    stageAttr,
    upsertOverride,
  ]);

  const handleEditPipelineSave = useCallback(
    (updatedStages: StageOption[]) => {
      // Normalize temp ids (stage-123...) to slug from label so column headers show correctly
      const slug = (s: string) =>
        s
          .trim()
          .toLowerCase()
          .replace(/\s+/g, "-")
          .replace(/[^a-z0-9-]/g, "");
      const seen = new Set<string>();
      const normalized = updatedStages.map((s) => {
        let id = s.id;
        if (id.startsWith("stage-")) {
          const base = slug(s.label) || "stage";
          id = base;
          let n = 1;
          while (seen.has(id)) {
            id = `${base}-${n}`;
            n += 1;
          }
          seen.add(id);
        } else {
          seen.add(id);
        }
        return { ...s, id, order: s.order };
      });
      upsertOverride.mutate(
        {
          columnName: "status",
          config: { ...stageAttr?.config, options: normalized },
        },
        {
          onSuccess: () => {
            toast.success("Pipeline updated");
            setEditPipelineOpen(false);
          },
          onError: () => toast.error("Failed to save pipeline"),
        },
      );
    },
    [stageAttr, upsertOverride],
  );

  const handleCardClick = useCallback(
    (dealId: number) => {
      navigate(`/objects/deals/${dealId}`);
    },
    [navigate],
  );

  if (isPending) {
    return (
      <div className="flex gap-4 overflow-x-auto pb-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="w-72 shrink-0 space-y-2">
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mb-2 flex items-center justify-end">
        <Button
          variant="outline"
          size="xs"
          onClick={() => setEditPipelineOpen(true)}
        >
          <GearSix className="mr-1.5 size-3.5" />
          Edit Pipeline
        </Button>
      </div>

      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable
          droppableId="board"
          type="COLUMN"
          direction="horizontal"
        >
          {(boardProvided) => (
            <div
              ref={boardProvided.innerRef}
              {...boardProvided.droppableProps}
              className="flex gap-4 overflow-x-auto pb-4"
            >
              {displayStageIds.map((stageId, colIndex) => (
                <Draggable
                  key={stageId}
                  draggableId={`col-${stageId}`}
                  index={colIndex}
                >
                  {(colProvided, colSnapshot) => (
                    <div
                      ref={colProvided.innerRef}
                      {...colProvided.draggableProps}
                      className={cn(
                        "flex w-72 shrink-0 flex-col rounded-lg bg-muted/50 transition-colors",
                        colSnapshot.isDragging &&
                          "shadow-lg ring-2 ring-primary/30",
                      )}
                    >
                      <ContextMenu>
                        <ContextMenuTrigger asChild>
                          <div
                            {...colProvided.dragHandleProps}
                            className="flex cursor-grab items-center gap-2 px-3 py-2 active:cursor-grabbing"
                          >
                            <DealStageBadge stage={stageId} options={stageOptions} />
                            <span className="text-xs text-muted-foreground">
                              {(
                                localColumns?.[stageId] ||
                                dealsByStage[stageId]
                              )?.length ?? 0}{" "}
                              deals
                            </span>
                          </div>
                        </ContextMenuTrigger>
                        <ContextMenuContent>
                          <ContextMenuItem
                            onClick={() => setEditPipelineOpen(true)}
                          >
                            <GearSix className="mr-2 size-4" />
                            Edit Pipeline
                          </ContextMenuItem>
                          <ContextMenuSeparator />
                          <ContextMenuItem
                            variant="destructive"
                            disabled={displayStageIds.length <= 1}
                            onClick={() => handleDeleteStage(stageId)}
                          >
                            <TrashSimple className="mr-2 size-4" />
                            Delete stage
                            {((localColumns?.[stageId] ||
                              dealsByStage[stageId]) ??
                              []).length > 0 && (
                              <span className="ml-auto text-xs opacity-60">
                                moves deals
                              </span>
                            )}
                          </ContextMenuItem>
                        </ContextMenuContent>
                      </ContextMenu>

                      <Droppable droppableId={stageId} type="CARD">
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.droppableProps}
                            className={cn(
                              "min-h-[120px] flex-1 space-y-2 overflow-y-auto p-2 transition-colors",
                              snapshot.isDraggingOver && "bg-muted/70",
                            )}
                          >
                            {(
                              (localColumns?.[stageId] ||
                                dealsByStage[stageId]) ??
                              []
                            ).map((deal, index) => {
                              const id = (deal.id ?? deal.Id) as number;
                              const name = (deal.name ??
                                deal.Name ??
                                "Deal") as string;
                              const amount = Number(
                                deal.amount ?? deal.Amount ?? 0,
                              );
                              return (
                                <Draggable
                                  key={`deal-${id}`}
                                  draggableId={`deal-${id}`}
                                  index={index}
                                >
                                  {(provided, snapshot) => (
                                    <div
                                      ref={provided.innerRef}
                                      {...provided.draggableProps}
                                      {...provided.dragHandleProps}
                                      onClick={() => handleCardClick(id)}
                                      className={cn(
                                        "cursor-pointer rounded-md border bg-card p-3 shadow-sm transition-shadow hover:shadow-md",
                                        snapshot.isDragging &&
                                          "shadow-lg ring-2 ring-primary/50",
                                      )}
                                    >
                                      <p className="truncate font-medium">
                                        {name}
                                      </p>
                                      {amount > 0 && (
                                        <p className="text-sm text-muted-foreground">
                                          {formatCurrency(amount)}
                                        </p>
                                      )}
                                    </div>
                                  )}
                                </Draggable>
                              );
                            })}
                            {provided.placeholder}
                          </div>
                        )}
                      </Droppable>
                    </div>
                  )}
                </Draggable>
              ))}
              {boardProvided.placeholder}

              <Droppable
                key="add-stage"
                droppableId="add-stage"
                type="CARD"
              >
                {(provided, snapshot) => (
                  <Popover
                    open={addStageOpen}
                    onOpenChange={(o) => {
                      setAddStageOpen(o);
                      if (!o) {
                        setPendingDealId(null);
                        setNewStageName("");
                      }
                    }}
                  >
                    <PopoverTrigger asChild>
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        onClick={() => {
                          setNewStageName("");
                          setPendingDealId(null);
                          setAddStageOpen(true);
                        }}
                        className={cn(
                          "flex w-48 shrink-0 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed transition-colors",
                          snapshot.isDraggingOver
                            ? "border-primary bg-primary/10"
                            : "border-border bg-muted/40 hover:bg-muted/50",
                        )}
                      >
                        <PlusIcon className="h-6 w-6 text-muted-foreground" />
                        <span className="mt-1 text-xs text-muted-foreground">
                          Add stage
                        </span>
                        {provided.placeholder}
                      </div>
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-64 p-3">
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          handleAddStageSubmit();
                        }}
                        className="flex flex-col gap-3"
                      >
                        <h4 className="text-xs font-medium text-muted-foreground">
                          New stage
                        </h4>
                        <Input
                          autoFocus
                          placeholder="e.g. Qualification"
                          value={newStageName}
                          onChange={(e) => setNewStageName(e.target.value)}
                          className="h-8 text-sm"
                        />
                        {pendingDealId != null && (
                          <p className="text-[11px] text-muted-foreground">
                            The dropped deal will be moved to this new stage.
                          </p>
                        )}
                        <div className="flex justify-end gap-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="xs"
                            onClick={() => {
                              setAddStageOpen(false);
                              setPendingDealId(null);
                            }}
                          >
                            Cancel
                          </Button>
                          <Button
                            type="submit"
                            size="xs"
                            disabled={
                              !newStageName.trim() || upsertOverride.isPending
                            }
                          >
                            {upsertOverride.isPending
                              ? "Saving..."
                              : "Add stage"}
                          </Button>
                        </div>
                      </form>
                    </PopoverContent>
                  </Popover>
                )}
              </Droppable>
            </div>
          )}
        </Droppable>
      </DragDropContext>

      <EditPipelineDialog
        open={editPipelineOpen}
        onOpenChange={setEditPipelineOpen}
        stages={stageOptions}
        onSave={handleEditPipelineSave}
        isSaving={upsertOverride.isPending}
      />
    </div>
  );
}
