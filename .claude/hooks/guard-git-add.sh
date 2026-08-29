#!/usr/bin/env bash
# PreToolUse(Bash) guard: block bulk `git add -A` / `git add .` / `--all`.
# It has twice swept junk into commits here (87MB of raw Meshy exports; a
# parallel session's WIP). Exit 2 blocks the tool call and shows stderr to Claude.
input=$(cat)
cmd=$(printf '%s' "$input" | python3 -c "import json,sys; print(json.load(sys.stdin).get('tool_input',{}).get('command',''))" 2>/dev/null)
if printf '%s' "$cmd" | grep -qE '(^|[;&|] *)git +add +(-A|--all|\.)([[:space:]]|$)'; then
  echo "Blocked: bulk 'git add' stages everything — it has swept junk/other work into commits here before. Stage explicit paths instead (git add path/to/file …). See CLAUDE.md." >&2
  exit 2
fi
exit 0
