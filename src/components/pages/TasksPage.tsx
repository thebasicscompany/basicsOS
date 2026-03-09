import {
  CircleNotchIcon,
  PlusIcon,
  MagnifyingGlassIcon,
  CircleIcon,
  CheckCircleIcon,
  TrashIcon,
  ListChecksIcon,
  XIcon,
  CalendarIcon,
  UserIcon,
  BuildingsIcon,
  ArrowSquareOutIcon,
} from "@phosphor-icons/react";
import { useState, useMemo, useRef, useEffect } from "react";
import { Link } from "react-router";
import {
  startOfToday,
  endOfToday,
  endOfTomorrow,
  endOfWeek,
  getDay,
  isWithinInterval,
  parseISO,
  format,
  isToday,
  isTomorrow,
} from "date-fns";
import { toast } from "sonner";
import { showError } from "@/lib/show-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  useTasks,
  useMarkTaskDone,
  useDeleteTask,
  useCreateTask,
  useUpdateTask,
  type Task,
} from "@/hooks/use-tasks";
import { useContacts, type ContactSummary } from "@/hooks/use-contacts";
import { useCompanies } from "@/hooks/use-companies";
import { usePageTitle } from "@/contexts/page-header";

function getBucket(
  dueDate: string | null,
): "overdue" | "today" | "tomorrow" | "thisWeek" | "later" {
  if (!dueDate) return "later";
  const date = parseISO(dueDate);
  if (date < startOfToday()) return "overdue";
  if (isWithinInterval(date, { start: startOfToday(), end: endOfToday() }))
    return "today";
  if (isWithinInterval(date, { start: endOfToday(), end: endOfTomorrow() }))
    return "tomorrow";
  const now = new Date();
  const endOfWeekDate = endOfWeek(now, { weekStartsOn: 0 });
  if (getDay(now) < 5 && date <= endOfWeekDate) return "thisWeek";
  return "later";
}

function formatRelativeDate(dueDate: string | null): string | null {
  if (!dueDate) return null;
  const d = parseISO(dueDate);
  if (isToday(d)) return "Today";
  if (isTomorrow(d)) return "Tomorrow";
  return format(d, "MMM d");
}

const BUCKETS = [
  { key: "overdue", label: "Overdue" },
  { key: "today", label: "Today" },
  { key: "tomorrow", label: "Tomorrow" },
  { key: "thisWeek", label: "This week" },
  { key: "later", label: "Later" },
] as const;

/* ─── Date Popover ─── */

