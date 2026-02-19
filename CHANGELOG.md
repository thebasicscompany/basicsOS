# Changelog

All notable changes to Basics OS will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added
- Knowledge base with real-time collaborative editing (Yjs CRDTs)
- CRM module with contacts, companies, and deals pipeline
- Task manager with priorities, labels, and assignments
- Meeting intelligence with transcription and AI summaries
- AI assistant powered by Anthropic/OpenAI with RAG
- Automation engine with event-driven triggers and BullMQ workers
- AI employees framework for autonomous task execution
- Hub dashboard with customizable company branding
- Dynamic module system for extending the platform
- Company MCP server for AI tool integration (Claude, ChatGPT)
- Engineer MCP server for Claude Code integration
- Multi-tenant isolation via PostgreSQL Row-Level Security
- Role-based access control (admin/member/viewer) via Better Auth
- Web portal (Next.js 15 App Router)
- Desktop app (Electron v33)
- Mobile app (Expo SDK 54)
- Semantic search across documents and meetings (pgvector)
- PII redaction middleware for log safety
- Automated security tests (RBAC audit, secrets scan, input validation, tenant isolation)
- CI pipeline with build, typecheck, unit tests, integration tests, and dependency audit
- One-command dev setup (`pnpm dev:setup`)
- Code generator for new modules (`pnpm gen:module`)
