import { useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PlusIcon, CheckIcon, CaretUpDownIcon } from "@phosphor-icons/react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { NoteCard } from "@/components/record-detail/NoteCard";
import { getList, getOne, create, remove } from "@/lib/api/crm";
import { usePageTitle } from "@/contexts/page-header";
import { showError } from "@/lib/show-error";
import { cn } from "@/lib/utils";

const PER_PAGE = 25;

type NoteType = "deals" | "contacts" | "companies";

interface NoteRow {
  id: number;
  title?: string | null;
  text: string;
  date: string;
  dealId?: number;
  deal_id?: number;
  contactId?: number;
  contact_id?: number;
  companyId?: number;
  company_id?: number;
}

interface ParentRecord {
  id: number;
  label: string;
}

// ── Combobox for picking a parent record ─────────────────────────────────────

function RecordCombobox({
  records,
  value,
  onChange,
  placeholder,
  loading,
}: {
  records: ParentRecord[];
  value: number | null;
  onChange: (id: number | null) => void;
  placeholder: string;
  loading: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selected = records.find((r) => r.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          <span className="truncate">
            {selected ? selected.label : placeholder}
          </span>
          <CaretUpDownIcon className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search…" />
          <CommandList>
            {loading ? (
              <CommandEmpty>Loading…</CommandEmpty>
            ) : records.length === 0 ? (
              <CommandEmpty>No records found.</CommandEmpty>
            ) : (
              <CommandGroup>
                {records.map((r) => (
                  <CommandItem
                    key={r.id}
                    value={r.label}
                    onSelect={() => {
                      onChange(r.id === value ? null : r.id);
                      setOpen(false);
                    }}
                  >
                    <CheckIcon
                      className={cn(
                        "mr-2 size-4",
                        value === r.id ? "opacity-100" : "opacity-0",
                      )}
                    />
                    {r.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// ── Add Note Dialog ───────────────────────────────────────────────────────────

const RESOURCE_MAP: Record<NoteType, string> = {
  deals: "deal_notes",
  contacts: "contact_notes",
  companies: "company_notes",
};

const FK_MAP: Record<NoteType, string> = {
  deals: "dealId",
  contacts: "contactId",
  companies: "companyId",
};

function useParentRecords(noteType: NoteType) {
  return useQuery({
    queryKey: ["note-dialog-parents", noteType],
    queryFn: async (): Promise<ParentRecord[]> => {
      const data = await getList<Record<string, unknown>>(noteType, {
        pagination: { page: 1, perPage: 200 },
        sort: { field: noteType === "contacts" ? "first_name" : "name", order: "ASC" },
      });
      return data.data.map((r) => {
        const id = (r.id ?? r.Id) as number;
        let label = "Unknown";
        if (noteType === "contacts") {
          const first = (r.firstName ?? r.first_name ?? "") as string;
          const last = (r.lastName ?? r.last_name ?? "") as string;
          label = [first, last].filter(Boolean).join(" ") || "Unnamed Contact";
        } else {
          label = ((r.name ?? r.Name ?? "") as string) || "Unnamed";
        }
        return { id, label };
      });
    },
  });
}

function AddNoteDialog({
  open,
  onOpenChange,
  defaultType,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultType: NoteType;
}) {
  const qc = useQueryClient();
  const [noteType, setNoteType] = useState<NoteType>(defaultType);
  const [parentId, setParentId] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");

  const { data: parentRecords = [], isPending: loadingRecords } =
    useParentRecords(noteType);

  // Reset when dialog opens or type changes
  const handleTypeChange = useCallback((t: NoteType) => {
    setNoteType(t);
    setParentId(null);
  }, []);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next) {
        setNoteType(defaultType);
        setParentId(null);
        setTitle("");
        setText("");
      }
      onOpenChange(next);
    },
    [defaultType, onOpenChange],
  );

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!parentId) throw new Error("Please select a record to attach this note to.");
      if (!text.trim() && !title.trim())
        throw new Error("Please enter a title or note text.");
      const resource = RESOURCE_MAP[noteType];
      const fk = FK_MAP[noteType];
      return create(resource, {
        [fk]: parentId,
        title: title.trim() || null,
        text: text.trim(),
        date: new Date().toISOString(),
      });
    },
    onSuccess: () => {
      const resource = RESOURCE_MAP[noteType];
      qc.invalidateQueries({ queryKey: [resource] });
      qc.invalidateQueries({ queryKey: ["notes"] });
      toast.success("Note added");
      handleOpenChange(false);
    },
    onError: (err) => showError(err, "Failed to add note"),
  });

  const typeLabels: Record<NoteType, string> = {
    deals: "Deal Note",
    contacts: "Contact Note",
    companies: "Company Note",
  };

  const parentPlaceholders: Record<NoteType, string> = {
    deals: "Select a deal…",
    contacts: "Select a contact…",
    companies: "Select a company…",
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Note</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-1">
          {/* Note type */}
          <div className="flex flex-col gap-1.5">
            <Label>Note type</Label>
            <Select
              value={noteType}
              onValueChange={(v) => handleTypeChange(v as NoteType)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="deals">Deal Note</SelectItem>
                <SelectItem value="contacts">Contact Note</SelectItem>
                <SelectItem value="companies">Company Note</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Parent record picker */}
          <div className="flex flex-col gap-1.5">
            <Label>
              {typeLabels[noteType].replace(" Note", "")}
              <span className="ml-1 text-destructive">*</span>
            </Label>
            <RecordCombobox
              records={parentRecords}
              value={parentId}
              onChange={setParentId}
              placeholder={parentPlaceholders[noteType]}
              loading={loadingRecords}
            />
          </div>

          {/* Title */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="note-title">Title (optional)</Label>
            <Input
              id="note-title"
              placeholder="Untitled"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          {/* Text */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="note-text">Note</Label>
            <Textarea
              id="note-text"
              placeholder="Write your note here…"
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="min-h-[120px] resize-none"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => createMutation.mutate()}
            disabled={createMutation.isPending}
          >
            {createMutation.isPending ? "Saving…" : "Add Note"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Notes tab data hook ───────────────────────────────────────────────────────

function useNotesTab(resource: string, fkField: string, page: number) {
  const { data, isPending } = useQuery({
    queryKey: [resource, "all", page],
    queryFn: () =>
      getList<NoteRow>(resource, {
        pagination: { page, perPage: PER_PAGE },
        sort: { field: "date", order: "DESC" },
      }),
  });

  const notes = useMemo(() => data?.data ?? [], [data?.data]);
  const total = data?.total ?? 0;

  const parentIds = useMemo(() => {
    const ids = new Set<number>();
    for (const n of notes) {
      const row = n as unknown as Record<string, unknown>;
      const id =
        row[fkField] ??
        row[fkField.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)];
      if (id != null) ids.add(Number(id));
    }
    return Array.from(ids);
  }, [notes, fkField]);

  return { notes, total, isPending, parentIds };
}

function useParentNames(
  resource: string,
  ids: number[],
  nameExtractor: (r: Record<string, unknown>) => string,
) {
  return useQuery({
    queryKey: [resource, "batch", ids],
    queryFn: async () => {
      const entries = await Promise.all(
        ids.map(async (id) => {
          try {
            const d = await getOne<Record<string, unknown>>(resource, id);
            return [id, { name: nameExtractor(d) }] as const;
          } catch {
            return [id, { name: "Unknown" }] as const;
          }
        }),
      );
      return Object.fromEntries(entries);
    },
    enabled: ids.length > 0,
  });
}

// ── Notes Grid ────────────────────────────────────────────────────────────────

function NotesGrid({
  resource,
  notes,
  total,
  isPending,
  page,
  setPage,
  onNoteClick,
}: {
  resource: string;
  notes: NoteRow[];
  total: number;
  isPending: boolean;
  page: number;
  setPage: (fn: (p: number) => number) => void;
  onNoteClick: (parentId: number) => void;
}) {
  const qc = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: (id: number) => remove(resource, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [resource] });
      qc.invalidateQueries({ queryKey: ["notes"] });
      toast.success("Note deleted");
    },
    onError: (err) => showError(err, "Failed to delete note"),
  });

  if (isPending) {
    return (
      <div className="space-y-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-16 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (notes.length === 0) {
    return (
      <div className="rounded-lg bg-muted/50 py-12 text-center text-sm text-muted-foreground">
        No notes yet.
      </div>
    );
  }

  return (
    <>
      <div className="grid gap-2 sm:grid-cols-2">
        {notes.map((note) => {
          const row = note as unknown as Record<string, unknown>;
          const id = (row.id ?? row.Id) as number;
          const parentId = (row.dealId ??
            row.deal_id ??
            row.contactId ??
            row.contact_id ??
            row.companyId ??
            row.company_id) as number;
          const title = (row.title ?? null) as string | null;
          const text = (row.text ?? "") as string;
          const date = (row.date ?? row.Date) as string;

          return (
            <NoteCard
              key={id}
              title={title}
              text={text}
              date={date}
              onClick={() => onNoteClick(parentId)}
              onDelete={() => deleteMutation.mutate(id)}
            />
          );
        })}
      </div>
      {total > PER_PAGE && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">{total} total</span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page * PER_PAGE >= total}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function NotesPage() {
  usePageTitle("Notes");
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<NoteType>("deals");
  const [dealPage, setDealPage] = useState(1);
  const [contactPage, setContactPage] = useState(1);
  const [companyPage, setCompanyPage] = useState(1);
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  const dealTab = useNotesTab("deal_notes", "dealId", dealPage);
  const contactTab = useNotesTab("contact_notes", "contactId", contactPage);
  const companyTab = useNotesTab("company_notes", "companyId", companyPage);

  const { data: dealsData } = useParentNames("deals", dealTab.parentIds, (d) =>
    String(d.name ?? d.Name ?? "Deal"),
  );
  const { data: contactsData } = useParentNames(
    "contacts",
    contactTab.parentIds,
    (c) => {
      const first = c.firstName ?? c.first_name ?? "";
      const last = c.lastName ?? c.last_name ?? "";
      return [first, last].filter(Boolean).join(" ") || "Contact";
    },
  );
  const { data: companiesData } = useParentNames(
    "companies",
    companyTab.parentIds,
    (c) => String(c.name ?? c.Name ?? "Company"),
  );

  // Suppress unused variable warnings – kept for potential future use (parent name badges)
  void dealsData;
  void contactsData;
  void companiesData;

  const handleTabChange = useCallback((v: string) => {
    setActiveTab(v as NoteType);
  }, []);

  return (
    <div className="flex h-full flex-col gap-5 pb-8">
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <div className="flex items-center justify-between gap-3">
          <TabsList>
            <TabsTrigger value="deals">Deal Notes</TabsTrigger>
            <TabsTrigger value="contacts">Contact Notes</TabsTrigger>
            <TabsTrigger value="companies">Company Notes</TabsTrigger>
          </TabsList>
          <Button
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={() => setAddDialogOpen(true)}
          >
            <PlusIcon className="size-3.5" />
            Add Note
          </Button>
        </div>

        <TabsContent value="deals" className="mt-4 flex flex-1 flex-col gap-4">
          <NotesGrid
            resource="deal_notes"
            notes={dealTab.notes}
            total={dealTab.total}
            isPending={dealTab.isPending}
            page={dealPage}
            setPage={setDealPage}
            onNoteClick={(dealId) => navigate(`/objects/deals/${dealId}#notes`)}
          />
        </TabsContent>

        <TabsContent
          value="contacts"
          className="mt-4 flex flex-1 flex-col gap-4"
        >
          <NotesGrid
            resource="contact_notes"
            notes={contactTab.notes}
            total={contactTab.total}
            isPending={contactTab.isPending}
            page={contactPage}
            setPage={setContactPage}
            onNoteClick={(contactId) =>
              navigate(`/objects/contacts/${contactId}#notes`)
            }
          />
        </TabsContent>

        <TabsContent
          value="companies"
          className="mt-4 flex flex-1 flex-col gap-4"
        >
          <NotesGrid
            resource="company_notes"
            notes={companyTab.notes}
            total={companyTab.total}
            isPending={companyTab.isPending}
            page={companyPage}
            setPage={setCompanyPage}
            onNoteClick={(companyId) =>
              navigate(`/objects/companies/${companyId}#notes`)
            }
          />
        </TabsContent>
      </Tabs>

      <AddNoteDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        defaultType={activeTab}
      />
    </div>
  );
}
