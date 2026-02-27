---
name: debug-loop
description: Recursive hypothesis-driven debugging loop with tagged diagnostic logs
---

# Debug Loop

A systematic, iterative debugging methodology that generates falsifiable hypotheses, instruments code with tagged diagnostic logs, and loops until the root cause is confirmed and fixed.

## Invocation

```
/debug-loop <symptom description>
```

Or resume a previous iteration:

```
/debug-loop --resume
```

## The Loop

### Phase 0 — Capture

Gather the problem definition:

- **Symptom**: What is happening? (observable behavior)
- **Expected**: What should happen?
- **Trigger**: How to reproduce (exact steps)
- **Environment**: OS, runtime versions, hardware, relevant config
- **Key facts**: Any prior investigation results, logs, or clues

Output a structured problem statement.

### Phase 1 — Hypothesize

Generate **3–6 ranked, falsifiable hypotheses**. Each hypothesis must include:

```
H{N} [{PRIORITY}]  {One-line description}
                    {Why this could be the cause}
                    Test: {What to log/measure}
                    Confirm: {What log output confirms this hypothesis}
                    Deny: {What log output eliminates this hypothesis}
```

Priority levels: `HIGH`, `MED`, `LOW`.

Rank by:
1. Likelihood given the evidence
2. Ease of testing (prefer cheaply falsifiable hypotheses)
3. Blast radius if confirmed

### Phase 2 — Instrument

1. **Remove all previous `[DEBUG-LOOP]` tags** from the codebase:
   ```bash
   grep -rn "\[DEBUG-LOOP\]" apps/ packages/ --include="*.ts" --include="*.tsx"
   ```
   If any are found, remove them first. Each iteration starts clean.

2. **Add targeted diagnostic logs** tagged `[DEBUG-LOOP][H{N}]`:
   - Each log line is prefixed with `[DEBUG-LOOP][H{N}]` where N matches the hypothesis number
   - Logs must produce data that can **confirm or deny** the hypothesis
   - Place logs at the exact code path the hypothesis targets
   - Keep logs minimal — measure, don't spam
   - Use existing logging utilities (e.g., `rlog()`, `console.log()`, `log()`) — don't add new dependencies

3. **Document placement** — list each file, line, and what the log measures.

### Phase 3 — Restart

Restart only the affected services/processes. Don't restart things that don't need it.

- If only renderer code changed → restart desktop app
- If only API code changed → restart API server
- If main process code changed → restart desktop app
- If web code changed → restart web dev server

### Phase 4 — Monitor

1. Tell the user exactly how to reproduce the issue
2. Tell them what to look for: `grep "[DEBUG-LOOP]"` in the relevant log output
3. Wait for the user to reproduce and share the log output
4. Read the logs carefully — extract the data points for each hypothesis

### Phase 5 — Analyze

For each hypothesis, assign a verdict:

```
H{N}: {CONFIRMED | ELIMINATED | INCONCLUSIVE}
      Evidence: {exact log lines that support the verdict}
      Conclusion: {what this means}
```

- **CONFIRMED**: Log data matches the "Confirm" condition → this is (part of) the root cause
- **ELIMINATED**: Log data matches the "Deny" condition → this is not the cause
- **INCONCLUSIVE**: Log data doesn't clearly match either → need better instrumentation

### Phase 6 — Fix or Loop

**If a hypothesis is CONFIRMED:**
1. Remove all `[DEBUG-LOOP]` tags from the codebase
2. Implement the fix
3. Restart affected services
4. Ask user to reproduce — verify the fix works
5. If fix works → proceed to Phase 7
6. If fix doesn't fully work → generate new hypotheses informed by what we learned, return to Phase 1

**If all hypotheses are ELIMINATED or INCONCLUSIVE:**
1. Remove all `[DEBUG-LOOP]` tags
2. Document what was learned (narrowed search space)
3. Generate new hypotheses informed by the eliminated ones
4. Return to Phase 1 for the next iteration

### Phase 7 — Cleanup

Final verification:

```bash
grep -rn "\[DEBUG-LOOP\]" apps/ packages/ --include="*.ts" --include="*.tsx"
```

Must return **zero results**. If any tags remain, remove them.

Summarize:
- Root cause found
- Fix applied
- What was learned
- Total iterations required

## Conventions

| Convention | Detail |
|---|---|
| **Tag format** | `[DEBUG-LOOP][H{N}]` — always this exact format |
| **Clean starts** | Every iteration removes ALL previous tags before adding new ones |
| **Hypothesis numbering** | Continues across iterations (iteration 2 starts at H6 if iteration 1 had H1–H5) |
| **Grep-friendly** | All tags are greppable with `\[DEBUG-LOOP\]` |
| **No tag residue** | Zero `[DEBUG-LOOP]` tags in committed code. Ever. |
| **Falsifiable only** | Every hypothesis must have clear confirm/deny conditions |
| **Minimal instrumentation** | Log only what's needed to verdict each hypothesis |

## Anti-Patterns

- **Don't** add logs without a hypothesis they test
- **Don't** leave tags in code after fixing
- **Don't** skip the analysis phase — verdict every hypothesis
- **Don't** keep hypotheses that can't be tested with logs
- **Don't** restart services that weren't changed
- **Don't** mix fix code with diagnostic code — instrument first, fix after confirmation
