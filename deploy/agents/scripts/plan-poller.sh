#!/bin/bash
set -euo pipefail

# plan-poller.sh — long-running daemon that polls the sprint-plan GitHub issue
# every 60 seconds. When a new user comment appears (i.e. one without the bot
# marker), it spawns a focused product-agent to respond in the issue thread.
#
# Lifecycle:
#   - Runs continuously in the background (started by entrypoint or cron @reboot).
#   - Does nothing when no sprint-plan issue is open.
#   - When the owner writes "поехали" / "lgtm" / "утверждаю" / "approve",
#     the agent closes the issue and the poller goes back to idle.
#
# Requirements: gh (authenticated), claude CLI, jq.

source /etc/environment 2>/dev/null || true

REPO_DIR="/workspace/repo"
POLL_INTERVAL=60
BOT_MARKER="<!-- sprint-plan-bot -->"
LOCK_FILE="/tmp/plan-poller.lock"
LOG_FILE="/logs/plan-poller.log"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" >> "${LOG_FILE}"; }

# Prevent concurrent agent runs — if a previous response is still in progress,
# skip this poll cycle.
acquire_lock() {
    if [ -f "${LOCK_FILE}" ]; then
        local lock_pid
        lock_pid=$(cat "${LOCK_FILE}" 2>/dev/null)
        if kill -0 "${lock_pid}" 2>/dev/null; then
            return 1  # agent still running
        fi
        rm -f "${LOCK_FILE}"  # stale lock
    fi
    echo $$ > "${LOCK_FILE}"
    return 0
}

release_lock() { rm -f "${LOCK_FILE}"; }

# Track last comment we responded to, so we don't double-trigger.
LAST_SEEN_COMMENT_ID=""

respond_to_comment() {
    local issue_number="$1"
    local comment_body="$2"
    local is_approval="$3"

    cd "${REPO_DIR}"
    git fetch origin --quiet
    git checkout main --quiet
    git reset --hard origin/main --quiet

    local today
    today=$(date '+%Y-%m-%d')
    local branch="agents/nightly-${today}"

    # Switch to nightly branch if it exists, otherwise stay on main.
    if git ls-remote --exit-code --heads origin "${branch}" > /dev/null 2>&1; then
        git checkout -B "${branch}" "origin/${branch}" --quiet
    fi

    local respond_prompt
    if [ "${is_approval}" = "true" ]; then
        respond_prompt="You are the product agent. The owner has APPROVED the sprint plan in issue #${issue_number}.

Read the full issue thread: gh issue view ${issue_number} --comments

Do the following:
1. Apply any adjustments the owner requested in the thread to ROADMAP.md (re-prioritize, add/remove items, change statuses).
2. Post a SHORT closing comment on the issue summarizing what you adjusted. End the comment body with the marker: ${BOT_MARKER}
3. Close the issue: gh issue close ${issue_number}

Commit any ROADMAP/STRATEGY changes with message 'product: apply sprint plan feedback from #${issue_number}'.
At the end output '=== SUMMARY ===' with 3-5 bullets."
    else
        respond_prompt="You are the product agent responding to owner feedback on the sprint plan.

Read the full issue thread: gh issue view ${issue_number} --comments

The owner just wrote a new comment. Read it carefully and respond:
- If they ask a question — answer it based on ROADMAP.md, STRATEGY.md, and open issues.
- If they request a change (re-prioritize, add, remove) — describe what you would change and ask for confirmation, OR apply small changes to ROADMAP.md directly and note what you did.
- Keep your response concise and actionable.
- Post your response as a comment on issue #${issue_number} using: gh issue comment ${issue_number} --body \"<your response>\"
- IMPORTANT: always end your comment body with this exact marker on its own line: ${BOT_MARKER}

Do NOT close the issue. Do NOT create new issues. Focus only on the conversation.
At the end output '=== SUMMARY ===' with 3-5 bullets."
    fi

    local log_dir="/logs/plan-respond_$(date '+%Y-%m-%d_%H-%M-%S')"
    mkdir -p "${log_dir}"

    log "Spawning product agent for issue #${issue_number} (approval=${is_approval})"

    # set +e for the duration of this block: claude can exit non-zero
    # (max_turns, network blip, transient API error) and we don't want a
    # single bad agent run to kill the poller daemon.
    set +e
    claude \
        -p "${respond_prompt}" \
        --dangerously-skip-permissions \
        --max-turns 30 \
        --output-format stream-json \
        --verbose \
        2>"${log_dir}/stderr.log" \
        | tee "${log_dir}/response.jsonl" \
        | jq -r 'select(.type=="assistant") | .message.content[]? | select(.type=="text") | .text // empty' 2>/dev/null \
        > "${log_dir}/response.log"
    local claude_exit=${PIPESTATUS[0]}
    set -e

    if [ "${claude_exit}" -ne 0 ]; then
        log "WARNING: claude exited ${claude_exit} for issue #${issue_number} — poller continues"
    fi

    # Push any ROADMAP changes.
    if ! git diff --quiet || ! git diff --staged --quiet; then
        git add -A
        git commit -m "[product] sprint-plan feedback $(date '+%H:%M')" 2>/dev/null || true
        git push origin HEAD 2>/dev/null || true
    fi

    log "Agent finished for issue #${issue_number}"
}

# ---------------------------------------------------------------------------
# Main loop
# ---------------------------------------------------------------------------
log "plan-poller started (pid=$$, interval=${POLL_INTERVAL}s)"

while true; do
    sleep "${POLL_INTERVAL}"

    cd "${REPO_DIR}" 2>/dev/null || continue

    # Find an open sprint-plan issue.
    ISSUE_NUMBER=$(gh issue list --label sprint-plan --state open \
        --json number --limit 1 -q '.[0].number' 2>/dev/null || true)

    if [ -z "${ISSUE_NUMBER}" ] || [ "${ISSUE_NUMBER}" = "null" ]; then
        continue  # no open plan — idle
    fi

    # Fetch last comment via API.
    LAST_COMMENT=$(gh api "repos/{owner}/{repo}/issues/${ISSUE_NUMBER}/comments" \
        --jq '.[-1]' 2>/dev/null || true)

    if [ -z "${LAST_COMMENT}" ] || [ "${LAST_COMMENT}" = "null" ]; then
        continue  # no comments yet
    fi

    COMMENT_ID=$(echo "${LAST_COMMENT}" | jq -r '.id')
    COMMENT_BODY=$(echo "${LAST_COMMENT}" | jq -r '.body')

    # Skip if we already handled this comment.
    if [ "${COMMENT_ID}" = "${LAST_SEEN_COMMENT_ID}" ]; then
        continue
    fi

    # Skip if this is a bot response (has our marker).
    if echo "${COMMENT_BODY}" | grep -qF "${BOT_MARKER}"; then
        LAST_SEEN_COMMENT_ID="${COMMENT_ID}"
        continue
    fi

    # New user comment detected!
    log "New comment #${COMMENT_ID} on issue #${ISSUE_NUMBER}"

    # Check for approval keywords.
    IS_APPROVAL="false"
    if echo "${COMMENT_BODY}" | grep -qiE '(утверждаю|поехали|lgtm|approve|одобряю|го$|го!)'; then
        IS_APPROVAL="true"
        log "Approval detected!"
    fi

    # Acquire lock — skip if agent is already running.
    if ! acquire_lock; then
        log "Agent already running, will retry next cycle"
        continue
    fi

    respond_to_comment "${ISSUE_NUMBER}" "${COMMENT_BODY}" "${IS_APPROVAL}"
    release_lock

    LAST_SEEN_COMMENT_ID="${COMMENT_ID}"
done
