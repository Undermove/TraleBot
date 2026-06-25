#!/bin/bash
set -e

# dispatch-epic-finish.sh — on-demand "finish this epic" flow
#
# Triggered from the Dev Tycoon "🚀 Доделать эпик" button. Drives ONE epic to a
# reviewable PR — it does NOT merge to main and does NOT close the epic; those
# stay the owner's call (merge the PR, then move the epic to Done in the game).
#
# Why this exists: the per-task dispatch (dispatch-by-stage.sh) starts off
# `main`, so a task whose partial work already lives on the shared nightly
# branch (e.g. a dev run that hit --max-turns mid-TDD) looks "nothing to do"
# and never finishes. This flow instead works ON the nightly branch, where that
# WIP is, finishes each unfinished child task there, and lands the lot as the
# daily PR with the same CI-gate the morning cron uses.
#
# Steps:
#   1. Resolve child tasks of the epic (label `epic-<N>`).
#   2. For each OPEN child not yet `done`: run a developer agent on the nightly
#      branch to finish impl + tests and mark the task `done` (or, if already
#      fully implemented on the branch, just verify + mark done).
#   3. Push the nightly branch, open/refresh the daily PR, CI-gate → ready.
#   4. Comment the epic with a status summary. Stop. (No merge, no epic close.)
#
# Args:
#   $1 — GitHub issue number of the epic

[ -f /etc/environment ] && source /etc/environment

# Shared helpers (stale-claim reclaim, model routing, PR open/CI-gate).
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
source "${SCRIPT_DIR}/claim-utils.sh"
source "${SCRIPT_DIR}/model-utils.sh"
source "${SCRIPT_DIR}/pr-utils.sh"

EPIC_NUM="$1"
if [[ -z "$EPIC_NUM" ]]; then
    echo "Usage: dispatch-epic-finish.sh <epic_number>"
    exit 1
fi

TODAY=$(date '+%Y-%m-%d')
TIMESTAMP=$(date '+%Y-%m-%d_%H-%M-%S')
LOG_FILE="/logs/epic_finish_${EPIC_NUM}_${TIMESTAMP}.log"
REPO_DIR="${REPO_DIR:-/workspace/repo}"
BRANCH="${BRANCH_OVERRIDE:-agents/nightly-${TODAY}}"
RUNNING_LABEL="agent:running"
# Finish-flow does whole-task TDD from scratch, so it must NOT silently inherit
# the cheap per-stage MAX_TURNS=30 cap (meant for small dispatch-by-stage steps).
# Decoupled with its own default; override per-run with MAX_TURNS_PER_TASK=…
MAX_TURNS_PER_TASK="${MAX_TURNS_PER_TASK:-120}"

mkdir -p /logs
exec > >(tee "$LOG_FILE") 2>&1

echo "============================================"
echo "  Epic finish · #${EPIC_NUM} → nightly branch ${BRANCH}"
echo "  Started: $(date)"
echo "  Turn budget per task: ${MAX_TURNS_PER_TASK} (max-turns)"
echo "============================================"

# gh resolves the repo from the cwd remote — be inside the repo for every call.
cd "$REPO_DIR" || { echo "Repo dir not found: ${REPO_DIR}"; exit 1; }

# 1. Fetch the epic + sanity-check it really is one.
EPIC_JSON=$(gh issue view "$EPIC_NUM" --json title,body,labels 2>&1) || {
    echo "Failed to fetch epic #${EPIC_NUM}: $EPIC_JSON"; exit 1
}
EPIC_TITLE=$(echo "$EPIC_JSON" | jq -r '.title')
EPIC_LABELS=$(echo "$EPIC_JSON" | jq -r '.labels[].name')
if ! echo "$EPIC_LABELS" | grep -qx "epic"; then
    echo "Issue #${EPIC_NUM} is missing the 'epic' label — refusing to run."; exit 1
fi

# 2. Idempotency on the epic claim (stale-claim aware, same as the dispatchers).
if echo "$EPIC_LABELS" | grep -qx "$RUNNING_LABEL"; then
    if reclaim_if_stale "$EPIC_NUM"; then
        echo "Epic #${EPIC_NUM} had a STALE claim — reclaimed it, continuing."
    else
        echo "Epic #${EPIC_NUM} already has '${RUNNING_LABEL}' — another run in flight. Skipping."
        exit 0
    fi
