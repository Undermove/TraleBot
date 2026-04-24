#!/bin/bash
set -e

# Morning PR opener for the shared nightly branch.
# Integration QA already ran every hour as part of run-pipeline.sh.
# This script only: final mini-app rebuild + open/refresh one PR.
# Usage: /scripts/run-qa.sh

source /etc/environment

TODAY=$(date '+%Y-%m-%d')
BRANCH="agents/nightly-${TODAY}"
REPO_DIR="/workspace/repo"
LOG_DIR="/logs/qa_${TODAY}"
QA_REPORT="qa-report-${TODAY}.md"

mkdir -p "${LOG_DIR}"

echo "============================================"
echo "  Morning PR open: ${TODAY}"
echo "  Branch: ${BRANCH}"
echo "  $(date)"
echo "============================================"

cd "${REPO_DIR}"
git fetch origin --prune --quiet

if ! git ls-remote --exit-code --heads origin "${BRANCH}" > /dev/null 2>&1; then
    echo "No nightly branch ${BRANCH}. Nothing to open."
    exit 0
fi

git checkout main
git reset --hard origin/main
git checkout -B "${BRANCH}" "origin/${BRANCH}"

if [ "$(git rev-list main..HEAD --count)" -eq 0 ]; then
    echo "Branch has no commits beyond main. Nothing to open."
    exit 0
fi

# --- Final mini-app rebuild so wwwroot matches sources --------------------------
if [ -d src/Trale/miniapp-src ]; then
    (cd src/Trale/miniapp-src && npm run build) || true
    if ! git diff --quiet || [ -n "$(git ls-files --others --exclude-standard src/Trale/wwwroot/)" ]; then
        git add -A
        git add -f src/Trale/wwwroot/ 2>/dev/null || true
        git commit -m "[qa] Final mini-app rebuild ${TODAY}" 2>/dev/null || true
        git push origin "${BRANCH}"
    fi
fi

# --- Build PR body --------------------------------------------------------------
QA_REPORT_CONTENT=""
if [ -f "${QA_REPORT}" ]; then
    QA_REPORT_CONTENT=$(cat "${QA_REPORT}")
fi

# Group commits into human-readable sections by subject prefix + touched files.
# Buckets:
#   🆕 Новый контент         — feat(...) touching Lessons/, ModuleRegistry,
#                               MiniAppContentProvider, or data/dialogs.ts
#   📝 Исправления контента  — fix(content)...
#   🔧 Код-фичи              — other feat(...)
#   📐 Дизайн-спеки          — design(...)
#   🛠 Инфраструктура        — config:, chore:, tech-debt:, other fix(...)
#   ⏮ Откаты                — Revert "..."
# qa:, [tech-lead], product(roadmap), test(...) fall into the collapsed
# "Все коммиты" block below, not into top-level sections.
NEW_CONTENT=""
CONTENT_FIXES=""
CODE_FEATURES=""
DESIGN_SPECS=""
INFRA=""
REVERTS=""

# Neutralize ROADMAP section references so GitHub doesn't auto-link them to
# unrelated legacy issues/PRs. Two narrow patterns match:
#   (a) `#NN` inside parens, e.g. `design(#46)`, `design(VoM #53)`.
#   (b) `ROADMAP #NN`, e.g. `create #433 for ROADMAP #46`.
# Bare `#NN` outside these patterns (real issue refs like `create #433`,
# `Refs #403`, `Fixes #370`) is left alone so live links still work.
sanitize_subject() {
    local s="$1"
    # Swap `#NN` → sentinel `§§NN§§` inside paren groups (covers any number of
    # #NN within one `(...)`, loops until no raw `#NN` remains in parens).
    while printf '%s' "$s" | grep -qE '\([^)]*#[0-9]+[^)]*\)'; do
        s=$(printf '%s' "$s" | sed -E 's/(\([^)#]*)#([0-9]+)/\1§§\2§§/')
    done
    # `ROADMAP #NN` (case-insensitive) → also sentinel.
    s=$(printf '%s' "$s" | sed -E 's/([Rr][Oo][Aa][Dd][Mm][Aa][Pp]) #([0-9]+)/\1 §§\2§§/g')
    # Finally: sentinel → `\`#NN\`` (backticked, so GitHub won't auto-link).
    s=$(printf '%s' "$s" | sed -E 's/§§([0-9]+)§§/`#\1`/g')
    printf '%s' "$s"
}

