export interface MockCall {
  id: string;
  title: string;
  participants: { name: string; email: string }[];
  date: string;
  duration: number; // minutes
  summary: string;
  actionItems: string[];
  type: "call" | "meeting" | "video";
}

/**
 * Returns calls for a record. Replace with useCalls(objectSlug, recordId)
 * when call logging or calendar sync is implemented.
 */
export function getMockCalls(_recordId: number): MockCall[] {
  return [];
}
