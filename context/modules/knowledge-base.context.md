# Knowledge Base Module

## What It Is

A Notion-like hierarchical document system that lets tenants create, organize, and search
rich-text documents. Documents can be nested (parent/child), reordered by position, and
searched by title using full-text ilike queries.

## Key Database Tables

- **documents** — stores the document tree: `id`, `tenant_id`, `parent_id` (self-ref),
  `title`, `content_json` (JSONB, stores ProseMirror/BlockNote JSON), `position` (integer
  for ordering siblings), `created_by`, `updated_by`, `created_at`, `updated_at`.
- **document_embeddings** — stores vector chunks for semantic search: `document_id`,
  `chunk_text`, `embedding` (pgvector 1536-dim), `chunk_index`. Populated by AI worker
  in a later phase.

## tRPC Router: `appRouter.knowledge.*`

Defined in `packages/api/src/routers/knowledge.ts`.

| Procedure | Type     | Auth                                   | Description                                   |
| --------- | -------- | -------------------------------------- | --------------------------------------------- |
| `list`    | query    | protectedProcedure (tenantId required) | List root or child documents                  |
| `get`     | query    | protectedProcedure (tenantId required) | Get single doc with content                   |
| `create`  | mutation | memberProcedure                        | Create a new document                         |
| `update`  | mutation | memberProcedure                        | Update title / contentJson / position         |
| `delete`  | mutation | memberProcedure                        | Delete document (DB cascade removes children) |
| `reorder` | mutation | memberProcedure                        | Batch-update sibling positions                |
| `search`  | query    | protectedProcedure (tenantId required) | ilike title search                            |

Mutations emit `document.created` or `document.updated` events via `EventBus`.

## Validators: `packages/shared/src/validators/knowledge.ts`

- `createDocumentSchema` — `{ title, parentId?, position? }`
- `updateDocumentSchema` — `{ id, title?, contentJson?, position? }`
- `reorderDocumentsSchema` — `{ updates: Array<{ id, position }> }`

## Real-Time Sync (future phase)

Collaborative editing will be layered on top using **Yjs CRDTs** via `packages/sync`.
The `contentJson` field acts as the persistence target; the sync layer will hydrate and
flush Y.Doc state to/from this field. Implementation is deferred to the sync phase.
