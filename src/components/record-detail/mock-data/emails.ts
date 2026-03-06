export interface MockEmail {
  id: string;
  subject: string;
  from: { name: string; email: string };
  to: { name: string; email: string }[];
  date: string;
  snippet: string;
  body: string;
  threadId: string;
  isRead: boolean;
}

/**
 * Returns emails for a record. Replace with useEmails(objectSlug, recordId)
 * when record-level email sync (e.g. from Gmail) is implemented.
 */
export function getMockEmails(_recordId: number): MockEmail[] {
  return [];
}
