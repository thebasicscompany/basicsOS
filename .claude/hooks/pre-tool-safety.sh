#!/bin/bash
# Pre-tool safety hook — blocks dangerous operations
# Returns non-zero exit code to block the tool call

COMMAND="$CLAUDE_BASH_COMMAND"

# Block destructive git operations
if echo "$COMMAND" | grep -qE "git\s+push\s+--force|git\s+push\s+-f\s"; then
  echo "BLOCKED: Force push is not allowed. Use regular push."
  exit 1
fi

if echo "$COMMAND" | grep -qE "git\s+reset\s+--hard"; then
  echo "BLOCKED: Hard reset is not allowed. Use git stash or create a new branch."
  exit 1
fi

if echo "$COMMAND" | grep -qE "git\s+clean\s+-f"; then
  echo "BLOCKED: git clean -f is not allowed. Review untracked files manually."
  exit 1
fi

# Block rm -rf on critical paths
if echo "$COMMAND" | grep -qE "rm\s+-rf\s+(/|~|\.\.|\.git|node_modules|src)"; then
  echo "BLOCKED: Destructive rm -rf on protected path."
  exit 1
fi

# Block direct commits to main (should use worktrees)
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null)
if [ "$CURRENT_BRANCH" = "main" ] && echo "$COMMAND" | grep -qE "git\s+commit"; then
  echo "BLOCKED: Do not commit directly to main. Use a worktree: git worktree add ~/worktrees/[feature] -b feature/[feature]"
  exit 1
fi

exit 0
