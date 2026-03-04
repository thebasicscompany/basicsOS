/**
 * Stub meeting manager. Meeting recording requires backend support (basicsAdmin).
 * No WebSocket, no upload, no API call — local state only.
 * When activated, logs "Meeting recording requires backend support".
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
  options: MeetingManagerOptions
): MeetingManager {
  const { onMeetingStart, onMeetingStop } = options;

  return {
    async start(apiUrl: string, _token: string): Promise<void> {
      if (state.active) return;
      // eslint-disable-next-line no-console
      console.warn("Meeting recording requires backend support");
      const meetingId = `stub-${Date.now()}`;
      state = {
        active: true,
        meetingId,
        startedAt: Date.now(),
      };
      onMeetingStart(meetingId);
    },

    async stop(_apiUrl: string): Promise<void> {
      if (!state.active) return;
      const meetingId = state.meetingId;
      state = {
        active: false,
        meetingId: null,
        startedAt: null,
      };
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
