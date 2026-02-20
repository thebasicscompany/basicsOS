"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import {
  Button,
  Badge,
  Plus,
  Link2,
  MessageSquare,
  HardDrive,
  Github,
  EmptyState,
  addToast,
} from "@basicsos/ui";
import { AddLinkDialog } from "./AddLinkDialog";

const SERVICE_ICONS: Record<string, React.ElementType> = {
  slack: MessageSquare,
  "google-drive": HardDrive,
  github: Github,
};

// Next.js App Router requires default export — framework exception.
const HubPage = (): JSX.Element => {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { data: links, refetch: refetchLinks } = trpc.hub.listLinks.useQuery();
  const { data: integrations, refetch: refetchIntegrations } = trpc.hub.listIntegrations.useQuery();

  const getOAuthUrl = trpc.hub.getOAuthUrl.useMutation({
    onSuccess: ({ url }) => {
      window.location.href = url;
    },
    onError: (err) => {
      addToast({ title: "Cannot connect", description: err.message, variant: "destructive" });
    },
  });

  const disconnect = trpc.hub.disconnectIntegration.useMutation({
    onSuccess: (_data, { service }) => {
      addToast({ title: `${service} disconnected`, variant: "success" });
      void refetchIntegrations();
    },
    onError: (err) => {
      addToast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  useEffect(() => {
    const success = searchParams.get("oauth_success");
    const error = searchParams.get("oauth_error");
    if (success) {
      addToast({ title: `${success} connected successfully`, variant: "success" });
      void refetchIntegrations();
      router.replace("/hub");
    } else if (error) {
      addToast({
        title: "OAuth failed",
        description: decodeURIComponent(error),
        variant: "destructive",
      });
      router.replace("/hub");
    }
  }, []);

  const byCategory = (links ?? []).reduce<Record<string, typeof links>>((acc, link) => {
    const cat = link.category;
    acc[cat] = [...(acc[cat] ?? []), link];
    return acc;
  }, {});

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-stone-900">Hub</h1>
        <AddLinkDialog onCreated={() => void refetchLinks()}>
          <Button>
            <Plus size={14} className="mr-1" /> Add Link
          </Button>
        </AddLinkDialog>
      </div>

      {Object.entries(byCategory).length === 0 && (
        <EmptyState
          Icon={Link2}
          heading="No links yet"
          description="Add your first link to organize your team's tools and resources."
          action={
            <AddLinkDialog onCreated={() => void refetchLinks()}>
              <Button>
                <Plus size={14} className="mr-1" /> Add Link
              </Button>
            </AddLinkDialog>
          }
        />
      )}

      {Object.entries(byCategory).map(([cat, catLinks]) => (
        <div key={cat} className="mb-6">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-stone-500">
            {cat}
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {(catLinks ?? []).map((link) => (
              <a
                key={link.id}
                href={link.url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-3 rounded-xl border border-stone-200 bg-white p-4 hover:shadow-md hover:border-stone-300 transition-all"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-stone-100 text-stone-600">
                  <Link2 size={16} />
                </div>
                <span className="truncate font-medium text-stone-900">{link.title}</span>
              </a>
            ))}
          </div>
        </div>
      ))}

      {/* Integrations section */}
      <div className="mt-8">
        <h2 className="mb-4 text-lg font-semibold text-stone-900">Integrations</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(integrations ?? []).map((svc) => {
            const IconComp = SERVICE_ICONS[svc.service] ?? Link2;
            return (
              <div
                key={svc.service}
                className={`flex items-center justify-between rounded-xl border bg-white p-4 transition-all ${
                  svc.connected
                    ? "border-l-4 border-l-emerald-500 border-stone-200"
                    : "border-stone-200"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-stone-100 text-stone-600">
                    <IconComp size={18} />
                  </div>
                  <div>
                    <p className="font-medium text-stone-900">{svc.label}</p>
                    <div className="mt-0.5">
                      {svc.connected ? (
                        <Badge variant="success">Connected</Badge>
                      ) : svc.configured ? (
                        <Badge variant="secondary">Not connected</Badge>
                      ) : (
                        <Badge variant="outline">Not configured</Badge>
                      )}
                    </div>
                  </div>
                </div>

                <div className="ml-4 shrink-0">
                  {svc.connected ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => disconnect.mutate({ service: svc.service })}
                      disabled={disconnect.isPending}
                    >
                      Disconnect
                    </Button>
                  ) : svc.configured ? (
                    <Button
                      size="sm"
                      onClick={() => getOAuthUrl.mutate({ service: svc.service })}
                      disabled={getOAuthUrl.isPending}
                    >
                      Connect
                    </Button>
                  ) : (
                    <Button size="sm" variant="ghost" disabled title="Set OAuth env vars to enable">
                      Connect
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const HubPageWrapper = (): JSX.Element => (
  <Suspense>
    <HubPage />
  </Suspense>
);

export default HubPageWrapper;
