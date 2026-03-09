/**
 * Real meeting manager — creates meetings via the API backend.
 * Drop-in replacement for meeting-manager-stub.ts.
 */

export type MeetingState = {
  active: boolean;
  meetingId: string | null;
  startedAt: number | null;
};

export type MeetingPersistedState = MeetingState & { transcript?: string[] };

export type MeetingManagerOptions = {
  onMeetingStart: (meetingId: string) => void;
  onMeetingStop: (meetingId: string) => void;
};

export type MeetingManager = {
  start: (apiUrl: string, token: string) => Promise<void>;
  stop: (apiUrl: string) => Promise<void>;
  getState: () => MeetingState;
  getPersistedState: () => MeetingPersistedState | null;
};

let state: MeetingState = {
  active: false,
  meetingId: null,
  startedAt: null,
};

export function createMeetingManager(
  options: MeetingManagerOptions,
): MeetingManager {
  const { onMeetingStart, onMeetingStop } = options;

  return {
    async start(apiUrl: string, token: string): Promise<void> {
      console.log("[meeting-manager] start() called, active=", state.active, "apiUrl=", apiUrl, "hasToken=", !!token);
      if (state.active) { console.log("[meeting-manager] Already active, returning early"); return; }

      try {
        console.log("[meeting-manager] POST /api/meetings...");
        const res = await fetch(`${apiUrl}/api/meetings`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) {
          const err = await res.text().catch(() => "");
          throw new Error(`Failed to create meeting: ${res.status} ${err}`);
        }

        const meeting = (await res.json()) as { id: number };
        const meetingId = String(meeting.id);
        console.log("[meeting-manager] Meeting created, id=", meetingId);

        state = {
          active: true,
          meetingId,
          startedAt: Date.now(),
        };
        console.log("[meeting-manager] Calling onMeetingStart callback...");
        onMeetingStart(meetingId);
        console.log("[meeting-manager] onMeetingStart callback completed");
      } catch (err) {
        console.error("[meeting-manager] start failed:", err);
        throw err;
      }
    },

    async stop(_apiUrl: string): Promise<void> {
      console.log("[meeting-manager] stop() called, active=", state.active, "meetingId=", state.meetingId);
      if (!state.active) { console.log("[meeting-manager] Not active, returning early"); return; }
      const meetingId = state.meetingId;
      state = {
        active: false,
        meetingId: null,
        startedAt: null,
      };
      console.log("[meeting-manager] Calling onMeetingStop callback for meetingId=", meetingId);
      if (meetingId) onMeetingStop(meetingId);
    },

    getState(): MeetingState {
      return { ...state };
    },

    getPersistedState(): MeetingPersistedState | null {
      if (!state.active) return null;
      return { ...state };
    },
  };
}
