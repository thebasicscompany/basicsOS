"use client";

import { Suspense, useMemo, useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import {
  PageHeader,
  Button,
  Avatar,
  AvatarFallback,
  Badge,
  Card,
  CardContent,
  addToast,
} from "@basicsos/ui";
import { Plus, Users, Mail, Phone, Building2, Calendar, Download } from "@basicsos/ui";
import { CrmRecordTable } from "../components/CrmRecordTable";
import type { ColumnDef } from "../components/CrmRecordTable";
import { CrmViewBar } from "../components/CrmViewBar";
import { CrmBulkActionBar } from "../components/CrmBulkActionBar";
import { useCrmViewState, applyCrmFilters } from "../hooks/useCrmViewState";
import { useCustomFieldColumns } from "../hooks/useCustomFieldColumns";
import { CreateContactDialog } from "../CreateContactDialog";
import { nameToColor, exportCsv } from "../utils";

interface Contact {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  companyId: string | null;
  createdAt: Date | string;
  customFields?: Record<string, unknown> | null;
}

const ContactsPageContent = (): JSX.Element => {
  const router = useRouter();
  const utils = trpc.useUtils();
  const viewState = useCrmViewState();
  const { data: contactsData, isLoading } = trpc.crm.contacts.list.useQuery({});
  const { data: companiesData } = trpc.crm.companies.list.useQuery();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const deleteContact = trpc.crm.contacts.delete.useMutation({
    onSuccess: () => {
      void utils.crm.contacts.list.invalidate();
      addToast({ title: "Deleted", variant: "success" });
    },
  });

  const updateContact = trpc.crm.contacts.update.useMutation({
    onSuccess: () => void utils.crm.contacts.list.invalidate(),
    onError: (err) => addToast({ title: "Update failed", description: err.message, variant: "destructive" }),
  });

  const companyMap = useMemo(() => {
    const map = new Map<string, string>();
    (companiesData ?? []).forEach((c) => map.set(c.id, c.name));
    return map;
  }, [companiesData]);

  const contacts = useMemo((): Contact[] => (contactsData ?? []) as Contact[], [contactsData]);

  const filtered = useMemo(
    () =>
      applyCrmFilters(
        contacts,
        viewState,
        ["name", "email", "phone"],
        (row: Contact, field: string) => {
          if (field === "name") return row.name.toLowerCase();
          if (field === "email") return (row.email ?? "").toLowerCase();
          if (field === "phone") return (row.phone ?? "").toLowerCase();
          if (field === "company") return (companyMap.get(row.companyId ?? "") ?? "").toLowerCase();
          if (field === "createdAt") return new Date(row.createdAt).getTime();
          if (field.startsWith("cf_")) {
            const key = field.slice(3);
            return String(row.customFields?.[key] ?? "").toLowerCase();
          }
          return "";
        },
      ),
    [contacts, viewState, companyMap],
  );

  const handleEdit = useCallback(
    (id: string, field: string, value: string) => {
      if (field === "name") updateContact.mutate({ id, name: value });
      else if (field === "email") updateContact.mutate({ id, email: value || undefined });
      else if (field === "phone") updateContact.mutate({ id, phone: value || undefined });
    },
    [updateContact],
  );

  const columns: ColumnDef<Contact>[] = useMemo(
    () => [
      {
        key: "name",
        label: "Name",
        icon: Users,
        sortable: true,
        sortValue: (r: Contact) => r.name.toLowerCase(),
        render: (r: Contact) => (
          <div className="flex items-center gap-2">
            <Avatar className="size-7 shrink-0">
              <AvatarFallback className={`text-[10px] font-medium ${nameToColor(r.name)}`}>
                {r.name[0]?.toUpperCase() ?? "?"}
              </AvatarFallback>
            </Avatar>
            <span className="font-medium text-foreground">{r.name}</span>
          </div>
        ),
        editable: true,
        editType: "text",
        onEdit: (id: string, value: string) => handleEdit(id, "name", value),
      },
      {
        key: "email",
        label: "Email",
        icon: Mail,
        sortable: true,
        sortValue: (r: Contact) => (r.email ?? "").toLowerCase(),
        render: (r: Contact) =>
          r.email ? (
            <a href={`mailto:${r.email}`} className="text-sm text-primary hover:underline" onClick={(e) => e.stopPropagation()}>
              {r.email}
            </a>
          ) : (
            <span className="text-muted-foreground">{"\u2014"}</span>
          ),
        editable: true,
        editType: "text",
        onEdit: (id: string, value: string) => handleEdit(id, "email", value),
      },
      {
        key: "phone",
        label: "Phone",
        icon: Phone,
        sortable: true,
        sortValue: (r: Contact) => r.phone ?? "",
        render: (r: Contact) => <span className="text-sm">{r.phone ?? "\u2014"}</span>,
        editable: true,
        editType: "text",
        onEdit: (id: string, value: string) => handleEdit(id, "phone", value),
      },
      {
        key: "company",
        label: "Company",
        icon: Building2,
        sortable: true,
        sortValue: (r: Contact) => (companyMap.get(r.companyId ?? "") ?? "").toLowerCase(),
        render: (r: Contact) => {
          const name = companyMap.get(r.companyId ?? "");
          return name ? (
            <Badge variant="secondary" className="text-xs">{name}</Badge>
          ) : (
            <span className="text-muted-foreground">{"\u2014"}</span>
          );
        },
      },
      {
        key: "createdAt",
        label: "Created",
        icon: Calendar,
        sortable: true,
        sortValue: (r: Contact) => new Date(r.createdAt).getTime(),
        render: (r: Contact) => (
          <span className="text-xs text-muted-foreground">{new Date(r.createdAt).toLocaleDateString()}</span>
        ),
      },
    ],
    [companyMap, handleEdit],
  );

  const customFieldColumns = useCustomFieldColumns(contacts);
  const allColumns = useMemo(
    () => [...columns, ...customFieldColumns],
    [columns, customFieldColumns],
  );

  const handleBulkDelete = useCallback(() => {
    Promise.all(selectedIds.map((id) => deleteContact.mutateAsync({ id }))).then(() => {
      setSelectedIds([]);
    }).catch(() => {
      addToast({ title: "Some deletions failed", variant: "destructive" });
    });
  }, [selectedIds, deleteContact]);

  const handleExport = useCallback(() => {
    const selected = filtered.filter((c) => selectedIds.includes(c.id));
    exportCsv(
      selected,
      [
        { key: "name", label: "Name", value: (r) => r.name },
        { key: "email", label: "Email", value: (r) => r.email ?? "" },
        { key: "phone", label: "Phone", value: (r) => r.phone ?? "" },
        { key: "company", label: "Company", value: (r) => companyMap.get(r.companyId ?? "") ?? "" },
        { key: "createdAt", label: "Created", value: (r) => new Date(r.createdAt).toLocaleDateString() },
      ],
      "contacts-export",
    );
  }, [filtered, selectedIds, companyMap]);

  if (isLoading) {
    return <ContactsTableSkeleton />;
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="People"
        action={
          <CreateContactDialog onCreated={() => void utils.crm.contacts.list.invalidate()}>
            <Button size="sm"><Plus size={14} className="mr-1" /> New Contact</Button>
          </CreateContactDialog>
        }
      />
      <CrmViewBar
        viewState={viewState}
        filterDefs={[
          { field: "name", label: "Name", type: "text" },
          { field: "email", label: "Email", type: "text" },
          { field: "phone", label: "Phone", type: "text" },
        ]}
        sortFields={[
          { field: "name", label: "Name" },
          { field: "email", label: "Email" },
          { field: "createdAt", label: "Created" },
        ]}
        columnDefs={allColumns.map((c) => ({ key: c.key, label: c.label }))}
      />
      <CrmRecordTable
        data={filtered}
        columns={allColumns}
        getRowId={(r) => r.id}
        onRowClick={(r) => router.push(`/crm/contacts/${r.id}`)}
        onSelectionChange={setSelectedIds}
        hiddenColumns={viewState.hiddenColumns}
        sort={viewState.sort}
        sortDir={viewState.sortDir}
        onSort={viewState.setSort}
        contextMenuItems={(r) => [
          { label: "View details", onClick: () => router.push(`/crm/contacts/${r.id}`) },
          { label: "Copy email", onClick: () => { if (r.email) void navigator.clipboard.writeText(r.email); } },
          { label: "Delete", onClick: () => deleteContact.mutate({ id: r.id }), destructive: true },
        ]}
        emptyIcon={Users}
        emptyHeading="No contacts yet"
        emptyDescription="Add your first contact to get started."
        emptyAction={
          <CreateContactDialog onCreated={() => void utils.crm.contacts.list.invalidate()}>
            <Button size="sm"><Plus size={14} className="mr-1" /> Add Contact</Button>
          </CreateContactDialog>
        }
      />
      <CrmBulkActionBar
        selectedCount={selectedIds.length}
        totalCount={filtered.length}
        onSelectAll={() => setSelectedIds(filtered.map((c) => c.id))}
        onDeselectAll={() => setSelectedIds([])}
        onDelete={handleBulkDelete}
        isDeleting={deleteContact.isPending}
        extraActions={
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={handleExport}>
            <Download className="size-3" /> Export CSV
          </Button>
        }
      />
    </div>
  );
};

function ContactsTableSkeleton(): JSX.Element {
  return (
    <div className="flex flex-col gap-4">
      <div className="h-8 w-32 animate-pulse rounded bg-stone-200 dark:bg-stone-700" />
      <div className="h-8 w-64 animate-pulse rounded bg-stone-200 dark:bg-stone-700" />
      <Card>
        <CardContent className="py-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex gap-4 py-3">
              <div className="size-7 animate-pulse rounded-full bg-stone-200 dark:bg-stone-700" />
              <div className="h-4 w-32 animate-pulse rounded bg-stone-200 dark:bg-stone-700" />
              <div className="h-4 w-40 animate-pulse rounded bg-stone-200 dark:bg-stone-700" />
              <div className="h-4 w-24 animate-pulse rounded bg-stone-200 dark:bg-stone-700" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

const ContactsPage = (): JSX.Element => (
  <Suspense>
    <ContactsPageContent />
  </Suspense>
);

export default ContactsPage;
