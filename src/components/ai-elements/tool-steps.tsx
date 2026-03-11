import {
  CheckCircle,
  XCircle,
  CircleNotch,
} from "@phosphor-icons/react";

const TOOL_LABELS: Record<string, string> = {
  search_contacts: "Searching contacts",
  search_companies: "Searching companies",
  search_deals: "Searching deals",
  search_tasks: "Searching tasks",
  search_all: "Searching all records",
  get_contact: "Looking up contact",
  get_company: "Looking up company",
  get_deal: "Looking up deal",
  create_contact: "Creating contact",
  create_company: "Creating company",
  create_deal: "Creating deal",
  create_task: "Creating task",
  update_contact: "Updating contact",
  update_company: "Updating company",
  update_deal: "Updating deal",
  delete_record: "Deleting record",
  delete_task: "Deleting task",
  bulk_update: "Updating records",
  web_search: "Searching the web",
  enrich_record: "Enriching record",
  manage_view: "Managing view",
  create_automation: "Creating automation",
  generate_report: "Generating report",
  browse_web: "Browsing web page",
  complete_task: "Completing task",
  list_tasks: "Listing tasks",
  list_notes: "Listing notes",
  create_note: "Creating note",
  add_note: "Adding note",
};

export interface ToolStep {
  id: string;
  toolName: string;
  args?: string[];
  result?: string;
  success?: boolean;
  status: "running" | "complete" | "error";
}

export function ToolSteps({ steps }: { steps: ToolStep[] }) {
  if (!steps.length) return null;

  return (
    <div className="flex flex-col gap-1 mb-3">
      {steps.map((step) => (
        <div
          key={step.id}
          className="flex items-center gap-2 text-xs text-muted-foreground"
        >
          {step.status === "running" ? (
            <CircleNotch className="h-3 w-3 animate-spin" />
          ) : step.status === "complete" ? (
            <CheckCircle className="h-3 w-3 text-green-500" weight="fill" />
          ) : (
            <XCircle className="h-3 w-3 text-red-500" weight="fill" />
          )}
          <span>{TOOL_LABELS[step.toolName] ?? step.toolName}</span>
        </div>
      ))}
    </div>
  );
}
