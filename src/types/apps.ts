// Custom-app types (F2). `AppConfig` mirrors the app_config row returned by
// GET /api/app-config. The spec is a DeclarativeSpec (rendered natively by the
// shell) or a HostedSpec (sandboxed iframe). See
// docs/CONTRACTS_MCP_BROKER_AND_APP_SDK.md B.6.

export type AppType = "declarative" | "hosted";
export type AppStatus = "draft" | "preview" | "scanning" | "active" | "suspended";

/** A block in a declarative page, each bound to a broker dataSource/action. */
export type Block =
  | {
      kind: "table";
      dataSource: string;
      /** field name, or { field, label } — the renderer normalizes both */
      columns: Array<string | { field?: string; label?: string }>;
      title?: string;
    }
  | {
      kind: "form";
      /** object slug to create (e.g. "tasks") — maps to object.{object}.create */
      object: string;
      /** action id whose tool the submit calls — a string, or { action: "<id>" } */
      onSubmit: string | { action: string };
      title?: string;
      /** label for the submit button (defaults to "Submit") */
      submitLabel?: string;
      /** field hints for rendering the form inputs */
      fields?: Array<{ name: string; label?: string; type?: string; required?: boolean }>;
    }
  | { kind: "metric"; dataSource: string; field: string; agg: "count" | "sum" | "avg"; title?: string }
  | { kind: "chart"; dataSource: string; x: string; y: string; type: "bar" | "line"; title?: string }
  | { kind: "markdown"; text: string };

export interface DeclarativePage {
  slug: string;
  title: string;
  layout: "single" | "split" | "grid";
  blocks: Block[];
}

/** A data source = a broker tool call (read), reused by blocks on a page. */
export interface DeclarativeDataSource {
  id: string;
  tool: string;
  params?: Record<string, unknown>;
}

/** An action = a broker tool call (write), invoked by a form/button. */
export interface DeclarativeAction {
  id: string;
  tool: string;
  /** Static args merged into the tool call (e.g. the object slug for a generic
   *  object.create), beneath the form's submitted values. */
  params?: Record<string, unknown>;
  confirm?: boolean;
}

export interface DeclarativeSpec {
  version: 1;
  pages: DeclarativePage[];
  dataSources: DeclarativeDataSource[];
  actions?: DeclarativeAction[];
}

export interface HostedSpec {
  entryUrl: string;
  origin: string;
  integrity?: string;
  requiredScopes: string[];
}

export type AppSpec = DeclarativeSpec | HostedSpec | Record<string, unknown>;

/** Shape returned by GET /api/app-config (one app_config row). */
export interface AppConfig {
  id: number;
  slug: string;
  name: string;
  icon: string;
  iconColor: string;
  type: AppType;
  status: AppStatus;
  spec: AppSpec;
  permissions: string[];
  backendModule: { slug: string; version: string } | null;
  version: string;
  position: number;
  createdByCrmUserId: number | null;
  organizationId: string | null;
  createdAt: string;
  updatedAt: string;
}

export function isDeclarativeSpec(spec: AppSpec): spec is DeclarativeSpec {
  return (
    typeof spec === "object" &&
    spec !== null &&
    "pages" in spec &&
    Array.isArray((spec as DeclarativeSpec).pages)
  );
}

export function isHostedSpec(spec: AppSpec): spec is HostedSpec {
  return (
    typeof spec === "object" &&
    spec !== null &&
    "entryUrl" in spec &&
    typeof (spec as HostedSpec).entryUrl === "string"
  );
}
