import { useState } from "react";
import { Link } from "react-router";
import { format } from "date-fns";
import { EnvelopeSimpleIcon, CircleIcon } from "@phosphor-icons/react";
import { EmailViewDialog } from "./EmailViewDialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useContactEmails, useEmailSyncStatus } from "@/hooks/use-email-sync";
import type { SyncedEmail } from "@/types/email-sync";

export function EmailsTabContent({ recordId }: { recordId: number }) {
  const { data: syncStatus } = useEmailSyncStatus();
  const { data, isLoading } = useContactEmails(recordId);
  const emails = data?.data ?? [];
  const [selectedEmail, setSelectedEmail] = useState<SyncedEmail | null>(null);

  const isSyncActive =
    syncStatus?.syncStatus === "idle" || syncStatus?.syncStatus === "syncing";

  return (
    <div className="space-y-1">
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-start gap-3 px-4 py-3">
              <Skeleton className="mt-0.5 size-4" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            </div>
          ))}
        </div>
      ) : emails.length === 0 ? (
        <div className="rounded-lg border border-dashed py-12 text-center">
          {!isSyncActive ? (
            <>
              <p className="text-sm text-muted-foreground">No emails yet.</p>
              <p className="mt-1.5 text-xs text-muted-foreground">
                Connect Gmail in Settings and enable email sync to see emails
                here.
              </p>
              <Button variant="outline" size="sm" className="mt-4" asChild>
                <Link to="/settings#connections">Connect Gmail</Link>
              </Button>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                No emails found for this contact.
              </p>
              <p className="mt-1.5 text-xs text-muted-foreground">
                Emails will appear here as they sync from Gmail.
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="divide-y rounded-lg border bg-card">
          {emails.map((email) => (
            <button
              key={email.id}
              onClick={() => setSelectedEmail(email)}
              className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/50"
            >
              <EnvelopeSimpleIcon
                className={`mt-0.5 size-4 shrink-0 ${email.isRead ? "text-muted-foreground" : "text-primary"}`}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span
                    className={`truncate text-sm ${!email.isRead ? "font-semibold" : ""}`}
                  >
                    {email.subject ?? "(no subject)"}
                  </span>
                  {!email.isRead && (
                    <CircleIcon
                      weight="fill"
                      className="size-2 shrink-0 text-primary"
                    />
                  )}
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="truncate">
                    {email.fromName ?? email.fromEmail}
                  </span>
                  <span>&middot;</span>
                  <span className="shrink-0">
                    {format(new Date(email.date), "MMM d")}
                  </span>
                </div>
                <p className="mt-0.5 truncate text-xs text-muted-foreground/80">
                  {email.snippet}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}

      <EmailViewDialog
        email={selectedEmail}
        open={selectedEmail != null}
        onOpenChange={(open) => {
          if (!open) setSelectedEmail(null);
        }}
      />
    </div>
  );
}
