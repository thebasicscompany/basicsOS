# Attention Feed (Deferred)

## Concept

A "What needs my attention" feed that replaces the static dashboard:
- Overdue tasks assigned to you
- Meetings starting in the next hour
- CRM deals that haven't been updated in 7+ days
- New documents shared with you
- AI employee outputs awaiting approval

## Implementation Notes

- New `dashboard.feed` tRPC endpoint that aggregates from all modules
- Prioritized by urgency (overdue > upcoming > stale > new)
- Could be a sidebar tab in the icon rail or the default dashboard view
- Each feed item links to the relevant module detail page

## Status

Deferred from Desktop UX Overhaul. Implement as the default dashboard experience.
