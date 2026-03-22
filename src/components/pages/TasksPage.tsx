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
  HandshakeIcon,
  UserCircleIcon,
  LinkSimpleIcon,
  ListPlusIcon,
  DotsThreeVerticalIcon,
  CaretRightIcon,
} from "@phosphor-icons/react";
import { useState, useMemo, useRef, useEffect, useCallback } from "react";
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
  set,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  useTasks,
  useMarkTaskDone,
  useDeleteTask,
  useCreateTask,
  useUpdateTask,
  type CreateTaskData,
  type Task,
} from "@/hooks/use-tasks";
import { useContacts, type ContactSummary } from "@/hooks/use-contacts";
import { useCompanies, type CompanySummary } from "@/hooks/use-companies";
import { useDeals, type Deal } from "@/hooks/use-deals";
import { useRbacUsers, type RbacUser } from "@/hooks/use-rbac";
import { usePageTitle } from "@/contexts/page-header";
import { cn } from "@/lib/utils";

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
  const timePart = format(d, "h:mm a");
  if (isToday(d)) return `Today, ${timePart}`;
  if (isTomorrow(d)) return `Tomorrow, ${timePart}`;
  return format(d, "MMM d, h:mm a");
}

function timeInputValueFromIso(iso: string | null | undefined): string {
  if (!iso) return "09:00";
  const d = parseISO(iso);
  return format(d, "HH:mm");
}

function applyTimeToDate(base: Date, timeHHMM: string): Date {
  const [hRaw, mRaw] = timeHHMM.split(":");
  const h = Math.min(23, Math.max(0, parseInt(hRaw ?? "0", 10) || 0));
  const m = Math.min(59, Math.max(0, parseInt(mRaw ?? "0", 10) || 0));
  return set(base, { hours: h, minutes: m, seconds: 0, milliseconds: 0 });
}

function formatMemberName(u: RbacUser): string {
  const n = `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim();
  return n || u.email;
}

function memberInitials(u: RbacUser): string {
  const parts = `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim().split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
  }
  if (parts[0]) return parts[0].slice(0, 2).toUpperCase();
  return (u.email[0] ?? "?").toUpperCase();
}

function shortMemberLabel(u: RbacUser): string {
  const first = u.firstName?.trim();
  if (first) return first;
  return formatMemberName(u);
}

function tomorrowYmd(): string {
  const t = new Date();
  t.setDate(t.getDate() + 1);
  return format(t, "yyyy-MM-dd");
}

function localDateFromYmd(ymd: string): Date {
  const [y, mo, d] = ymd.split("-").map((x) => parseInt(x, 10));
  return new Date(y, mo - 1, d);
}

function compareTasksByDue(a: Task, b: Task): number {
  const ad = a.dueDate ? parseISO(a.dueDate).getTime() : Number.POSITIVE_INFINITY;
  const bd = b.dueDate ? parseISO(b.dueDate).getTime() : Number.POSITIVE_INFINITY;
  if (ad !== bd) return ad - bd;
  return a.id - b.id;
}

function taskMatchesSearch(
  t: Task,
  q: string,
  ctx: {
    contactMap: Map<number, ContactSummary>;
    companyMap: Map<number, CompanySummary>;
    dealMap: Map<number, Deal>;
    members: RbacUser[];
  },
): boolean {
  if (!q.trim()) return true;
  const lower = q.toLowerCase();
  if (t.text?.toLowerCase().includes(lower)) return true;
  const contact = t.contactId ? ctx.contactMap.get(t.contactId) : null;
  const company = t.companyId ? ctx.companyMap.get(t.companyId) : null;
  const contactName = contact
    ? `${contact.firstName ?? ""} ${contact.lastName ?? ""}`.toLowerCase()
    : "";
  const companyName = company?.name?.toLowerCase() ?? "";
  if (contactName.includes(lower) || companyName.includes(lower)) return true;
  const deal = t.dealId ? ctx.dealMap.get(t.dealId) : null;
  if (deal?.name?.toLowerCase().includes(lower)) return true;
  const assignee =
    t.assigneeId != null
      ? ctx.members.find((m) => m.id === t.assigneeId)
      : undefined;
  if (assignee) {
    if (formatMemberName(assignee).toLowerCase().includes(lower)) return true;
    if (assignee.email.toLowerCase().includes(lower)) return true;
  }
  return false;
}

