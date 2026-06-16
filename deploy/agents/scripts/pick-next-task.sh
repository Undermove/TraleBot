#!/bin/bash
set -euo pipefail

# Shared claim-label helpers (stale `agent:running` reclaim). Sourced from the
# script's own dir so host bind-mount edits apply without an image rebuild.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
# shellcheck source=claim-utils.sh
source "${SCRIPT_DIR}/claim-utils.sh"

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
#   1. Epics to build come from two sources: the active sprint plan (first
#      open `sprint-plan`, `auto-approved` preferred) AND every epic in the
#      game's "Doing" column (label `epic:doing`). A sprint plan is NOT
#      required — epics kicked off from Dev Tycoon build on their own. If
#      neither source yields an epic → exit empty.
#   2. Epic order = sprint-plan body order (`## Эпик #N` headings) first, then
#      Doing epics not already listed. De-duplicated, order-preserving.
#   3. A task belongs to an epic when it carries the `epic-<EPIC>` LABEL (set
#      by both the nightly breakdown and the kickoff) or, as a fallback, its
#      title starts `epic-<EPIC>:`. Sorted ascending by issue number — backend
#      (lower number, created first) before frontend, then content, then tests.
#   4. A task is eligible when it has label `qa-prepared` AND lacks all of
#      `done` (already shipped tonight), `dev-stuck` (a previous dev iteration
#      hit max-turns; needs human triage, skip), and `agent:running` (another
#      agent has already claimed it — don't double-build the same task). The
#      dev loop sets `agent:running` while working and clears it on return. A
#      claim left stale by a HARD-KILLED run (OOM / container stop / reboot —
#      the EXIT trap never fired) is reclaimed automatically below once it is
#      older than STALE_CLAIM_MINUTES, so a crash mid-build self-heals on the
#      next pass instead of stalling the epic until a human intervenes.
#   5. The script returns the first eligible task across all epics in
#      order. If nothing matches → exit empty.

# Epics to build come from two sources, plan first:
#   1. The active sprint plan's `## Эпик #N` headings (the nightly flow).
#   2. Epics in the game's "Doing" column (label `epic:doing`) — these are
#      kicked off from Dev Tycoon and may have NO sprint plan at all.
# Either source alone is enough; a sprint plan is no longer required, so epics
# moved to Doing in the game get built even without a published plan.
PLAN_EPICS=""
SPRINT=$(gh issue list --label sprint-plan --label auto-approved --state open --limit 1 --json number --jq '.[0].number // empty' 2>/dev/null)
if [ -z "${SPRINT}" ]; then
    SPRINT=$(gh issue list --label sprint-plan --state open --limit 1 --json number --jq '.[0].number // empty' 2>/dev/null)
fi
if [ -n "${SPRINT}" ]; then
    # Declared order from the body. Patterns: `## Эпик #NNN` / `## Epic #NNN`.
    PLAN_EPICS=$(gh issue view "${SPRINT}" --json body --jq '.body' 2>/dev/null \
            | grep -oiE '##[[:space:]]+(Эпик|Epic)[[:space:]]+#[0-9]+' \
            | grep -oE '[0-9]+')
fi
DOING_EPICS=$(gh issue list --label epic --label "epic:doing" --state open --limit 50 \
             --json number --jq '.[].number' 2>/dev/null)

# Plan epics (priority order) then Doing epics, de-duplicated, order-preserving.
EPICS=$(printf '%s\n%s\n' "${PLAN_EPICS}" "${DOING_EPICS}" | awk 'NF && !seen[$0]++')

[ -z "${EPICS}" ] && exit 0

# Pre-fetch all open task issues once (cheaper than per-epic queries).
ALL_TASKS_JSON=$(gh issue list --label task --state open --limit 200 --json number,title,labels 2>/dev/null)

# Self-heal dead claims before selecting. Any open task still wearing
# `agent:running` from a run that was hard-killed (so its EXIT trap never
# cleared the label) would otherwise be skipped forever. Reclaim the stale
# ones, then re-fetch so the eligibility filter below sees the cleared labels.
RUNNING_NUMS=$(echo "${ALL_TASKS_JSON}" \
    | jq -r '.[] | select((.labels // []) | map(.name) | contains(["agent:running"])) | .number' 2>/dev/null)
RECLAIMED_ANY=0
for N in ${RUNNING_NUMS}; do
    if reclaim_if_stale "${N}"; then
        echo "pick-next-task: reclaimed stale ${RUNNING_LABEL} on #${N}" >&2
        RECLAIMED_ANY=1
    fi
done
if [ "${RECLAIMED_ANY}" -eq 1 ]; then
    ALL_TASKS_JSON=$(gh issue list --label task --state open --limit 200 --json number,title,labels 2>/dev/null)
fi

for EPIC in ${EPICS}; do
    # Filter to tasks under this epic, sort ascending, drop done/dev-stuck/non-qa-prepared.
    # Associate a task with its epic by the `epic-<N>` LABEL — both the nightly
    # breakdown and the Dev Tycoon epic-kickoff set it reliably. The old title
    # convention (`epic-<N>: …`) is kept as a fallback; the kickoff path titles
    # tasks `[epic-<N>] …`, which the label match covers.
    PICK=$(echo "${ALL_TASKS_JSON}" | jq -r --arg epic "${EPIC}" '
        [.[] | select(
            ((.labels // []) | map(.name) | contains(["epic-" + $epic]))
            or (.title | startswith("epic-" + $epic + ":"))
        )]
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
