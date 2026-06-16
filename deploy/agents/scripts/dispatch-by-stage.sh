#!/bin/bash
set -e

# dispatch-by-stage.sh — on-demand, per-task agent dispatch
#
# Called from the Dev Tycoon UI when the owner moves a card on the dev
# board (or hits "Run agent" on the card). Runs a single agent session
# scoped to ONE GitHub issue, on its own short-lived branch.
#
# This is decoupled from the nightly run-pipeline.sh phases. It's meant
# for fast feedback ("I want this task moved forward NOW") rather than
# the batched discovery → review → breakdown flow.
#
# Args:
#   $1 — GitHub issue number (the task)
#   $2 — target stage: spec | dev | qa | review
#
# Stage → agent mapping mirrors lib/kanban.ts DEV_STAGE_LEAD in the
# tycoon repo. For "spec" we pick designer (the others — product,
# methodist — are still triggered by the nightly planning flow).
#
# Idempotency: if the issue already has the `agent:running` label we
# exit early. The label is set at the start and cleared at the end so
# rapid double-clicks don't spawn duplicate sessions.

[ -f /etc/environment ] && source /etc/environment

# Shared claim-label helpers (stale `agent:running` reclaim).
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
source "${SCRIPT_DIR}/claim-utils.sh"

ISSUE_NUM="$1"
STAGE="$2"

if [[ -z "$ISSUE_NUM" || -z "$STAGE" ]]; then
    echo "Usage: dispatch-by-stage.sh <issue_number> <stage>"
    echo "       stage = spec | dev | qa | review"
    exit 1
fi

case "$STAGE" in
    spec)   AGENT="designer" ;;
    dev)    AGENT="developer" ;;
    qa)     AGENT="qa" ;;
    review) AGENT="tech-lead" ;;
    *)
        echo "Unknown stage: $STAGE (expected: spec, dev, qa, review)"
        exit 1
        ;;
esac

# Per-role model routing (heavy=Opus for dev/review, light=Sonnet for spec/qa).
# Shared with the pipeline via model-utils.sh; override via PIPELINE_MODEL_*.
source "${SCRIPT_DIR}/model-utils.sh"

TIMESTAMP=$(date '+%Y-%m-%d_%H-%M-%S')
LOG_FILE="/logs/dispatch_${ISSUE_NUM}_${STAGE}_${TIMESTAMP}.log"
REPO_DIR="${REPO_DIR:-/workspace/repo}"
RUNNING_LABEL="agent:running"
BRANCH="claude/${AGENT}/task-${ISSUE_NUM}-$(date '+%Y%m%d-%H%M')"

mkdir -p /logs

exec > >(tee "$LOG_FILE") 2>&1

echo "============================================"
echo "  Dispatch · issue #${ISSUE_NUM} → ${STAGE} (${AGENT}, model=$(resolve_model "${AGENT}"))"
echo "  Branch: ${BRANCH}"
echo "  Started: $(date)"
echo "============================================"

# gh resolves the target GitHub repo from the git remote of the current
# directory, so we must be inside the repo before any gh call below (the work
# branch is still created later, after the idempotency check).
cd "$REPO_DIR" || {
    echo "Repo dir not found: ${REPO_DIR}"
    exit 1
}

# 1. Pull issue details (also implicitly checks issue exists / we have auth).
ISSUE_JSON=$(gh issue view "$ISSUE_NUM" --json title,body,labels 2>&1) || {
    echo "Failed to fetch issue #${ISSUE_NUM}: $ISSUE_JSON"
    exit 1
}
TITLE=$(echo "$ISSUE_JSON" | jq -r '.title')
BODY=$(echo "$ISSUE_JSON" | jq -r '.body // ""')
LABELS=$(echo "$ISSUE_JSON" | jq -r '.labels[].name')

# 2. Idempotency check. A live claim means another dispatch is in flight —
#    skip. But a claim left behind by a hard-killed run (EXIT trap never fired)
#    would block this task forever, so reclaim it if it's gone stale and carry
#    on instead of bailing.
if echo "$LABELS" | grep -qx "$RUNNING_LABEL"; then
    if reclaim_if_stale "$ISSUE_NUM"; then
        echo "Issue #${ISSUE_NUM} had a STALE '${RUNNING_LABEL}' claim — reclaimed it, continuing."
    else
        echo "Issue #${ISSUE_NUM} already has '${RUNNING_LABEL}' label — another dispatch is in flight. Skipping."
        exit 0
    fi
fi

# Ensure the running label exists in the repo (idempotent).
gh label create "$RUNNING_LABEL" --color "fbca04" --description "An agent is actively working on this issue right now" 2>/dev/null || true

# 3. Mark running.
gh issue edit "$ISSUE_NUM" --add-label "$RUNNING_LABEL" >/dev/null || true

# Always clear the running label on exit, even on failure.
cleanup() {
    gh issue edit "$ISSUE_NUM" --remove-label "$RUNNING_LABEL" >/dev/null 2>&1 || true
    echo "Finished at: $(date)"
}
trap cleanup EXIT

