import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { showError } from "@/lib/show-error";
import { usePageTitle } from "@/contexts/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DeclarativeAppRenderer } from "@/components/apps/DeclarativeAppRenderer";
import { HostedAppHost } from "@/components/apps/HostedAppHost";
import { TypeToConfirmDeleteDialog } from "@/components/TypeToConfirmDeleteDialog";
import { ConnectCodingAgentDialog } from "@/components/apps/ConnectCodingAgentDialog";
import {
  runBuilderStream,
  usePublishApp,
  type BuildPlan,
  type BuilderEvent,
} from "@/hooks/use-app-builder";
import { useApp, useDeleteApp } from "@/hooks/use-app-registry";
import { isDeclarativeSpec, isHostedSpec, type AppConfig } from "@/types/apps";

const PHASES = [
  { key: "planning", label: "Plan" },
  { key: "building", label: "Build" },
  { key: "refining", label: "Review" },
] as const;

/**
 * In-app builder (APP-3 declarative + APP-4e hosted). It works DELIBERATELY — the
 * server plans the app, builds it, then reviews/refines it, streaming each phase
 * here so you watch it work (not a one-shot). The result is a DRAFT app previewed
 * live below (declarative rendered natively; hosted in its sandboxed iframe), then
 * "Publish" scans + activates it for everyone.
 */
