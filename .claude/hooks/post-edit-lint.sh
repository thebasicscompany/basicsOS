#!/bin/bash
# Post-edit hook — runs after any file Write/Edit
# Auto-formats and type-checks modified files

FILE="$CLAUDE_FILE_PATH"

# Only process TypeScript/JavaScript files
if [[ "$FILE" =~ \.(ts|tsx|js|jsx)$ ]]; then
  # Auto-format if prettier is available
  if command -v npx &> /dev/null && [ -f "node_modules/.bin/prettier" ]; then
    npx prettier --write "$FILE" 2>/dev/null
  fi

  # Type-check if tsconfig exists
  if [ -f "tsconfig.json" ] && command -v npx &> /dev/null; then
    RESULT=$(npx tsc --noEmit 2>&1)
    if [ $? -ne 0 ]; then
      echo "TYPE ERROR in $FILE:"
      echo "$RESULT" | grep -A 2 "$FILE"
    fi
  fi
fi
