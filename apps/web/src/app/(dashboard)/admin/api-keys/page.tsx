"use client";

// Next.js App Router requires default export — framework exception.

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button, Badge, Input, Label, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, addToast, Copy, Trash2, Plus, Check } from "@basicsos/ui";

type CreatedKey = { id: string; name: string; key: string; keyPrefix: string };

const CopyButton = ({ text }: { text: string }): JSX.Element => {
  const [copied, setCopied] = useState(false);

  const handleCopy = (): void => {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <Button variant="outline" size="sm" onClick={handleCopy}>
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      <span className="ml-1.5">{copied ? "Copied" : "Copy"}</span>
    </Button>
  );
};

const CreateKeyDialog = ({ onCreated }: { onCreated: (key: CreatedKey) => void }): JSX.Element => {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [monthlyLimit, setMonthlyLimit] = useState("");

  const create = trpc.llmKeys.create.useMutation({
    onSuccess: (data) => {
      onCreated({ id: data.id, name: data.name, key: data.key, keyPrefix: data.keyPrefix });
      setOpen(false);
      setName("");
      setMonthlyLimit("");
    },
    onError: (err) =>
      addToast({ title: "Failed to create key", description: err.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-1.5 h-4 w-4" />
          New key
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create virtual key</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="key-name">Name</Label>
            <Input
              id="key-name"
              placeholder="e.g. Production, Dev, Team A"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="monthly-limit">Monthly token limit (optional)</Label>
            <Input
              id="monthly-limit"
              type="number"
              placeholder="e.g. 1000000"
              value={monthlyLimit}
              onChange={(e) => setMonthlyLimit(e.target.value)}
            />
            <p className="text-xs text-stone-400">Leave blank for unlimited.</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            disabled={!name.trim() || create.isPending}
            onClick={() =>
              create.mutate({
                name: name.trim(),
                monthlyLimitTokens: monthlyLimit ? parseInt(monthlyLimit, 10) : undefined,
              })
            }
          >
            {create.isPending ? "Creating…" : "Create key"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const NewKeyReveal = ({ createdKey, onDismiss }: { createdKey: CreatedKey; onDismiss: () => void }): JSX.Element => (
  <div className="rounded-xl border border-primary/30 bg-primary/5 p-5">
    <p className="text-sm font-medium text-stone-900">
      Key created — copy it now. You won&apos;t be able to see it again.
    </p>
    <div className="mt-3 flex items-center gap-2 rounded-lg border bg-white p-3">
      <code className="flex-1 break-all font-mono text-xs text-stone-700">{createdKey.key}</code>
      <CopyButton text={createdKey.key} />
    </div>
    <Button variant="outline" size="sm" className="mt-3" onClick={onDismiss}>
      Done
    </Button>
  </div>
);

const ApiKeysPage = (): JSX.Element => {
  const [newKey, setNewKey] = useState<CreatedKey | null>(null);
  const utils = trpc.useUtils();

  const { data: keys = [], isLoading } = trpc.llmKeys.list.useQuery();

  const setActive = trpc.llmKeys.setActive.useMutation({
    onSuccess: () => void utils.llmKeys.list.invalidate(),
    onError: (err) =>
      addToast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteKey = trpc.llmKeys.delete.useMutation({
    onSuccess: () => {
      addToast({ title: "Key deleted", variant: "success" });
      void utils.llmKeys.list.invalidate();
    },
    onError: (err) =>
      addToast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const handleCreated = (key: CreatedKey): void => {
    setNewKey(key);
    void utils.llmKeys.list.invalidate();
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">AI API Keys</h1>
          <p className="mt-1 text-stone-500">
            Virtual keys let team members access AI features without sharing raw provider credentials.
          </p>
        </div>
        <CreateKeyDialog onCreated={handleCreated} />
      </div>

      {/* Newly created key reveal */}
      {newKey && <NewKeyReveal createdKey={newKey} onDismiss={() => setNewKey(null)} />}

      {/* Key list */}
      <div className="rounded-xl border bg-white">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-stone-400">Loading…</div>
        ) : keys.length === 0 ? (
          <div className="p-8 text-center text-sm text-stone-400">
            No keys yet. Create one to get started.
          </div>
        ) : (
          <div className="divide-y">
            {keys.map((key) => (
              <div key={key.id} className="flex items-center justify-between p-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-stone-900">{key.name}</span>
                    <Badge variant={key.isActive ? "success" : "secondary"}>
                      {key.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  <p className="mt-0.5 font-mono text-xs text-stone-400">
                    {key.keyPrefix}••••••••••••••••••••
                  </p>
                  {key.lastUsedAt && (
                    <p className="mt-0.5 text-xs text-stone-400">
                      Last used {new Date(key.lastUsedAt).toLocaleDateString()}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={setActive.isPending}
                    onClick={() => setActive.mutate({ id: key.id, isActive: !key.isActive })}
                  >
                    {key.isActive ? "Deactivate" : "Activate"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={deleteKey.isPending}
                    onClick={() => {
                      if (confirm(`Delete key "${key.name}"? This cannot be undone.`))
                        deleteKey.mutate({ id: key.id });
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Self-hosted / BYOK note */}
      <div className="rounded-xl border bg-stone-50 p-5">
        <h3 className="font-medium text-stone-700">Bring Your Own Keys</h3>
        <p className="mt-1 text-sm text-stone-500">
          Prefer to use your own provider credentials? Set them in your{" "}
          <code className="rounded bg-stone-100 px-1">.env</code> file and restart the API server.
        </p>
        <div className="mt-3 rounded-lg bg-white p-3 font-mono text-xs text-stone-600">
          ANTHROPIC_API_KEY=sk-ant-...
          <br />
          <span className="text-stone-400"># or</span>
          <br />
          AI_API_KEY=bsk_live_...
        </div>
      </div>
    </div>
  );
};

export default ApiKeysPage;
