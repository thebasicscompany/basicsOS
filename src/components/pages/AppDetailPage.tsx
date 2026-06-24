import { useState } from "react";
import { useParams, useNavigate } from "react-router";
import { PencilSimpleIcon, TrashIcon } from "@phosphor-icons/react";
import { toast } from "sonner";
import { showError } from "@/lib/show-error";
import { usePageTitle } from "@/contexts/page-header";
import { Button } from "@/components/ui/button";
import { useApp, useAppRegistry, useDeleteApp } from "@/hooks/use-app-registry";
import { useMe } from "@/hooks/use-me";
import { isDeclarativeSpec, isHostedSpec } from "@/types/apps";
import { DeclarativeAppRenderer } from "@/components/apps/DeclarativeAppRenderer";
import { HostedAppHost } from "@/components/apps/HostedAppHost";
import { TypeToConfirmDeleteDialog } from "@/components/TypeToConfirmDeleteDialog";

/**
 * Runtime host for a custom app at /apps/:slug. Resolves the app from the
 * registry and dispatches by type: `declarative` → native renderer (APP-2),
 * `hosted` → sandboxed iframe (APP-4a). Loading this is pure runtime content —
 * it never triggers a signed-client rebuild. Admins get a slim Edit/Delete bar
 * (Edit reopens the builder on this app; Delete removes it for everyone).
 */
export function AppDetailPage() {
  const { appSlug = "" } = useParams<{ appSlug: string }>();
  const app = useApp(appSlug);
  const { isLoading } = useAppRegistry();
  usePageTitle(app?.name ?? "App");
  const navigate = useNavigate();
  const me = useMe();
  const isAdmin = Boolean(me.data?.administrator);
  const del = useDeleteApp();
  const [deleteOpen, setDeleteOpen] = useState(false);

  if (isLoading && !app) {
    return <div className="p-6 text-sm text-muted-foreground">Loading app…</div>;
  }
  if (!app) {
    return (
      <div className="p-6">
        <h2 className="text-lg font-semibold">App not found</h2>
        <p className="text-sm text-muted-foreground">
          No app exists at <code>/apps/{appSlug}</code>, or it isn’t available to you.
        </p>
      </div>
    );
  }

  const onDelete = async () => {
    try {
      await del.mutateAsync(app.slug);
      toast.success(`Deleted "${app.name}"`);
      navigate("/home");
    } catch (e) {
      showError(e);
    }
  };

  const body =
    app.type === "declarative" && isDeclarativeSpec(app.spec) ? (
      <DeclarativeAppRenderer app={app} />
    ) : app.type === "hosted" && isHostedSpec(app.spec) ? (
      <HostedAppHost app={app} />
    ) : (
      <div className="p-6">
        <h2 className="text-lg font-semibold">{app.name}</h2>
        <p className="text-sm text-muted-foreground">
          This app has no renderable spec yet (status: {app.status}).
        </p>
      </div>
    );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {isAdmin ? (
        <div className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-2">
          <span className="mr-auto text-xs uppercase tracking-wide text-muted-foreground">
            Admin
          </span>
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={() => navigate(`/apps/new?edit=${encodeURIComponent(app.slug)}`)}
          >
            <PencilSimpleIcon className="size-3.5" />
            Edit
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs text-destructive hover:text-destructive"
            onClick={() => setDeleteOpen(true)}
            disabled={del.isPending}
          >
            <TrashIcon className="size-3.5" />
            Delete
          </Button>
        </div>
      ) : null}
      <div className="min-h-0 flex-1 overflow-auto">{body}</div>

      <TypeToConfirmDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        name={app.name}
        title="Delete this app?"
        description={
          <>
            This permanently deletes{" "}
            <span className="font-medium text-foreground">{app.name}</span> for everyone in the
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
