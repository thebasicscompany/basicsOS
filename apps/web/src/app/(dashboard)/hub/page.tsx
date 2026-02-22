"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { Button, Badge, Plus, Link2, MessageSquare, HardDrive, Github, EmptyState, addToast, PageHeader, Card, SectionLabel } from "@basicsos/ui";
import { AddLinkDialog } from "./AddLinkDialog";

const SERVICE_ICONS: Record<string, React.ElementType> = {
  slack: MessageSquare,
  "google-drive": HardDrive,
  github: Github,
};

// Next.js App Router requires default export — framework exception.
const HubPage = (): JSX.Element => {
  const utils = trpc.useUtils();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { data: links } = trpc.hub.listLinks.useQuery();
  const { data: integrations } = trpc.hub.listIntegrations.useQuery();

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
      void utils.hub.listIntegrations.invalidate();
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
      void utils.hub.listIntegrations.invalidate();
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
      <PageHeader
        title="Hub"
        className="mb-6"
        action={
          <AddLinkDialog onCreated={() => void utils.hub.listLinks.invalidate()}>
            <Button><Plus size={14} className="mr-1" /> Add Link</Button>
          </AddLinkDialog>
        }
      />

      {Object.entries(byCategory).length === 0 && (
        <EmptyState
          Icon={Link2}
          heading="No links yet"
          description="Add your first link to organize your team's tools and resources."
          action={
            <AddLinkDialog onCreated={() => void utils.hub.listLinks.invalidate()}>
              <Button>
                <Plus size={14} className="mr-1" /> Add Link
              </Button>
            </AddLinkDialog>
          }
        />
      )}

      {Object.entries(byCategory).map(([cat, catLinks]) => (
        <div key={cat} className="mb-6">
          <SectionLabel as="h2" className="mb-3">
            {cat}
          </SectionLabel>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {(catLinks ?? []).map((link) => (
              <a key={link.id} href={link.url} target="_blank" rel="noreferrer" className="block">
                <Card className="p-4 transition-colors hover:bg-accent/50">
                  <span className="text-sm font-medium text-stone-900 dark:text-stone-100 line-clamp-1">{link.title}</span>
                </Card>
              </a>
            ))}
          </div>
        </div>
      ))}

      {/* Integrations section */}
      <div className="mt-8">
        <SectionLabel as="h2" className="mb-4">Integrations</SectionLabel>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(integrations ?? []).map((svc) => {
            const IconComp = SERVICE_ICONS[svc.service] ?? Link2;
            return (
              <Card
                key={svc.service}
                className={`flex items-center justify-between p-4 transition-colors ${
                  svc.connected ? "border-l-4 border-l-success" : ""
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-stone-200 dark:bg-stone-700 text-stone-600 dark:text-stone-400">
                    <IconComp size={18} />
                  </div>
                  <div>
                    <p className="font-medium text-stone-900 dark:text-stone-100">{svc.label}</p>
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
              </Card>
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