function DatePopover({
  task,
  isOverdue,
  isDone,
}: {
  task: Task;
  isOverdue: boolean;
  isDone: boolean;
}) {
  const updateTask = useUpdateTask();
  const [open, setOpen] = useState(false);
  const dateLabel = formatRelativeDate(task.dueDate);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          onClick={(e) => e.stopPropagation()}
          className={`flex items-center gap-1 text-xs tabular-nums shrink-0 rounded px-1.5 py-0.5 transition-colors hover:bg-accent ${
            isOverdue && !isDone
              ? "text-destructive"
              : dateLabel
                ? "text-muted-foreground"
                : "text-muted-foreground/40"
          }`}
        >
          <CalendarIcon className="size-3" />
          {dateLabel ?? "No date"}
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto p-0"
        align="end"
        onClick={(e) => e.stopPropagation()}
      >
        <Calendar
          mode="single"
          selected={task.dueDate ? parseISO(task.dueDate) : undefined}
          onSelect={(date) => {
            updateTask.mutate(
              {
                id: task.id,
                dueDate: date ? date.toISOString() : undefined,
              } as Parameters<typeof updateTask.mutate>[0],
              {
                onSuccess: () => setOpen(false),
                onError: (err) => showError(err, "Failed to update date"),
              },
            );
          }}
          defaultMonth={task.dueDate ? parseISO(task.dueDate) : new Date()}
        />
        {task.dueDate && (
          <div className="border-t px-3 py-2">
            <button
              className="text-xs text-destructive hover:underline"
              onClick={() => {
                updateTask.mutate(
                  { id: task.id, dueDate: undefined } as Parameters<
                    typeof updateTask.mutate
                  >[0],
                  {
                    onSuccess: () => setOpen(false),
                    onError: (err) => showError(err, "Failed to clear date"),
                  },
                );
              }}
            >
              Clear date
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

/* ─── Contact Popover ─── */

function ContactPopover({
  task,
  contactName,
  contactId,
  contacts,
}: {
  task: Task;
  contactName: string | null;
  contactId: number | null;
  contacts: ContactSummary[];
}) {
  const updateTask = useUpdateTask();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = useMemo(
    () =>
      contacts
        .filter((c) => {
          const name =
            `${c.firstName ?? ""} ${c.lastName ?? ""}`.toLowerCase();
          return name.includes(search.toLowerCase());
        })
        .slice(0, 10),
    [contacts, search],
  );

  return (
    <Popover
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) setSearch("");
      }}
    >
      <PopoverTrigger asChild>
        <button
          onClick={(e) => e.stopPropagation()}
          className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground shrink-0 rounded px-1.5 py-0.5 transition-colors hover:bg-accent max-w-[140px] truncate"
        >
          <UserIcon className="size-3 shrink-0" />
          {contactId ? contactName ?? "Contact" : "Add contact"}
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-64 p-3"
        align="end"
        onClick={(e) => e.stopPropagation()}
      >
        <Label className="text-xs text-muted-foreground">Contact</Label>
        {contactId && (
          <div className="mt-1.5 flex items-center justify-between">
            <Link
              to={`/objects/contacts/${contactId}`}
              className="text-sm font-medium hover:underline flex items-center gap-1"
            >
              {contactName}
              <ArrowSquareOutIcon className="size-3 text-muted-foreground" />
            </Link>
            <button
              className="text-xs text-destructive hover:underline"
              onClick={() => {
                updateTask.mutate(
                  { id: task.id, contactId: undefined } as Parameters<
                    typeof updateTask.mutate
                  >[0],
                  {
                    onSuccess: () => setOpen(false),
                    onError: (err) =>
                      showError(err, "Failed to remove contact"),
                  },
                );
              }}
            >
              Remove
            </button>
          </div>
        )}
        <Input
          placeholder="Search contacts…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mt-2 h-8 text-sm"
          autoFocus={!contactId}
        />
        {search && filtered.length > 0 && (
          <div className="mt-1.5 max-h-36 overflow-y-auto rounded-md border">
            {filtered.map((c) => (
              <button
                key={c.id}
                className="w-full px-2.5 py-1.5 text-left text-xs hover:bg-accent"
                onClick={() => {
                  setSearch("");
                  updateTask.mutate(
                    { id: task.id, contactId: c.id } as Parameters<
                      typeof updateTask.mutate
                    >[0],
                    {
                      onSuccess: () => setOpen(false),
                      onError: (err) =>
                        showError(err, "Failed to link contact"),
                    },
                  );
                }}
              >
                {c.firstName} {c.lastName}
                {c.companyName && (
                  <span className="ml-1 text-muted-foreground">
                    · {c.companyName}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
        {search && filtered.length === 0 && (
          <p className="mt-1.5 text-xs text-muted-foreground">
            No contacts found
          </p>
        )}
      </PopoverContent>
    </Popover>
  );
}

/* ─── Task Row ─── */

function TaskRow({
  task,
  contactName,
  contactId,
  companyName,
  companyId,
  bucketKey,
  contacts,
}: {
  task: Task;
  contactName: string | null;
  contactId: number | null;
  companyName: string | null;
  companyId: number | null;
  bucketKey: string;
  contacts: ContactSummary[];
}) {
  const markDone = useMarkTaskDone();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const isDone = !!task.doneDate;
  const isOverdue = bucketKey === "overdue";

  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(task.text ?? "");
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setEditText(task.text ?? "");
  }, [task.text]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    markDone.mutate(
      { id: task.id, done: !isDone },
      { onError: (err) => showError(err, "Failed to update task") },
    );
  };

  const handleSaveText = () => {
    setEditing(false);
    if (editText.trim() && editText !== task.text) {
      updateTask.mutate(
        { id: task.id, text: editText.trim() } as Parameters<
          typeof updateTask.mutate
        >[0],
        { onError: (err) => showError(err, "Failed to update task") },
      );
    } else {
      setEditText(task.text ?? "");
    }
  };

  const handleDelete = () => {
    deleteTask.mutate(task.id, {
      onSuccess: () => {
        toast.success("Task deleted");
        setConfirmDeleteOpen(false);
      },
      onError: () => toast.error("Failed to delete task"),
    });
  };

  return (
    <>
      <div className="group flex items-center gap-3 rounded-lg px-4 py-3 transition-colors hover:bg-accent/40">
        {/* Checkbox */}
        <button
          onClick={handleToggle}
          disabled={markDone.isPending}
          aria-label={`${isDone ? "Mark not done" : "Mark done"}: ${task.text ?? "Untitled"}`}
          className={`shrink-0 transition-colors ${
            isDone
              ? "text-primary"
              : isOverdue
                ? "text-destructive/60 hover:text-destructive"
                : "text-muted-foreground hover:text-primary"
          }`}
        >
          {isDone ? (
            <CheckCircleIcon weight="fill" className="size-5" />
          ) : (
            <CircleIcon className="size-5" />
          )}
        </button>

        {/* Task name — click to edit inline */}
        {editing ? (
          <input
            ref={inputRef}
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            onBlur={handleSaveText}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSaveText();
              if (e.key === "Escape") {
                setEditing(false);
                setEditText(task.text ?? "");
              }
            }}
            className="flex-1 min-w-0 bg-transparent text-sm font-medium outline-none"
          />
        ) : (
          <span
            onClick={() => !isDone && setEditing(true)}
            className={`flex-1 min-w-0 truncate text-sm cursor-text ${
              isDone
                ? "line-through text-muted-foreground opacity-50"
                : "font-medium"
            }`}
          >
            {task.text ?? "—"}
          </span>
        )}

        {/* Right-side metadata — all clickable popovers */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Company (read-only link) */}
          {companyId != null && (
            <Link
              to={`/objects/companies/${companyId}`}
              onClick={(e) => e.stopPropagation()}
              className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground rounded px-1.5 py-0.5 hover:bg-accent transition-colors max-w-[120px] truncate"
            >
              <BuildingsIcon className="size-3 shrink-0" />
              {companyName ?? "Company"}
            </Link>
          )}

          {/* Contact popover */}
          <ContactPopover
            task={task}
            contactName={contactName}
            contactId={contactId}
            contacts={contacts}
          />

          {/* Date popover */}
          <DatePopover task={task} isOverdue={isOverdue} isDone={isDone} />

          {/* Delete */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setConfirmDeleteOpen(true);
            }}
            disabled={deleteTask.isPending}
            className="shrink-0 p-1 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive transition-all rounded"
            aria-label="Delete task"
          >
            <TrashIcon className="size-3.5" />
          </button>
        </div>
      </div>

      <Dialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete task?</DialogTitle>
            <DialogDescription>
              "{task.text}" will be permanently deleted.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmDeleteOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDelete}
              disabled={deleteTask.isPending}
            >
              {deleteTask.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/* ─── Inline Quick Add ─── */

function InlineAddTask() {
  const createTask = useCreateTask();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const handleSubmit = () => {
    const trimmed = text.trim();
    if (!trimmed) {
      setEditing(false);
      setText("");
      return;
    }
    createTask.mutate(
      { text: trimmed, dueDate: new Date().toISOString() },
      {
        onSuccess: () => {
          setText("");
          inputRef.current?.focus();
        },
        onError: (err) => showError(err, "Failed to create task"),
      },
    );
  };

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-sm text-muted-foreground transition-colors hover:bg-accent/40 hover:text-foreground"
      >
        <PlusIcon className="size-5" />
        Add task
      </button>
    );
  }

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <CircleIcon className="size-5 shrink-0 text-muted-foreground" />
      <input
        ref={inputRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleSubmit();
          if (e.key === "Escape") {
            setEditing(false);
            setText("");
          }
        }}
        onBlur={() => {
          if (!text.trim()) {
            setEditing(false);
            setText("");
          }
        }}
        placeholder="Task description…"
        className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/50"
        disabled={createTask.isPending}
      />
    </div>
  );
}

