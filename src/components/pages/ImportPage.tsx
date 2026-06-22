import { useSearchParams } from "react-router";
import { usePageTitle } from "@/contexts/page-header";
import { ImportWizard } from "@/components/import/ImportWizard";

export function ImportPage() {
  usePageTitle("Import");
  const [params] = useSearchParams();
  const object = params.get("object") ?? undefined;

  return (
    <div className="flex h-full flex-col overflow-auto pb-8">
      <p className="mb-6 text-sm text-muted-foreground">
        Import a CSV — create a brand-new grid from it (columns and types are
        inferred automatically), or import into an existing grid.
      </p>
      <div className="max-w-2xl">
        <ImportWizard initialObjectSlug={object} />
      </div>
    </div>
  );
}

ImportPage.path = "/import";
