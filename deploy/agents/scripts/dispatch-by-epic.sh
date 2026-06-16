#!/bin/bash
set -e

# dispatch-by-epic.sh — on-demand epic kickoff
#
# Sequential 4-agent run scoped to ONE epic. Mirrors the workflow the
# owner described:
#   product → designer → methodist → tech-lead
#
# - product:    refines BDD acceptance criteria, edits the epic body
# - designer:   if the epic touches UI, drops a design-spec under
#               design-specs/epic-<N>/ and comments on the epic;
#               otherwise leaves a short "no design needed" comment
# - methodist:  pedagogy check on the epic (comments only)
# - tech-lead:  decomposes the epic into child task issues, each with
#               labels: task, stage:spec, epic-<N>
#
# The nightly run-pipeline.sh phases are untouched. This script is the
# kickoff path triggered from the Dev Tycoon UI when the owner moves an
# epic into Doing (or hits "▶ перезапустить" on the epic detail).
#
# Args:
#   $1 — GitHub issue number of the epic
#
# Idempotency: skip if the epic already has a LIVE `agent:running` claim.
# Label is set at the start and cleared in the EXIT trap; a claim stranded by
# a hard-killed run is auto-reclaimed once stale (see claim-utils.sh).

[ -f /etc/environment ] && source /etc/environment

# Shared claim-label helpers (stale `agent:running` reclaim).
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
source "${SCRIPT_DIR}/claim-utils.sh"

EPIC_NUM="$1"
if [[ -z "$EPIC_NUM" ]]; then
    echo "Usage: dispatch-by-epic.sh <epic_number>"
    exit 1
fi

# Per-role model routing. In this kickoff flow only tech-lead (epic breakdown)
# runs heavy/Opus; product / designer / methodist are light/Sonnet planning
# text. Shared with the pipeline via model-utils.sh; override via PIPELINE_MODEL_*.
source "${SCRIPT_DIR}/model-utils.sh"

TIMESTAMP=$(date '+%Y-%m-%d_%H-%M-%S')
LOG_FILE="/logs/dispatch_epic_${EPIC_NUM}_${TIMESTAMP}.log"
REPO_DIR="${REPO_DIR:-/workspace/repo}"
RUNNING_LABEL="agent:running"
BRANCH="claude/epic-${EPIC_NUM}-kickoff-$(date '+%Y%m%d-%H%M')"

mkdir -p /logs

exec > >(tee "$LOG_FILE") 2>&1

echo "============================================"
echo "  Epic dispatch · #${EPIC_NUM}"
echo "  Branch: ${BRANCH}"
echo "  Started: $(date)"
echo "============================================"

# gh resolves the target GitHub repo from the git remote of the current
# directory, so we must be inside the repo before any gh call below (the
# branch is still created later, after the idempotency checks).
cd "$REPO_DIR" || {
    echo "Repo dir not found: ${REPO_DIR}"
    exit 1
}

# 1. Fetch epic.
EPIC_JSON=$(gh issue view "$EPIC_NUM" --json title,body,labels 2>&1) || {
    echo "Failed to fetch epic #${EPIC_NUM}: $EPIC_JSON"
    exit 1
}
TITLE=$(echo "$EPIC_JSON" | jq -r '.title')
BODY=$(echo "$EPIC_JSON" | jq -r '.body // ""')
LABELS=$(echo "$EPIC_JSON" | jq -r '.labels[].name')

# Sanity check: must be an epic.
if ! echo "$LABELS" | grep -qx "epic"; then
    echo "Issue #${EPIC_NUM} is missing the 'epic' label — refusing to run."
    exit 1
fi

# 2. Idempotency. Live claim → another dispatch is in flight, skip. A claim
#    stranded by a hard-killed run (EXIT trap never fired) is reclaimed once
#    stale so the epic can be kicked off again instead of jamming forever.
if echo "$LABELS" | grep -qx "$RUNNING_LABEL"; then
    if reclaim_if_stale "$EPIC_NUM"; then
        echo "Epic #${EPIC_NUM} had a STALE '${RUNNING_LABEL}' claim — reclaimed it, continuing."
    else
        echo "Epic #${EPIC_NUM} already has '${RUNNING_LABEL}' — another dispatch in flight. Skipping."
        exit 0
    fi
fi

gh label create "$RUNNING_LABEL" --color "fbca04" --description "An agent is actively working on this issue right now" 2>/dev/null || true
gh issue edit "$EPIC_NUM" --add-label "$RUNNING_LABEL" >/dev/null || true

cleanup() {
    gh issue edit "$EPIC_NUM" --remove-label "$RUNNING_LABEL" >/dev/null 2>&1 || true
    echo "Finished at: $(date)"
}
trap cleanup EXIT

