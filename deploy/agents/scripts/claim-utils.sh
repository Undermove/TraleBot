# claim-utils.sh — shared helpers for the `agent:running` claim label.
#
# A claim marks «an agent is actively building this issue right now». The
# dispatch wrapper (dispatch-by-stage.sh / the dev loop) adds the label at the
# start of a run and clears it from an EXIT trap. That trap covers a clean exit
# AND a normal non-zero exit — but it does NOT fire when the run is hard-killed:
# OOM (the container exited 137 on 2026-05-31), `docker stop`, or a host reboot.
# A killed run therefore leaves `agent:running` stuck, and every later picker
# pass skips the task forever — until a human removes the label by hand.
#
# These helpers let the picker and the dispatcher detect such dead claims by
# age and reclaim them automatically, so a crash mid-build self-heals on the
# next run instead of silently stalling the whole epic.
#
# Sourced — defines functions and (overridable) config, runs nothing on its own.

RUNNING_LABEL="${RUNNING_LABEL:-agent:running}"

# A claim older than this many minutes with no live run behind it is treated as
# dead. A single dispatch is capped at --max-turns 30, which tops out around a
# few tens of minutes even on Opus; 90 min is a safe ceiling that never reclaims
# a genuinely running agent. Override via env if dispatches ever run longer.
STALE_CLAIM_MINUTES="${STALE_CLAIM_MINUTES:-90}"

# _claims_repo → prints owner/name for the current repo, or empty.
# gh resolves the default repo from the cwd git remote (same as the bare
# `gh issue list` calls elsewhere); GH_REPO overrides it when set.
_claims_repo() {
    if [ -n "${GH_REPO:-}" ]; then
        echo "${GH_REPO}"
        return
    fi
    gh repo view --json nameWithOwner --jq .nameWithOwner 2>/dev/null || true
}

# claim_age_minutes <issue> → whole minutes since the CURRENT `agent:running`
# label was applied, or empty string if it can't be determined. Reads the
# issue's event log (`labeled` events, newest matching one wins). per_page=100
# pulls the whole history of a task issue in a single call (oldest-first), so
# the most recent claim is always present.
claim_age_minutes() {
    local issue="$1" repo ts then_epoch now_epoch
    repo="$(_claims_repo)"
    [ -z "${repo}" ] && { echo ""; return; }

    ts=$(gh api "repos/${repo}/issues/${issue}/events?per_page=100" 2>/dev/null \
        | jq -r --arg L "${RUNNING_LABEL}" \
            '[.[] | select(.event == "labeled" and .label.name == $L) | .created_at] | last // empty' \
            2>/dev/null)
    [ -z "${ts}" ] && { echo ""; return; }

    # Parse the ISO-8601 `created_at` to epoch seconds. GNU date (the Linux
    # container) handles `-d` directly; the BSD-date and python fallbacks keep
    # the helper usable on a macOS host for local testing.
    then_epoch=$(date -d "${ts}" +%s 2>/dev/null \
        || date -j -f "%Y-%m-%dT%H:%M:%SZ" "${ts}" +%s 2>/dev/null \
        || python3 -c 'import sys,calendar,time; print(calendar.timegm(time.strptime(sys.argv[1],"%Y-%m-%dT%H:%M:%SZ")))' "${ts}" 2>/dev/null)
    [ -z "${then_epoch}" ] && { echo ""; return; }
    now_epoch=$(date +%s)
    echo $(( (now_epoch - then_epoch) / 60 ))
}

# reclaim_if_stale <issue> → if the claim is older than STALE_CLAIM_MINUTES,
# remove `agent:running`, drop a breadcrumb comment, and return 0 (reclaimed).
# Returns 1 when the claim is still live OR its age can't be determined — in
# both cases we leave the label alone, erring toward never killing a real run.
reclaim_if_stale() {
    local issue="$1" age
    age="$(claim_age_minutes "${issue}")"
    [ -z "${age}" ] && return 1
    [ "${age}" -lt "${STALE_CLAIM_MINUTES}" ] && return 1

    # Body is a plain double-quoted string (no heredoc) so the file parses
    # cleanly under any bash; backticks are escaped to stay literal in markdown.
    local body
    body="♻️ **Авто-восстановление claim'а.** Лейбл \`${RUNNING_LABEL}\` висел ${age} мин (порог ${STALE_CLAIM_MINUTES} мин) без живого прогона — предыдущий агент, похоже, был убит (OOM / рестарт контейнера / ребут), и EXIT-trap не успел снять claim. Снимаю лейбл и возвращаю задачу в очередь на разработку.

_(Dev Tycoon · self-heal)_"
    gh issue edit "${issue}" --remove-label "${RUNNING_LABEL}" >/dev/null 2>&1 || true
    gh issue comment "${issue}" --body "${body}" >/dev/null 2>&1 || true
    return 0
}
