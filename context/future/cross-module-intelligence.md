# Cross-Module Intelligence (Deferred)

## Concept

A `RelatedItems` component that surfaces connections across modules automatically:
- When viewing a CRM contact, show related tasks, meetings, and knowledge docs
- When viewing a meeting summary, show linked CRM deals and follow-up tasks
- "How did it know?" moments — the system connects data the user didn't explicitly link

## Implementation Notes

- Uses pgvector semantic similarity + explicit foreign key relationships
- `RelatedItems` component queries a new `search.related` tRPC endpoint
- Sidebar or bottom section in detail views
- Requires embedding all module records (tasks, contacts, deals, docs, meetings)

## Status

Deferred from Desktop UX Overhaul. Implement after cross-module search is solid.
