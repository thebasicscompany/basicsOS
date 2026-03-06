import { useState, useMemo } from "react";
import { useNavigate } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { NoteCard } from "@/components/record-detail/NoteCard";
import { getList, getOne } from "@/lib/api/crm";
import { usePageTitle } from "@/contexts/page-header";

const PER_PAGE = 25;

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
      const id = row[fkField] ?? row[fkField.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)];
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

function NotesGrid({
  notes,
  total,
  isPending,
  page,
  setPage,
  parentNames: _parentNames,
  fkField: _fkField,
  onNoteClick,
}: {
  notes: NoteRow[];
  total: number;
  isPending: boolean;
  page: number;
  setPage: (fn: (p: number) => number) => void;
  parentNames?: Record<number, { name: string }>;
  fkField: string;
  onNoteClick: (parentId: number) => void;
}) {
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
          const parentId =
            (row.dealId ??
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

export function NotesPage() {
  usePageTitle("Notes");
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<
    "deals" | "contacts" | "companies"
  >("deals");
  const [dealPage, setDealPage] = useState(1);
  const [contactPage, setContactPage] = useState(1);
  const [companyPage, setCompanyPage] = useState(1);

  const dealTab = useNotesTab("deal_notes", "dealId", dealPage);
  const contactTab = useNotesTab("contact_notes", "contactId", contactPage);
  const companyTab = useNotesTab("company_notes", "companyId", companyPage);

  const { data: dealsData } = useParentNames(
    "deals",
    dealTab.parentIds,
    (d) => String(d.name ?? d.Name ?? "Deal"),
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

  return (
    <div className="flex h-full flex-col gap-5 pb-8">
      <Tabs
        value={activeTab}
        onValueChange={(v) =>
          setActiveTab(v as "deals" | "contacts" | "companies")
        }
      >
        <TabsList>
          <TabsTrigger value="deals">Deal Notes</TabsTrigger>
          <TabsTrigger value="contacts">Contact Notes</TabsTrigger>
          <TabsTrigger value="companies">Company Notes</TabsTrigger>
        </TabsList>

        <TabsContent value="deals" className="mt-4 flex flex-1 flex-col gap-4">
          <NotesGrid
            notes={dealTab.notes}
            total={dealTab.total}
            isPending={dealTab.isPending}
            page={dealPage}
            setPage={setDealPage}
            parentNames={dealsData}
            fkField="dealId"
            onNoteClick={(dealId) => navigate(`/objects/deals/${dealId}#notes`)}
          />
        </TabsContent>

        <TabsContent
          value="contacts"
          className="mt-4 flex flex-1 flex-col gap-4"
        >
          <NotesGrid
            notes={contactTab.notes}
            total={contactTab.total}
            isPending={contactTab.isPending}
            page={contactPage}
            setPage={setContactPage}
            parentNames={contactsData}
            fkField="contactId"
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
            notes={companyTab.notes}
            total={companyTab.total}
            isPending={companyTab.isPending}
            page={companyPage}
            setPage={setCompanyPage}
            parentNames={companiesData}
            fkField="companyId"
            onNoteClick={(companyId) =>
              navigate(`/objects/companies/${companyId}#notes`)
            }
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