while IFS='|' read -r sha subject; do
    [ -z "$sha" ] && continue
    files=$(git show --name-only --format='' "$sha" 2>/dev/null || true)
    safe_subject=$(sanitize_subject "$subject")
    line="- ${safe_subject}"

    case "$subject" in
        "Revert"*)
            REVERTS+="${line}"$'\n'
            ;;
        "fix(content)"*)
            CONTENT_FIXES+="${line}"$'\n'
            ;;
        "design("*)
            DESIGN_SPECS+="${line}"$'\n'
            ;;
        "config:"*|"chore:"*|"tech-debt:"*)
            INFRA+="${line}"$'\n'
            ;;
        "feat"*)
            if echo "$files" | grep -qE '(Lessons/|ModuleRegistry|MiniAppContentProvider|data/dialogs\.ts)'; then
                NEW_CONTENT+="${line}"$'\n'
            else
                CODE_FEATURES+="${line}"$'\n'
            fi
            ;;
        "fix"*)
            INFRA+="${line}"$'\n'
            ;;
    esac
done < <(git log main..HEAD --format='%h|%s' --reverse)

render_section() {
    local title="$1"
    local body="$2"
    if [ -n "$body" ]; then
        printf "### %s\n\n%s\n" "$title" "$body"
    fi
}

# Summary stats
COMMITS_TOTAL=$(git rev-list main..HEAD --count)
FILES_TOTAL=$(git diff --name-only main..HEAD | wc -l | tr -d ' ')
ADDITIONS=$(git diff --shortstat main..HEAD | grep -oE '[0-9]+ insertion' | grep -oE '[0-9]+' || echo "0")
DELETIONS=$(git diff --shortstat main..HEAD | grep -oE '[0-9]+ deletion' | grep -oE '[0-9]+' || echo "0")

# Issues closed or referenced tonight
CLOSED_ISSUES=$(git log main..HEAD --format=%B | grep -iEo '(fixes|closes|resolves)[[:space:]]+#[0-9]+' | grep -oE '#[0-9]+' | sort -u | tr '\n' ' ' || true)
REFERENCED_ISSUES=$(git log main..HEAD --format=%B | grep -iEo 'refs[[:space:]]+#[0-9]+' | grep -oE '#[0-9]+' | sort -u | tr '\n' ' ' || true)

FILES_CHANGED=$(git diff --stat main..HEAD)
COMMITS=$(git log --oneline main..HEAD)

SECTIONS=""
SECTIONS+=$(render_section "🆕 Новый контент" "$NEW_CONTENT")
SECTIONS+=$(render_section "📝 Исправления контента" "$CONTENT_FIXES")
SECTIONS+=$(render_section "🔧 Код-фичи" "$CODE_FEATURES")
SECTIONS+=$(render_section "📐 Дизайн-спеки (готовы к разработке)" "$DESIGN_SPECS")
SECTIONS+=$(render_section "🛠 Инфраструктура" "$INFRA")
SECTIONS+=$(render_section "⏮ Откаты" "$REVERTS")

