import { useState, useMemo } from "react";
import { useNavigate } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getList, getOne } from "@/lib/api/crm";
import { usePageTitle } from "@/contexts/page-header";
const PER_PAGE = 25;

interface DealNoteRow {
  id: number;
  dealId?: number;
  deal_id?: number;
  text: string;
  date: string;
}

interface ContactNoteRow {
  id: number;
  contactId?: number;
  contact_id?: number;
  text: string;
  date: string;
}

function formatDate(d: string): string {
  try {
    return new Date(d).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return d;
  }
}

function truncate(str: string, len: number): string {
  if (!str) return "";
  return str.length <= len ? str : str.slice(0, len) + "\u2026";
}

export function NotesPage() {
  usePageTitle("Notes");
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"deals" | "contacts">("deals");
  const [dealPage, setDealPage] = useState(1);
  const [contactPage, setContactPage] = useState(1);

  const { data: dealNotesData, isPending: dealNotesPending } = useQuery({
    queryKey: ["deal_notes", "all", dealPage],
    queryFn: () =>
      getList<DealNoteRow>("deal_notes", {
        pagination: { page: dealPage, perPage: PER_PAGE },
        sort: { field: "date", order: "DESC" },
      }),
  });

  const { data: contactNotesData, isPending: contactNotesPending } = useQuery({
    queryKey: ["contact_notes", "all", contactPage],
    queryFn: () =>
      getList<ContactNoteRow>("contact_notes", {
        pagination: { page: contactPage, perPage: PER_PAGE },
        sort: { field: "date", order: "DESC" },
      }),
  });

  const dealIds = useMemo(() => {
    const data = dealNotesData?.data ?? [];
    const ids = new Set<number>();
    for (const n of data) {
      const row = n as unknown as Record<string, unknown>;
      const id = row.dealId ?? row.deal_id;
      if (id != null) ids.add(Number(id));
    }
    return Array.from(ids);
  }, [dealNotesData?.data]);

  const contactIds = useMemo(() => {
    const data = contactNotesData?.data ?? [];
    const ids = new Set<number>();
    for (const n of data) {
      const row = n as unknown as Record<string, unknown>;
      const id = row.contactId ?? row.contact_id;
      if (id != null) ids.add(Number(id));
    }
    return Array.from(ids);
  }, [contactNotesData?.data]);

  const { data: dealsData } = useQuery({
    queryKey: ["deals", "batch", dealIds],
    queryFn: async () => {
      const entries = await Promise.all(
        dealIds.map(async (id) => {
          try {
            const d = await getOne<Record<string, unknown>>("deals", id);
            return [id, { name: String(d.name ?? d.Name ?? "Deal") }] as const;
          } catch {
            return [id, { name: "Unknown" }] as const;
          }
        }),
      );
      return Object.fromEntries(entries);
    },
    enabled: dealIds.length > 0,
  });

  const { data: contactsData } = useQuery({
    queryKey: ["contacts", "batch", contactIds],
    queryFn: async () => {
      const entries = await Promise.all(
        contactIds.map(async (id) => {
          try {
            const c = await getOne<Record<string, unknown>>("contacts", id);
            const first = c.firstName ?? c.first_name ?? "";
            const last = c.lastName ?? c.last_name ?? "";
            return [
              id,
              { name: [first, last].filter(Boolean).join(" ") || "Contact" },
            ] as const;
          } catch {
            return [id, { name: "Unknown" }] as const;
          }
        }),
      );
      return Object.fromEntries(entries);
    },
    enabled: contactIds.length > 0,
  });

  const dealNotes = dealNotesData?.data ?? [];
  const contactNotes = contactNotesData?.data ?? [];
  const dealTotal = dealNotesData?.total ?? 0;
  const contactTotal = contactNotesData?.total ?? 0;

  const handleDealNoteClick = (dealId: number) => {
    navigate(`/objects/deals/${dealId}#notes`);
  };

  const handleContactNoteClick = (contactId: number) => {
    navigate(`/objects/contacts/${contactId}#notes`);
  };

  return (
    <div className="flex h-full flex-col gap-5 pb-8">
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as "deals" | "contacts")}
      >
        <TabsList>
          <TabsTrigger value="deals">Deal Notes</TabsTrigger>
          <TabsTrigger value="contacts">Contact Notes</TabsTrigger>
        </TabsList>

        <TabsContent value="deals" className="mt-4 flex flex-1 flex-col gap-4">
          {dealNotesPending ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : dealNotes.length === 0 ? (
            <div className="rounded-lg bg-muted/50 py-12 text-center text-sm text-muted-foreground">
              No deal notes yet.
            </div>
          ) : (
            <>
              <div className="overflow-auto rounded-lg bg-card">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted">
                      <th className="px-4 py-2 text-left font-medium">Deal</th>
                      <th className="px-4 py-2 text-left font-medium">Note</th>
                      <th className="px-4 py-2 text-left font-medium">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dealNotes.map((note) => {
                      const n = note as unknown as Record<string, unknown>;
                      const dealId = (n.dealId ?? n.deal_id) as number;
                      const name = dealsData?.[dealId]?.name ?? "…";
                      const text = (n.text ?? "") as string;
                      const date = (n.date ?? n.Date) as string;
                      return (
                        <tr
                          key={(n.id ?? n.Id) as number}
                          className="cursor-pointer transition-colors hover:bg-muted/50"
                          onClick={() => handleDealNoteClick(dealId)}
                        >
                          <td className="px-4 py-2 font-medium">{name}</td>
                          <td className="max-w-md px-4 py-2 text-muted-foreground">
                            {truncate(text, 80)}
                          </td>
                          <td className="px-4 py-2 text-muted-foreground">
                            {formatDate(date)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {dealTotal > PER_PAGE && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    {dealTotal} total
                  </span>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={dealPage <= 1}
                      onClick={() => setDealPage((p) => p - 1)}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={dealPage * PER_PAGE >= dealTotal}
                      onClick={() => setDealPage((p) => p + 1)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent
          value="contacts"
          className="mt-4 flex flex-1 flex-col gap-4"
        >
          {contactNotesPending ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : contactNotes.length === 0 ? (
            <div className="rounded-lg bg-muted/50 py-12 text-center text-sm text-muted-foreground">
              No contact notes yet.
            </div>
          ) : (
            <>
              <div className="overflow-auto rounded-lg bg-card">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted">
                      <th className="px-4 py-2 text-left font-medium">
                        Contact
                      </th>
                      <th className="px-4 py-2 text-left font-medium">Note</th>
                      <th className="px-4 py-2 text-left font-medium">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contactNotes.map((note) => {
                      const n = note as unknown as Record<string, unknown>;
                      const contactId = (n.contactId ?? n.contact_id) as number;
                      const name = contactsData?.[contactId]?.name ?? "…";
                      const text = (n.text ?? "") as string;
                      const date = (n.date ?? n.Date) as string;
                      return (
                        <tr
                          key={(n.id ?? n.Id) as number}
                          className="cursor-pointer transition-colors hover:bg-muted/50"
                          onClick={() => handleContactNoteClick(contactId)}
                        >
                          <td className="px-4 py-2 font-medium">{name}</td>
                          <td className="max-w-md px-4 py-2 text-muted-foreground">
                            {truncate(text, 80)}
                          </td>
                          <td className="px-4 py-2 text-muted-foreground">
                            {formatDate(date)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {contactTotal > PER_PAGE && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    {contactTotal} total
                  </span>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={contactPage <= 1}
                      onClick={() => setContactPage((p) => p - 1)}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={contactPage * PER_PAGE >= contactTotal}
                      onClick={() => setContactPage((p) => p + 1)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
