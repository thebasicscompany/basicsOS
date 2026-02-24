"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { trpc } from "@/lib/trpc";
import {
  Button,
  Card,
  CardContent,
  Badge,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  Input,
  Label,
  Switch,
  PageHeader,
  EmptyState,
  addToast,
  cn,
  Settings,
  Plus,
  Pencil,
  Trash2,
} from "@basicsos/ui";

const COLOR_OPTIONS = [
  "bg-stone-400",
  "bg-blue-500",
  "bg-green-500",
  "bg-yellow-500",
  "bg-orange-500",
  "bg-red-500",
  "bg-purple-500",
  "bg-indigo-500",
] as const;

type ColorOption = (typeof COLOR_OPTIONS)[number];

interface StageFormState {
  name: string;
  color: ColorOption;
  isWon: boolean;
  isLost: boolean;
}

const DEFAULT_FORM: StageFormState = {
  name: "",
  color: "bg-stone-400",
  isWon: false,
  isLost: false,
};

interface StageDialogProps {
  mode: "create" | "edit";
  initial?: StageFormState & { id: string };
  trigger: React.ReactNode;
  onDone: () => void;
}

const StageDialog = ({ mode, initial, trigger, onDone }: StageDialogProps): JSX.Element => {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<StageFormState>(initial ?? DEFAULT_FORM);

  const createStage = trpc.crm.pipelineStages.create.useMutation({
    onSuccess: () => {
      addToast({ title: "Stage created", variant: "success" });
      setOpen(false);
      setForm(DEFAULT_FORM);
      onDone();
    },
    onError: (err) => {
      addToast({ title: "Failed to create stage", description: err.message, variant: "destructive" });
    },
  });

  const updateStage = trpc.crm.pipelineStages.update.useMutation({
    onSuccess: () => {
      addToast({ title: "Stage updated", variant: "success" });
      setOpen(false);
      onDone();
    },
    onError: (err) => {
      addToast({ title: "Failed to update stage", description: err.message, variant: "destructive" });
    },
  });

  const handleSubmit = (e: FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    if (!form.name.trim()) return;
    if (mode === "edit" && initial) {
      updateStage.mutate({ id: initial.id, ...form });
    } else {
      createStage.mutate(form);
    }
  };

  const isPending = createStage.isPending || updateStage.isPending;

  const handleOpenChange = (next: boolean): void => {
    setOpen(next);
    if (next && mode === "edit" && initial) {
      setForm({ name: initial.name, color: initial.color, isWon: initial.isWon, isLost: initial.isLost });
    }
    if (!next && mode === "create") {
      setForm(DEFAULT_FORM);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Add Stage" : "Edit Stage"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="stage-name">Name</Label>
            <Input
              id="stage-name"
              placeholder="e.g. Discovery"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
              autoFocus
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label>Color</Label>
            <div className="flex flex-wrap gap-2">
              {COLOR_OPTIONS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, color }))}
                  className={cn(
                    "h-7 w-7 rounded-full transition-all",
                    color,
                    form.color === color
                      ? "ring-2 ring-offset-2 ring-stone-900 dark:ring-stone-100 scale-110"
                      : "hover:scale-105",
                  )}
                  aria-label={`Select color ${color}`}
                />
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-3 rounded-md border border-stone-200 dark:border-stone-700 p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-stone-900 dark:text-stone-100">Mark as Won</p>
                <p className="text-xs text-stone-500 dark:text-stone-400">
                  Deals in this stage count as closed-won
                </p>
              </div>
              <Switch
                checked={form.isWon}
                onCheckedChange={(checked) =>
                  setForm((f) => ({ ...f, isWon: checked, isLost: checked ? false : f.isLost }))
                }
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-stone-900 dark:text-stone-100">Mark as Lost</p>
                <p className="text-xs text-stone-500 dark:text-stone-400">
                  Deals in this stage count as closed-lost
                </p>
              </div>
              <Switch
                checked={form.isLost}
                onCheckedChange={(checked) =>
                  setForm((f) => ({ ...f, isLost: checked, isWon: checked ? false : f.isWon }))
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving…" : mode === "create" ? "Add Stage" : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

interface DeleteConfirmDialogProps {
  stageId: string;
  stageName: string;
  trigger: React.ReactNode;
  onDone: () => void;
}

const DeleteConfirmDialog = ({
  stageId,
  stageName,
  trigger,
  onDone,
}: DeleteConfirmDialogProps): JSX.Element => {
  const [open, setOpen] = useState(false);

  const deleteStage = trpc.crm.pipelineStages.delete.useMutation({
    onSuccess: () => {
      addToast({ title: "Stage deleted", variant: "success" });
      setOpen(false);
      onDone();
    },
    onError: (err) => {
      addToast({ title: "Failed to delete stage", description: err.message, variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Delete Stage</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-stone-600 dark:text-stone-400">
          Are you sure you want to delete{" "}
          <span className="font-semibold text-stone-900 dark:text-stone-100">{stageName}</span>?
          Deals currently in this stage will remain but lose their stage association.
        </p>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={deleteStage.isPending}
            onClick={() => deleteStage.mutate({ id: stageId })}
          >
            {deleteStage.isPending ? "Deleting…" : "Delete Stage"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const PipelineStagesPage = (): JSX.Element => {
  const utils = trpc.useUtils();
  const { data: stages = [], isLoading } = trpc.crm.pipelineStages.list.useQuery();

  const invalidate = (): void => {
    void utils.crm.pipelineStages.list.invalidate();
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Pipeline Stages"
        backHref="/crm"
        backLabel="CRM"
        action={
          <StageDialog
            mode="create"
            onDone={invalidate}
            trigger={
              <Button>
                <Plus size={16} className="mr-1.5" />
                Add Stage
              </Button>
            }
          />
        }
      />

      {!isLoading && stages.length === 0 ? (
        <EmptyState
          Icon={Settings}
          heading="No custom stages yet"
          description="Add custom pipeline stages to replace the default Lead / Qualified / Proposal set."
          action={
            <StageDialog
              mode="create"
              onDone={invalidate}
              trigger={
                <Button>
                  <Plus size={14} className="mr-1" />
                  Add Stage
                </Button>
              }
            />
          }
        />
      ) : (
        <Card>
          <CardContent className="divide-y divide-stone-200 dark:divide-stone-700 p-0">
            {stages.map((stage) => (
              <div
                key={stage.id}
                className="flex items-center gap-3 px-4 py-3"
              >
                <span
                  className={cn("h-3 w-3 shrink-0 rounded-full", stage.color)}
                  aria-hidden="true"
                />
                <span className="flex-1 text-sm font-medium text-stone-900 dark:text-stone-100">
                  {stage.name}
                </span>
                <div className="flex items-center gap-1.5">
                  {stage.isWon && (
                    <Badge variant="success" className="text-[10px]">
                      Won
                    </Badge>
                  )}
                  {stage.isLost && (
                    <Badge variant="destructive" className="text-[10px]">
                      Lost
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <StageDialog
                    mode="edit"
                    initial={{
                      id: stage.id,
                      name: stage.name,
                      color: stage.color as ColorOption,
                      isWon: stage.isWon,
                      isLost: stage.isLost,
                    }}
                    onDone={invalidate}
                    trigger={
                      <Button variant="ghost" size="icon" className="size-8" aria-label="Edit stage">
                        <Pencil size={14} />
                      </Button>
                    }
                  />
                  <DeleteConfirmDialog
                    stageId={stage.id}
                    stageName={stage.name}
                    onDone={invalidate}
                    trigger={
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-destructive hover:text-destructive"
                        aria-label="Delete stage"
                      >
                        <Trash2 size={14} />
                      </Button>
                    }
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default PipelineStagesPage;
