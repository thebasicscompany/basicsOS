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

const CALL_TEMPLATES: MockCall[] = [
  {
    id: "call-1",
    title: "Partnership kickoff call",
    participants: [
      { name: "Sarah Chen", email: "sarah.chen@acme.co" },
      { name: "You", email: "me@company.com" },
      { name: "Alex Rivera", email: "alex@company.com" },
    ],
    date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    duration: 45,
    summary: `Discussed the scope of the partnership and agreed on initial milestones. Sarah's team will handle the API integration on their end while we provide SDK documentation and sandbox access.

Key decisions:
- Start with a 3-month pilot program
- Weekly sync calls every Tuesday at 10am
- Shared Slack channel for async communication`,
    actionItems: [
      "Send SDK documentation and API keys",
      "Set up shared Slack channel",
      "Draft pilot program agreement",
      "Schedule weekly sync recurring invite",
    ],
    type: "video",
  },
  {
    id: "call-2",
    title: "Quick check-in: Integration status",
    participants: [
      { name: "Sarah Chen", email: "sarah.chen@acme.co" },
      { name: "You", email: "me@company.com" },
    ],
    date: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
    duration: 15,
    summary: `Brief status update on the integration progress. Their engineering team has completed the authentication flow and is now working on data sync. No blockers currently.`,
    actionItems: [
      "Share rate limit documentation",
      "Review their webhook implementation",
    ],
    type: "call",
  },
  {
    id: "call-3",
    title: "Quarterly business review",
    participants: [
      { name: "Sarah Chen", email: "sarah.chen@acme.co" },
      { name: "Michael Torres", email: "michael@acme.co" },
      { name: "You", email: "me@company.com" },
      { name: "Jordan Kim", email: "jordan@company.com" },
    ],
    date: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
    duration: 60,
    summary: `Comprehensive review of the partnership metrics for Q4. Usage has grown 40% MoM. Discussed expansion opportunities including their European market rollout.

Revenue impact: $45K ARR from the integration, with projected growth to $120K by Q2.`,
    actionItems: [
      "Prepare European compliance documentation",
      "Send updated pricing proposal for higher tier",
      "Schedule technical deep-dive for EU data residency",
      "Share case study draft for joint marketing",
    ],
    type: "meeting",
  },
  {
    id: "call-4",
    title: "Product demo - New features",
    participants: [
      { name: "Sarah Chen", email: "sarah.chen@acme.co" },
      { name: "You", email: "me@company.com" },
    ],
    date: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString(),
    duration: 30,
    summary: `Walked through the new dashboard and reporting features. Sarah was particularly interested in the real-time analytics and custom report builder.`,
    actionItems: [
      "Enable beta features in their account",
      "Send recording of the demo",
    ],
    type: "video",
  },
];

export function getMockCalls(recordId: number): MockCall[] {
  const offset = recordId % 2;
  return CALL_TEMPLATES.slice(offset, offset + 3).map((c, i) => ({
    ...c,
    id: `${c.id}-${recordId}`,
    date: new Date(
      Date.now() - (i * 5 + offset * 2 + 1) * 24 * 60 * 60 * 1000,
    ).toISOString(),
  }));
}
