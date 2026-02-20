import { PageHeader } from "@basicsos/ui";

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
      <div className="rounded-xl border-2 border-primary/20 bg-primary/5 p-5">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-semibold text-stone-900">Managed Hosting</h3>
            <p className="mt-1 text-sm text-stone-600">
              One-click deploy, automatic updates, no infrastructure to manage.
              Includes an AI API key covering all models.
            </p>
          </div>
          <a
            href="https://basicsos.com"
            target="_blank"
            rel="noreferrer"
            className="ml-4 flex-shrink-0 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            basicsos.com →
          </a>
        </div>
      </div>

      {/* Self-hosted */}
      <div className="rounded-xl border bg-white p-5">
        <h3 className="font-semibold text-stone-900">Self-Hosted</h3>
        <p className="mt-1 text-sm text-stone-600">
          You&apos;re running this yourself — you own everything. Deploy anywhere Docker runs.
        </p>
        <div className="mt-3 rounded-lg bg-stone-50 p-3 font-mono text-xs text-stone-700">
          docker-compose -f docker-compose.prod.yml up -d
        </div>
      </div>
    </div>
  </div>
);

export default BillingPage;
