#!/bin/bash
set -e

# Sequential agent pipeline on a SHARED nightly branch.
#
# FLOW (one hour = one pass through this pipeline):
#   1. methodist    — pedagogical audit, files issues (label: methodist)
#   2. product      — triages methodist's issues + generates own ideas,
#                     updates STRATEGY.md/ROADMAP.md
#   3. designer     — creates UX design specs for [idea]/[launch] tasks
#                     that don't have one yet (design-specs/<N>.md)
#   4. tech-lead    — (a) breaks designed ROADMAP items into small
#                      technical GitHub issues (labels: task, P1/P2/P3)
#                     (b) reviews previous hour's developer work
#   5. developer    — picks the highest-priority open 'task' issue and
#                     implements it on the shared branch
#   6. qa           — integration-tests the whole shared branch after the
#                     new commit lands
#
# SINGLE SOURCE OF TRUTH: GitHub issues drive execution. ROADMAP.md is strategic.
# SHARED BRANCH: agents/nightly-YYYY-MM-DD — each hour continues the previous.
# NO PR HERE: the morning 09:00 run (run-qa.sh) opens the single daily PR.

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

echo ""
echo ">>> Recent activity on ${BRANCH}:"
git log --oneline -20 main.."${BRANCH}" || true
echo ""

# --- Agent definitions ----------------------------------------------------------
# Generous limits — tech-lead has two jobs (breakdown + review), developer
# does actual implementation, QA runs full integration. Methodist/product/
# designer are lighter but raised from 25 so they don't truncate triage.
MAX_TURNS_PER_AGENT=(40 50 40 80 100 60)

AGENTS=("methodist" "product" "designer" "tech-lead" "developer" "qa")
AGENT_LABELS=("Methodist" "Product" "Designer" "Tech Lead" "Developer" "QA")

CONTEXT_PREFIX="You are working on the SHARED nightly branch '${BRANCH}'. Previous agents (this hour AND earlier hours tonight) have already pushed work to this branch. GitHub issues are the SINGLE SOURCE OF TRUTH for executable work — ROADMAP.md is strategic context only.

BEFORE doing anything else:
1. git log --oneline -30 main..HEAD — see what was done tonight.
2. git diff --stat main..HEAD — see touched files.
3. gh issue list --state open --limit 50 — see the task backlog.
4. Read STRATEGY.md — current product phase and launch checklist, priorities come from here.
5. Read ROADMAP.md for strategic context.

Do NOT create a PR. Do NOT redo work that is already committed. Commit your own work with clear messages referencing issue numbers when applicable.

"

