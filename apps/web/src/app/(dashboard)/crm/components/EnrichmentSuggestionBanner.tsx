"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, Button, Badge, Sparkles, X, addToast } from "@basicsos/ui";

interface EnrichmentSuggestionBannerProps {
  contactId: string;
}

export const EnrichmentSuggestionBanner = ({
  contactId,
}: EnrichmentSuggestionBannerProps): JSX.Element | null => {
  const [dismissed, setDismissed] = useState(false);
  const utils = trpc.useUtils();

  const { data: enrichment } = trpc.crm.contacts.enrichFromDomain.useQuery(
    { contactId },
    { enabled: !dismissed },
  );

  const linkToCompany = trpc.crm.contacts.linkToCompany.useMutation({
    onSuccess: () => {
      addToast({ title: "Company linked", variant: "success" });
      setDismissed(true);
      void utils.crm.contacts.get.invalidate({ id: contactId });
    },
    onError: (err) => {
      addToast({
        title: "Failed to link company",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  if (dismissed || !enrichment) return null;

  const primarySuggestion = enrichment.suggestions[0];
  if (!primarySuggestion) return null;

  return (
    <Card className="mb-6 border-primary/30 bg-primary/5">
      <CardContent className="flex items-center gap-3 py-3">
        <Sparkles className="h-4 w-4 shrink-0 text-primary" />
        <div className="flex flex-1 flex-wrap items-center gap-2 text-sm text-stone-700">
          <span>Suggested company:</span>
          <span className="font-semibold text-stone-900">{primarySuggestion.name}</span>
          <Badge variant="outline" className="text-xs">
            {enrichment.emailDomain}
          </Badge>
          <span className="text-stone-500">— domain match</span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            size="sm"
            disabled={linkToCompany.isPending}
            onClick={() =>
              linkToCompany.mutate({
                contactId,
                companyId: primarySuggestion.id,
              })
            }
          >
            {linkToCompany.isPending ? "Linking…" : "Link"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setDismissed(true)}
            aria-label="Dismiss suggestion"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
