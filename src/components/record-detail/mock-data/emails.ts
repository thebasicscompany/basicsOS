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

const EMAIL_TEMPLATES: MockEmail[] = [
  {
    id: "em-1",
    subject: "Re: Partnership proposal",
    from: { name: "Sarah Chen", email: "sarah.chen@acme.co" },
    to: [{ name: "You", email: "me@company.com" }],
    date: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    snippet:
      "Thanks for sending over the proposal. I've reviewed it with our team and we'd like to schedule a call...",
    body: `Thanks for sending over the proposal. I've reviewed it with our team and we'd like to schedule a call to discuss the next steps.

A few points we'd like to cover:
- Timeline for the integration
- Pricing tiers and volume discounts
- Support SLA expectations

Would Thursday at 2pm work for a 30-minute call?

Best,
Sarah`,
    threadId: "th-1",
    isRead: true,
  },
  {
    id: "em-2",
    subject: "Meeting notes - Q1 planning",
    from: { name: "You", email: "me@company.com" },
    to: [{ name: "Sarah Chen", email: "sarah.chen@acme.co" }],
    date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    snippet:
      "Hi Sarah, here are the notes from our Q1 planning session. Key takeaways...",
    body: `Hi Sarah,

Here are the notes from our Q1 planning session. Key takeaways:

1. **Product roadmap** - We'll focus on the API integration first, targeting end of March
2. **Budget** - $50K allocated for the first phase
3. **Team** - Alex and Jordan will be the primary points of contact

Let me know if I missed anything.

Best regards`,
    threadId: "th-2",
    isRead: true,
  },
  {
    id: "em-3",
    subject: "Invoice #4521 - Payment confirmation",
    from: { name: "Billing", email: "billing@acme.co" },
    to: [{ name: "You", email: "me@company.com" }],
    date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    snippet:
      "Payment of $12,500 for invoice #4521 has been processed successfully.",
    body: `Payment of $12,500 for invoice #4521 has been processed successfully.

**Invoice details:**
- Invoice #: 4521
- Amount: $12,500.00
- Payment method: Wire transfer
- Reference: PAY-2024-4521

The payment will appear in your account within 2-3 business days.

Thank you for your business.`,
    threadId: "th-3",
    isRead: true,
  },
  {
    id: "em-4",
    subject: "Follow-up: Product demo feedback",
    from: { name: "Sarah Chen", email: "sarah.chen@acme.co" },
    to: [{ name: "You", email: "me@company.com" }],
    date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    snippet:
      "The team really enjoyed the demo yesterday. A couple of questions came up...",
    body: `The team really enjoyed the demo yesterday. A couple of questions came up that I wanted to relay:

1. Does the platform support SSO via SAML?
2. What's the data retention policy?
3. Can we get a sandbox environment for testing?

Also, our VP of Engineering would like to join the next call if possible.

Thanks!
Sarah`,
    threadId: "th-4",
    isRead: false,
  },
  {
    id: "em-5",
    subject: "Contract draft for review",
    from: { name: "You", email: "me@company.com" },
    to: [
      { name: "Sarah Chen", email: "sarah.chen@acme.co" },
      { name: "Legal Team", email: "legal@acme.co" },
    ],
    date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    snippet:
      "Please find attached the draft contract for the annual subscription...",
    body: `Please find attached the draft contract for the annual subscription plan.

Key terms:
- 12-month commitment starting April 1
- Monthly billing of $4,166.67
- 99.9% uptime SLA
- 30-day termination notice period

Please review and let us know if you have any questions or redlines.

Best regards`,
    threadId: "th-5",
    isRead: true,
  },
];

/**
 * Returns deterministic mock emails based on recordId.
 * Different records get slightly different subsets.
 */
export function getMockEmails(recordId: number): MockEmail[] {
  const offset = recordId % 3;
  return EMAIL_TEMPLATES.slice(offset, offset + 4).map((e, i) => ({
    ...e,
    id: `${e.id}-${recordId}`,
    date: new Date(
      Date.now() - (i * 2 + offset) * 24 * 60 * 60 * 1000,
    ).toISOString(),
  }));
}
