import { useCallback, useMemo, useState } from "react";
import {
  useQueries,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import { showError } from "@/lib/show-error";
import { callAppTool, listAppTools, type BrokerToolWire } from "@/lib/app-broker";
import {
  computeMetric,
  extractRows,
  formatCell,
  getField,
  toChartData,
  type Row,
} from "@/lib/apps/spec-data";
import type {
  AppConfig,
  Block,
  DeclarativeAction,
  DeclarativePage,
  DeclarativeSpec,
} from "@/types/apps";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface DataState {
  rows: Row[];
  isLoading: boolean;
  error: Error | null;
}

interface RendererCtx {
  /** rows per dataSource id */
  data: Map<string, DataState>;
  /** broker tool input schemas, by tool name (for form-field inference) */
  toolsByName: Map<string, BrokerToolWire>;
  actionsById: Map<string, DeclarativeAction>;
  /** run an action's tool; confirm dialog already cleared by caller */
  runAction: (actionId: string, args: Record<string, unknown>) => Promise<void>;
  /** preview mode: force-confirm every write so testing doesn't mutate live data */
  forceConfirm: boolean;
}

/**
 * Renders a DeclarativeSpec natively (APP-2). Each block binds to a broker tool
 * through the app-facing path (callAppTool / listAppTools), so the app reads/writes
 * the viewer's own org-scoped, RBAC-checked data with zero app code. Write actions
 * are confirm-gated when the action says so — and ALWAYS in preview (forceConfirm).
 */
export function DeclarativeAppRenderer({
  app,
  forceConfirm = false,
}: {
  app: AppConfig;
  forceConfirm?: boolean;
}) {
  const spec = app.spec as DeclarativeSpec;
  const slug = app.slug;
  const qc = useQueryClient();

  const dataSources = useMemo(() => spec.dataSources ?? [], [spec.dataSources]);
  const actionsById = useMemo(() => {
    const m = new Map<string, DeclarativeAction>();
    for (const a of spec.actions ?? []) m.set(a.id, a);
    return m;
  }, [spec.actions]);

  const { data: tools } = useQuery({
    queryKey: ["app-tools", slug],
    queryFn: () => listAppTools(slug),
    staleTime: 60_000,
  });
  const toolsByName = useMemo(() => {
    const m = new Map<string, BrokerToolWire>();
    for (const t of tools ?? []) m.set(t.name, t);
    return m;
  }, [tools]);

  const dsQueries = useQueries({
    queries: dataSources.map((ds) => ({
      queryKey: ["app-data", slug, ds.id],
      queryFn: async (): Promise<Row[]> =>
        extractRows(await callAppTool(slug, ds.tool, ds.params ?? {})),
    })),
  });

  const data = useMemo(() => {
    const m = new Map<string, DataState>();
    dataSources.forEach((ds, i) => {
      const q = dsQueries[i] as UseQueryResult<Row[]> | undefined;
      m.set(ds.id, {
        rows: q?.data ?? [],
        isLoading: q?.isLoading ?? false,
        error: (q?.error as Error | null) ?? null,
      });
    });
    return m;
    // dsQueries identity changes each render; key on the data/loading/error tuple.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataSources, dsQueries.map((q) => `${q.isLoading}:${q.dataUpdatedAt}:${q.errorUpdatedAt}`).join("|")]);

  const runAction = useCallback(
    async (actionId: string, args: Record<string, unknown>) => {
      const action = actionsById.get(actionId);
      if (!action) {
        toast.error("Unknown action");
        return;
      }
      try {
        // Merge the action's static params (e.g. { object: "feedbacks" }) with the
        // submitted form values — without this the tool gets the values but not the
        // target (object slug), so writes silently no-op.
        const actionParams = action.params ?? {};
        await callAppTool(slug, action.tool, { ...actionParams, ...args });
        toast.success("Done");
        // Refresh every dataSource so tables/metrics reflect the write.
        qc.invalidateQueries({ queryKey: ["app-data", slug] });
      } catch (e) {
        showError(e);
      }
    },
    [actionsById, slug, qc],
  );

  const ctx: RendererCtx = { data, toolsByName, actionsById, runAction, forceConfirm };

  if (!spec.pages?.length) {
    return <div className="p-6 text-sm text-muted-foreground">This app has no pages.</div>;
  }

  const pages = spec.pages;
  // Multiple pages render as TABS (like Retool); a single page renders directly.
  // The outer container scrolls so tall apps aren't clipped in the preview/host.
  const inner =
    pages.length === 1 ? (
      <PageView page={pages[0]} ctx={ctx} />
    ) : (
      <Tabs defaultValue={pages[0].slug} className="w-full">
        <TabsList className="flex-wrap">
          {pages.map((p) => (
            <TabsTrigger key={p.slug} value={p.slug}>
              {p.title || p.slug}
            </TabsTrigger>
          ))}
        </TabsList>
        {pages.map((p) => (
          <TabsContent key={p.slug} value={p.slug} className="mt-4">
            <PageView page={p} ctx={ctx} showTitle={false} />
          </TabsContent>
        ))}
      </Tabs>
    );

  return <div className="h-full max-h-full overflow-y-auto p-6">{inner}</div>;
}

const LAYOUT_CLASS: Record<DeclarativePage["layout"], string> = {
  single: "grid grid-cols-1 gap-4",
  split: "grid grid-cols-1 gap-4 md:grid-cols-2",
  grid: "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3",
};

function PageView({
  page,
  ctx,
  showTitle = true,
}: {
  page: DeclarativePage;
  ctx: RendererCtx;
  showTitle?: boolean;
}) {
  return (
    <section>
      {showTitle && page.title ? <h2 className="mb-4 text-xl font-semibold">{page.title}</h2> : null}
      <div className={LAYOUT_CLASS[page.layout] ?? LAYOUT_CLASS.single}>
        {page.blocks.map((block, i) => (
          <BlockView key={i} block={block} ctx={ctx} />
        ))}
      </div>
    </section>
  );
}

function BlockView({ block, ctx }: { block: Block; ctx: RendererCtx }) {
  switch (block.kind) {
    case "markdown":
      return <MarkdownBlock text={block.text} />;
    case "metric":
      return <MetricBlock block={block} ctx={ctx} />;
    case "table":
      return <TableBlock block={block} ctx={ctx} />;
    case "chart":
      return <ChartBlock block={block} ctx={ctx} />;
    case "form":
      return <FormBlock block={block} ctx={ctx} />;
    default:
      return null;
  }
}

function DataGuard({
  state,
  children,
}: {
  state: DataState | undefined;
  children: React.ReactNode;
}) {
  if (!state) return <p className="text-sm text-muted-foreground">No data source.</p>;
  if (state.isLoading) return <Skeleton className="h-24 w-full" />;
  if (state.error)
    return <p className="text-sm text-destructive">{state.error.message}</p>;
  return <>{children}</>;
}

function MarkdownBlock({ text }: { text: string }) {
  // Minimal: render as preformatted text. (A full markdown renderer is a later
  // enhancement; the spec keeps markdown to short static copy.)
  return (
    <Card>
      <CardContent className="whitespace-pre-wrap pt-6 text-sm leading-relaxed">{text}</CardContent>
    </Card>
  );
}

function MetricBlock({
  block,
  ctx,
}: {
  block: Extract<Block, { kind: "metric" }>;
  ctx: RendererCtx;
}) {
  const state = ctx.data.get(block.dataSource);
  const value = state ? computeMetric(state.rows, block.field, block.agg) : 0;
  const display =
    block.agg === "avg" ? Math.round(value * 100) / 100 : value;
  return (
    <Card>
      <CardHeader>
        <CardDescription>{block.title ?? `${block.agg} of ${block.field}`}</CardDescription>
        <CardTitle className="text-3xl tabular-nums">
          <DataGuard state={state}>{display.toLocaleString()}</DataGuard>
        </CardTitle>
      </CardHeader>
    </Card>
  );
}

// A table column may be a plain field name OR a { field, label } object — the
// builder model emits both shapes, so normalize before rendering (rendering the
// object directly throws "Objects are not valid as a React child").
type TableCol = string | { field?: string; label?: string; key?: string; name?: string };
const colField = (c: TableCol): string =>
  typeof c === "string" ? c : String(c?.field ?? c?.key ?? c?.name ?? "");
const colLabel = (c: TableCol): string =>
  typeof c === "string" ? c : String(c?.label ?? c?.field ?? c?.key ?? c?.name ?? "");

function TableBlock({
  block,
  ctx,
}: {
  block: Extract<Block, { kind: "table" }>;
  ctx: RendererCtx;
}) {
  const state = ctx.data.get(block.dataSource);
  return (
    <Card className="col-span-full">
      {block.title ? (
        <CardHeader>
          <CardTitle>{block.title}</CardTitle>
        </CardHeader>
      ) : null}
      <CardContent>
        <DataGuard state={state}>
          <Table>
            <TableHeader>
              <TableRow>
                {block.columns.map((col) => (
                  <TableHead key={colField(col)}>{colLabel(col)}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {(state?.rows ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={block.columns.length} className="text-muted-foreground">
                    No rows.
                  </TableCell>
                </TableRow>
              ) : (
                (state?.rows ?? []).map((row, i) => (
                  <TableRow key={i}>
                    {block.columns.map((col) => (
                      <TableCell key={colField(col)}>
                        {formatCell(getField(row, colField(col)))}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </DataGuard>
      </CardContent>
    </Card>
  );
}

function ChartBlock({
  block,
  ctx,
}: {
  block: Extract<Block, { kind: "chart" }>;
  ctx: RendererCtx;
}) {
  const state = ctx.data.get(block.dataSource);
  const points = state ? toChartData(state.rows, block.x, block.y) : [];
  return (
    <Card className="col-span-full">
      {block.title ? (
        <CardHeader>
          <CardTitle>{block.title}</CardTitle>
        </CardHeader>
      ) : null}
      <CardContent>
        <DataGuard state={state}>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              {block.type === "line" ? (
                <LineChart data={points}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="x" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="y" stroke="var(--color-primary, #6366f1)" />
                </LineChart>
              ) : (
                <BarChart data={points}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="x" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="y" fill="var(--color-primary, #6366f1)" />
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
        </DataGuard>
      </CardContent>
    </Card>
  );
}

interface FormField {
  name: string;
  label: string;
  type: string;
  required: boolean;
}

/** Map a spec field type onto what the renderer supports: number | textarea | text.
 * The builder model uses varied names ("long-text", "textarea", "paragraph"…). */
function normalizeFieldType(t: string | undefined): string {
  if (t === "number" || t === "integer") return "number";
  if (/textarea|long.?text|multiline|paragraph/i.test(String(t ?? ""))) return "textarea";
  return "text";
}

/** Derive form fields from a tool's JSON Schema when the block doesn't list them. */
function fieldsFromSchema(schema: Record<string, unknown> | undefined): FormField[] {
  if (!schema || typeof schema !== "object") return [];
  const props = (schema.properties as Record<string, { type?: string; description?: string }>) ?? {};
  const required = new Set(Array.isArray(schema.required) ? (schema.required as string[]) : []);
  return Object.entries(props).map(([name, def]) => ({
    name,
    label: def?.description ?? name,
    type: normalizeFieldType(def?.type),
    required: required.has(name),
  }));
}

function FormBlock({
  block,
  ctx,
}: {
  block: Extract<Block, { kind: "form" }>;
  ctx: RendererCtx;
}) {
  // onSubmit may be an action-id string OR { action: "<id>" } — the builder model emits both.
  const onSubmitId =
    typeof block.onSubmit === "string" ? block.onSubmit : (block.onSubmit?.action ?? "");
  const action = ctx.actionsById.get(onSubmitId);
  const toolSchema = action ? ctx.toolsByName.get(action.tool)?.inputSchema : undefined;
  const fields: FormField[] = useMemo(() => {
    if (block.fields?.length) {
      return block.fields.map((f) => ({
        name: f.name,
        label: f.label ?? f.name,
        type: normalizeFieldType(f.type),
        required: f.required ?? false,
      }));
    }
    return fieldsFromSchema(toolSchema);
  }, [block.fields, toolSchema]);

  const [values, setValues] = useState<Record<string, string>>({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const needsConfirm = Boolean(action?.confirm) || ctx.forceConfirm;

  const buildArgs = (): Record<string, unknown> => {
    const args: Record<string, unknown> = {};
    for (const f of fields) {
      const v = values[f.name];
      if (v === undefined || v === "") continue;
      args[f.name] = f.type === "number" ? Number(v) : v;
    }
    return args;
  };

  const doSubmit = async () => {
    if (!action) {
      toast.error("This form has no action.");
      return;
    }
    setSubmitting(true);
    try {
      await ctx.runAction(onSubmitId, buildArgs());
      setValues({});
    } finally {
      setSubmitting(false);
      setConfirmOpen(false);
    }
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (needsConfirm) setConfirmOpen(true);
    else void doSubmit();
  };

  return (
    <Card>
      {block.title ? (
        <CardHeader>
          <CardTitle>{block.title}</CardTitle>
        </CardHeader>
      ) : null}
      <CardContent>
        <form className="flex flex-col gap-3" onSubmit={onSubmit}>
          {fields.length === 0 ? (
            <p className="text-sm text-muted-foreground">No input fields.</p>
          ) : (
            fields.map((f) => (
              <div key={f.name} className="flex flex-col gap-1">
                <Label htmlFor={`f-${f.name}`}>
                  {f.label}
                  {f.required ? <span className="text-destructive"> *</span> : null}
                </Label>
                {f.type === "textarea" ? (
                  <Textarea
                    id={`f-${f.name}`}
                    required={f.required}
                    rows={3}
                    value={values[f.name] ?? ""}
                    onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
                  />
                ) : (
                  <Input
                    id={`f-${f.name}`}
                    type={f.type}
                    required={f.required}
                    value={values[f.name] ?? ""}
                    onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
                  />
                )}
              </div>
            ))
          )}
          <Button type="submit" disabled={submitting} className="self-start">
            {submitting ? "…" : (block.submitLabel ?? "Submit")}
          </Button>
        </form>
      </CardContent>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm</DialogTitle>
            <DialogDescription>
              {ctx.forceConfirm
                ? "Preview mode — confirm to run this write against live data."
                : "This will run a write action. Continue?"}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={() => void doSubmit()} disabled={submitting}>
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
