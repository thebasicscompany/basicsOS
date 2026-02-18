#!/bin/bash
# Skill activation hook — runs on every user prompt
# Matches prompt keywords to skills and injects activation hints
# This lifts skill auto-activation from ~20% to ~80%

PROMPT="$CLAUDE_USER_PROMPT"

HINTS=""

# Architecture skill triggers
if echo "$PROMPT" | grep -qiE "architect|structure|organize|module|component|where.*(put|place|create)|design pattern|refactor"; then
  HINTS="$HINTS\nMANDATORY: Load the 'architecture' skill for this task."
fi

# Testing skill triggers
if echo "$PROMPT" | grep -qiE "test|spec|coverage|mock|assert|TDD|jest|vitest"; then
  HINTS="$HINTS\nMANDATORY: Load the 'testing-patterns' skill for this task."
fi

# Worktree skill triggers
if echo "$PROMPT" | grep -qiE "worktree|branch|feature|parallel|merge|rebase"; then
  HINTS="$HINTS\nMANDATORY: Load the 'worktree' skill for this task."
fi

# Security triggers → use security-auditor agent
if echo "$PROMPT" | grep -qiE "security|audit|vulnerab|OWASP|injection|XSS|CSRF|auth.*(check|review)"; then
  HINTS="$HINTS\nCRITICAL: Use the 'security-auditor' agent for this task."
fi

# Debug triggers → use debugger agent
if echo "$PROMPT" | grep -qiE "bug|error|fail|broke|crash|exception|stack.?trace|debug|not working|unexpected"; then
  HINTS="$HINTS\nMANDATORY: Use the 'debugger' agent for this task."
fi

if [ -n "$HINTS" ]; then
  echo -e "$HINTS"
fi