PR_BODY=$(cat <<PREOF
## Ночной прогон — ${TODAY}

Пять агентов (methodist → product → tech-lead → developer → qa) работали последовательно каждый час на ветке \`${BRANCH}\`. Интеграционный QA каждый час, GitHub issues — источник правды по задачам.

**Итого:** ${COMMITS_TOTAL} коммитов · ${FILES_TOTAL} файлов · +${ADDITIONS} / -${DELETIONS} строк

---

## Что сделали этой ночью

${SECTIONS}

---

### Задачи

**Закрытые:** ${CLOSED_ISSUES:-—}
**Упомянутые:** ${REFERENCED_ISSUES:-—}

<details>
<summary>QA Report (hourly integration)</summary>

${QA_REPORT_CONTENT:-_QA-отчёт не сгенерирован_}

</details>

<details>
<summary>Все коммиты</summary>

\`\`\`
${COMMITS}
\`\`\`

</details>

<details>
<summary>Изменённые файлы</summary>

\`\`\`
${FILES_CHANGED}
\`\`\`

</details>

---
*Automated by Bombora Nightly Pipeline — ${TODAY}*
PREOF
)

# --- Open or refresh PR (as DRAFT) ----------------------------------------------
# Use the REST API directly for body updates. `gh pr edit` currently fails
# (exit 1) on repos with classic Projects attached — it emits "GraphQL: Projects
# (classic) is being deprecated" and aborts the update. REST PATCH avoids the
# GraphQL projects enumeration entirely.
#
# Morning PR always opens as DRAFT. It is promoted to "ready for review" only
# AFTER GitHub Actions CI returns green (see CI-gate below). This way the
# owner's morning PR list only surfaces PRs that are actually mergeable —
# red PRs stay visibly in draft state with the failure details commented.
REPO_SLUG=$(git config --get remote.origin.url | sed -E 's#.*github\.com[:/]([^/]+/[^/.]+).*#\1#')
EXISTING_PR=$(gh pr list --head "${BRANCH}" --state open --json number --jq '.[0].number' 2>/dev/null || true)
if [ -n "${EXISTING_PR}" ]; then
    echo ">>> PR #${EXISTING_PR} already exists for ${BRANCH}. Updating body via REST."
    gh api "repos/${REPO_SLUG}/pulls/${EXISTING_PR}" --method PATCH \
        -f body="${PR_BODY}" --jq .html_url || true
    PR_NUMBER="${EXISTING_PR}"
else
    PR_NUMBER=$(gh pr create \
        --title "Ночной прогон ${TODAY}" \
        --body "${PR_BODY}" \
        --base main \
        --head "${BRANCH}" \
        --draft \
        | grep -oE '/pull/[0-9]+' | grep -oE '[0-9]+' || true)
fi

# --- CI gate: wait for green, promote draft → ready -----------------------------
# Gives GitHub Actions up to 15 minutes to finish. If green → mark PR as ready
# for review. If red or timeout → leave as draft and post a comment pointing at
# the failed run, so the owner sees exactly why it isn't mergeable yet.
if [ -n "${PR_NUMBER}" ]; then
    echo ">>> Waiting for CI on PR #${PR_NUMBER}..."
    if timeout 900 gh pr checks "${PR_NUMBER}" --watch --fail-fast >/dev/null 2>&1; then
        echo ">>> CI green. Marking PR #${PR_NUMBER} as ready for review."
        gh pr ready "${PR_NUMBER}" 2>/dev/null || true
    else
        echo ">>> CI failed or timed out. PR #${PR_NUMBER} stays in draft."
        FAILED_RUN=$(gh pr checks "${PR_NUMBER}" --json name,state,link \
            --jq '.[] | select(.state != "SUCCESS") | "- " + .name + " (" + .state + ") " + .link' 2>/dev/null || echo "- see Actions tab")
        gh pr comment "${PR_NUMBER}" --body "🚧 Автоматически оставлен в draft — CI не зелёный.

$FAILED_RUN

Следующему developer-слоту стоит взять это как priority #1." 2>/dev/null || true
    fi
fi

git checkout main

echo ""
echo "============================================"
echo "  Morning PR open complete — ${TODAY}"
echo "  $(date)"
echo "============================================"