fi
gh label create "$RUNNING_LABEL" --color "fbca04" --description "An agent is actively working on this issue right now" 2>/dev/null || true
gh issue edit "$EPIC_NUM" --add-label "$RUNNING_LABEL" >/dev/null 2>&1 || true
cleanup() {
    gh issue edit "$EPIC_NUM" --remove-label "$RUNNING_LABEL" >/dev/null 2>&1 || true
    echo "Finished at: $(date)"
}
trap cleanup EXIT

# 2b. Reuse an already-open PR for THIS epic instead of spawning a fresh
#     agents/nightly-<today> branch every run. Without this, a finish run on a
#     new day opened a brand-new branch+PR while the previous epic's PR sat
#     unmerged — orphan duplicates (#980, #998) that never converged. We match
#     the finish-flow PR by its stable title ("Доделка эпика #<N> · …") and only
#     among agents/nightly-* heads, then continue on that same branch.
EPIC_OPEN_PR=$(gh pr list --state open --limit 50 --json number,headRefName,title 2>/dev/null \
    | jq -r --arg n "$EPIC_NUM" '
        [.[] | select((.headRefName | startswith("agents/nightly-"))
                      and (.title | test("эпика #" + $n + "([^0-9]|$)")))][0]
        | select(. != null) | "\(.number)\t\(.headRefName)"' 2>/dev/null || true)
EPIC_PR_NUMBER=$(printf '%s' "$EPIC_OPEN_PR" | cut -f1)
EPIC_PR_BRANCH=$(printf '%s' "$EPIC_OPEN_PR" | cut -f2)
if [ -n "$EPIC_PR_BRANCH" ]; then
    echo ">>> Reusing open PR #${EPIC_PR_NUMBER} for epic #${EPIC_NUM} on branch '${EPIC_PR_BRANCH}' (not opening a new nightly branch)."
    BRANCH="$EPIC_PR_BRANCH"
fi

# 3. Check out the shared nightly branch, seeded from its remote tip if present
#    (so earlier WIP is here) else freshly off main.
git fetch origin --quiet || true
if git rev-parse --verify --quiet "origin/${BRANCH}" >/dev/null; then
    git checkout -B "$BRANCH" "origin/${BRANCH}"
else
    git checkout -B "$BRANCH" "origin/main"
fi

# 4. Resolve OPEN child tasks of this epic that are not yet `done`.
CHILDREN_JSON=$(gh issue list --label "epic-${EPIC_NUM}" --label task --state open --limit 100 \
    --json number,title,labels 2>/dev/null || echo "[]")
UNFINISHED=$(echo "$CHILDREN_JSON" | jq -r '
    .[] | select((.labels // []) | map(.name) | contains(["done"]) | not) | .number' 2>/dev/null)
TOTAL_CHILDREN=$(echo "$CHILDREN_JSON" | jq -r 'length' 2>/dev/null || echo 0)

echo ">>> Epic #${EPIC_NUM} has ${TOTAL_CHILDREN} open child task(s); unfinished: $(echo ${UNFINISHED} | tr '\n' ' ' | sed 's/ $//')"

# 4b. If there's nothing left to build and a PR is already open, don't run a
# finish pass that would only churn — the one thing missing is the human merge.
# Nudge for it and bail (the EXIT trap clears the epic claim).
if [ -z "$(printf '%s' "$UNFINISHED" | tr -d '[:space:]')" ] && [ -n "$EPIC_PR_NUMBER" ]; then
    echo ">>> All child tasks already done; PR #${EPIC_PR_NUMBER} open — nothing to finish, waiting on merge."
    gh issue comment "$EPIC_NUM" --body "✅ Все задачи эпика #${EPIC_NUM} готовы — доделывать нечего. Осталось за тобой: проверь CI и **смержи PR #${EPIC_PR_NUMBER}**, затем передвинь эпик в Done. _(finish-flow ничего не запускал, чтобы не крутить вхолостую.)_" >/dev/null 2>&1 || true
    exit 0
fi

FINISHED_NOW=""
STILL_OPEN=""

# 5. Finish each unfinished task on the nightly branch.
for TASK in ${UNFINISHED}; do
    echo ""
    echo "--------------------------------------------"
    echo "  → finishing task #${TASK} (developer, model=$(resolve_model developer))"
    echo "--------------------------------------------"

    # A stale claim on the task must not block us; a live one means skip.
    TASK_LABELS=$(gh issue view "$TASK" --json labels --jq '.labels[].name' 2>/dev/null || echo "")
    if echo "$TASK_LABELS" | grep -qx "$RUNNING_LABEL"; then
        if ! reclaim_if_stale "$TASK"; then
            echo "Task #${TASK} has a live '${RUNNING_LABEL}' — another agent is on it. Skipping."
            STILL_OPEN="${STILL_OPEN} #${TASK}"
            continue
        fi
    fi

    TASK_JSON=$(gh issue view "$TASK" --json title,body 2>/dev/null || echo '{}')
    TASK_TITLE=$(echo "$TASK_JSON" | jq -r '.title // ""')
    TASK_BODY=$(echo "$TASK_JSON" | jq -r '.body // ""')

    INSTRUCTION=$(cat <<EOF
Ты — developer. Прочитай свою роль из .claude/agents/developer.md.

Ты работаешь ПРЯМО на общей ночной ветке '${BRANCH}' (НЕ создавай новую ветку,
НЕ переключайся на main). На этой ветке уже может лежать частично сделанная
работа по этой задаче от прошлого прогона, который не доехал — сначала
осмотрись: 'git log --oneline origin/main..HEAD' и поищи файлы по теме задачи.

Задача #${TASK}: ${TASK_TITLE}

Описание:
${TASK_BODY}

ЧТО НУЖНО:
1. Если задача уже полностью реализована на этой ветке и тесты по ней есть —
   НЕ переписывай, просто прогони 'dotnet test' (или нужный раннер), убедись
   что зелёно, и переходи к шагу 4.
2. Если есть частичная работа — доведи её до конца (TDD: красный → зелёный →
   рефактор). Не начинай с нуля, если уже что-то написано.
3. Если работы нет — реализуй задачу с тестами.
4. Закоммить изменения с упоминанием #${TASK} в commit message (это связывает
   коммит с задачей в Dev Tycoon). НЕ пушь сам и НЕ открывай PR — обёртка
   сделает это в конце.
5. ТОЛЬКО когда реализация готова и тесты зелёные — поставь задаче метку done:
   gh issue edit ${TASK} --add-label done   (НЕ закрывай issue).

Если упёрся в лимит ходов и не успел — это нормально, обёртка увидит. Работай
только над #${TASK}, чужие задачи не трогай.
EOF
)

    claude \
        $(agent_model_args developer) \
        -p "$INSTRUCTION" \
        --dangerously-skip-permissions \
        --max-turns "${MAX_TURNS_PER_TASK}" \
        --output-format stream-json \
        --verbose \
        || echo "[warn] developer exited non-zero on #${TASK} (continuing)"

    # Commit any leftovers the agent didn't commit itself.
    if ! git diff --quiet || ! git diff --staged --quiet; then
        git add -A
        git commit -m "[developer] finish #${TASK} (epic #${EPIC_NUM}, leftover changes)" || true
    fi

    # Pull the run's terminal reason + turn count from the just-streamed result
    # line (tee'd into $LOG_FILE) so a stuck task can say WHY, not just "stuck".
    RESULT_LINE=$(grep '"type":"result"' "$LOG_FILE" 2>/dev/null | tail -1 || true)
    NUM_TURNS=$(printf '%s' "$RESULT_LINE" | jq -r '.num_turns // "?"' 2>/dev/null || echo "?")
    TERMINAL=$(printf '%s' "$RESULT_LINE" | jq -r '.terminal_reason // .subtype // "?"' 2>/dev/null || echo "?")

    # Did the task reach 'done'? (The agent adds it on success.)
    if gh issue view "$TASK" --json labels --jq '.labels[].name' 2>/dev/null | grep -qx "done"; then
        echo ">>> #${TASK} is now done (turns=${NUM_TURNS}/${MAX_TURNS_PER_TASK})."
        FINISHED_NOW="${FINISHED_NOW} #${TASK}"
    else
        echo ">>> #${TASK} still not done (terminal=${TERMINAL}, turns=${NUM_TURNS}/${MAX_TURNS_PER_TASK}) — tagging dev-stuck."
        gh issue edit "$TASK" --add-label "dev-stuck" >/dev/null 2>&1 || true
        # Actionable hint so the owner sees the lever: raise the budget vs split.
        if [ "${TERMINAL}" = "max_turns" ] || [ "${TERMINAL}" = "error_max_turns" ]; then
            HINT="Упёрся в потолок ходов (**${NUM_TURNS}/${MAX_TURNS_PER_TASK}**). Варианты: подними бюджет — перезапусти «Доделать эпик» с \`MAX_TURNS_PER_TASK=$((MAX_TURNS_PER_TASK + 60))\`, либо раздроби задачу на куски по 1–2 часа. Частичная работа уже на ветке — следующий прогон продолжит с места."
        else
            HINT="Прогон завершился как \`${TERMINAL}\` за ${NUM_TURNS} ходов, но метка done не выставлена. Загляни в лог \`${LOG_FILE##*/}\` — возможно, упали тесты или задача недопонята."
        fi
        gh issue comment "$TASK" --body "🚧 **Доделка не дошла до done.** ${HINT}" >/dev/null 2>&1 || true
        STILL_OPEN="${STILL_OPEN} #${TASK}"
    fi
done

# 6. Push whatever landed on the nightly branch.
COMMITS_AHEAD=$(git log --oneline origin/main..HEAD 2>/dev/null | wc -l | tr -d ' ')
if [ "${COMMITS_AHEAD}" -gt 0 ]; then
    git push origin "$BRANCH" || echo "[warn] push failed"
fi

# 7. Recompute child completion after the run.
CHILDREN_AFTER=$(gh issue list --label "epic-${EPIC_NUM}" --label task --state all --limit 100 \
    --json number,labels 2>/dev/null || echo "[]")
DONE_CNT=$(echo "$CHILDREN_AFTER" | jq -r '[.[] | select(((.labels // []) | map(.name) | contains(["done"])) or (.state == "CLOSED"))] | length' 2>/dev/null || echo 0)
ALL_CNT=$(echo "$CHILDREN_AFTER" | jq -r 'length' 2>/dev/null || echo 0)

# 8. Open / refresh the daily PR with the CI-gate (only if there's something).
PR_LINE="PR не открывался (нет коммитов впереди main)."
if [ "${COMMITS_AHEAD}" -gt 0 ]; then
    PR_BODY=$(cat <<EOF
## Доделка эпика #${EPIC_NUM} — ${EPIC_TITLE}

Запущено из Dev Tycoon («Доделать эпик»). Агент-разработчик добивал незаконченные
задачи прямо на ночной ветке \`${BRANCH}\`.

**Дочерние задачи:** ${DONE_CNT}/${ALL_CNT} done
**Доделаны в этом прогоне:** ${FINISHED_NOW:-—}
**Ещё открыты:** ${STILL_OPEN:-—}

Когда CI зелёный и PR станет ready — смержи в main и передвинь эпик #${EPIC_NUM}
в Done на доске.

_(Automated · dispatch-epic-finish)_
EOF
)
    if open_or_refresh_pr "$BRANCH" "Доделка эпика #${EPIC_NUM} · ${TODAY}" "$PR_BODY"; then
        PR_LINE="PR #${PR_NUMBER} (${PR_CI:-?}) — ${PR_URL}"
    else
        PR_LINE="не удалось открыть PR (см. лог ${LOG_FILE##*/})."
    fi
fi

# 9. Summary comment on the epic.
gh issue comment "$EPIC_NUM" --body "$(cat <<EOF
🚀 **Доделка эпика прогнана** (из Dev Tycoon).

- Дочерние задачи: **${DONE_CNT}/${ALL_CNT} done**
- Доделаны сейчас: ${FINISHED_NOW:-—}
- Ещё открыты: ${STILL_OPEN:-—}
- ${PR_LINE}

Мерж в main и закрытие эпика — за тобой (флоу до этого не доходит специально).
_(Dev Tycoon · dispatch-epic-finish)_
EOF
)" || true

git checkout main 2>/dev/null || true
echo ""
echo "Epic finish done. ${DONE_CNT}/${ALL_CNT} child tasks done."
