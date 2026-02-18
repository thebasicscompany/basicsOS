---
name: architecture
description: Guide for code organization, design patterns, and architectural decisions in Basics OS.
---
# Architecture Guide

## When to Use This Skill
Invoke when making decisions about:
- Where to place new code
- Which design pattern to use
- How to structure new features
- How components should communicate

## Core Principles
1. **Separation of concerns** — each module has one responsibility
2. **Dependency inversion** — depend on abstractions, not concretions
3. **Composition over inheritance** — prefer composing small functions
4. **Explicit over implicit** — no magic, clear data flow

## File Organization
- Group by feature, not by type
- Co-locate tests with source files (`*.test.ts` next to `*.ts`)
- Shared utilities go in `/src/lib/`
- Types and interfaces go in `/src/types/`

## Decision Framework
- < 50 lines of logic → inline in the calling module
- 50-200 lines → extract to a utility in the same feature directory
- 200+ lines → create a new module with its own directory

For detailed patterns, see `resources/patterns.md`.
