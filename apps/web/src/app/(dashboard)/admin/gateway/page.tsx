"use client";

// Next.js App Router requires default export — framework exception.

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  Button,
  Badge,
  Card,
  PageHeader,
  CodeBlock,
  SectionLabel,
  Copy,
  Check,
  Loader2,
} from "@basicsos/ui";

const CopyButton = ({ text, label = "Copy" }: { text: string; label?: string }): JSX.Element => {
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
      <span className="ml-1.5">{copied ? "Copied!" : label}</span>
    </Button>
  );
};

const GatewayPage = (): JSX.Element => {
  const [keyVisible, setKeyVisible] = useState(false);
  const { data, isLoading } = trpc.gateway.getConfig.useQuery();

  const gatewayUrl = data?.gatewayUrl ?? null;
  const configured = data?.configured ?? false;
  const keyPrefix = data?.keyPrefix ?? null;
  const fullKey = data?.key ?? null;

  const ttsExample = `curl -X POST ${gatewayUrl ?? "https://your-gateway-url"}/v1/audio/speech \\
  -H "Authorization: Bearer ${keyVisible && fullKey ? fullKey : "<YOUR_API_KEY>"}" \\
  -H "Content-Type: application/json" \\
  -d '{"model":"basics-tts","input":"Hello from Basics OS"}' \\
  --output speech.mp3`;

  const sttExample = `curl -X POST ${gatewayUrl ?? "https://your-gateway-url"}/v1/audio/transcriptions \\
  -H "Authorization: Bearer ${keyVisible && fullKey ? fullKey : "<YOUR_API_KEY>"}" \\
  -F "file=@audio.wav" \\
  -F "model=basics-stt"`;

  const chatExample = `curl -X POST ${gatewayUrl ?? "https://your-gateway-url"}/v1/chat/completions \\
  -H "Authorization: Bearer ${keyVisible && fullKey ? fullKey : "<YOUR_API_KEY>"}" \\
  -H "Content-Type: application/json" \\
  -d '{"model":"basics-chat-fast","messages":[{"role":"user","content":"Hello"}]}'`;

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader
        title="Gateway API"
        description="Connect to the Basics OS infra gateway for AI, TTS, and STT. Use the URL and key below to call the API from your own code."
      />

      {/* Connection status */}
      <Card className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-stone-900">Connection status</p>
            <p className="mt-0.5 text-xs text-stone-500">
              Configure via <code className="rounded bg-stone-100 px-1 py-0.5 font-mono text-xs">BASICOS_API_URL</code>{" "}
              and{" "}
              <code className="rounded bg-stone-100 px-1 py-0.5 font-mono text-xs">BASICOS_API_KEY</code>{" "}
              environment variables.
            </p>
          </div>
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-stone-400" />
          ) : (
            <Badge variant={configured ? "success" : "secondary"}>
              {configured ? "Connected" : "Not configured"}
            </Badge>
          )}
        </div>

        {configured && gatewayUrl && (
          <div className="mt-4 space-y-3">
            {/* Gateway URL */}
            <div>
              <SectionLabel as="p" className="mb-1">Gateway URL</SectionLabel>
              <div className="flex items-center gap-2 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2">
                <code className="flex-1 break-all font-mono text-xs text-stone-700">{gatewayUrl}</code>
                <CopyButton text={gatewayUrl} />
              </div>
            </div>

            {/* API Key */}
            <div>
              <SectionLabel as="p" className="mb-1">API Key</SectionLabel>
              <div className="flex items-center gap-2 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2">
                <code className="flex-1 break-all font-mono text-xs text-stone-700">
                  {keyVisible && fullKey ? fullKey : keyPrefix ?? "••••••••••••••••••••••••"}
                </code>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setKeyVisible((v) => !v)}
                >
                  {keyVisible ? "Hide" : "Reveal"}
                </Button>
                {keyVisible && fullKey && <CopyButton text={fullKey} />}
              </div>
              <p className="mt-1 text-xs text-stone-500">
                Keep this secret. Use it in the <code className="font-mono">Authorization: Bearer</code> header.
              </p>
            </div>
          </div>
        )}

        {!configured && !isLoading && (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
            <p className="text-sm text-amber-800">
              Add <code className="font-mono">BASICOS_API_URL</code> and{" "}
              <code className="font-mono">BASICOS_API_KEY</code> to your <code className="font-mono">.env</code> and
              restart the API server.
            </p>
          </div>
        )}
      </Card>

      {/* What the gateway provides */}
      <Card className="p-5">
        <h3 className="font-semibold text-stone-900">What&apos;s available</h3>
        <div className="mt-3 grid grid-cols-3 gap-3">
          {[
            { label: "Chat completions", path: "/v1/chat/completions", desc: "Gemini 2.5 via LiteLLM" },
            { label: "Text-to-speech", path: "/v1/audio/speech", desc: "Deepgram aura-2" },
            { label: "Speech-to-text", path: "/v1/audio/transcriptions", desc: "Deepgram nova-2" },
          ].map((item) => (
            <div key={item.path} className="rounded-lg border border-stone-200 p-3">
              <p className="text-xs font-medium text-stone-900">{item.label}</p>
              <code className="mt-0.5 block font-mono text-xs text-stone-500">{item.path}</code>
              <p className="mt-1 text-xs text-stone-400">{item.desc}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* Developer examples */}
      <div className="space-y-4">
        <h3 className="font-semibold text-stone-900">Code examples</h3>

        <div className="space-y-1">
          <SectionLabel as="p">Text-to-speech</SectionLabel>
          <CodeBlock code={ttsExample} />
        </div>

        <div className="space-y-1">
          <SectionLabel as="p">Speech-to-text</SectionLabel>
          <CodeBlock code={sttExample} />
        </div>

        <div className="space-y-1">
          <SectionLabel as="p">Chat completions</SectionLabel>
          <CodeBlock code={chatExample} />
        </div>
      </div>

      {/* Health check */}
      {configured && gatewayUrl && (
        <Card className="p-5">
          <h3 className="font-semibold text-stone-900">Health check</h3>
          <p className="mt-1 text-sm text-stone-600">
            Check that the gateway is reachable and all providers are up.
          </p>
          <CodeBlock
            code={`curl ${gatewayUrl}/health`}
            className="mt-3"
          />
        </Card>
      )}
    </div>
  );
};

export default GatewayPage;