INSTRUCTIONS=(
    # 1. METHODIST
    "${CONTEXT_PREFIX}Read .claude/agents/methodist.md. Your role this hour:
- Scan pedagogical structure of course modules (skip Alphabet and Numbers — owner is happy with them). Focus on 'Verbs of Movement' and later modules.
- First, read your existing feedback: 'gh issue list --label methodist --state open --limit 50'. Do NOT duplicate issues you already filed.
- For NEW pedagogical problems only, file GitHub issues with 'gh issue create --label methodist'. Title should be concise, body should state: problem, affected module, suggested fix.
- Do NOT edit code. Do NOT touch ROADMAP.md directly — product does that.
At the very end output '=== SUMMARY ===' with 3-7 bullets."

    # 2. PRODUCT
    "${CONTEXT_PREFIX}Read .claude/agents/product.md. Also read STRATEGY.md FIRST — it defines the current product phase and the launch checklist. Your role this hour:

AGGREGATE inputs:
- Read STRATEGY.md (current phase, launch checklist).
- Read ROADMAP.md (backlog, philosophy).
- 'gh issue list --label methodist --state open --limit 50'
- 'gh issue list --label product --state open --limit 50'

TRIAGE methodist's issues: for each relevant one, add to ROADMAP.md as [idea] or [launch] if it closes a checklist item; source-link the issue number; close/comment on the issue once reflected. Max 5 per session.

GENERATE your own ideas (you are not just reacting to methodist): features closing launch-checklist items, marketing angles (Batumi expat chats, referral loops), retention mechanics (Bombora feeding tamagotchi), onboarding copy, positioning. File them as GitHub issues with label 'product' (and 'launch' if applicable).

BACKLOG RULE: if ROADMAP already has 5+ [idea]/[launch] tasks, DO NOT generate new ideas — only triage and prioritize.

PRIORITIZE: move tasks in ROADMAP. Items closing launch-checklist rank highest. Update STRATEGY.md if a checklist item is done.

Do NOT create small technical issues — that is tech-lead's job.
At the very end output '=== SUMMARY ===' with 3-7 bullets."

    # 3. DESIGNER
    "${CONTEXT_PREFIX}Read .claude/agents/designer.md. Your role this hour:
- Find ROADMAP.md entries with status [idea] or [launch] that do NOT yet have a design spec in design-specs/.
- Pick ONE (highest in the launch section first; if everything is already specced — stop with a 'nothing-to-do' summary).
- Create design-specs/<short-slug>.md with: goal, user flows, screen sketches (ASCII/prose is fine), component breakdown, edge cases, copy (Russian), accessibility notes.
- Update the ROADMAP.md status of that entry from [idea]/[launch] to [designed] and add the design-spec path.
Do NOT create a PR. At the very end output '=== SUMMARY ===' with 3-7 bullets."

    # 4. TECH-LEAD (breakdown + review)
    "${CONTEXT_PREFIX}Read .claude/agents/tech-lead.md AND ARCHITECTURE.md. You have TWO responsibilities this hour:

PART A — BREAKDOWN (creating the execution backlog):
- Preferred source: ROADMAP.md entries with status [designed] (designer has produced a spec). For simple [launch] items without a full spec — allowed if acceptance criteria are obvious. [idea] entries skip until designer has specced them.
- For each qualifying entry without a corresponding open GitHub 'task' issue, break it into SMALL technical issues (ideally 1-4 hours of work each).
- Priority rule: if the ROADMAP section is tagged [launch] OR directly closes a STRATEGY.md launch-checklist item, the task gets label P1. Other useful work is P2. Polish / post-launch ideas are P3.
- Create each with 'gh issue create --label task --label <priority>'. Include acceptance criteria (and design-spec path if available) in the body.
- Cross-link: in the ROADMAP section, add a reference like '(issues: #N, #M)'.

PART B — REVIEW (of previous hour's developer work):
- Look at the last developer commit (git log --author-date-order --grep='\\[developer\\]' -1) and the QA output from that hour (latest '[qa]' commit notes).
- Compare against ARCHITECTURE.md (Clean Architecture, services-not-MediatR for new features, SRP, no dead code). Check test coverage.
- Small issues you can fix in-place — do it (boy-scout + missing tests). Bigger issues — re-open the relevant GitHub issue (or open a follow-up with label 'needs-fix') with concrete remediation notes. Do NOT merge status changes that were broken.
- Run 'dotnet test' — must be green when you finish your part.

At the very end output '=== SUMMARY ===' with 3-7 bullets: issues created / reviewed / fixed / reopened."

    # 5. DEVELOPER
    "${CONTEXT_PREFIX}Read .claude/agents/developer.md AND ARCHITECTURE.md. Your role this hour:
- Pick ONE task to work on, in this priority order:
    1) any open issue labelled 'needs-fix' (tech-lead sent back for rework) assigned to you or unassigned,
    2) else highest-priority open issue labelled 'task' AND 'P1' with no assignee,
    3) else 'task' + 'P2' with no assignee,
    4) else 'task' + 'P3' with no assignee.
- Assign the issue to yourself: 'gh issue edit <N> --add-assignee @me' (or just add a comment 'Taking this' if assignment fails).
- Implement it on the shared branch. Follow ARCHITECTURE.md: new use cases as services (not MediatR), Clean Architecture layers, unit tests for new business logic.
- Run 'dotnet test' (must be green) and 'cd src/Trale/miniapp-src && npm run build'.
- Commit with 'Fixes #<N>' or 'Refs #<N>' in the message.
- Do NOT close the issue yourself — tech-lead/QA decides.
At the very end output '=== SUMMARY ===' with 3-7 bullets: issue picked, files changed, test results."

    # 6. QA
    "${CONTEXT_PREFIX}Read .claude/agents/qa.md. Your role this hour (after developer):
- Run the full integration pass on the current state of the shared branch: 'dotnet test' + 'cd src/Trale/miniapp-src && npm run build'. Check migrations if DB code changed.
- If builds/tests fail: comment on the issue that developer just touched with the failure details, add label 'needs-fix'. Do NOT try to fix big regressions yourself — that is developer's job next hour.
- Small build/config fixes (missing files, stale snapshots, wwwroot rebuild) — do fix those yourself.
- Append integration findings to 'qa-report-${TODAY}.md' at repo root (create if absent). One dated section per hour.
At the very end output '=== SUMMARY ===' with 3-7 bullets: what you ran, what passed, what failed, follow-ups filed."
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
echo "  PR will be opened at 09:00."
echo "  $(date)"
echo "============================================"