/* ─── Loading Skeleton ─── */

function TasksSkeleton() {
  return (
    <div className="space-y-1">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3">
          <Skeleton className="size-5 shrink-0 rounded-full" />
          <Skeleton className="h-4 flex-1 max-w-[40%]" />
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-12" />
        </div>
      ))}
    </div>
  );
}

/* ─── Add Task Dialog ─── */

function AddTaskDialog({
  open,
  onOpenChange,
  contacts,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contacts: ContactSummary[];
}) {
  const createTask = useCreateTask();
  const [contactId, setContactId] = useState<string>("");
  const [contactSearch, setContactSearch] = useState("");
  const [text, setText] = useState("");
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const [dueDate, setDueDate] = useState(tomorrow);

  const filteredContacts = useMemo(
    () =>
      contacts
        .filter((c) => {
          const name =
            `${c.firstName ?? ""} ${c.lastName ?? ""}`.toLowerCase();
          return name.includes(contactSearch.toLowerCase());
        })
        .slice(0, 20),
    [contacts, contactSearch],
  );

  const handleSubmit = () => {
    if (!text.trim()) {
      toast.error("Enter task text");
      return;
    }
    createTask.mutate(
      {
        contactId: contactId ? parseInt(contactId, 10) : undefined,
        text: text.trim(),
        dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
      },
      {
        onSuccess: () => {
          toast.success("Task created");
          onOpenChange(false);
          setContactId("");
          setContactSearch("");
          setText("");
          setDueDate(tomorrow);
        },
        onError: (err) => showError(err, "Failed to create task"),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>New task</DialogTitle>
          <DialogDescription>
            Create a task and optionally assign it to a contact.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Task</Label>
            <Input
              placeholder="Task description"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSubmit();
              }}
              className="h-8 text-sm"
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Contact (optional)</Label>
            <Input
              placeholder="Search contacts…"
              value={contactSearch}
              onChange={(e) => {
                setContactSearch(e.target.value);
                setContactId("");
              }}
              className="h-8 text-sm"
            />
            {contactSearch && !contactId && filteredContacts.length > 0 && (
              <div className="max-h-40 overflow-y-auto rounded-md border bg-popover shadow-md">
                {filteredContacts.map((c) => (
                  <button
                    key={c.id}
                    className="w-full px-3 py-1.5 text-left text-sm hover:bg-accent"
                    onClick={() => {
                      setContactId(String(c.id));
                      setContactSearch(
                        `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim(),
                      );
                    }}
                  >
                    {c.firstName} {c.lastName}
                    {c.companyName && (
                      <span className="ml-1 text-muted-foreground">
                        · {c.companyName}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Due date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full h-8 justify-start text-sm font-normal"
                >
                  <CalendarIcon className="mr-2 size-3.5" />
                  {dueDate
                    ? format(new Date(dueDate), "MMM d, yyyy")
                    : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dueDate ? new Date(dueDate) : undefined}
                  onSelect={(date) =>
                    setDueDate(
                      date ? format(date, "yyyy-MM-dd") : "",
                    )
                  }
                  defaultMonth={dueDate ? new Date(dueDate) : new Date()}
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={createTask.isPending}
          >
            {createTask.isPending && (
              <CircleNotchIcon className="mr-1.5 size-3.5 animate-spin" />
            )}
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Main Page ─── */

export function TasksPage() {
  usePageTitle("Tasks");
  const { data: tasksData, isPending: tasksPending } = useTasks();
  const { data: contactsData } = useContacts({
    pagination: { page: 1, perPage: 500 },
  });
  const { data: companiesData } = useCompanies({
    pagination: { page: 1, perPage: 500 },
  });

  const [addOpen, setAddOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [searchExpanded, setSearchExpanded] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (searchExpanded) searchRef.current?.focus();
  }, [searchExpanded]);

  const contacts = useMemo(
    () => contactsData?.data ?? [],
    [contactsData?.data],
  );
  const companies = useMemo(
    () => companiesData?.data ?? [],
    [companiesData?.data],
  );

  const contactMap = useMemo(
    () => new Map(contacts.map((c) => [c.id, c])),
    [contacts],
  );
  const companyMap = useMemo(
    () => new Map(companies.map((c) => [c.id, c])),
    [companies],
  );

  const tasks = useMemo(() => tasksData?.data ?? [], [tasksData?.data]);

  const activeTasks = useMemo(
    () =>
      tasks.filter(
        (t) =>
          !t.doneDate ||
          new Date(t.doneDate) > new Date(Date.now() - 25 * 1000),
      ),
    [tasks],
  );

  const filteredTasks = useMemo(() => {
    if (!search.trim()) return activeTasks;
    const q = search.toLowerCase();
    return activeTasks.filter((t) => {
      if (t.text?.toLowerCase().includes(q)) return true;
      const contact = t.contactId ? contactMap.get(t.contactId) : null;
      const company = t.companyId ? companyMap.get(t.companyId) : null;
      const contactName = contact
        ? `${contact.firstName ?? ""} ${contact.lastName ?? ""}`.toLowerCase()
        : "";
      const companyName = company?.name?.toLowerCase() ?? "";
      return contactName.includes(q) || companyName.includes(q);
    });
  }, [activeTasks, search, contactMap, companyMap]);

  const grouped = useMemo(() => {
    const groups: Record<string, Task[]> = {
      overdue: [],
      today: [],
      tomorrow: [],
      thisWeek: [],
      later: [],
    };
    for (const t of filteredTasks) {
      groups[getBucket(t.dueDate)].push(t);
    }
    return groups;
  }, [filteredTasks]);

  return (
    <div className="flex h-full flex-col overflow-auto pb-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="text-sm text-muted-foreground">
          {!tasksPending && <span>{activeTasks.length} tasks</span>}
        </div>
        <div className="flex items-center gap-2">
          {searchExpanded ? (
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={searchRef}
                placeholder="Search tasks…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onBlur={() => {
                  if (!search) setSearchExpanded(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setSearch("");
                    setSearchExpanded(false);
                  }
                }}
                className="h-8 w-52 pl-8 text-sm"
              />
              <button
                onClick={() => {
                  setSearch("");
                  setSearchExpanded(false);
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <XIcon className="size-3.5" />
              </button>
            </div>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={() => setSearchExpanded(true)}
            >
              <MagnifyingGlassIcon className="size-4" />
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAddOpen(true)}
            className="h-8 gap-1.5 text-sm"
          >
            <PlusIcon className="size-3.5" />
            Add task
          </Button>
        </div>
      </div>

      {/* Task list */}
      <div className="flex-1 space-y-6">
        {tasksPending && <TasksSkeleton />}

        {!tasksPending && activeTasks.length === 0 && (
          <EmptyState
            icon={<ListChecksIcon />}
            title="No tasks yet"
            description="Create your first task to get started"
            action={
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAddOpen(true)}
                className="gap-1.5"
              >
                <PlusIcon className="size-3.5" />
                Add task
              </Button>
            }
          />
        )}

        {!tasksPending &&
          activeTasks.length > 0 &&
          filteredTasks.length === 0 && (
            <EmptyState
              icon={<MagnifyingGlassIcon />}
              title="No matching tasks"
              description={`Nothing matches "${search}"`}
            />
          )}

        {BUCKETS.map(({ key, label }) => {
          const bucket = grouped[key];
          if (!bucket?.length) return null;
          const isOverdue = key === "overdue";
          return (
            <div key={key}>
              <div className="mb-1 flex items-center gap-2 px-4">
                <span
                  className={`text-xs font-medium ${isOverdue ? "text-destructive" : "text-muted-foreground"}`}
                >
                  {label}
                </span>
                <Badge
                  variant="outline"
                  className={`text-[10px] px-1.5 py-0 ${isOverdue ? "border-destructive/30 text-destructive" : ""}`}
                >
                  {bucket.length}
                </Badge>
              </div>
              <div className="space-y-0.5">
                {bucket.map((task) => {
                  const contact = task.contactId
                    ? contactMap.get(task.contactId)
                    : null;
                  const company = task.companyId
                    ? companyMap.get(task.companyId)
                    : null;
                  const contactName = contact
                    ? `${contact.firstName ?? ""} ${contact.lastName ?? ""}`.trim() ||
                      null
                    : null;
                  const companyName = company?.name ?? null;
                  return (
                    <TaskRow
                      key={task.id}
                      task={task}
                      contactName={contactName}
                      contactId={task.contactId}
                      companyName={companyName}
                      companyId={task.companyId}
                      bucketKey={key}
                      contacts={contacts}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}

        {!tasksPending && activeTasks.length > 0 && <InlineAddTask />}
      </div>

      <AddTaskDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        contacts={contacts}
      />
    </div>
  );
}
