import { useState } from "react";
import { toast } from "sonner";
import { PlugIcon, TrashIcon, KeyIcon } from "@phosphor-icons/react";
import { showError } from "@/lib/show-error";
import {
  useConnectors,
  useCreateConnector,
  useDeleteConnector,
  type ConnectorAuthScheme,
} from "@/hooks/use-connectors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const AUTH_LABELS: Record<ConnectorAuthScheme, string> = {
  bearer: "Bearer token (Authorization: Bearer …)",
  header: "Custom header",
  query: "Query parameter",
  none: "No auth",
};

const emptyForm = {
  name: "",
  baseUrl: "",
  authScheme: "bearer" as ConnectorAuthScheme,
  authName: "",
  apiKey: "",
  description: "",
};

/**
 * Admin UI to register custom external-API connectors. The admin supplies a base
 * URL, how the key is sent, and the key itself; the key is stored encrypted and
 * never returned. Apps/agent then call the API by slug via the broker (which
 * injects the key) — they never see it.
 */
export function ConnectorsSettings() {
  const { data: connectors, isLoading } = useConnectors();
  const create = useCreateConnector();
  const del = useDeleteConnector();
  const [form, setForm] = useState(emptyForm);
  const [adding, setAdding] = useState(false);

  const needsName = form.authScheme === "header" || form.authScheme === "query";
  const needsKey = form.authScheme !== "none";
  const canSubmit =
    form.name.trim() &&
    /^https?:\/\//.test(form.baseUrl.trim()) &&
    (!needsKey || form.apiKey.trim()) &&
    (!needsName || form.authName.trim());

  const submit = async () => {
    if (!canSubmit) return;
    try {
      await create.mutateAsync({
        name: form.name.trim(),
        baseUrl: form.baseUrl.trim(),
        description: form.description.trim() || undefined,
        authScheme: form.authScheme,
        authName: needsName ? form.authName.trim() : undefined,
        apiKey: needsKey ? form.apiKey.trim() : undefined,
      });
      toast.success(`Connector "${form.name.trim()}" added`);
      setForm(emptyForm);
      setAdding(false);
    } catch (e) {
      showError(e);
    }
  };

  const onDelete = async (slug: string, name: string) => {
    if (!window.confirm(`Delete the "${name}" connector? Apps using it will stop working.`)) return;
    try {
      await del.mutateAsync(slug);
      toast.success(`Deleted "${name}"`);
    } catch (e) {
      showError(e);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Connect any external API by URL + key. The key is stored encrypted and injected
        server-side — apps and the assistant call the API by name and never see the key.
      </p>

      {/* Existing connectors */}
      <div className="space-y-2">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : connectors && connectors.length > 0 ? (
          connectors.map((cn) => (
            <div
              key={cn.slug}
              className="flex items-start gap-3 rounded-lg border border-border p-3"
            >
              <PlugIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{cn.name}</span>
                  <code className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                    {cn.slug}
                  </code>
                  {cn.hasKey ? (
                    <span className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                      <KeyIcon className="size-3" /> key set
                    </span>
                  ) : null}
                </div>
                <div className="truncate text-xs text-muted-foreground">{cn.baseUrl}</div>
                {cn.description ? (
                  <div className="mt-1 text-xs text-muted-foreground">{cn.description}</div>
                ) : null}
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 shrink-0 text-destructive hover:text-destructive"
                title="Delete connector"
                onClick={() => onDelete(cn.slug, cn.name)}
                disabled={del.isPending}
              >
                <TrashIcon className="size-4" />
              </Button>
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">No connectors yet.</p>
        )}
      </div>

      {/* Add form */}
      {adding ? (
        <div className="space-y-3 rounded-lg border border-border p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="cn-name">Name</Label>
              <Input
                id="cn-name"
                placeholder="e.g. OpenWeather"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cn-url">Base URL</Label>
              <Input
                id="cn-url"
                placeholder="https://api.example.com"
                value={form.baseUrl}
                onChange={(e) => setForm((f) => ({ ...f, baseUrl: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="cn-auth">Auth type</Label>
              <select
                id="cn-auth"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={form.authScheme}
                onChange={(e) =>
                  setForm((f) => ({ ...f, authScheme: e.target.value as ConnectorAuthScheme }))
                }
              >
                {(Object.keys(AUTH_LABELS) as ConnectorAuthScheme[]).map((k) => (
                  <option key={k} value={k}>
                    {AUTH_LABELS[k]}
                  </option>
                ))}
              </select>
            </div>
            {needsName ? (
              <div className="space-y-1.5">
                <Label htmlFor="cn-authname">
                  {form.authScheme === "header" ? "Header name" : "Query param name"}
                </Label>
                <Input
                  id="cn-authname"
                  placeholder={form.authScheme === "header" ? "X-API-Key" : "api_key"}
                  value={form.authName}
                  onChange={(e) => setForm((f) => ({ ...f, authName: e.target.value }))}
                />
              </div>
            ) : null}
          </div>

          {needsKey ? (
            <div className="space-y-1.5">
              <Label htmlFor="cn-key">API key</Label>
              <Input
                id="cn-key"
                type="password"
                placeholder="paste the key — stored encrypted, never shown again"
                value={form.apiKey}
                onChange={(e) => setForm((f) => ({ ...f, apiKey: e.target.value }))}
              />
            </div>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="cn-desc">
              Description <span className="text-muted-foreground">(helps the assistant call it)</span>
            </Label>
            <Textarea
              id="cn-desc"
              rows={2}
              placeholder="What this API does + key endpoints, e.g. 'Weather API. GET /data/2.5/weather?q={city} returns current weather.'"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>

          <div className="flex gap-2">
            <Button onClick={submit} disabled={!canSubmit || create.isPending}>
              {create.isPending ? "Adding…" : "Add connector"}
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setForm(emptyForm);
                setAdding(false);
              }}
              disabled={create.isPending}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
          <PlugIcon className="mr-1.5 size-4" />
          Add connector
        </Button>
      )}
    </div>
  );
}
