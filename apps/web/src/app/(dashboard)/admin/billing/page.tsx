import { PageHeader, Card, Button, CodeBlock } from "@basicsos/ui";

// Next.js App Router requires default export — framework exception.
const BillingPage = (): JSX.Element => (
  <div className="max-w-2xl">
    <PageHeader
      title="Hosting"
      description="Choose how to run Basics OS for your team."
      className="mb-6"
    />

    <div className="mt-6 space-y-4">
      {/* Managed */}
      <Card className="border border-primary/20 ring-1 ring-primary/10 bg-primary/5 p-5">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-semibold text-stone-900">Managed Hosting</h3>
            <p className="mt-1 text-sm text-stone-600">
              One-click deploy, automatic updates, no infrastructure to manage.
              Includes an AI API key covering all models.
            </p>
          </div>
          <Button asChild className="ml-4 flex-shrink-0">
            <a href="https://basicsos.com" target="_blank" rel="noreferrer">
              basicsos.com &rarr;
            </a>
          </Button>
        </div>
      </Card>

      {/* Self-hosted */}
      <Card className="p-5">
        <h3 className="font-semibold text-stone-900">Self-Hosted</h3>
        <p className="mt-1 text-sm text-stone-600">
          You&apos;re running this yourself — you own everything. Deploy anywhere Docker runs.
        </p>
        <CodeBlock code="docker-compose -f docker-compose.prod.yml up -d" className="mt-3" />
      </Card>
    </div>
  </div>
);

export default BillingPage;
