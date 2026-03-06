import { useState, useMemo } from "react";
import { format } from "date-fns";
import {
  PhoneIcon,
  VideoCameraIcon,
  UsersIcon,
} from "@phosphor-icons/react";
import { getMockCalls, type MockCall } from "./mock-data/calls";
import { CallViewDialog } from "./CallViewDialog";

const TYPE_ICON = {
  call: PhoneIcon,
  meeting: UsersIcon,
  video: VideoCameraIcon,
} as const;

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

interface CallsTabContentProps {
  recordId: number;
  objectSlug: string;
  onSwitchToTab?: (tab: string) => void;
}

export function CallsTabContent({
  recordId,
  objectSlug,
  onSwitchToTab,
}: CallsTabContentProps) {
  const calls = useMemo(() => getMockCalls(recordId), [recordId]);
  const [selectedCall, setSelectedCall] = useState<MockCall | null>(null);

  return (
    <div className="space-y-1">
      {calls.length === 0 ? (
        <div className="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">
          No calls yet.
        </div>
      ) : (
        <div className="divide-y rounded-lg border bg-card">
          {calls.map((call) => {
            const Icon = TYPE_ICON[call.type];
            return (
              <button
                key={call.id}
                onClick={() => setSelectedCall(call)}
                className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/50"
              >
                <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">
                      {call.title}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="truncate">
                      {call.participants.map((p) => p.name).join(", ")}
                    </span>
                    <span>&middot;</span>
                    <span className="shrink-0">
                      {formatDuration(call.duration)}
                    </span>
                    <span>&middot;</span>
                    <span className="shrink-0">
                      {format(new Date(call.date), "MMM d")}
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      <CallViewDialog
        call={selectedCall}
        open={selectedCall != null}
        onOpenChange={(open) => {
          if (!open) setSelectedCall(null);
        }}
        objectSlug={objectSlug}
        recordId={recordId}
        onSwitchToTab={onSwitchToTab}
      />
    </div>
  );
}
