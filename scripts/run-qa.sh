#!/bin/bash
set -e

# QA integration: merge all overnight pipeline branches, run QA agent, create combined PR.
# Runs after the last pipeline (e.g., at 09:00).

source /etc/environment

TIMESTAMP=$(date '+%Y-%m-%d')
BRANCH="qa/integration-${TIMESTAMP}"
REPO_DIR="/workspace/repo"
LOG_DIR="/logs/qa_${TIMESTAMP}"
QA_REPORT="qa-report-${TIMESTAMP}.md"

mkdir -p "${LOG_DIR}"

echo "============================================"
echo "  QA Integration: ${TIMESTAMP}"
echo "  $(date)"
echo "============================================"

cd "${REPO_DIR}"
git checkout main
git pull origin main

# Find today's pipeline branches (created in the last 24 hours)
echo ">>> Looking for overnight pipeline branches..."
PIPELINE_BRANCHES=$(git branch -r --sort=-committerdate | grep "origin/claude/pipeline/${TIMESTAMP}" | sed 's|origin/||' | tr -d ' ')

if [ -z "${PIPELINE_BRANCHES}" ]; then
    echo "No pipeline branches found for ${TIMESTAMP}. Nothing to integrate."
    exit 0
fi

echo "Found branches:"
echo "${PIPELINE_BRANCHES}"
echo ""

# Create integration branch
git checkout -b "${BRANCH}"

# Merge each pipeline branch, resolving ROADMAP conflicts by keeping ours
MERGE_FAILURES=""
MERGED_COUNT=0

for branch in ${PIPELINE_BRANCHES}; do
    echo ">>> Merging ${branch}..."
    if git merge "origin/${branch}" --no-edit 2>/dev/null; then
        MERGED_COUNT=$((MERGED_COUNT + 1))
        echo "    ✓ merged cleanly"
    else
        # Try to auto-resolve common conflicts
        CONFLICTED=$(git diff --name-only --diff-filter=U 2>/dev/null || true)
        RESOLVED=true

        for file in ${CONFLICTED}; do
            case "${file}" in
                ROADMAP.md)
                    # ROADMAP: keep ours (cumulative), take theirs at the end
                    git checkout --ours "${file}"
                    git add "${file}"
                    ;;
                src/Trale/wwwroot/*)
                    # Build artifacts: take theirs, will rebuild anyway
                    git checkout --theirs "${file}"
                    git add -f "${file}" 2>/dev/null || git add "${file}"
                    ;;
                *.css|*.tsx|*.ts)
                    # Source conflicts need manual resolution — abort this merge
                    RESOLVED=false
                    break
                    ;;
                *)
                    git checkout --ours "${file}"
                    git add "${file}"
                    ;;
            esac
        done

        if [ "${RESOLVED}" = true ]; then
            git commit --no-edit 2>/dev/null || true
            MERGED_COUNT=$((MERGED_COUNT + 1))
            echo "    ✓ merged with auto-resolved conflicts"
        else
            git merge --abort
            MERGE_FAILURES="${MERGE_FAILURES}\n- ${branch}: conflict in ${CONFLICTED}"
            echo "    ✗ skipped — unresolvable conflict"
        fi
    fi
done

echo ""
echo "Merged ${MERGED_COUNT} branches."

if [ "${MERGED_COUNT}" -eq 0 ]; then
    echo "No branches merged successfully. Aborting."
    git checkout main
    git branch -D "${BRANCH}"
    exit 0
fi

# Take ROADMAP.md from the latest pipeline branch (most complete)
LATEST_BRANCH=$(echo "${PIPELINE_BRANCHES}" | tail -1)
if git show "origin/${LATEST_BRANCH}:ROADMAP.md" > /dev/null 2>&1; then
    git checkout "origin/${LATEST_BRANCH}" -- ROADMAP.md
    git add ROADMAP.md
    git commit -m "Take ROADMAP.md from latest pipeline run" 2>/dev/null || true
fi

# Run QA agent
echo ""
echo ">>> Running QA agent..."
MAX_TURNS="${MAX_TURNS:-50}"

claude \
    -p "Read your role instructions from .claude/agents/qa.md. You are on branch '${BRANCH}' which contains merged changes from ${MERGED_COUNT} overnight pipeline runs. Run your full QA workflow: build, test, check migrations, analyze changes, write test report. Save the report as '${QA_REPORT}' in the repo root. Fix any build/migration issues you find. IMPORTANT: At the very end, output '=== SUMMARY ===' with the key findings." \
    --dangerously-skip-permissions \
    --max-turns "${MAX_TURNS}" \
    --output-format text \
    --verbose \
    2>&1 | tee "${LOG_DIR}/qa.log"

# Commit QA fixes and report
if ! git diff --quiet || ! git diff --staged --quiet || [ -n "$(git ls-files --others --exclude-standard)" ]; then
    git add -A
    git commit -m "[qa] Integration test fixes and report" 2>/dev/null || true
fi

# Check if branch has any commits beyond main
if [ "$(git rev-list main..HEAD --count)" -eq 0 ]; then
    echo "No changes to integrate."
    git checkout main
    git branch -D "${BRANCH}"
    exit 0
fi

# Extract QA summary
QA_SUMMARY=""
if [ -f "${LOG_DIR}/qa.log" ]; then
    QA_SUMMARY=$(sed -n '/=== SUMMARY ===/,$ p' "${LOG_DIR}/qa.log" | tail -n +2 | head -20)
fi

# Read QA report if it was created
QA_REPORT_CONTENT=""
if [ -f "${QA_REPORT}" ]; then
    QA_REPORT_CONTENT=$(cat "${QA_REPORT}")
fi

# Build file stats
FILES_CHANGED=$(git diff --stat main)
COMMITS=$(git log main..HEAD --oneline)

# Create PR
MERGE_NOTES=""
if [ -n "${MERGE_FAILURES}" ]; then
    MERGE_NOTES=$(printf "\n\n### Не удалось смержить\n${MERGE_FAILURES}")
fi

PR_BODY=$(cat <<PREOF
## QA Integration — ${TIMESTAMP}

Объединены **${MERGED_COUNT}** ночных пайплайн-веток. QA-агент проверил сборку, тесты, миграции и написал тест-кейсы для ручной проверки.
${MERGE_NOTES}

---

<details>
<summary>QA Report</summary>

${QA_REPORT_CONTENT:-_QA-отчёт не сгенерирован_}

</details>

<details>
<summary>QA Agent Summary</summary>

${QA_SUMMARY:-_Summary not extracted_}

</details>

## Коммиты

\`\`\`
${COMMITS}
\`\`\`

## Изменённые файлы

\`\`\`
${FILES_CHANGED}
\`\`\`

---
*Automated by Bombora QA Integration — ${TIMESTAMP}*
PREOF
)

# Rebuild mini-app so wwwroot has correct assets
cd src/Trale/miniapp-src && npm run build 2>/dev/null && cd "${REPO_DIR}"
git add -A
git add -f src/Trale/wwwroot/ 2>/dev/null || true
git commit -m "[qa] Final rebuild" 2>/dev/null || true

git push origin "${BRANCH}"

gh pr create \
    --title "QA Integration ${TIMESTAMP}" \
    --body "${PR_BODY}" \
    --base main \
    --head "${BRANCH}"

git checkout main

echo ""
echo "============================================"
echo "  QA Integration complete!"
echo "  $(date)"
echo "============================================"
