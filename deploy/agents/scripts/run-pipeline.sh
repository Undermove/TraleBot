#!/bin/bash
set -e

# Sequential agent pipeline on a SHARED nightly branch.
# Each hourly cron invocation continues work on the same branch agents/nightly-YYYY-MM-DD,
# so every agent can see what previous agents (this hour AND prior hours) already did.
# No PR is created here — the morning QA run opens the single daily PR.
# Usage: /scripts/run-pipeline.sh

source /etc/environment

TODAY=$(date '+%Y-%m-%d')
HOUR_STAMP=$(date '+%Y-%m-%d_%H-%M')
BRANCH="agents/nightly-${TODAY}"
REPO_DIR="/workspace/repo"
LOG_DIR="/logs/pipeline_${HOUR_STAMP}"
SUMMARY_FILE="${LOG_DIR}/summaries.md"

mkdir -p "${LOG_DIR}"

echo "============================================"
echo "  Pipeline hour: ${HOUR_STAMP}"
echo "  Shared branch: ${BRANCH}"
echo "  $(date)"
echo "============================================"

cd "${REPO_DIR}"

# --- Sync shared nightly branch -------------------------------------------------
git fetch origin --prune --quiet
git checkout main
git reset --hard origin/main

if git ls-remote --exit-code --heads origin "${BRANCH}" > /dev/null 2>&1; then
    echo ">>> Branch ${BRANCH} exists on origin — continuing work."
    git checkout -B "${BRANCH}" "origin/${BRANCH}"
else
    echo ">>> First run of the night — creating ${BRANCH} from main."
    git checkout -B "${BRANCH}" main
    git push -u origin "${BRANCH}"
fi

# Show recent activity so the agents' context window has it via git log below
echo ""
echo ">>> Recent activity on ${BRANCH}:"
git log --oneline -20 main.."${BRANCH}" || true
echo ""

# --- Agent definitions ----------------------------------------------------------
# Max turns per agent
MAX_TURNS_PER_AGENT=(25 25 25 50 50)

AGENTS=("product" "methodist" "designer" "developer" "tech-lead")
AGENT_LABELS=("Product" "Methodist" "Designer" "Developer" "Tech Lead")

# Shared context prefix — every agent sees it.
CONTEXT_PREFIX="You are working on the SHARED nightly branch '${BRANCH}'. Previous agents (this hour AND earlier hours tonight) have already pushed work to this branch. BEFORE doing anything else:

1. Run: git log --oneline -30 main..HEAD — to see what has been done tonight.
2. Run: git diff --stat main..HEAD — to see which files were touched.
3. Check ROADMAP.md for current task statuses.
4. Run: gh issue list --state open --limit 50 — to see open GitHub issues.

Your goal is to CONTINUE the work, not restart it. Do NOT re-do work previous agents already finished. Do NOT pick a task that is already [dev]/[review]/[done] unless it is explicitly your role to advance it. Do NOT create a PR — just commit locally, the script pushes at the end.

"