function effectiveParentTaskId(
  t: Task,
  taskById: Map<number, Task>,
): number | null {
  const pid = t.parentTaskId ?? null;
  if (pid == null) return null;
  return taskById.has(pid) ? pid : null;
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
  const [timeStr, setTimeStr] = useState(() =>
    timeInputValueFromIso(task.dueDate),
  );
  const dateLabel = formatRelativeDate(task.dueDate);

  useEffect(() => {
    if (open) setTimeStr(timeInputValueFromIso(task.dueDate));
  }, [open, task.dueDate]);

  const commitDue = (date: Date, time: string) => {
    const merged = applyTimeToDate(date, time);
    updateTask.mutate(
      { id: task.id, dueDate: merged.toISOString() },
      {
        onError: (err) => showError(err, "Failed to update date"),
      },
    );
  };

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
            if (!date) return;
            commitDue(date, timeStr);
          }}
          defaultMonth={task.dueDate ? parseISO(task.dueDate) : new Date()}
        />
        <div className="border-t px-3 py-2 space-y-2">
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground whitespace-nowrap">
              Time
            </Label>
            <Input
              type="time"
              value={timeStr}
              onChange={(e) => {
                const next = e.target.value;
                setTimeStr(next);
                const d = task.dueDate ? parseISO(task.dueDate) : new Date();
                commitDue(d, next);
              }}
              className="h-8 w-[7.5rem] text-sm tabular-nums"
            />
          </div>
          {task.dueDate && (
            <button
              type="button"
              className="text-xs text-destructive hover:underline"
              onClick={() => {
                updateTask.mutate(
                  { id: task.id, dueDate: null },
                  {
                    onSuccess: () => setOpen(false),
                    onError: (err) => showError(err, "Failed to clear date"),
                  },
                );
              }}
            >
              Clear date & time
            </button>
          )}
        </div>
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
                  { id: task.id, contactId: null },
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
                    { id: task.id, contactId: c.id },
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

/* ─── Company Popover ─── */

function CompanyPopover({
  task,
  companyName,
  companyId,
  companies,
}: {
  task: Task;
  companyName: string | null;
  companyId: number | null;
  companies: CompanySummary[];
}) {
  const updateTask = useUpdateTask();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = useMemo(
    () =>
      companies
        .filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))
        .slice(0, 10),
    [companies, search],
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
          <BuildingsIcon className="size-3 shrink-0" />
          {companyId ? companyName ?? "Company" : "Add company"}
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-64 p-3"
        align="end"
        onClick={(e) => e.stopPropagation()}
      >
        <Label className="text-xs text-muted-foreground">Company</Label>
        {companyId && (
          <div className="mt-1.5 flex items-center justify-between gap-2">
            <Link
              to={`/objects/companies/${companyId}`}
              className="text-sm font-medium hover:underline flex items-center gap-1 min-w-0 truncate"
            >
              {companyName}
              <ArrowSquareOutIcon className="size-3 shrink-0 text-muted-foreground" />
            </Link>
            <button
              type="button"
              className="text-xs text-destructive hover:underline shrink-0"
              onClick={() => {
                updateTask.mutate(
                  { id: task.id, companyId: null },
                  {
                    onSuccess: () => setOpen(false),
                    onError: (err) =>
                      showError(err, "Failed to remove company"),
                  },
                );
              }}
            >
              Remove
            </button>
          </div>
        )}
        <Input
          placeholder="Search companies…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mt-2 h-8 text-sm"
          autoFocus={!companyId}
        />
        {search && filtered.length > 0 && (
          <div className="mt-1.5 max-h-36 overflow-y-auto rounded-md border">
            {filtered.map((c) => (
              <button
                key={c.id}
                type="button"
                className="w-full px-2.5 py-1.5 text-left text-xs hover:bg-accent truncate"
                onClick={() => {
                  setSearch("");
                  updateTask.mutate(
                    { id: task.id, companyId: c.id },
                    {
                      onSuccess: () => setOpen(false),
                      onError: (err) =>
                        showError(err, "Failed to link company"),
                    },
                  );
                }}
              >
                {c.name}
              </button>
            ))}
          </div>
        )}
        {search && filtered.length === 0 && (
          <p className="mt-1.5 text-xs text-muted-foreground">
            No companies found
          </p>
        )}
      </PopoverContent>
    </Popover>
  );
}

/* ─── Deal Popover ─── */

function DealPopover({
  task,
  dealName,
  dealId,
  deals,
}: {
  task: Task;
  dealName: string | null;
  dealId: number | null;
  deals: Deal[];
}) {
  const updateTask = useUpdateTask();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = useMemo(
    () =>
      deals
        .filter((d) => d.name.toLowerCase().includes(search.toLowerCase()))
        .slice(0, 10),
    [deals, search],
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
          <HandshakeIcon className="size-3 shrink-0" />
          {dealId ? dealName ?? "Deal" : "Add deal"}
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-64 p-3"
        align="end"
        onClick={(e) => e.stopPropagation()}
      >
        <Label className="text-xs text-muted-foreground">Deal</Label>
        {dealId && (
          <div className="mt-1.5 flex items-center justify-between gap-2">
            <Link
              to={`/objects/deals/${dealId}`}
              className="text-sm font-medium hover:underline flex items-center gap-1 min-w-0 truncate"
            >
              {dealName}
              <ArrowSquareOutIcon className="size-3 shrink-0 text-muted-foreground" />
            </Link>
            <button
              type="button"
              className="text-xs text-destructive hover:underline shrink-0"
              onClick={() => {
                updateTask.mutate(
                  { id: task.id, dealId: null },
                  {
                    onSuccess: () => setOpen(false),
                    onError: (err) => showError(err, "Failed to remove deal"),
                  },
                );
              }}
            >
              Remove
            </button>
          </div>
        )}
        <Input
          placeholder="Search deals…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mt-2 h-8 text-sm"
          autoFocus={!dealId}
        />
        {search && filtered.length > 0 && (
          <div className="mt-1.5 max-h-36 overflow-y-auto rounded-md border">
            {filtered.map((d) => (
              <button
                key={d.id}
                type="button"
                className="w-full px-2.5 py-1.5 text-left text-xs hover:bg-accent truncate"
                onClick={() => {
                  setSearch("");
                  updateTask.mutate(
                    { id: task.id, dealId: d.id },
                    {
                      onSuccess: () => setOpen(false),
                      onError: (err) =>
                        showError(err, "Failed to link deal"),
                    },
                  );
                }}
              >
                {d.name}
              </button>
            ))}
          </div>
        )}
        {search && filtered.length === 0 && (
          <p className="mt-1.5 text-xs text-muted-foreground">
            No deals found
          </p>
        )}
      </PopoverContent>
    </Popover>
  );
}