export function AppBuilderPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  // ?edit=<slug> opens this builder on an EXISTING app (from its detail page) so
  // admins can keep refining, re-publish, or delete it — same machinery as a new
  // build, just seeded with the published app as the draft.
  const [searchParams] = useSearchParams();
  const editSlug = searchParams.get("edit");
  const existingApp = useApp(editSlug ?? "");
  usePageTitle(editSlug ? "Edit app" : "Build an app");
  const [prompt, setPrompt] = useState("");
  const [draft, setDraft] = useState<AppConfig | null>(null);

  useEffect(() => {
    if (editSlug && existingApp && draft?.slug !== existingApp.slug) {
      setDraft(existingApp);
    }
  }, [editSlug, existingApp, draft?.slug]);
  const [plan, setPlan] = useState<BuildPlan | null>(null);
  const [phase, setPhase] = useState<string | null>(null);
  const [building, setBuilding] = useState(false);
  const [rawFail, setRawFail] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [connectOpen, setConnectOpen] = useState(false);

  const publish = usePublishApp();
  const del = useDeleteApp();

  const onDelete = async () => {
    if (!draft) return;
    try {
      await del.mutateAsync(draft.slug);
      toast.success("App deleted");
      setDraft(null);
      setPlan(null);
      setPrompt("");
      setDeleteOpen(false);
    } catch (e) {
      showError(e);
    }
  };

  const onGenerate = async () => {
    if (!prompt.trim() || building) return;
    setBuilding(true);
    setRawFail(null);
    setPhase("planning");
    setPlan(null);
    try {
      await runBuilderStream({ prompt, slug: draft?.slug }, (e: BuilderEvent) => {
        if (e.type === "phase") setPhase(e.phase);
        else if (e.type === "plan") setPlan(e.plan);
        else if (e.type === "done") {
          setDraft(e.app);
          setPlan(e.plan);
          qc.invalidateQueries({ queryKey: ["app-config"] });
          toast.success(`Built a ${e.kind} app — preview below`);
        } else if (e.type === "error") {
          setRawFail(e.raw ?? e.detail ?? null);
          toast.error(e.error);
        }
      });
    } catch (e) {
      showError(e);
    } finally {
      setBuilding(false);
      setPhase(null);
    }
  };

  const onPublish = async () => {
    if (!draft) return;
    try {
      const pub = await publish.mutateAsync(draft.slug);
      if (pub.ok) {
        toast.success("Published — now in everyone's sidebar");
        navigate(`/apps/${draft.slug}`);
      } else {
        toast.error(`Scan blocked publish (${pub.scan.risk}): ${pub.scan.reasons.join("; ") || pub.scan.summary}`);
        setDraft({ ...draft, status: pub.status });
      }
    } catch (e) {
      showError(e);
    }
  };

  const activePhaseIdx = PHASES.findIndex((p) => p.key === phase);

  return (
    <div className="grid grid-cols-1 gap-6 p-6 lg:grid-cols-[400px_1fr]">
      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Build an app</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <textarea
              className="min-h-32 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
              placeholder="Describe the app. e.g. 'A team chat to replace Teams', 'a daily standup where everyone posts their status', or 'a dashboard of deals renewing in 60 days'."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              disabled={building}
            />
            <div className="flex gap-2">
              <Button onClick={() => void onGenerate()} disabled={building || !prompt.trim()}>
                {building ? "Working…" : draft ? "Refine" : "Build it"}
              </Button>
              <Button
                variant="outline"
                onClick={() => void onPublish()}
                disabled={!draft || building || publish.isPending}
              >
                {publish.isPending ? "Publishing…" : "Publish"}
              </Button>
              {draft ? (
                <Button
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  onClick={() => setDeleteOpen(true)}
                  disabled={building || del.isPending}
                >
                  {del.isPending ? "Deleting…" : "Delete"}
                </Button>
              ) : null}
            </div>
            {draft ? (
              <p className="text-xs text-muted-foreground">
                Keep refining by typing a change (e.g. “make the button blue”, “add a comments box”) and clicking
                Refine — the builder remembers this app and your conversation until you Publish.
              </p>
            ) : null}

            <button
              type="button"
              onClick={() => setConnectOpen(true)}
              className="self-start text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            >
              Or build with your AI coding agent (Cursor, Claude Code, Codex) →
            </button>

            {/* Deliberate phase progress — shows it taking its time. */}
            {building ? (
              <div className="flex items-center gap-2 pt-1">
                {PHASES.map((p, i) => {
                  const state =
                    activePhaseIdx < 0 ? "pending" : i < activePhaseIdx ? "done" : i === activePhaseIdx ? "active" : "pending";
                  return (
                    <div key={p.key} className="flex items-center gap-2">
                      <span
                        className={
                          "rounded-full px-2 py-0.5 text-xs " +
                          (state === "active"
                            ? "bg-primary text-primary-foreground"
                            : state === "done"
                              ? "bg-muted text-foreground"
                              : "bg-muted/40 text-muted-foreground")
                        }
                      >
                        {state === "active" ? "● " : state === "done" ? "✓ " : ""}
                        {p.label}
                      </span>
                      {i < PHASES.length - 1 ? <span className="text-muted-foreground">→</span> : null}
                    </div>
                  );
                })}
              </div>
            ) : null}

            {draft ? (
              <p className="text-xs text-muted-foreground">
                Draft <code>/apps/{draft.slug}</code> · {draft.type} · status {draft.status} · {draft.permissions.length}{" "}
                grant{draft.permissions.length === 1 ? "" : "s"}
              </p>
            ) : null}
          </CardContent>
        </Card>

        {plan ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Plan — {plan.name}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 text-sm">
              <p className="text-muted-foreground">{plan.summary}</p>
              <p>
                <span className="text-muted-foreground">Type:</span> {plan.kind}
              </p>
              {plan.tools?.length ? (
                <p className="text-xs">
                  <span className="text-muted-foreground">Uses:</span> {plan.tools.join(", ")}
                </p>
              ) : null}
            </CardContent>
          </Card>
        ) : null}

        {rawFail ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm text-destructive">Couldn’t finish</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="max-h-48 overflow-auto whitespace-pre-wrap text-xs text-muted-foreground">{rawFail}</pre>
            </CardContent>
          </Card>
        ) : null}
      </div>

      <Card className="flex max-h-[80vh] min-h-[420px] flex-col">
        <CardHeader>
          <CardTitle>Preview {draft ? `— ${draft.name}` : ""}</CardTitle>
        </CardHeader>
        <CardContent className="min-h-0 flex-1 overflow-hidden p-0">
          {draft && draft.type === "declarative" && isDeclarativeSpec(draft.spec) ? (
            <DeclarativeAppRenderer app={draft} forceConfirm />
          ) : draft && draft.type === "hosted" && isHostedSpec(draft.spec) ? (
            <HostedAppHost app={draft} />
          ) : (
            <p className="p-6 text-sm text-muted-foreground">
              Describe an app and click “Build it”. The builder plans, builds, then reviews it — you’ll see each step, then a
              live preview here. Writes are confirm-gated in preview.
            </p>
          )}
        </CardContent>
      </Card>

      <ConnectCodingAgentDialog open={connectOpen} onOpenChange={setConnectOpen} />

      <TypeToConfirmDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        name={draft?.name ?? ""}
        title="Delete this app?"
        description={
          <>
            This permanently deletes{" "}
            <span className="font-medium text-foreground">{draft?.name}</span> for everyone in the
            organization. This cannot be undone.
          </>
        }
        confirmLabel="Delete app"
        onConfirm={onDelete}
        pending={del.isPending}
      />
    </div>
  );
}
