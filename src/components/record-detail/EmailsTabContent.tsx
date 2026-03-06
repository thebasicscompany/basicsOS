import { useState, useMemo } from "react";
import { format } from "date-fns";
import {
  EnvelopeSimpleIcon,
  CircleIcon,
} from "@phosphor-icons/react";
import { getMockEmails, type MockEmail } from "./mock-data/emails";
import { EmailViewDialog } from "./EmailViewDialog";

export function EmailsTabContent({ recordId }: { recordId: number }) {
  const emails = useMemo(() => getMockEmails(recordId), [recordId]);
  const [selectedEmail, setSelectedEmail] = useState<MockEmail | null>(null);

  return (
    <div className="space-y-1">
      {emails.length === 0 ? (
        <div className="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">
          No emails yet.
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
                    {email.subject}
                  </span>
                  {!email.isRead && (
                    <CircleIcon
                      weight="fill"
                      className="size-2 shrink-0 text-primary"
                    />
                  )}
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="truncate">{email.from.name}</span>
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