# 4. Prepare repo on a fresh branch off main.
cd "$REPO_DIR"
git fetch origin --quiet || true
git checkout main
git pull --ff-only origin main || true
git checkout -b "$BRANCH"

# 5. Stage-specific directive. Keep these short — the role file
#    (.claude/agents/<agent>.md) carries the persona and the heavy
#    workflow instructions. This just narrows the agent to THIS task.
case "$STAGE" in
    spec)
        DIRECTIVE="Это стадия СПЕКА для одной конкретной задачи. Прочитай свою роль из .claude/agents/${AGENT}.md и сделай design-spec под задачу #${ISSUE_NUM} в design-specs/. Если задача не дизайнерская — оставь короткий комментарий «дизайн не требуется» в design-specs/task-${ISSUE_NUM}.md. Не пиши код приложения. Закоммить design-specs/."
        ;;
    dev)
        DIRECTIVE="Это стадия РАЗРАБОТКА для одной конкретной задачи. Прочитай свою роль из .claude/agents/${AGENT}.md. Если есть design-specs/ под эту задачу — прочти. Делай TDD: красный → зелёный → рефактор. Запусти dotnet test (или нужный тестраннер) перед коммитом — зелёное обязательно. Закоммить код."
        ;;
    qa)
        DIRECTIVE="Это стадия QA для одной конкретной задачи. Прочитай свою роль из .claude/agents/${AGENT}.md. Прогони тесты которые добавил developer. Если что-то ломается — оставь комментарий на issue с тем что упало, и НЕ закрывай задачу. Можешь добавить недостающие интеграционные тесты. Закоммить тесты."
        ;;
    review)
        DIRECTIVE="Это стадия РЕВЬЮ для одной конкретной задачи. Прочитай свою роль из .claude/agents/${AGENT}.md (tech-lead). Посмотри что developer/qa накоммитили по issue #${ISSUE_NUM} (git log --oneline main..HEAD), оцени по стандартам репо. Можешь рефакторить аккуратно — только когда dotnet test зелёный до и после. Если код нужно вернуть — оставь комментарий на issue и НЕ закрывай."
        ;;
esac

# 6. Compose the full instruction.
INSTRUCTION=$(cat <<EOF
Ты сейчас работаешь над одной конкретной GitHub issue.

Задача #${ISSUE_NUM}: ${TITLE}

Описание:
${BODY}

${DIRECTIVE}

Когда закончишь:
- Закоммить свои изменения (упомяни #${ISSUE_NUM} в commit message — это связывает коммит с задачей в tycoon-дашборде).
- НЕ пушь сам, обёртка сделает это.
- НЕ создавай PR, обёртка комментирует issue с веткой.
- Если делать нечего по этой стадии — выходи без коммитов, я это пойму.

Не трогай чужие задачи. Только #${ISSUE_NUM}.
EOF
)

# 7. Run the agent.
claude \
    $(agent_model_args "$AGENT") \
    -p "$INSTRUCTION" \
    --dangerously-skip-permissions \
    --max-turns "${MAX_TURNS:-30}" \
    --output-format stream-json \
    --verbose \
    || {
        echo "claude exited non-zero"
        # Continue to push whatever was committed before the error.
    }

# 8. If the agent made uncommitted changes, commit them with a sentinel
#    message. Most agents will commit themselves, but cover the case.
if ! git diff --quiet || ! git diff --staged --quiet; then
    git add -A
    git commit -m "[${AGENT}] dispatch #${ISSUE_NUM} (stage: ${STAGE}, uncommitted leftovers)" || true
fi

# 9. Push only if we have commits not on main.
COMMITS_AHEAD=$(git log --oneline main..HEAD | wc -l | tr -d ' ')
if [[ "$COMMITS_AHEAD" -gt 0 ]]; then
    git push origin "$BRANCH"
    SHA=$(git rev-parse --short HEAD)
    SUMMARY=$(git log --pretty=format:'- %s' main..HEAD | head -8)
    gh issue comment "$ISSUE_NUM" --body "$(cat <<EOF
🎮 **${AGENT}** прогнал диспатч по стадии \`${STAGE}\` — ${COMMITS_AHEAD} коммит(а).

Ветка: \`${BRANCH}\`
HEAD: \`${SHA}\`

\`\`\`
${SUMMARY}
\`\`\`

_(прислано из Dev Tycoon · dispatch-by-stage)_
EOF
)"
else
    echo "No commits — agent decided nothing to do for this stage."
    # Optional: small breadcrumb so owner sees the agent ran but skipped.
    gh issue comment "$ISSUE_NUM" --body "ℹ️ **${AGENT}** прогнал диспатч по стадии \`${STAGE}\` — ничего нового делать не нашёл. Лог: \`${LOG_FILE##*/}\`. _(Dev Tycoon)_" || true
fi

# Return to main for the next caller.
git checkout main
git branch -D "$BRANCH" 2>/dev/null || true

echo ""
echo "Dispatch finished cleanly."
