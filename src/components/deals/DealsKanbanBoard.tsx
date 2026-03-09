import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from "@hello-pangea/dnd";
import { PlusIcon } from "@phosphor-icons/react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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

interface StageOption {
  id: string;
  label: string;
  color?: string;
  order?: number;
}

function formatCurrency(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
}

export function DealsKanbanBoard() {
  const navigate = useNavigate();
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

  const handleDragEnd = useCallback(
    (result: DropResult) => {
      if (!result.destination) return;
      const dealId = result.draggableId.replace(/^deal-/, "");
      const targetStage = result.destination.droppableId;
      if (targetStage === result.source.droppableId) return;

      const id = parseInt(dealId, 10);
      if (isNaN(id)) return;

      if (targetStage === "add-stage") {
        setPendingDealId(id);
        setNewStageName("");
        setAddStageOpen(true);
        return;
      }

      updateRecord.mutate({ id, data: { status: targetStage } });
    },
    [updateRecord],
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
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4 pt-2">
          {allStageIds.map((stageId) => (
            <Droppable key={stageId} droppableId={stageId}>
              {(provided, snapshot) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className={cn(
                    "flex w-72 shrink-0 flex-col rounded-lg bg-muted/50 transition-colors",
                    snapshot.isDraggingOver && "bg-muted/70",
                  )}
                >
                  <div className="flex items-center gap-2 px-3 py-2">
                    <DealStageBadge stage={stageId} />
                    <span className="text-xs text-muted-foreground">
                      {dealsByStage[stageId]?.length ?? 0} deals
                    </span>
                  </div>
                  <div className="min-h-[120px] flex-1 space-y-2 overflow-y-auto p-2">
                    {(dealsByStage[stageId] ?? []).map((deal, index) => {
                      const id = (deal.id ?? deal.Id) as number;
                      const name = (deal.name ?? deal.Name ?? "Deal") as string;
                      const amount = Number(deal.amount ?? deal.Amount ?? 0);
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
                              <p className="font-medium truncate">{name}</p>
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
                </div>
              )}
            </Droppable>
          ))}
          <Droppable key="add-stage" droppableId="add-stage">
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
                        {upsertOverride.isPending ? "Saving..." : "Add stage"}
                      </Button>
                    </div>
                  </form>
                </PopoverContent>
              </Popover>
            )}
          </Droppable>
        </div>
      </DragDropContext>
    </div>
  );
}