/* ─── Assignee (team member) ─── */

function AssigneePopover({
  taskId,
  assigneeId,
  assigneeLabel,
  members,
  onAssign,
}: {
  /** When omitted, `onAssign` must persist assignment (e.g. new task row). */
  taskId?: number;
  assigneeId: number | null;
  assigneeLabel: string | null;
  members: RbacUser[];
  onAssign?: (id: number | null) => void;
}) {
  const updateTask = useUpdateTask();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const activeMembers = useMemo(
    () => members.filter((m) => !m.disabled),
    [members],
  );

  const filtered = useMemo(
    () =>
      activeMembers
        .filter((m) => {
          const q = search.toLowerCase();
          return (
            formatMemberName(m).toLowerCase().includes(q) ||
            m.email.toLowerCase().includes(q)
          );
        })
        .slice(0, 12),
    [activeMembers, search],
  );

  const selected = assigneeId
    ? members.find((m) => m.id === assigneeId)
    : null;

  const persist = (id: number | null) => {
    if (onAssign) {
      onAssign(id);
      setOpen(false);
      return;
    }
    if (taskId == null) return;
    updateTask.mutate(
      { id: taskId, assigneeId: id },
      {
        onSuccess: () => setOpen(false),
        onError: (err) =>
          showError(err, id == null ? "Failed to unassign" : "Failed to assign"),
      },
    );
  };

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
          type="button"
          onClick={(e) => e.stopPropagation()}
          className="flex items-center gap-1.5 shrink-0 rounded-md border border-transparent px-2 py-0.5 text-xs transition-colors hover:bg-accent hover:border-border max-w-[130px]"
        >
          {selected ? (
            <>
              <span
                className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[10px] font-semibold text-primary"
                aria-hidden
              >
                {memberInitials(selected)}
              </span>
              <span className="truncate font-medium text-foreground">
                {assigneeLabel ?? formatMemberName(selected)}
              </span>
            </>
          ) : (
            <>
              <UserCircleIcon className="size-4 shrink-0 text-muted-foreground" />
              <span className="text-muted-foreground">Assign</span>
            </>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-64 p-3"
        align="start"
        onClick={(e) => e.stopPropagation()}
      >
        <Label className="text-xs text-muted-foreground">Assigned to</Label>
        {assigneeId && selected && (
          <div className="mt-1.5 flex items-center justify-between gap-2">
            <span className="text-sm font-medium truncate">
              {formatMemberName(selected)}
            </span>
            <button
              type="button"
              className="text-xs text-destructive hover:underline shrink-0"
              onClick={() => persist(null)}
            >
              Clear
            </button>
          </div>
        )}
        <Input
          placeholder="Search team…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mt-2 h-8 text-sm"
        />
        <div className="mt-1.5 max-h-44 overflow-y-auto rounded-md border">
          {filtered.map((m) => (
            <button
              key={m.id}
              type="button"
              className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-xs hover:bg-accent"
              onClick={() => {
                setSearch("");
                persist(m.id);
              }}
            >
              <span
                className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold"
                aria-hidden
              >
                {memberInitials(m)}
              </span>
              <span className="min-w-0 flex-1 truncate">
                <span className="font-medium">{formatMemberName(m)}</span>
                <span className="block truncate text-muted-foreground">
                  {m.email}
                </span>
              </span>
            </button>
          ))}
        </div>
        {search && filtered.length === 0 && (
          <p className="mt-1.5 text-xs text-muted-foreground">No match</p>
        )}
        {!search && filtered.length === 0 && (
          <p className="mt-1.5 text-xs text-muted-foreground">
            No teammates found
          </p>
        )}
      </PopoverContent>
    </Popover>
  );
}

/* ─── Subtask quick add (under a master task) ─── */

function SubtaskQuickAdd({
  parentId,
  onClose,
}: {
  parentId: number;
  onClose: () => void;
}) {
  const createTask = useCreateTask();
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const submit = () => {
    const trimmed = text.trim();
    if (!trimmed) {
      onClose();
      return;
    }
    createTask.mutate(
      {
        text: trimmed,
        parentTaskId: parentId,
        dueDate: new Date().toISOString(),
      },
      {
        onSuccess: () => {
          setText("");
          onClose();
        },
        onError: (err) => showError(err, "Failed to add subtask"),
      },
    );
  };

  return (
    <div className="flex items-center gap-2 border-l-2 border-primary/25 py-2 pl-3 ml-3 mr-4 rounded-r-md bg-muted/15">
      <ListPlusIcon className="size-4 shrink-0 text-muted-foreground" />
      <input
        ref={inputRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
          if (e.key === "Escape") {
            setText("");
            onClose();
          }
        }}
        onBlur={() => {
          if (!text.trim()) onClose();
        }}
        placeholder="New subtask…"
        className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/50"
        disabled={createTask.isPending}
      />
    </div>
  );
}

