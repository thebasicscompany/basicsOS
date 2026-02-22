"use client";

// Next.js App Router requires default export — framework exception.

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  Button, Badge, Input, Label,
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
  addToast, PageHeader, Card, CodeBlock, InlineCode,
  Copy, Trash2, Plus, Check,
} from "@basicsos/ui";

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
            <p className="text-xs text-stone-500">Leave blank for unlimited.</p>
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
            {create.isPending ? "Creating\u2026" : "Create key"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const NewKeyReveal = ({ createdKey, onDismiss }: { createdKey: CreatedKey; onDismiss: () => void }): JSX.Element => (
  <Card className="border border-primary/20 ring-1 ring-primary/10 bg-primary/5 p-5">
    <p className="text-sm font-medium text-stone-900 dark:text-stone-100">
      Key created — copy it now. You won&apos;t be able to see it again.
    </p>
    <div className="mt-3 flex items-center gap-2 rounded-lg bg-white dark:bg-stone-800 p-3 ring-1 ring-stone-200 dark:ring-stone-700/50">
      <code className="flex-1 break-all font-mono text-xs text-stone-700 dark:text-stone-200">{createdKey.key}</code>
      <CopyButton text={createdKey.key} />
    </div>
    <Button variant="outline" size="sm" className="mt-3" onClick={onDismiss}>
      Done
    </Button>
  </Card>
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
      <PageHeader
        title="AI API Keys"
        description="Virtual keys let team members access AI features without sharing raw provider credentials."
        action={<CreateKeyDialog onCreated={handleCreated} />}
      />

      {/* Newly created key reveal */}
      {newKey && <NewKeyReveal createdKey={newKey} onDismiss={() => setNewKey(null)} />}

      {/* Key list */}
      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-stone-500">Loading\u2026</div>
        ) : keys.length === 0 ? (
          <div className="p-8 text-center text-sm text-stone-500">
            No keys yet. Create one to get started.
          </div>
        ) : (
          <div className="divide-y divide-stone-100">
            {keys.map((key) => (
              <div key={key.id} className="flex items-center justify-between p-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-stone-900">{key.name}</span>
                    <Badge variant={key.isActive ? "success" : "secondary"}>
                      {key.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  <p className="mt-0.5 font-mono text-xs text-stone-500">
                    {key.keyPrefix}\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022
                  </p>
                  {key.lastUsedAt && (
                    <p className="mt-0.5 text-xs text-stone-500">
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
      </Card>

      {/* Self-hosted / BYOK note */}
      <Card className="p-5">
        <h3 className="font-semibold text-stone-900">Bring Your Own Keys</h3>
        <p className="mt-1 text-sm text-stone-600">
          Prefer to use your own provider credentials? Set them in your{" "}
          <InlineCode>.env</InlineCode> file and restart the API server.
        </p>
        <CodeBlock code={"ANTHROPIC_API_KEY=sk-ant-...\n# or\nAI_API_KEY=bsk_live_..."} className="mt-3" />
      </Card>
    </div>
  );
};

export default ApiKeysPage;
