#!/bin/bash
set -euo pipefail

# pick-next-task.sh — deterministic task picker for the dev loop.
#
# Walks the active sprint plan's epics in declared order and returns the
# next task issue that should be implemented. Replaces the prior phase_dev
# behaviour of «first qa-prepared open task gh returns», which routinely
# picked stale tasks ahead of priority epics and ignored intra-epic
# dependencies (e.g. starting Tests before Frontend exists).
#
# Output: one line — "<issue-number>\t<title>" for the chosen task. Empty
# stdout (and exit 0) means «no eligible task; dev loop should stop».
#
# Selection rules, in order:
#   1. The active sprint plan is the first issue with label `sprint-plan`,
#      `auto-approved` if any exists; otherwise the first open `sprint-plan`.
#      If neither exists → exit empty.
#   2. Epic order = the order they appear in the sprint plan body (parsed
#      from `## Эпик #N` headings). The publish-plan phase writes one such
#      heading per included epic.
#   3. Within an epic, tasks are open issues whose title starts
#      `epic-<EPIC>:`. Sorted ascending by issue number — backend (lower
#      number, created first by breakdown) comes before frontend, then
#      content, then tests. This is the convention breakdown emits.
#   4. A task is eligible when it has label `qa-prepared` AND lacks all of
#      `done` (already shipped tonight), `dev-stuck` (a previous dev iteration
#      hit max-turns; needs human triage, skip), and `agent:running` (another
#      agent has already claimed it — don't double-build the same task). The
#      dev loop sets `agent:running` while working and clears it on return; a
#      claim left stale by a killed run needs the label removed by hand, same
#      as `dev-stuck`.
#   5. The script returns the first eligible task across all epics in
#      order. If nothing matches → exit empty.

SPRINT=$(gh issue list --label sprint-plan --label auto-approved --state open --limit 1 --json number --jq '.[0].number // empty' 2>/dev/null)
if [ -z "${SPRINT}" ]; then
    SPRINT=$(gh issue list --label sprint-plan --state open --limit 1 --json number --jq '.[0].number // empty' 2>/dev/null)
fi
[ -z "${SPRINT}" ] && exit 0

# Extract epic numbers from the body in declared order. Patterns supported:
#   `## Эпик #NNN: …`  (the publish-plan template)
#   `## Epic #NNN: …`  (English fallback)
EPICS=$(gh issue view "${SPRINT}" --json body --jq '.body' 2>/dev/null \
        | grep -oiE '##[[:space:]]+(Эпик|Epic)[[:space:]]+#[0-9]+' \
        | grep -oE '[0-9]+')

[ -z "${EPICS}" ] && exit 0

# Pre-fetch all open task issues once (cheaper than per-epic queries).
ALL_TASKS_JSON=$(gh issue list --label task --state open --limit 200 --json number,title,labels 2>/dev/null)

for EPIC in ${EPICS}; do
    # Filter to tasks under this epic, sort ascending, drop done/dev-stuck/non-qa-prepared.
    PICK=$(echo "${ALL_TASKS_JSON}" | jq -r --arg epic "${EPIC}" '
        [.[] | select(.title | startswith("epic-" + $epic + ":"))]
        | sort_by(.number)
        | .[]
        | select((.labels // []) | map(.name) | contains(["qa-prepared"]))
        | select((.labels // []) | map(.name) | contains(["done"]) | not)
        | select((.labels // []) | map(.name) | contains(["dev-stuck"]) | not)
        | select((.labels // []) | map(.name) | contains(["agent:running"]) | not)
        | "\(.number)\t\(.title)"
    ' 2>/dev/null | head -1)
    if [ -n "${PICK}" ]; then
        echo "${PICK}"
        exit 0
    fi
done

# Nothing left in priority chain.
exit 0
