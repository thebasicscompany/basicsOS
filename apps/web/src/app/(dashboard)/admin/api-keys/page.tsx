import { PageHeader, Card, Button, CodeBlock, InlineCode } from "@basicsos/ui";

// Next.js App Router requires default export — framework exception.
const ApiKeysPage = (): JSX.Element => (
  <div className="max-w-2xl">
    <PageHeader
      title="AI Configuration"
      description="Choose how to power AI features in Basics OS."
      className="mb-6"
    />

    <div className="mt-6 space-y-4">
      {/* Option A */}
      <Card className="border border-primary/20 ring-1 ring-primary/10 bg-primary/5 p-5">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-semibold text-stone-900">Managed API Key</h3>
            <p className="mt-1 text-sm text-stone-600">
              One key covers all AI models, speech-to-text, and text-to-speech.
              No provider accounts needed.
            </p>
          </div>
          <Button asChild className="ml-4 flex-shrink-0">
            <a href="https://basicsos.com/keys" target="_blank" rel="noreferrer">
              Get a key &rarr;
            </a>
          </Button>
        </div>
        <CodeBlock code={"AI_API_KEY=bsk_live_...\nAI_API_URL=https://api.basicsos.com"} className="mt-3" />
      </Card>

      {/* Option B */}
      <Card className="p-5">
        <h3 className="font-semibold text-stone-900">Bring Your Own Keys</h3>
        <p className="mt-1 text-sm text-stone-600">
          Use your own Anthropic or OpenAI account.
        </p>
        <CodeBlock code={"ANTHROPIC_API_KEY=sk-ant-...\n# or\nOPENAI_API_KEY=sk-..."} className="mt-3" />
      </Card>
    </div>

    <p className="mt-4 text-sm text-stone-500">
      Edit your <InlineCode>.env</InlineCode> file and restart
      the API server to apply changes.
    </p>
  </div>
);

export default ApiKeysPage;
