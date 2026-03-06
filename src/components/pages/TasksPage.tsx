import {
  CircleNotchIcon,
  PlusIcon,
  MagnifyingGlassIcon,
  SquareIcon,
  CheckSquareIcon,
  TrashIcon,
} from "@phosphor-icons/react";
import { useState, useMemo } from "react";
import {
  startOfToday,
  endOfToday,
  endOfTomorrow,
  endOfWeek,
  getDay,
  isWithinInterval,
  parseISO,
  format,
  addDays,
} from "date-fns";
import { toast } from "sonner";
import { showError } from "@/lib/show-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TaskTypeInput } from "@/components/task-type-input";
import {
  useTasks,
  useMarkTaskDone,
  useDeleteTask,
  useCreateTask,
  type Task,
} from "@/hooks/use-tasks";
import { useContacts, type ContactSummary } from "@/hooks/use-contacts";
import { ContactSheet } from "@/components/sheets/ContactSheet";

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

const BUCKETS = [
  { key: "overdue", label: "Overdue" },
  { key: "today", label: "Today" },
  { key: "tomorrow", label: "Tomorrow" },
  { key: "thisWeek", label: "This week" },
  { key: "later", label: "Later" },
] as const;

function TaskRow({
  task,
  contactName,
  onContactClick,
}: {
  task: Task;
  contactName: string | null;
  onContactClick: () => void;
}) {
  const markDone = useMarkTaskDone();
  const deleteTask = useDeleteTask();
  const isDone = !!task.doneDate;
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const handleToggle = () => {
    markDone.mutate(
      { id: task.id, done: !isDone },
      { onError: (err) => showError(err, "Failed to update task") },
    );
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
      <div className="group flex items-center gap-2 h-[var(--row-height)] px-3">
        <button
          onClick={handleToggle}
          disabled={markDone.isPending}
          aria-label={`${isDone ? "Mark task as not done" : "Mark task as done"}: ${task.text ?? "Untitled task"}`}
          className="shrink-0 text-muted-foreground hover:text-primary transition-colors"
        >
          {isDone ? (
            <CheckSquareIcon className="size-3.5 text-primary" />
          ) : (
            <SquareIcon className="size-3.5" />
          )}
        </button>
        <span
          className={`min-w-0 flex-1 truncate text-sm ${isDone ? "line-through text-muted-foreground" : ""}`}
        >
          {task.text ?? "—"}
        </span>
        {task.type && task.type !== "None" && (
          <Badge variant="outline" className="h-5 shrink-0 text-xs font-normal">
            {task.type}
          </Badge>
        )}
        {contactName && (
          <button
            onClick={onContactClick}
            className="shrink-0 text-xs text-muted-foreground hover:text-foreground hover:underline transition-colors"
            aria-label={`Open contact: ${contactName}`}
          >
            {contactName}
          </button>
        )}
        {task.dueDate && (
          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
            {format(parseISO(task.dueDate), "MMM d")}
          </span>
        )}
        <button
          onClick={() => setConfirmDeleteOpen(true)}
          disabled={deleteTask.isPending}
          className="shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive transition-all"
          aria-label="Delete task"
        >
          <TrashIcon className="size-3" />
        </button>
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
  const [type, setType] = useState("");
  const [text, setText] = useState("");
  const tomorrow = addDays(new Date(), 1).toISOString().slice(0, 10);
  const [dueDate, setDueDate] = useState(tomorrow);

  const filteredContacts = useMemo(
    () =>
      contacts
        .filter((c) => {
          const name = `${c.firstName ?? ""} ${c.lastName ?? ""}`.toLowerCase();
          return name.includes(contactSearch.toLowerCase());
        })
        .slice(0, 20),
    [contacts, contactSearch],
  );

  const handleSubmit = () => {
    if (!contactId) {
      toast.error("Select a contact");
      return;
    }
    if (!text.trim()) {
      toast.error("Enter task text");
      return;
    }
    createTask.mutate(
      {
        contactId: parseInt(contactId, 10),
        type: type.trim() || undefined,
        text: text.trim(),
        dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
      },
      {
        onSuccess: () => {
          toast.success("Task created");
          onOpenChange(false);
          setContactId("");
          setContactSearch("");
          setType("");
          setText("");
          setDueDate(tomorrow);
        },
        onError: (err) => showError(err, "Failed to create task"),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New task</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Contact</Label>
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
            <Label className="text-xs">Task</Label>
            <Input
              placeholder="Task description"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSubmit();
              }}
              className="h-8 text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Type</Label>
              <TaskTypeInput
                value={type}
                onChange={setType}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Due date</Label>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
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

import { usePageTitle } from "@/contexts/page-header";

export function TasksPage() {
  usePageTitle("Tasks");
  const { data: tasksData, isPending: tasksPending } = useTasks();
  const { data: contactsData } = useContacts({
    pagination: { page: 1, perPage: 500 },
  });

  const [addOpen, setAddOpen] = useState(false);
  const [selectedContact, setSelectedContact] = useState<ContactSummary | null>(
    null,
  );
  const [contactSheetOpen, setContactSheetOpen] = useState(false);
  const [search, setSearch] = useState("");

  const contacts = useMemo(
    () => contactsData?.data ?? [],
    [contactsData?.data],
  );

  const contactMap = useMemo(
    () => new Map(contacts.map((c) => [c.id, c])),
    [contacts],
  );

  const tasks = useMemo(() => tasksData?.data ?? [], [tasksData?.data]);

  const activeTasks = useMemo(
    () =>
      tasks.filter(
        (t) =>
          !t.doneDate ||
          new Date(t.doneDate) > new Date(Date.now() - 5 * 60 * 1000),
      ),
    [tasks],
  );

  const filteredTasks = useMemo(() => {
    if (!search.trim()) return activeTasks;
    const q = search.toLowerCase();
    return activeTasks.filter((t) => {
      if (t.text?.toLowerCase().includes(q)) return true;
      const contact = t.contactId ? contactMap.get(t.contactId) : null;
      const name = contact
        ? `${contact.firstName ?? ""} ${contact.lastName ?? ""}`.toLowerCase()
        : "";
      return name.includes(q);
    });
  }, [activeTasks, search, contactMap]);

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

  const handleContactClick = (contactId: number) => {
    const contact = contactMap.get(contactId);
    if (contact) {
      setSelectedContact(contact);
      setContactSheetOpen(true);
    }
  };

  return (
    <div className="flex h-full flex-col overflow-auto pb-8">
      <div className="mb-4 flex items-center justify-between">
        {!tasksPending ? (
          <span className="text-xs text-muted-foreground">
            {activeTasks.length} upcoming
          </span>
        ) : (
          <span />
        )}
        <Button
          size="sm"
          onClick={() => setAddOpen(true)}
          className="h-7 gap-1 text-sm"
        >
          <PlusIcon className="size-3.5" />
          Add task
        </Button>
      </div>

      <div className="relative mb-3 max-w-xs">
        <MagnifyingGlassIcon className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search tasks…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8 pl-8 text-sm"
        />
      </div>

      <div className="flex-1 space-y-3">
        {tasksPending && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CircleNotchIcon className="size-3.5 animate-spin" />
            Loading…
          </div>
        )}

        {!tasksPending && activeTasks.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No upcoming tasks.
          </p>
        )}

        {!tasksPending &&
          activeTasks.length > 0 &&
          filteredTasks.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No tasks match "{search}".
            </p>
          )}

        {BUCKETS.map(({ key, label }) => {
          const bucket = grouped[key];
          if (!bucket?.length) return null;
          return (
            <div key={key}>
              <p className="mb-1 px-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {label}{" "}
                <span className="ml-1 text-muted-foreground/60">
                  {bucket.length}
                </span>
              </p>
              <div className="rounded-md bg-card">
                {bucket.map((task) => {
                  const contact = task.contactId
                    ? contactMap.get(task.contactId)
                    : null;
                  const contactName = contact
                    ? `${contact.firstName ?? ""} ${contact.lastName ?? ""}`.trim() ||
                      null
                    : null;
                  return (
                    <TaskRow
                      key={task.id}
                      task={task}
                      contactName={contactName}
                      onContactClick={() => handleContactClick(task.contactId)}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <AddTaskDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        contacts={contacts}
      />
      <ContactSheet
        open={contactSheetOpen}
        onOpenChange={setContactSheetOpen}
        contact={selectedContact}
      />
    </div>
  );
}