INSTRUCTIONS=(
    "${CONTEXT_PREFIX}Read your role instructions from .claude/agents/product.md. Product workflow for this session:
- First, sync the backlog: run 'gh issue list --label product --state open --limit 50' and cross-reference with ROADMAP.md. If an open issue is not in ROADMAP.md yet, add it as an [idea]. If a ROADMAP [idea] has a matching issue, link it.
- Only AFTER the sync, generate at most 1-2 NEW ideas, and only if backlog is genuinely thin. Learning elements count.
- Update ROADMAP.md (status tags, new [idea] entries).
Do NOT create a separate PR. At the very end output '=== SUMMARY ===' with 3-7 bullets."

    "${CONTEXT_PREFIX}Read your role instructions from .claude/agents/methodist.md. Methodist workflow:
- First, read YOUR OWN past notes: run 'gh issue list --label methodist --state open --limit 50' AND grep for 'methodist' in ROADMAP.md. Do NOT duplicate feedback you already left.
- Then validate pedagogical structure of course modules (skip Alphabet and Numbers — owner is happy). Focus on 'Verbs of Movement' and later modules.
- File new GitHub issues (label: methodist) ONLY for problems you have not already flagged. Add methodical notes to ROADMAP.md.
Do NOT edit code. Do NOT create a PR. At the very end output '=== SUMMARY ===' with 3-7 bullets."

    "${CONTEXT_PREFIX}Read your role instructions from .claude/agents/designer.md. Designer workflow:
- Find the TOP [idea] task in ROADMAP.md that is not already in design-specs/. If all [idea] tasks already have specs, pick the topmost without — if none, stop and report nothing-to-do in the summary.
- Create the design spec in design-specs/, update ROADMAP.md status to [designed].
Do NOT create a PR. At the very end output '=== SUMMARY ===' with 3-7 bullets."

    "${CONTEXT_PREFIX}Read your role instructions from .claude/agents/developer.md and ARCHITECTURE.md. Developer workflow:
- Priority: [dev] (returned by tech-lead, fix their comments) > [designed] (new task with spec). Pick exactly ONE task.
- For [dev]: read tech-lead's latest review commit/notes and fix.
- For [designed]: read design-specs/<task> and implement.
- Also scan open GitHub issues labelled 'bug' with no assignee — if one is obviously fixable in the chosen task's area, fix it opportunistically (mention in summary).
- Follow ARCHITECTURE.md: new use cases as services (not MediatR), Clean Architecture layers, unit tests for new business logic.
- Run 'dotnet test' (must be green) and 'cd src/Trale/miniapp-src && npm run build'. Update status to [review].
Do NOT create a PR. At the very end output '=== SUMMARY ===' with 3-7 bullets on what changed, files, test results."

    "${CONTEXT_PREFIX}Read your role instructions from .claude/agents/tech-lead.md AND ARCHITECTURE.md. Tech-lead workflow:
- Review NEW changes since last tech-lead pass on this branch. Use: git log --oneline -20 main..HEAD and find the last '[tech-lead]' commit; diff from there.
- Compare against ARCHITECTURE.md (Clean Architecture, services-not-MediatR for new features, SRP, no dead code). Check quality, test coverage, spec compliance.
- Small fixes — apply directly (boy-scout + missing tests). Bigger issues — move the task from [review] back to [dev] with actionable notes, so next-hour developer picks it up.
- Run 'dotnet test' (mandatory — must be green). Update status to [done] only if everything passes.
Do NOT create a PR. At the very end output '=== SUMMARY ===' with 3-7 bullets: reviewed / passed / fixed / sent-back-to-dev."
)

# --- Run agents -----------------------------------------------------------------
> "${SUMMARY_FILE}"

for i in "${!AGENTS[@]}"; do
    agent="${AGENTS[$i]}"
    label="${AGENT_LABELS[$i]}"
    instruction="${INSTRUCTIONS[$i]}"
    turns="${MAX_TURNS_PER_AGENT[$i]}"
    log_file="${LOG_DIR}/${agent}.log"

    echo ""
    echo ">>> [${agent}] starting at $(date)"

    # Commit anything the previous agent left uncommitted
    if ! git diff --quiet || ! git diff --staged --quiet || [ -n "$(git ls-files --others --exclude-standard)" ]; then
        prev_idx=$((i-1))
        prev_agent="${AGENTS[$prev_idx]:-prev}"
        git add -A
        git commit -m "[${prev_agent}] ${HOUR_STAMP}" --allow-empty 2>/dev/null || true
    fi

    claude \
        -p "${instruction}" \
        --dangerously-skip-permissions \
        --max-turns "${turns}" \
        --output-format text \
        --verbose \
        2>&1 | tee "${log_file}"

    # Commit this agent's work immediately so the next agent sees it in git log
    if ! git diff --quiet || ! git diff --staged --quiet || [ -n "$(git ls-files --others --exclude-standard)" ]; then
        git add -A
        git commit -m "[${agent}] ${HOUR_STAMP}" 2>/dev/null || true
    fi

    # Extract summary
    AGENT_SUMMARY=$(sed -n '/=== SUMMARY ===/,$ p' "${log_file}" | tail -n +2)
    {
        echo "### ${label}"
        echo ""
        if [ -n "${AGENT_SUMMARY}" ]; then
            echo "${AGENT_SUMMARY}"
        else
            echo "_Summary not extracted. See ${log_file}._"
        fi
        echo ""
    } >> "${SUMMARY_FILE}"

    echo ">>> [${agent}] finished at $(date)"
done

# --- Push back to shared branch -------------------------------------------------
if [ "$(git rev-list "origin/${BRANCH}..HEAD" --count)" -eq 0 ]; then
    echo ""
    echo ">>> No new commits this hour. Nothing to push."
else
    echo ""
    echo ">>> Pushing updates to ${BRANCH}..."
    git push origin "${BRANCH}"
fi

git checkout main

echo ""
echo "============================================"
echo "  Pipeline hour complete — ${HOUR_STAMP}"
echo "  Shared branch: ${BRANCH}"
echo "  QA will test & PR in the morning."
echo "  $(date)"
echo "============================================"