# 3. Branch prep — agents may write design-specs/ or other files.
cd "$REPO_DIR"
git fetch origin --quiet || true
git checkout main
git pull --ff-only origin main || true
git checkout -b "$BRANCH"

# 4. Helper: run one agent on this epic.
#    Args: agent_name, stage_label, directive
run_agent() {
    local agent="$1"
    local stage_label="$2"
    local directive="$3"

    echo ""
    echo "--------------------------------------------"
    echo "  → ${agent} (${stage_label}, model=$(resolve_model "${agent}"))"
    echo "--------------------------------------------"

    local instruction
    instruction=$(cat <<EOF
Ты сейчас работаешь над одним конкретным эпиком в GitHub.

Эпик #${EPIC_NUM}: ${TITLE}

Описание эпика:
${BODY}

Стадия: ${stage_label}.
Твоя роль: ${agent}. Прочитай свою роль из .claude/agents/${agent}.md.

${directive}

Когда закончишь — выходи. Не пиши код приложения (это будет позже на доске разработки). Не открывай PR — обёртка сделает это в конце.

Не трогай чужие эпики. Только #${EPIC_NUM}.
EOF
)

    claude \
        $(agent_model_args "$agent") \
        -p "$instruction" \
        --dangerously-skip-permissions \
        --max-turns "${MAX_TURNS_PER_AGENT:-20}" \
        --output-format stream-json \
        --verbose \
        || echo "[warn] ${agent} exited non-zero (continuing to next agent)"
}

# 5. The sequence.
run_agent "product" "epic-spec · product" \
"Перечитай эпик и допиши недостающие BDD-критерии приёмки в формате Given/When/Then прямо в комментарии к эпику через gh issue comment. Если уже всё чётко — оставь короткий комментарий «BDD достаточно, перехожу к designer/methodist». Никаких файлов в репо для product не нужно."

run_agent "designer" "epic-spec · designer" \
"Если эпик трогает UI — сделай design-spec в design-specs/epic-${EPIC_NUM}/spec.md (компоненты, состояния loading/empty/error/success, переходы) и оставь короткий gh issue comment со ссылкой. Если UI не трогает — оставь gh issue comment «дизайн не требуется», файлы не создавай."

run_agent "methodist" "epic-spec · methodist" \
"Если эпик про обучение / контент / методику — оцени педагогическую сторону в gh issue comment (прогрессия, пререквизиты, где можно проседать). Если эпик чисто технический — gh issue comment «по моей части без замечаний»."

run_agent "tech-lead" "epic-breakdown · tech-lead" \
"Декомпозируй этот эпик на 2–6 task-issue, размером 1–4 часа каждая. Создай их через gh issue create. На каждой новой issue обязательно поставь метки: task, stage:spec, epic-${EPIC_NUM}, плюс приоритет с эпика если есть. В body каждой issue первой строкой укажи «parent: #${EPIC_NUM}» — это связывает их с эпиком в Dev Tycoon. В конце оставь один gh issue comment на сам эпик в формате: 'Декомпозировал на N задач: #X, #Y, #Z'. Никакого application-кода не пиши — это работа разработчика на доске."

# 6. If anything got written to files (design-specs/), commit + push.
if ! git diff --quiet || ! git diff --staged --quiet; then
    git add -A
    git commit -m "[epic-spec] kickoff for #${EPIC_NUM}: ${TITLE}" || true
fi

COMMITS_AHEAD=$(git log --oneline main..HEAD | wc -l | tr -d ' ')
if [[ "$COMMITS_AHEAD" -gt 0 ]]; then
    git push origin "$BRANCH"
    SHA=$(git rev-parse --short HEAD)
    SUMMARY=$(git log --pretty=format:'- %s' main..HEAD | head -8)
    gh issue comment "$EPIC_NUM" --body "$(cat <<EOF
🎮 **epic-kickoff** прогнан — product → designer → methodist → tech-lead.

Ветка: \`${BRANCH}\` · HEAD \`${SHA}\` · ${COMMITS_AHEAD} коммит(а).

\`\`\`
${SUMMARY}
\`\`\`

_(прислано из Dev Tycoon · dispatch-by-epic)_
EOF
)"
else
    gh issue comment "$EPIC_NUM" --body "🎮 **epic-kickoff** прогнан — product → designer → methodist → tech-lead. Файлов не создано (значит, эпик чисто рассуждательный или таски уже разложены). Лог: \`${LOG_FILE##*/}\`. _(Dev Tycoon)_" || true
fi

git checkout main
git branch -D "$BRANCH" 2>/dev/null || true

echo ""
echo "Epic dispatch finished cleanly."
