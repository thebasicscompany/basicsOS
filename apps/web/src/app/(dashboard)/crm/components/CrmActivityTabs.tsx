"use client";

import { trpc } from "@/lib/trpc";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@basicsos/ui";
import { CrmNotesPanel } from "./CrmNotesPanel";
import { CrmTasksPanel } from "./CrmTasksPanel";
import { CrmAttachmentsPanel } from "./CrmAttachmentsPanel";
import { CrmHistoryPanel } from "./CrmHistoryPanel";

interface CrmActivityTabsProps {
  entity: "contact" | "company" | "deal";
  recordId: string;
}

function useTabCounts(
  entity: "contact" | "company" | "deal",
  recordId: string,
): { taskCount: number; fileCount: number } {
  const entityPlural =
    entity === "contact"
      ? "contacts"
      : entity === "company"
        ? "companies"
        : "deals";

  const { data: tasks = [] } = trpc.tasks.listByEntity.useQuery({
    entityType: entity,
    entityId: recordId,
  });

  const { data: attachments = [] } = trpc.crm.attachments.list.useQuery({
    entity: entityPlural,
    recordId,
  });

  return { taskCount: tasks.length, fileCount: attachments.length };
}

function tabLabel(base: string, count: number): string {
  return count > 0 ? `${base} (${count})` : base;
}

export function CrmActivityTabs({ entity, recordId }: CrmActivityTabsProps): JSX.Element {
  const entityPlural =
    entity === "contact"
      ? "contacts"
      : entity === "company"
        ? "companies"
        : "deals";

  const { taskCount, fileCount } = useTabCounts(entity, recordId);

  return (
    <Tabs defaultValue="notes" className="w-full">
      <TabsList className="w-full justify-start">
        <TabsTrigger value="notes">Notes</TabsTrigger>
        <TabsTrigger value="tasks">{tabLabel("Tasks", taskCount)}</TabsTrigger>
        <TabsTrigger value="files">{tabLabel("Files", fileCount)}</TabsTrigger>
        <TabsTrigger value="activity">Activity</TabsTrigger>
      </TabsList>

      <TabsContent value="notes" className="mt-4">
        <CrmNotesPanel entity={entity} recordId={recordId} />
      </TabsContent>

      <TabsContent value="tasks" className="mt-4">
        <CrmTasksPanel entityType={entity} entityId={recordId} />
      </TabsContent>

      <TabsContent value="files" className="mt-4">
        <CrmAttachmentsPanel entity={entityPlural} recordId={recordId} />
      </TabsContent>

      <TabsContent value="activity" className="mt-4">
        <CrmHistoryPanel entity={entity} recordId={recordId} />
      </TabsContent>
    </Tabs>
  );
}