/* ─── Task Row ─── */

function TaskRow({
  task,
  contactName,
  contactId,
  companyName,
  companyId,
  dealName,
  dealId,
  assigneeLabel,
  bucketKey,
  contacts,
  companies,
  deals,
  members,
  isSubtask,
  onAddSubtask,
  subtaskCount = 0,
  masterHasSubtasks,
  subtasksCollapsed,
  onToggleSubtasksCollapse,
}: {
  task: Task;
  contactName: string | null;
  contactId: number | null;
  companyName: string | null;
  companyId: number | null;
  dealName: string | null;
  dealId: number | null;
  assigneeLabel: string | null;
  bucketKey: string;
  contacts: ContactSummary[];
  companies: CompanySummary[];
  deals: Deal[];
  members: RbacUser[];
  isSubtask?: boolean;
  onAddSubtask?: () => void;
  /** Master tasks only: shown in delete confirmation */
  subtaskCount?: number;
  /** Master row: at least one subtask exists (show collapse control) */
  masterHasSubtasks?: boolean;
  subtasksCollapsed?: boolean;
  onToggleSubtasksCollapse?: () => void;
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
        { id: task.id, text: editText.trim() },
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
      <div
        className={`group flex items-center gap-3 rounded-lg py-3 pr-4 transition-colors hover:bg-accent/40 ${
          isSubtask ? "pl-2 ml-6 border-l-2 border-border/70 bg-muted/10" : "pl-4"
        }`}
      >
        {!isSubtask && (
          <div className="flex w-6 shrink-0 items-center justify-center">
            {masterHasSubtasks ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleSubtasksCollapse?.();
                }}
                className="rounded p-0.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                aria-expanded={!subtasksCollapsed}
                aria-label={
                  subtasksCollapsed
                    ? "Expand subtasks"
                    : "Collapse subtasks"
                }
              >
                <CaretRightIcon
                  className={cn(
                    "size-4 transition-transform duration-200",
                    !subtasksCollapsed && "rotate-90",
                  )}
                />
              </button>
            ) : (
              <span className="size-4 shrink-0" aria-hidden />
            )}
          </div>
        )}

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

        <AssigneePopover
          taskId={task.id}
          assigneeId={task.assigneeId}
          assigneeLabel={assigneeLabel}
          members={members}
        />

        {/* Right-side metadata — all clickable popovers */}
        <div className="flex items-center gap-1.5 shrink-0">
          <CompanyPopover
            task={task}
            companyName={companyName}
            companyId={companyId}
            companies={companies}
          />

          {/* Contact popover */}
          <ContactPopover
            task={task}
            contactName={contactName}
            contactId={contactId}
            contacts={contacts}
          />

          <DealPopover
            task={task}
            dealName={dealName}
            dealId={dealId}
            deals={deals}
          />

          {/* Date popover */}
          <DatePopover task={task} isOverdue={isOverdue} isDone={isDone} />

          {!isSubtask && onAddSubtask && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onAddSubtask();
              }}
              className="shrink-0 p-1 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-primary transition-all rounded"
              aria-label="Add subtask"
            >
              <ListPlusIcon className="size-3.5" />
            </button>
          )}

          {isSubtask && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  onClick={(e) => e.stopPropagation()}
                  className="shrink-0 p-1 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-foreground transition-all rounded"
                  aria-label="Subtask options"
                >
                  <DotsThreeVerticalIcon className="size-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                <DropdownMenuItem
                  onClick={() => {
                    updateTask.mutate(
                      { id: task.id, parentTaskId: null },
                      {
                        onError: (err) =>
                          showError(err, "Failed to move task"),
                      },
                    );
                  }}
                >
                  Make top-level task
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

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
              {subtaskCount > 0
                ? ` This will also remove ${subtaskCount} subtask${subtaskCount === 1 ? "" : "s"}.`
                : ""}
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

function InlineAddTask({
  contacts,
  companies,
  deals,
  members,
}: {
  contacts: ContactSummary[];
  companies: CompanySummary[];
  deals: Deal[];
  members: RbacUser[];
}) {
  const createTask = useCreateTask();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");
  const [assigneeId, setAssigneeId] = useState<number | null>(null);
  const [contactId, setContactId] = useState<number | null>(null);
  const [companyId, setCompanyId] = useState<number | null>(null);
  const [dealId, setDealId] = useState<number | null>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkTab, setLinkTab] = useState<"contact" | "company" | "deal">(
    "contact",
  );
  const [linkSearch, setLinkSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const assignee = assigneeId
    ? members.find((m) => m.id === assigneeId)
    : null;
  const assigneeDraftLabel = assignee ? shortMemberLabel(assignee) : null;

  const filteredContacts = useMemo(
    () =>
      contacts
        .filter((c) => {
          const name =
            `${c.firstName ?? ""} ${c.lastName ?? ""}`.toLowerCase();
          return name.includes(linkSearch.toLowerCase());
        })
        .slice(0, 8),
    [contacts, linkSearch],
  );

  const filteredCompanies = useMemo(
    () =>
      companies
        .filter((c) =>
          c.name.toLowerCase().includes(linkSearch.toLowerCase()),
        )
        .slice(0, 8),
    [companies, linkSearch],
  );

  const filteredDeals = useMemo(
    () =>
      deals
        .filter((d) =>
          d.name.toLowerCase().includes(linkSearch.toLowerCase()),
        )
        .slice(0, 8),
    [deals, linkSearch],
  );

  const resetDraft = () => {
    setAssigneeId(null);
    setContactId(null);
    setCompanyId(null);
    setDealId(null);
  };

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  useEffect(() => {
    if (!linkOpen) setLinkSearch("");
  }, [linkOpen]);

  const handleSubmit = () => {
    const trimmed = text.trim();
    if (!trimmed) {
      setEditing(false);
      setText("");
      resetDraft();
      return;
    }
    const payload: CreateTaskData = {
      text: trimmed,
      dueDate: new Date().toISOString(),
    };
    if (assigneeId != null) payload.assigneeId = assigneeId;
    if (contactId != null) payload.contactId = contactId;
    if (companyId != null) payload.companyId = companyId;
    if (dealId != null) payload.dealId = dealId;

    createTask.mutate(payload, {
      onSuccess: () => {
        setText("");
        resetDraft();
        inputRef.current?.focus();
      },
      onError: (err) => showError(err, "Failed to create task"),
    });
  };

  const linkedContact = contactId
    ? contacts.find((c) => c.id === contactId)
    : null;
  const linkedCompany = companyId
    ? companies.find((c) => c.id === companyId)
    : null;
  const linkedDeal = dealId ? deals.find((d) => d.id === dealId) : null;
  const linkCount =
    (contactId ? 1 : 0) + (companyId ? 1 : 0) + (dealId ? 1 : 0);

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
    <div className="space-y-2 px-4 py-3">
      <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
        <div className="flex min-w-0 flex-1 items-center gap-3">
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
                resetDraft();
              }
            }}
            onBlur={() => {
              if (!text.trim()) {
                setEditing(false);
                setText("");
                resetDraft();
              }
            }}
            placeholder="Task description…"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/50"
            disabled={createTask.isPending}
          />
        </div>
        <div className="flex shrink-0 items-center gap-1.5 pl-8 sm:pl-0">
          <AssigneePopover
            assigneeId={assigneeId}
            assigneeLabel={assigneeDraftLabel}
            members={members}
            onAssign={setAssigneeId}
          />
          <Popover open={linkOpen} onOpenChange={setLinkOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 gap-1 px-2 text-xs"
              >
                <LinkSimpleIcon className="size-3.5" />
                Link
                {linkCount > 0 ? (
                  <Badge
                    variant="secondary"
                    className="h-4 min-w-4 px-1 text-[10px]"
                  >
                    {linkCount}
                  </Badge>
                ) : null}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-0" align="end">
              <Tabs value={linkTab} onValueChange={(v) => setLinkTab(v as typeof linkTab)}>
                <TabsList className="grid w-full grid-cols-3 rounded-none border-b bg-transparent p-0 h-9">
                  <TabsTrigger
                    value="contact"
                    className="rounded-none text-xs data-[state=active]:border-b-2 data-[state=active]:border-primary"
                  >
                    Contact
                  </TabsTrigger>
                  <TabsTrigger
                    value="company"
                    className="rounded-none text-xs data-[state=active]:border-b-2 data-[state=active]:border-primary"
                  >
                    Company
                  </TabsTrigger>
                  <TabsTrigger
                    value="deal"
                    className="rounded-none text-xs data-[state=active]:border-b-2 data-[state=active]:border-primary"
                  >
                    Deal
                  </TabsTrigger>
                </TabsList>
                <div className="p-3 space-y-2">
                  <Input
                    placeholder={
                      linkTab === "contact"
                        ? "Search contacts…"
                        : linkTab === "company"
                          ? "Search companies…"
                          : "Search deals…"
                    }
                    value={linkSearch}
                    onChange={(e) => setLinkSearch(e.target.value)}
                    className="h-8 text-sm"
                  />
                  <TabsContent value="contact" className="mt-0 space-y-1">
                    {linkedContact && (
                      <div className="flex items-center justify-between rounded-md border px-2 py-1.5 text-xs">
                        <span className="truncate">
                          {linkedContact.firstName} {linkedContact.lastName}
                        </span>
                        <button
                          type="button"
                          className="text-destructive hover:underline shrink-0"
                          onClick={() => setContactId(null)}
                        >
                          Clear
                        </button>
                      </div>
                    )}
                    {linkSearch &&
                      filteredContacts.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          className="w-full rounded-md px-2 py-1.5 text-left text-xs hover:bg-accent truncate"
                          onClick={() => {
                            setContactId(c.id);
                            setLinkOpen(false);
                          }}
                        >
                          {c.firstName} {c.lastName}
                        </button>
                      ))}
                  </TabsContent>
                  <TabsContent value="company" className="mt-0 space-y-1">
                    {linkedCompany && (
                      <div className="flex items-center justify-between rounded-md border px-2 py-1.5 text-xs">
                        <span className="truncate">{linkedCompany.name}</span>
                        <button
                          type="button"
                          className="text-destructive hover:underline shrink-0"
                          onClick={() => setCompanyId(null)}
                        >
                          Clear
                        </button>
                      </div>
                    )}
                    {linkSearch &&
                      filteredCompanies.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          className="w-full rounded-md px-2 py-1.5 text-left text-xs hover:bg-accent truncate"
                          onClick={() => {
                            setCompanyId(c.id);
                            setLinkOpen(false);
                          }}
                        >
                          {c.name}
                        </button>
                      ))}
                  </TabsContent>
                  <TabsContent value="deal" className="mt-0 space-y-1">
                    {linkedDeal && (
                      <div className="flex items-center justify-between rounded-md border px-2 py-1.5 text-xs">
                        <span className="truncate">{linkedDeal.name}</span>
                        <button
                          type="button"
                          className="text-destructive hover:underline shrink-0"
                          onClick={() => setDealId(null)}
                        >
                          Clear
                        </button>
                      </div>
                    )}
                    {linkSearch &&
                      filteredDeals.map((d) => (
                        <button
                          key={d.id}
                          type="button"
                          className="w-full rounded-md px-2 py-1.5 text-left text-xs hover:bg-accent truncate"
                          onClick={() => {
                            setDealId(d.id);
                            setLinkOpen(false);
                          }}
                        >
                          {d.name}
                        </button>
                      ))}
                  </TabsContent>
                </div>
              </Tabs>
            </PopoverContent>
          </Popover>
        </div>
      </div>
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
  companies,
  deals,
  members,
  masterTasks,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contacts: ContactSummary[];
  companies: CompanySummary[];
  deals: Deal[];
  members: RbacUser[];
  masterTasks: Task[];
}) {
  const createTask = useCreateTask();
  const [contactId, setContactId] = useState("");
  const [contactSearch, setContactSearch] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [companySearch, setCompanySearch] = useState("");
  const [dealId, setDealId] = useState("");
  const [dealSearch, setDealSearch] = useState("");
  const [assigneeId, setAssigneeId] = useState<string>("");
  const [parentMasterId, setParentMasterId] = useState<string>("");
  const [text, setText] = useState("");
  const [dueDate, setDueDate] = useState(() => tomorrowYmd());
  const [dueTime, setDueTime] = useState("09:00");

  useEffect(() => {
    if (open) {
      setDueDate(tomorrowYmd());
      setDueTime("09:00");
      setText("");
      setContactId("");
      setContactSearch("");
      setCompanyId("");
      setCompanySearch("");
      setDealId("");
      setDealSearch("");
      setAssigneeId("");
      setParentMasterId("");
    }
  }, [open]);

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

  const filteredCompanies = useMemo(
    () =>
      companies
        .filter((c) =>
          c.name.toLowerCase().includes(companySearch.toLowerCase()),
        )
        .slice(0, 20),
    [companies, companySearch],
  );

  const filteredDeals = useMemo(
    () =>
      deals
        .filter((d) => d.name.toLowerCase().includes(dealSearch.toLowerCase()))
        .slice(0, 20),
    [deals, dealSearch],
  );

  const activeMembers = useMemo(
    () => members.filter((m) => !m.disabled),
    [members],
  );

  const handleSubmit = () => {
    if (!text.trim()) {
      toast.error("Enter task text");
      return;
    }
    const dueIso =
      dueDate && dueTime
        ? applyTimeToDate(localDateFromYmd(dueDate), dueTime).toISOString()
        : dueDate
          ? localDateFromYmd(dueDate).toISOString()
          : undefined;

    const payload: CreateTaskData = {
      text: text.trim(),
      dueDate: dueIso,
    };
    if (contactId) payload.contactId = parseInt(contactId, 10);
    if (companyId) payload.companyId = parseInt(companyId, 10);
    if (dealId) payload.dealId = parseInt(dealId, 10);
    if (assigneeId) payload.assigneeId = parseInt(assigneeId, 10);
    if (parentMasterId)
      payload.parentTaskId = parseInt(parentMasterId, 10);

    createTask.mutate(payload, {
      onSuccess: () => {
        toast.success("Task created");
        onOpenChange(false);
      },
      onError: (err) => showError(err, "Failed to create task"),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New task</DialogTitle>
          <DialogDescription>
            Add a task, link it to your CRM, pick a teammate, and set date &
            time.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_160px] sm:items-end">
            <div className="space-y-1.5">
              <Label className="text-xs">Task</Label>
              <Input
                placeholder="What needs to be done?"
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
              <Label className="text-xs">Assign to</Label>
              <Select
                value={assigneeId || "__none__"}
                onValueChange={(v) =>
                  setAssigneeId(v === "__none__" ? "" : v)
                }
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="Teammate" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__" className="text-xs">
                    No one
                  </SelectItem>
                  {activeMembers.map((m) => (
                    <SelectItem
                      key={m.id}
                      value={String(m.id)}
                      className="text-xs"
                    >
                      {formatMemberName(m)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {masterTasks.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-xs">Under master task (optional)</Label>
              <Select
                value={parentMasterId || "__none__"}
                onValueChange={(v) =>
                  setParentMasterId(v === "__none__" ? "" : v)
                }
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent className="max-h-56">
                  <SelectItem value="__none__" className="text-xs">
                    None — top-level task
                  </SelectItem>
                  {masterTasks.map((t) => (
                    <SelectItem
                      key={t.id}
                      value={String(t.id)}
                      className="text-xs line-clamp-2"
                    >
                      {t.text?.trim() || `Task #${t.id}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
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
                    type="button"
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
            <Label className="text-xs">Company (optional)</Label>
            <Input
              placeholder="Search companies…"
              value={companySearch}
              onChange={(e) => {
                setCompanySearch(e.target.value);
                setCompanyId("");
              }}
              className="h-8 text-sm"
            />
            {companySearch && !companyId && filteredCompanies.length > 0 && (
              <div className="max-h-40 overflow-y-auto rounded-md border bg-popover shadow-md">
                {filteredCompanies.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className="w-full px-3 py-1.5 text-left text-sm hover:bg-accent truncate"
                    onClick={() => {
                      setCompanyId(String(c.id));
                      setCompanySearch(c.name);
                    }}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Deal (optional)</Label>
            <Input
              placeholder="Search deals…"
              value={dealSearch}
              onChange={(e) => {
                setDealSearch(e.target.value);
                setDealId("");
              }}
              className="h-8 text-sm"
            />
            {dealSearch && !dealId && filteredDeals.length > 0 && (
              <div className="max-h-40 overflow-y-auto rounded-md border bg-popover shadow-md">
                {filteredDeals.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    className="w-full px-3 py-1.5 text-left text-sm hover:bg-accent truncate"
                    onClick={() => {
                      setDealId(String(d.id));
                      setDealSearch(d.name);
                    }}
                  >
                    {d.name}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
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
                      ? format(localDateFromYmd(dueDate), "MMM d, yyyy")
                      : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dueDate ? localDateFromYmd(dueDate) : undefined}
                    onSelect={(date) =>
                      setDueDate(date ? format(date, "yyyy-MM-dd") : "")
                    }
                    defaultMonth={
                      dueDate ? localDateFromYmd(dueDate) : new Date()
                    }
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Due time</Label>
              <Input
                type="time"
                value={dueTime}
                onChange={(e) => setDueTime(e.target.value)}
                className="h-8 text-sm tabular-nums"
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
  const { data: dealsData } = useDeals({
    pagination: { page: 1, perPage: 500 },
  });
  const { data: rbacUsersData } = useRbacUsers();

  const [addOpen, setAddOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [searchExpanded, setSearchExpanded] = useState(false);
  const [subtaskDraftParentId, setSubtaskDraftParentId] = useState<
    number | null
  >(null);
  const [collapsedMasterIds, setCollapsedMasterIds] = useState<Set<number>>(
    () => new Set(),
  );
  const searchRef = useRef<HTMLInputElement>(null);

  const toggleMasterCollapsed = useCallback((id: number) => {
    setCollapsedMasterIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setSubtaskDraftParentId((cur) => (cur === id ? null : cur));
  }, []);

  const expandMasterIfCollapsed = useCallback((id: number) => {
    setCollapsedMasterIds((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

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
  const deals = useMemo(() => dealsData?.data ?? [], [dealsData?.data]);
  const members = useMemo(
    () => rbacUsersData ?? [],
    [rbacUsersData],
  );

  const contactMap = useMemo(
    () => new Map(contacts.map((c) => [c.id, c])),
    [contacts],
  );
  const companyMap = useMemo(
    () => new Map(companies.map((c) => [c.id, c])),
    [companies],
  );
  const dealMap = useMemo(
    () => new Map(deals.map((d) => [d.id, d])),
    [deals],
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

  const taskById = useMemo(
    () => new Map(activeTasks.map((t) => [t.id, t])),
    [activeTasks],
  );

  const searchCtx = useMemo(
    () => ({ contactMap, companyMap, dealMap, members }),
    [contactMap, companyMap, dealMap, members],
  );

  const filteredTaskIds = useMemo(() => {
    if (!search.trim()) return new Set(activeTasks.map((t) => t.id));
    const direct = new Set<number>();
    for (const t of activeTasks) {
      if (taskMatchesSearch(t, search, searchCtx)) direct.add(t.id);
    }
    const expanded = new Set(direct);
    for (const id of direct) {
      const t = taskById.get(id);
      const ep = t ? effectiveParentTaskId(t, taskById) : null;
      if (ep != null) expanded.add(ep);
    }
    for (const t of activeTasks) {
      const p = effectiveParentTaskId(t, taskById);
      if (p != null && expanded.has(p)) expanded.add(t.id);
    }
    return expanded;
  }, [activeTasks, search, searchCtx, taskById]);

  const visibleTasks = useMemo(
    () => activeTasks.filter((t) => filteredTaskIds.has(t.id)),
    [activeTasks, filteredTaskIds],
  );

  const childrenByParent = useMemo(() => {
    const m = new Map<number, Task[]>();
    for (const t of visibleTasks) {
      const p = effectiveParentTaskId(t, taskById);
      if (p == null) continue;
      const arr = m.get(p) ?? [];
      arr.push(t);
      m.set(p, arr);
    }
    for (const arr of m.values()) arr.sort(compareTasksByDue);
    return m;
  }, [visibleTasks, taskById]);

  const subtaskCountByParent = useMemo(() => {
    const m = new Map<number, number>();
    for (const t of activeTasks) {
      const p = effectiveParentTaskId(t, taskById);
      if (p == null) continue;
      m.set(p, (m.get(p) ?? 0) + 1);
    }
    return m;
  }, [activeTasks, taskById]);

  const rootVisibleTasks = useMemo(
    () =>
      visibleTasks.filter((t) => effectiveParentTaskId(t, taskById) == null),
    [visibleTasks, taskById],
  );

  const masterRootTasks = useMemo(
    () =>
      [...activeTasks]
        .filter((t) => effectiveParentTaskId(t, taskById) == null)
        .sort((a, b) =>
          (a.text ?? "").localeCompare(b.text ?? "", undefined, {
            sensitivity: "base",
          }),
        ),
    [activeTasks, taskById],
  );

  const grouped = useMemo(() => {
    const groups: Record<string, Task[]> = {
      overdue: [],
      today: [],
      tomorrow: [],
      thisWeek: [],
      later: [],
    };
    for (const t of rootVisibleTasks) {
      groups[getBucket(t.dueDate)].push(t);
    }
    (Object.keys(groups) as Array<keyof typeof groups>).forEach((k) => {
      groups[k].sort(compareTasksByDue);
    });
    return groups;
  }, [rootVisibleTasks]);

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
          visibleTasks.length === 0 && (
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
                  const children = childrenByParent.get(task.id) ?? [];
                  const rowProps = (t: Task) => {
                    const contact = t.contactId
                      ? contactMap.get(t.contactId)
                      : null;
                    const company = t.companyId
                      ? companyMap.get(t.companyId)
                      : null;
                    const deal = t.dealId ? dealMap.get(t.dealId) : null;
                    const assignee =
                      t.assigneeId != null
                        ? members.find((m) => m.id === t.assigneeId)
                        : null;
                    const contactName = contact
                      ? `${contact.firstName ?? ""} ${contact.lastName ?? ""}`.trim() ||
                        null
                      : null;
                    const companyName = company?.name ?? null;
                    const dealName = deal?.name ?? null;
                    const assigneeLabel = assignee
                      ? shortMemberLabel(assignee)
                      : null;
                    return {
                      contactName,
                      contactId: t.contactId,
                      companyName,
                      companyId: t.companyId,
                      dealName,
                      dealId: t.dealId,
                      assigneeLabel,
                    };
                  };
                  const masterProps = rowProps(task);
                  const totalSubs =
                    subtaskCountByParent.get(task.id) ?? 0;
                  const masterCollapsed =
                    totalSubs > 0 && collapsedMasterIds.has(task.id);
                  return (
                    <div key={task.id} className="space-y-0">
                      <TaskRow
                        task={task}
                        {...masterProps}
                        bucketKey={key}
                        contacts={contacts}
                        companies={companies}
                        deals={deals}
                        members={members}
                        subtaskCount={totalSubs}
                        masterHasSubtasks={totalSubs > 0}
                        subtasksCollapsed={masterCollapsed}
                        onToggleSubtasksCollapse={
                          totalSubs > 0
                            ? () => toggleMasterCollapsed(task.id)
                            : undefined
                        }
                        onAddSubtask={() => {
                          expandMasterIfCollapsed(task.id);
                          setSubtaskDraftParentId((cur) =>
                            cur === task.id ? null : task.id,
                          );
                        }}
                      />
                      {subtaskDraftParentId === task.id && !masterCollapsed && (
                        <SubtaskQuickAdd
                          parentId={task.id}
                          onClose={() => setSubtaskDraftParentId(null)}
                        />
                      )}
                      {!masterCollapsed &&
                        children.map((child) => (
                          <TaskRow
                            key={child.id}
                            task={child}
                            {...rowProps(child)}
                            bucketKey={key}
                            contacts={contacts}
                            companies={companies}
                            deals={deals}
                            members={members}
                            isSubtask
                          />
                        ))}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {!tasksPending && activeTasks.length > 0 && (
          <InlineAddTask
            contacts={contacts}
            companies={companies}
            deals={deals}
            members={members}
          />
        )}
      </div>

      <AddTaskDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        contacts={contacts}
        companies={companies}
        deals={deals}
        members={members}
        masterTasks={masterRootTasks}
      />
    </div>
  );
}
