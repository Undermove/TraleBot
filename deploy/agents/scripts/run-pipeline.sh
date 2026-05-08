#!/bin/bash
set -e

# Epic-driven nightly pipeline.
#
# PHASES (in order):
#   1. discovery        — product creates one epic-draft issue with BDD scenarios
#                         (owner-priority first, else from STRATEGY/ROADMAP)
#   2. methodist-review — methodist comments on every open epic-draft issue
#                         (pedagogy: progression, prerequisites, missing topics)
#   3. native-review    — native-reviewer comments on every open epic-draft issue
#                         (language: Georgian correctness, Russian translation,
#                         word choice, register)
#   4. finalize         — product reads review comments, updates epic body to
#                         address them, swaps label epic-draft → epic-ready
#   5. breakdown        — tech-lead splits each epic-ready into task issues
#                         (1-4h each) with hour estimates; comments total on epic
#   6. publish-plan     — orchestrator (no agent) composes/refreshes a single
#                         sprint-plan-issue listing every epic-ready and its
#                         tasks. Owner approval gate hangs on this issue.
#                         If discovery/breakdown produced nothing → file a
#                         pipeline-failure issue instead of an empty plan.
#   7. qa-prep          — qa writes a per-task test plan as a comment on every
#                         task issue under approved epics (before dev starts)
#   8. dev              — developer picks one qa-prepared task at a time, must
#                         cover every test the qa plan listed; loops until tasks
#                         exhausted or iteration cap hit
#   9. refactor         — tech-lead end-of-night pass on the whole nightly
#                         branch; only refactors when dotnet test is green
#                         before AND after each step
#
# MODES (passed as $1):
#   auto    — orchestrator decides from sprint-plan state (default)
#               · no open sprint-plan        → run planning phases (1–6)
#               · open sprint-plan, pending  → exit, wait for owner «поехали»
#               · open sprint-plan, approved → run build phases (7–9)
#   plan    — force planning phases (1–6), ignore approval state
#   build   — force build phases (7–9), ignore approval state
#   <phase> — force a single phase (for smoke testing). Valid:
#             discovery / methodist-review / native-review / finalize /
#             breakdown / publish-plan / qa-prep / dev / refactor
#
# OUTPUT: agents push to the shared nightly branch agents/nightly-YYYY-MM-DD.
# The morning 09:00 cron (run-qa.sh) opens/refreshes the daily PR.

[ -f /etc/environment ] && source /etc/environment

MODE="${1:-auto}"
TODAY=$(date '+%Y-%m-%d')
HOUR_STAMP=$(date '+%Y-%m-%d_%H-%M')
BRANCH="${BRANCH_OVERRIDE:-agents/nightly-${TODAY}}"
# BASE_BRANCH is the branch the nightly is forked off / synced to. Defaults
# to main; can be overridden when smoke-testing pipeline changes that haven't
# been merged yet (e.g. BASE_BRANCH=feature/foo before re-running the night).
BASE_BRANCH="${BASE_BRANCH:-main}"
REPO_DIR="${REPO_DIR:-/workspace/repo}"
LOG_DIR="${LOG_DIR_OVERRIDE:-/logs/pipeline_${HOUR_STAMP}}"
SUMMARY_FILE="${LOG_DIR}/summaries.md"
SHARED_CONTEXT_FILE="${LOG_DIR}/shared-context.md"
TOKEN_USAGE_FILE="${LOG_DIR}/token-usage.md"
TOKEN_USAGE_NIGHTLY="${TOKEN_USAGE_NIGHTLY_OVERRIDE:-/logs/token-usage-${TODAY}.md}"

OWNER_LOGIN="${OWNER_LOGIN:-Undermove}"
APPROVE_RE='(?i)поехали|approve|^go\b|^го\b|🚀'

# Iteration cap for the per-task dev loop. Each iteration is one task (one fresh
# developer session). Bounded so a runaway night can't burn the whole budget.
DEV_LOOP_MAX_ITER="${DEV_LOOP_MAX_ITER:-5}"

mkdir -p "${LOG_DIR}"

echo "============================================"
echo "  Epic-driven pipeline"
echo "  Mode:          ${MODE}"
echo "  Hour:          ${HOUR_STAMP}"
echo "  Shared branch: ${BRANCH}"
echo "  $(date)"
echo "============================================"

cd "${REPO_DIR}"

# --- Sync shared nightly branch ------------------------------------------------
git fetch origin --prune --quiet
git checkout "${BASE_BRANCH}" 2>/dev/null
git reset --hard "origin/${BASE_BRANCH}" 2>/dev/null

if git ls-remote --exit-code --heads origin "${BRANCH}" > /dev/null 2>&1; then
    echo ">>> Branch ${BRANCH} exists on origin — continuing."
    git checkout -B "${BRANCH}" "origin/${BRANCH}"
    if git merge "origin/${BASE_BRANCH}" --no-edit; then
        git push origin "${BRANCH}" 2>/dev/null || true
    else
        echo ">>> WARNING: auto-merge of origin/${BASE_BRANCH} into ${BRANCH} hit a conflict — agents will work on stale tip."
        git merge --abort 2>/dev/null || true
    fi
else
    echo ">>> First run of the night — creating ${BRANCH} from ${BASE_BRANCH}."
    git checkout -B "${BRANCH}" "${BASE_BRANCH}"
    git push -u origin "${BRANCH}" 2>/dev/null || true
fi

# --- Plugin loadouts ----------------------------------------------------------
DOTNET_SKILLS_ROOT="/opt/dotnet-skills/plugins"
DOTNET_CORE_PLUGINS=(
    "${DOTNET_SKILLS_ROOT}/dotnet"
    "${DOTNET_SKILLS_ROOT}/dotnet-aspnet"
    "${DOTNET_SKILLS_ROOT}/dotnet-data"
    "${DOTNET_SKILLS_ROOT}/dotnet-test"
    "${DOTNET_SKILLS_ROOT}/dotnet-nuget"
)
DOTNET_QA_PLUGINS=("${DOTNET_CORE_PLUGINS[@]}" "${DOTNET_SKILLS_ROOT}/dotnet-diag")
FRONTEND_DESIGN_PLUGIN="/opt/anthropic-plugins/plugins/frontend-design"

agent_plugin_args() {
    local agent="$1"
    local -a dirs=()
    case "$agent" in
        tech-lead-breakdown|tech-lead-review)
                    dirs=("${DOTNET_CORE_PLUGINS[@]}") ;;
        developer)  dirs=("${DOTNET_CORE_PLUGINS[@]}" "${FRONTEND_DESIGN_PLUGIN}") ;;
        designer)   dirs=("${FRONTEND_DESIGN_PLUGIN}") ;;
        qa)         dirs=("${DOTNET_QA_PLUGINS[@]}") ;;
        *) return 0 ;;
    esac
    for d in "${dirs[@]}"; do
        [ -d "$d" ] && printf -- '--plugin-dir %s ' "$d"
    done
}

# --- Shared context (built once per pipeline invocation) ----------------------
build_shared_context() {
    {
        echo "# Shared context — ${HOUR_STAMP}"
        echo ""
        echo "Nightly branch: \`${BRANCH}\`  •  Mode: \`${MODE}\`"
        echo ""
        echo "## Recent commits on nightly branch (${BASE_BRANCH}..HEAD, up to 50)"
        echo ""
        echo '```'
        git log --oneline -50 "${BASE_BRANCH}..HEAD" 2>/dev/null || echo "(no commits yet tonight)"
        echo '```'
        echo ""
        echo "## Touched files (${BASE_BRANCH}..HEAD)"
        echo ""
        echo '```'
        git diff --stat "${BASE_BRANCH}..HEAD" 2>/dev/null || echo "(no diff)"
        echo '```'
        echo ""
        echo "## Open issue counts by label"
        echo ""
        for lbl in epic epic-draft epic-ready epic-methodist-reviewed epic-native-reviewed task qa-prepared sprint-plan pipeline-failure needs-fix P1 P2 P3; do
            count=$(gh issue list --label "$lbl" --state open --limit 100 --json number 2>/dev/null \
                        | jq 'length' 2>/dev/null || echo "?")
            printf -- "- **%s**: %s\n" "$lbl" "$count"
        done
        echo ""
        echo "## Open epic-draft issues"
        echo ""
        gh issue list --label epic-draft --state open --limit 20 --json number,title \
            --template '{{range .}}- #{{.number}} {{.title}}
{{end}}' 2>/dev/null || echo "(none)"
        echo ""
        echo "## Open epic-ready issues"
        echo ""
        gh issue list --label epic-ready --state open --limit 20 --json number,title \
            --template '{{range .}}- #{{.number}} {{.title}}
{{end}}' 2>/dev/null || echo "(none)"
        echo ""
    } > "${SHARED_CONTEXT_FILE}"
    echo ">>> Shared context: ${SHARED_CONTEXT_FILE}"
}

# --- Token tracking init ------------------------------------------------------
> "${SUMMARY_FILE}"
{
    echo "# Token usage — ${HOUR_STAMP} (mode: ${MODE})"
    echo ""
    echo "| Phase | Turns | Input | Output | Cache read | Cache create | Cost (USD) |"
    echo "|-------|------:|------:|-------:|-----------:|-------------:|-----------:|"
} > "${TOKEN_USAGE_FILE}"

TOTAL_TURNS=0
TOTAL_INPUT=0
TOTAL_OUTPUT=0
TOTAL_CACHE_READ=0
TOTAL_CACHE_CREATE=0
COST_VALUES=()

# --- run_agent helper ---------------------------------------------------------
# Wraps a single claude invocation: extracts usage, summary, max-turn alerts,
# commits any changes the agent left behind. Caller passes phase name (for log
# files), agent name (for plugin loadout + .md prompt), max turns, and the
# instruction body that follows the standard CONTEXT_PREFIX.
PHASE_PRODUCED_OUTPUT=0  # set by run_agent based on whether the session produced commits / issue activity

run_agent() {
    local phase_id="$1"      # e.g. "discovery", "qa-prep-task-123"
    local agent="$2"         # e.g. "product", "qa", maps to plugins + .md
    local max_turns="$3"
    local instruction="$4"

    local log_file="${LOG_DIR}/${phase_id}.log"
    local jsonl_file="${LOG_DIR}/${phase_id}.jsonl"
    local stderr_file="${LOG_DIR}/${phase_id}.stderr.log"

    echo ""
    echo ">>> [${phase_id}] starting at $(date) (agent=${agent}, max_turns=${max_turns})"

    # Commit any leftover from a previous phase before starting fresh.
    if ! git diff --quiet || ! git diff --staged --quiet || [ -n "$(git ls-files --others --exclude-standard)" ]; then
        git add -A
        git commit -m "[pipeline] pre-${phase_id} ${HOUR_STAMP}" --allow-empty 2>/dev/null || true
    fi

    local pre_sha
    pre_sha=$(git rev-parse HEAD 2>/dev/null || echo "")

    # shellcheck disable=SC2046
    claude \
        $(agent_plugin_args "${agent}") \
        -p "${instruction}" \
        --dangerously-skip-permissions \
        --max-turns "${max_turns}" \
        --output-format stream-json \
        --verbose \
        2>"${stderr_file}" \
        | tee "${jsonl_file}" \
        | jq -r 'select(.type=="assistant") | .message.content[]? | select(.type=="text") | .text // empty' 2>/dev/null \
        | tee "${log_file}"

    if ! git diff --quiet || ! git diff --staged --quiet || [ -n "$(git ls-files --others --exclude-standard)" ]; then
        git add -A
        git commit -m "[${phase_id}] ${HOUR_STAMP}" 2>/dev/null || true
    fi

    local post_sha
    post_sha=$(git rev-parse HEAD 2>/dev/null || echo "")
    if [ "${pre_sha}" != "${post_sha}" ]; then
        PHASE_PRODUCED_OUTPUT=1
    else
        PHASE_PRODUCED_OUTPUT=0
    fi

    # --- Token accounting -------------------------------------------------------
    local USAGE_JSON
    USAGE_JSON=$(jq -c 'select(.type=="result")' "${jsonl_file}" 2>/dev/null | tail -1)
    local u_subtype="unknown"
    if [ -n "${USAGE_JSON}" ]; then
        local u_turns u_input u_output u_cache_read u_cache_cr u_cost
        u_turns=$(echo "${USAGE_JSON}"      | jq -r '.num_turns                     // 0')
        u_input=$(echo "${USAGE_JSON}"      | jq -r '.usage.input_tokens            // 0')
        u_output=$(echo "${USAGE_JSON}"     | jq -r '.usage.output_tokens           // 0')
        u_cache_read=$(echo "${USAGE_JSON}" | jq -r '.usage.cache_read_input_tokens // 0')
        u_cache_cr=$(echo "${USAGE_JSON}"   | jq -r '.usage.cache_creation_input_tokens // 0')
        u_cost=$(echo "${USAGE_JSON}"       | jq -r '.total_cost_usd // .cost_usd   // 0')
        u_subtype=$(echo "${USAGE_JSON}"    | jq -r '.subtype                       // "unknown"')

        printf -- "| %s | %s | %s | %s | %s | %s | %s |\n" \
            "${phase_id} (${u_subtype})" \
            "${u_turns}" "${u_input}" "${u_output}" "${u_cache_read}" "${u_cache_cr}" \
            "$(awk -v c="${u_cost}" 'BEGIN{printf "%.4f", c}')" \
            >> "${TOKEN_USAGE_FILE}"

        TOTAL_TURNS=$((TOTAL_TURNS + u_turns))
        TOTAL_INPUT=$((TOTAL_INPUT + u_input))
        TOTAL_OUTPUT=$((TOTAL_OUTPUT + u_output))
        TOTAL_CACHE_READ=$((TOTAL_CACHE_READ + u_cache_read))
        TOTAL_CACHE_CREATE=$((TOTAL_CACHE_CREATE + u_cache_cr))
        COST_VALUES+=("${u_cost}")
    else
        printf -- "| %s | ? | ? | ? | ? | ? | ? |\n" "${phase_id} (no result event)" \
            >> "${TOKEN_USAGE_FILE}"
    fi

    # --- Summary + max-turn alert ----------------------------------------------
    local AGENT_SUMMARY
    AGENT_SUMMARY=$(sed -n '/=== SUMMARY ===/,$ p' "${log_file}" | tail -n +2)

    local TURN_ALERTS_FILE="${LOG_DIR}/turn-alerts.md"
    if [ -z "${AGENT_SUMMARY}" ]; then
        local alert
        if [ "${u_subtype}" != "success" ] && [ "${u_subtype}" != "unknown" ]; then
            alert="⚠️  ${phase_id} ended with subtype=${u_subtype} (max-turns=${max_turns}). No === SUMMARY === produced."
        else
            alert="⚠️  ${phase_id} did not produce === SUMMARY === (max-turns=${max_turns})."
        fi
        echo "${alert}"
        echo "- ${alert}" >> "${TURN_ALERTS_FILE}"
    fi

    {
        echo "### ${phase_id}"
        echo ""
        if [ -n "${AGENT_SUMMARY}" ]; then
            echo "${AGENT_SUMMARY}"
        else
            echo "_Summary not extracted. See ${log_file}._"
        fi
        echo ""
    } >> "${SUMMARY_FILE}"

    echo ">>> [${phase_id}] finished at $(date)"
}

# --- Common context prefix that every agent prompt starts with -----------------
context_prefix() {
    cat <<EOF
You are working on the SHARED nightly branch '${BRANCH}'. Previous phases (this hour AND earlier hours tonight) have already pushed work to this branch. GitHub issues are the SINGLE SOURCE OF TRUTH for executable work.

BEFORE doing anything else, read the pre-built shared context at '${SHARED_CONTEXT_FILE}'. It already contains: recent commits on the nightly branch, touched files, open-issue counts by label, the open epic-drafts and epic-readys. Do NOT re-run 'git log ${BASE_BRANCH}..HEAD', 'git diff --stat ${BASE_BRANCH}..HEAD', or unfiltered 'gh issue list'. Use labelled queries only when you need the BODIES of issues you intend to act on.

Do NOT create a PR. Do NOT redo work that is already committed. Commit your own work with clear messages.

COMMIT SUBJECT CONVENTION — ROADMAP section numbers are NOT GitHub issue numbers. Write them as \`§46\` or \`ROADMAP-46\`, NEVER \`#46\` (GitHub auto-links bare \`#NN\` to issue #NN). Use bare \`#NN\` ONLY for real GitHub issues.

EOF
}

# =============================================================================
# PHASE FUNCTIONS
# =============================================================================

phase_discovery() {
    local instruction
    instruction="$(context_prefix)Read .claude/agents/product.md and STRATEGY.md.

YOUR JOB IN THIS PHASE: pick ONE candidate task and create exactly ONE epic-draft GitHub issue with full BDD scenarios. That epic will be reviewed by methodist + native-reviewer in the next phase, finalized by you again, and broken down by tech-lead.

Source priority for the epic — STRICT order, do NOT skip earlier sources:

1. OWNER-PRIORITIES.md — for every section there, look at the role-checklist. If ANY checkbox in that section is unchecked AND no open epic-issue covers that section, use it. The checklist is the SOLE source of truth for done-ness.
   IMPORTANT: closed GitHub issues do NOT mean a checkbox is satisfied. Issues with the label 'not-implemented' were closed during a backlog reset without any implementation — TREAT THEM AS IF THEY DO NOT EXIST when reasoning about completed work. Only an [x] checkmark in the role-checklist of OWNER-PRIORITIES.md counts as done.

2. Owner comments on the latest sprint-plan-issue (label sprint-plan, latest closed/open) where the owner asks for new work.

3. STRATEGY.md launch-checklist — pick the top unchecked launch item.

4. ROADMAP.md [idea]/[launch] backlog — pick the highest priority that closes a launch-checklist item.

Skip a source ONLY if every candidate in it is fully covered by an open epic-issue (epic-draft / epic-methodist-reviewed / epic-native-reviewed / epic-ready / epic-broken-down). Skip is NOT triggered by closed task-issues — those reflect a previous workflow and are unreliable. If everything is genuinely covered across all four sources, output '=== SUMMARY ===' saying 'no candidate, all covered' and exit.

Create the epic via:
  gh issue create --label epic --label epic-draft --title '[epic] <short title>' --body @epic-body.md
where epic-body.md follows this template (write it locally first, then pass with --body-file):

# <Epic title>
**Source:** OWNER-PRIORITIES §N | ROADMAP §N | sprint-plan #N comment | STRATEGY launch-checklist
**Goal:** one paragraph — what user-visible outcome this epic delivers and why it matters now.
**Out of scope:** what this epic does NOT cover (so the breakdown stays tight).

## Acceptance criteria (BDD)
- Scenario 1 — short name
  - **Given:** initial state (which user, what's already in the system)
  - **When:** action (what the user does)
  - **Then:** expected observable result (what the user sees / what changes in API / what is written to DB)
- Scenario 2 — …
- Scenario «negative» — what must NOT happen, or which error case is handled

## Existing artefacts
- design-spec: <path-or-«none»>
- related issues: <links-or-«none»>
- ROADMAP section: <§N or «none»>

## Notes for reviewers
- Methodist: focus on <progression / prerequisite / module fit>
- Native-reviewer: focus on <Georgian phrasing / register / examples>

After creating the issue, output '=== SUMMARY ===' with: epic number, source, scope in one line.

HARD RULES:
- Exactly ONE epic per discovery phase. Don't batch.
- BDD section MUST contain at least one Given/When/Then scenario AND at least one negative scenario.
- Don't touch ROADMAP.md or any code in this phase. Just create the epic-issue.
- Don't comment on the epic yourself. Reviewers add comments next."

    run_agent "discovery" "product" 50 "${instruction}"
}

phase_methodist_review() {
    local drafts
    drafts=$(gh issue list --label epic-draft --state open --limit 20 --json number -q '.[].number' 2>/dev/null)
    if [ -z "${drafts}" ]; then
        echo ">>> [methodist-review] no open epic-draft. Skip."
        return
    fi
    local instruction
    instruction="$(context_prefix)Read .claude/agents/methodist.md.

YOUR JOB IN THIS PHASE: comment on every open epic-draft issue with pedagogical feedback, then add label 'epic-methodist-reviewed' on each issue you reviewed.

Process every issue listed by:
  gh issue list --label epic-draft --state open --json number,title,body

For each issue:
1. Read the body (Goal + BDD + Notes for reviewers).
2. Post ONE comment with your pedagogical analysis. Cover:
   - Does the epic respect i+1 (no skipped prerequisites)?
   - Are the BDD scenarios pedagogically sound?
   - Is the proposed module/lesson placement correct?
   - Anything missing — a forward-reference, a contrast lesson, a review pass?
3. Add label epic-methodist-reviewed:
   gh issue edit <N> --add-label epic-methodist-reviewed

DO NOT edit the body. DO NOT close the issue. DO NOT create new task issues. Comments only.

If you find no pedagogical concerns, comment 'pedagogically sound, no objections' and still add the label.

At the very end output '=== SUMMARY ===' with one bullet per epic reviewed."

    run_agent "methodist-review" "methodist" 40 "${instruction}"
}

phase_native_review() {
    local drafts
    drafts=$(gh issue list --label epic-draft --state open --limit 20 --json number -q '.[].number' 2>/dev/null)
    if [ -z "${drafts}" ]; then
        echo ">>> [native-review] no open epic-draft. Skip."
        return
    fi
    local instruction
    instruction="$(context_prefix)Read .claude/agents/native-reviewer.md.

YOUR JOB IN THIS PHASE: comment on every open epic-draft issue with language-correctness feedback, then add label 'epic-native-reviewed'.

Process every issue listed by:
  gh issue list --label epic-draft --state open --json number,title,body

For each issue:
1. Read the body. Pay attention to any Georgian text in BDD scenarios, examples, or 'Notes for reviewers'.
2. Post ONE comment covering:
   - Are example Georgian phrases in the BDD natural and correct?
   - Are translations accurate and idiomatic (no Russian calques)?
   - Verb forms, cases, preverbs, version vowels — anything wrong?
   - Register match (formal/informal)?
3. Add label:
   gh issue edit <N> --add-label epic-native-reviewed

DO NOT edit the body. DO NOT close the issue. Comments only.

If the epic has no Georgian content (pure infra/UX), comment 'no language content to review' and still add the label.

At the very end output '=== SUMMARY ===' with one bullet per epic reviewed."

    run_agent "native-review" "native-reviewer" 40 "${instruction}"
}

phase_finalize() {
    local ready_for_finalize
    ready_for_finalize=$(gh issue list --label epic-draft --label epic-methodist-reviewed --label epic-native-reviewed --state open --limit 20 --json number -q '.[].number' 2>/dev/null)
    if [ -z "${ready_for_finalize}" ]; then
        echo ">>> [finalize] no epic-draft fully reviewed by both methodist and native. Skip."
        return
    fi
    local instruction
    instruction="$(context_prefix)Read .claude/agents/product.md.

YOUR JOB IN THIS PHASE: take every epic-draft issue that has BOTH labels epic-methodist-reviewed AND epic-native-reviewed, read the review comments, update the issue body to address them, and promote it to epic-ready.

Process every issue listed by:
  gh issue list --label epic-draft --label epic-methodist-reviewed --label epic-native-reviewed --state open --json number,title,body,comments

For each issue:
1. Read body + ALL comments (methodist + native).
2. Update the body to address the feedback. Concrete changes:
   - If methodist flagged a missing prerequisite — add a sub-scenario or a 'Prerequisite' line under Existing artefacts.
   - If native flagged an incorrect Georgian phrase — fix it in the BDD scenarios.
   - If a reviewer suggested a scope cut — narrow Out-of-scope.
   - If a reviewer flagged something you do NOT agree with — leave the body but add a section '### Reviewer concerns deferred' with one sentence per deferred item explaining why.
3. Update body via:
   gh issue edit <N> --body-file updated-body.md
4. Swap labels:
   gh issue edit <N> --remove-label epic-draft --add-label epic-ready
5. Post a short comment summarising what changed in the body, e.g. 'Finalized — incorporated methodist comment on prerequisite chain, deferred native concern on register (out of scope this epic).'

DO NOT touch ROADMAP.md or code. DO NOT close the issue. DO NOT split into tasks (that's the next phase).

At the very end output '=== SUMMARY ===' with one bullet per epic finalized."

    run_agent "finalize" "product" 50 "${instruction}"
}

phase_breakdown() {
    local ready
    ready=$(gh issue list --label epic-ready --state open --limit 20 --json number -q '.[].number' 2>/dev/null)
    if [ -z "${ready}" ]; then
        echo ">>> [breakdown] no open epic-ready. Skip."
        return
    fi
    local instruction
    instruction="$(context_prefix)Read .claude/agents/tech-lead.md AND ARCHITECTURE.md.

YOUR JOB IN THIS PHASE: for every open epic-ready issue, split it into small task issues (1–4 hours each) with explicit hour estimates. Then comment on the epic with the total estimate and per-task list.

Process every issue listed by:
  gh issue list --label epic-ready --state open --json number,title,body

For each epic:
1. Re-read the BDD scenarios. Each scenario typically becomes one or more task issues.
2. Decompose into tasks of 1–4h. A good task closes one BDD scenario or one technical layer (backend DTO, frontend component, tests).
3. Create each task issue:
   gh issue create --label task --label P1 --title 'epic-<EPIC>: <task-title>' --body @body.md
   where body.md is:
       Part of #<EPIC>
       **Estimate:** <N>h
       **Scope:** what this task delivers (one paragraph)
       **Acceptance criteria:** 3-7 testable bullets — derived from the BDD scenarios this task closes
       **Files to touch:** rough sketch of files / classes
       **BDD scenarios this task closes:** Scenario 1, Scenario 2 (by name from the epic)
4. After all tasks for an epic are created, comment on the EPIC issue with:
       ## Breakdown — total <SUM>h
       - #<task1> — <task title> — <estN>h
       - #<task2> — …
       Total: <SUM>h.
       Sprint capacity (one night) ≈ 6h. <If SUM ≤ 6h: 'fits one night, possibly room for another epic'. If SUM > 6h: 'spans two nights, will continue tomorrow'.>

5. Add label epic-broken-down on the epic:
   gh issue edit <EPIC> --add-label epic-broken-down

If you reach the conclusion that an epic-ready is actually too small (<2h total) or too big (>10h), comment that on the epic and DO NOT split it — flag it for the publish-plan phase to decide. Don't attempt to merge or split epics yourself in this phase.

DO NOT pick a task and start coding. DO NOT close the epic. Just decompose + estimate.

At the very end output '=== SUMMARY ===' with: epics broken down, total task issues created, total hours."

    run_agent "breakdown" "tech-lead-breakdown" 80 "${instruction}"
}

phase_publish_plan() {
    # No agent — orchestrator-only step. Compose a sprint-plan-issue body from
    # all open epic-broken-down issues. Update existing sprint-plan if one is
    # open and pending owner approval; otherwise create a new one.
    local broken_down
    broken_down=$(gh issue list --label epic-broken-down --state open --limit 20 --json number,title -q '.[]' 2>/dev/null)

    # Decide whether we have anything to plan.
    local epic_count
    epic_count=$(echo "${broken_down}" | jq -s 'length')
    if [ "${epic_count}" -eq 0 ]; then
        # No broken-down epics — and we just ran planning phases that should
        # have produced some. File a pipeline-failure issue so the owner is
        # not left with silence.
        echo ">>> [publish-plan] no epic-broken-down issues found after planning."
        local turn_alerts=""
        if [ -f "${LOG_DIR}/turn-alerts.md" ]; then
            turn_alerts=$(cat "${LOG_DIR}/turn-alerts.md")
        fi
        local fail_body
        fail_body="Pipeline ${HOUR_STAMP}: planning completed but produced zero epic-broken-down issues.

Possible causes:
- discovery skipped (no candidate found in OWNER-PRIORITIES / sprint-plan comments / STRATEGY / ROADMAP)
- methodist or native review hit max-turns
- finalize skipped (epic-draft missing one of the required review labels)
- breakdown hit max-turns

Turn-limit alerts this hour:
${turn_alerts:-(none)}

Logs: ${LOG_DIR}

Action: investigate the planning logs above. The pipeline will NOT auto-retry — fix the root cause, then run the planning phases manually with run-pipeline.sh plan."
        gh issue create \
            --label pipeline-failure \
            --title "Pipeline failure ${HOUR_STAMP}: no sprint plan generated" \
            --body "${fail_body}" 2>/dev/null || true
        return
    fi

    # Compose the sprint-plan body. One section per epic.
    local plan_body_file="${LOG_DIR}/sprint-plan-body.md"
    {
        echo "Ночной план на **${TODAY}**. Напишите комментарий с уточнениями. Когда всё устроит — напишите «поехали»."
        echo ""
        echo "В плане ${epic_count} эпик(ов). Для каждого есть готовая разбивка на задачи с оценками от тех-лида."
        echo ""
        echo "---"
        echo ""
        local total_hours=0
        while read -r e; do
            [ -z "$e" ] && continue
            local enum etitle
            enum=$(echo "$e" | jq -r '.number')
            etitle=$(echo "$e" | jq -r '.title')
            echo "## Эпик #${enum}: ${etitle}"
            echo ""

            # Pull the most recent breakdown comment (one starting with '## Breakdown').
            # Use jq's array-last instead of unix `tail -1`: comment bodies are
            # multi-line, so tail -1 grabs the last LINE (often blank), not the
            # last MATCHING COMMENT.
            local breakdown_comment
            breakdown_comment=$(gh issue view "${enum}" --json comments \
                                 -q '[.comments[]? | select(.body | startswith("## Breakdown")) | .body] | last // ""' 2>/dev/null)
            if [ -n "${breakdown_comment}" ]; then
                echo "${breakdown_comment}"
                local epic_hours
                epic_hours=$(echo "${breakdown_comment}" | grep -oE 'Total: [0-9]+h' | grep -oE '[0-9]+' | head -1 || echo 0)
                total_hours=$((total_hours + epic_hours))
            else
                echo "_Breakdown comment not found — see #${enum} for tasks._"
            fi
            echo ""
        done < <(echo "${broken_down}" | jq -c '.')

        echo "---"
        echo ""
        echo "**Итого по ночи: ~${total_hours}h.**"
        echo ""
        echo "_Ветка: \`${BRANCH}\`_"
        echo "<!-- sprint-plan-bot -->"
    } > "${plan_body_file}"

    # Find the latest open sprint-plan issue (if any) and refresh it.
    local sprint_num
    local existing
    existing=$(gh issue list --label sprint-plan --state open --limit 1 --json number -q '.[0].number' 2>/dev/null)
    if [ -n "${existing}" ]; then
        echo ">>> [publish-plan] refreshing open sprint-plan #${existing}."
        gh issue edit "${existing}" --body-file "${plan_body_file}" 2>/dev/null || true
        gh issue comment "${existing}" --body "Plan refreshed at ${HOUR_STAMP}: ${epic_count} epic(s), ~${total_hours}h. Approve with «поехали» when ready." 2>/dev/null || true
        sprint_num="${existing}"
    else
        echo ">>> [publish-plan] creating new sprint-plan."
        sprint_num=$(gh issue create \
            --label sprint-plan \
            --title "Sprint Plan ${TODAY}" \
            --body-file "${plan_body_file}" 2>/dev/null \
            | grep -oE '/issues/[0-9]+' | grep -oE '[0-9]+' || true)
    fi

    # --- Owner-priority auto-approval --------------------------------------
    # If EVERY epic in this plan came from OWNER-PRIORITIES.md, the owner has
    # already pinned these tasks — there's no point waiting for a manual
    # «поехали» comment that only re-confirms what's already pinned. Tag the
    # sprint-plan with label 'auto-approved' so detect_sprint_state moves
    # straight to build phases on the next hour. If even one epic comes from
    # another source (STRATEGY / ROADMAP / sprint-plan comment), keep the
    # default manual gate so the owner can still triage non-pinned work.
    if [ -n "${sprint_num}" ] && [ "${epic_count}" -gt 0 ]; then
        local non_pinned=0
        while read -r e; do
            [ -z "$e" ] && continue
            local enum
            enum=$(echo "$e" | jq -r '.number')
            local body
            body=$(gh issue view "${enum}" --json body -q '.body' 2>/dev/null)
            if ! echo "${body}" | grep -qE '^\*\*Source:\*\* +OWNER-PRIORITIES'; then
                non_pinned=$((non_pinned + 1))
            fi
        done < <(echo "${broken_down}" | jq -c '.')

        if [ "${non_pinned}" -eq 0 ]; then
            echo ">>> [publish-plan] all ${epic_count} epic(s) sourced from OWNER-PRIORITIES — auto-approving sprint #${sprint_num}."
            gh issue edit "${sprint_num}" --add-label auto-approved 2>/dev/null || true
            gh issue comment "${sprint_num}" --body "🚀 Auto-approved: every epic in this plan is sourced from OWNER-PRIORITIES.md. Build phases will run on the next hourly tick — no «поехали» required." 2>/dev/null || true
        else
            echo ">>> [publish-plan] sprint #${sprint_num}: ${non_pinned} epic(s) outside OWNER-PRIORITIES — keeping manual «поехали» gate."
        fi
    fi
}

phase_qa_prep() {
    # For each task issue under approved epics that lacks 'qa-prepared' label,
    # ask qa to add an acceptance test plan as a comment, then label it qa-prepared.
    local pending_tasks
    pending_tasks=$(gh issue list --label task --state open --limit 50 --json number,labels \
                    -q '.[] | select((.labels // []) | map(.name) | contains(["qa-prepared"]) | not) | .number' 2>/dev/null)
    if [ -z "${pending_tasks}" ]; then
        echo ">>> [qa-prep] no unprepared tasks. Skip."
        return
    fi
    local instruction
    instruction="$(context_prefix)Read .claude/agents/qa.md.

YOUR JOB IN THIS PHASE: for every open task issue WITHOUT label 'qa-prepared', post an acceptance test plan as a comment, then add the qa-prepared label.

Process tasks listed by:
  gh issue list --label task --state open --json number,title,body,labels

Skip any task that already has label qa-prepared (idempotent).

For each task:
1. Read the body — Acceptance criteria + BDD scenarios closed.
2. Trace each acceptance criterion to a concrete test:
   - HTTP behaviour → integration test in tests/IntegrationTests/
   - Business logic without infra → unit test in tests/UnitTests/ via builder pattern
   - UI behaviour → component test in miniapp-src or integration test on the API
3. Post ONE comment with this structure:
       ## Test plan
       Each acceptance criterion above MUST be covered by at least one test before this task is considered done.
       - **AC: <criterion text>** → <test type> in <file path>: <one-line test name>
       - **AC: <criterion text>** → …
       - **Negative case: <edge case>** → <test type> in <path>: <test name>

       Notes:
       - <any infra required, e.g. Testcontainers, mock data>
       - <any non-obvious assertion>

   Test type guide:
   - HTTP behaviour or backend integration → integration test in tests/IntegrationTests/
   - Business logic without infra → unit test in tests/UnitTests/ via builder pattern
   - **UI behaviour visible to the user (mini-app component, screen flow, tap interactions)** → Playwright spec in src/Trale/miniapp-src/e2e/<feature>.spec.ts. EVERY visible BDD scenario from the parent epic that touches the mini-app MUST get a Playwright spec — it's the only layer that catches a 'it compiles, but the tap target is broken' regression. Mock the /api/* surface with page.route() so the spec is deterministic and doesn't need a live backend.
4. Add label qa-prepared:
   gh issue edit <N> --add-label qa-prepared

Do NOT run dotnet test in this phase. Do NOT touch code. This is a planning step.

At the very end output '=== SUMMARY ===' with one bullet per task prepared, total tests planned."

    run_agent "qa-prep" "qa" 60 "${instruction}"
}

phase_dev() {
    # Pick ONE qa-prepared task that's open and not yet developed. Implement.
    local picks
    picks=$(gh issue list --label task --label qa-prepared --state open --limit 5 --json number,title,labels \
              -q '[.[] | select(.labels // [] | map(.name) | contains(["done"]) | not)] | .[0]' 2>/dev/null)
    local pick_num pick_title
    pick_num=$(echo "${picks}" | jq -r '.number // empty')
    pick_title=$(echo "${picks}" | jq -r '.title // empty')
    if [ -z "${pick_num}" ]; then
        echo ">>> [dev] no qa-prepared open tasks. Skip."
        return
    fi
    local phase_id="dev-${pick_num}"
    local instruction
    instruction="$(context_prefix)Read .claude/agents/developer.md AND ARCHITECTURE.md.

YOUR JOB IN THIS PHASE: implement task issue #${pick_num} (${pick_title}).

1. gh issue view ${pick_num}  — read body + the qa test-plan comment.
2. Assign yourself: gh issue edit ${pick_num} --add-assignee @me  (ignore failure if not allowed).
3. Implement on the shared branch (NOT a feature branch). TDD order: write red tests for every test the qa plan listed FIRST (one commit), then green code (next commit), then optional refactor.
4. Every test from the qa-prepared comment MUST be present and green before you finish. If you cannot cover one — DO NOT skip silently. Comment on the issue with what you couldn't do and why, leave the task open.
5. Run 'dotnet test TraleBot.sln' — must be green.
6. Run 'cd src/Trale/miniapp-src && npm run build' — must succeed.
7. **Playwright UI gate.** Look at the qa-prep test plan above. If ANY entry mentions a Playwright spec (UI behaviour AC), you MUST author/extend the spec in 'src/Trale/miniapp-src/e2e/' AND run it green. Run with:
       cd src/Trale/miniapp-src && npx playwright test
   The webServer in playwright.config.ts builds + previews the SPA itself; the spec mocks /api/* via page.route() so it doesn't need the .NET backend. If a Playwright spec was listed in the qa-prep plan and you couldn't make it green, DO NOT add the 'done' label — comment on the issue with what failed and leave it open. 'It compiles' is not 'it works'.
8. Commit with 'Refs #${pick_num}' / 'Fixes #${pick_num}'.
9. After committing, add label 'done' to the issue: gh issue edit ${pick_num} --add-label done. Do NOT close the issue (refactor + qa pass needs to see it).

DO NOT pick a different task. DO NOT touch issues outside this scope.

At the very end output '=== SUMMARY ===' with: task picked, files changed, tests added, dotnet test result."

    run_agent "${phase_id}" "developer" 100 "${instruction}"
}

phase_refactor() {
    local instruction
    instruction="$(context_prefix)Read .claude/agents/tech-lead.md AND ARCHITECTURE.md.

YOUR JOB IN THIS PHASE: end-of-night architecture review on the whole nightly branch. Run AFTER all dev iterations are done.

1. git log --oneline ${BASE_BRANCH}..HEAD  — see every commit this night.
2. Read commits with prefix [dev-N], group by epic (each task issue links to a parent epic).
3. For each touched area:
   - Compare against ARCHITECTURE.md (Clean Architecture layers, services not MediatR for new use cases, SRP, no leaky abstractions, EF queries sane).
   - Boy-scout fixes (small): apply in place — tighten types, delete dead code, split too-big files, pull duplicates into helpers.
4. After ANY refactor commit:
   - Run 'dotnet test TraleBot.sln' — MUST be green. If not, REVERT the last refactor commit (do not chase). Tests are the contract.
   - Run 'cd src/Trale/miniapp-src && npm run build' — must succeed.
   - Run 'cd src/Trale/miniapp-src && npx playwright test' — MUST be green if any spec exists. UI tests are part of the contract.
5. For real regressions you can't fix in 1-2 commits — open a 'needs-fix' issue with a 3-7 bullet remediation plan. Do NOT silently leave broken code on the branch.

DO NOT create new task issues outside needs-fix. DO NOT touch tests to make them pass — fix the code or revert.

At the very end output '=== SUMMARY ===' with: commits reviewed, refactor commits, needs-fix opened."

    run_agent "refactor" "tech-lead-review" 50 "${instruction}"
}

# =============================================================================
# ORCHESTRATION
# =============================================================================

run_planning_phases() {
    echo ""
    echo "=== PLANNING PHASES ==="
    phase_discovery
    phase_methodist_review
    phase_native_review
    phase_finalize
    phase_breakdown
    phase_publish_plan
}

run_build_phases() {
    echo ""
    echo "=== BUILD PHASES ==="
    phase_qa_prep
    local i=0
    while [ "${i}" -lt "${DEV_LOOP_MAX_ITER}" ]; do
        i=$((i + 1))
        echo ""
        echo ">>> Dev loop iteration ${i}/${DEV_LOOP_MAX_ITER}"
        local before_count
        before_count=$(gh issue list --label task --label qa-prepared --state open --limit 50 --json number,labels \
                         -q '[.[] | select(.labels // [] | map(.name) | contains(["done"]) | not)] | length' 2>/dev/null)
        if [ "${before_count}" -eq 0 ]; then
            echo ">>> No qa-prepared undone tasks remaining. Stop dev loop."
            break
        fi
        phase_dev
        # Push partial progress between iterations.
        if [ "$(git rev-list "origin/${BRANCH}..HEAD" --count 2>/dev/null || echo 0)" -gt 0 ]; then
            git push origin "${BRANCH}" 2>/dev/null || true
        fi
    done
    phase_refactor
}

detect_sprint_state() {
    local SPRINT_NUM
    SPRINT_NUM=$(gh issue list --label sprint-plan --state open --limit 1 \
                   --json number -q '.[0].number' 2>/dev/null)
    if [ -z "${SPRINT_NUM}" ]; then
        echo "no-plan"
        return
    fi

    # Auto-approval: publish-plan stamps 'auto-approved' on plans where every
    # epic comes from OWNER-PRIORITIES.md. Treat that as if the owner had
    # written «поехали» — no manual gate needed for already-pinned work.
    local AUTO
    AUTO=$(gh issue view "${SPRINT_NUM}" --json labels \
               -q '.labels[]? | select(.name == "auto-approved") | .name' 2>/dev/null)
    if [ -n "${AUTO}" ]; then
        echo "approved:${SPRINT_NUM}"
        return
    fi

    local APPROVED
    APPROVED=$(gh issue view "${SPRINT_NUM}" --json comments \
                   -q ".comments[]? | select(.author.login == \"${OWNER_LOGIN}\") | .body" 2>/dev/null \
                | grep -P -i "${APPROVE_RE}" | head -1 || true)
    if [ -n "${APPROVED}" ]; then
        echo "approved:${SPRINT_NUM}"
    else
        echo "pending:${SPRINT_NUM}"
    fi
}

build_shared_context

case "${MODE}" in
    auto)
        STATE=$(detect_sprint_state || echo "no-plan")
        echo ">>> Sprint state: ${STATE}"
        case "${STATE}" in
            no-plan)
                run_planning_phases
                ;;
            approved:*)
                run_build_phases
                ;;
            pending:*)
                echo ""
                echo "============================================"
                echo "  Sprint plan ${STATE#pending:} pending owner approval."
                echo "  Skipping planning AND build (no token spend)."
                echo "  Waiting for owner «поехали»."
                echo "  $(date)"
                echo "============================================"
                ;;
        esac
        ;;
    plan)
        run_planning_phases
        ;;
    build)
        run_build_phases
        ;;
    discovery)        phase_discovery ;;
    methodist-review) phase_methodist_review ;;
    native-review)    phase_native_review ;;
    finalize)         phase_finalize ;;
    breakdown)        phase_breakdown ;;
    publish-plan)     phase_publish_plan ;;
    qa-prep)          phase_qa_prep ;;
    dev)              phase_dev ;;
    refactor)         phase_refactor ;;
    *)
        echo "Unknown MODE '${MODE}'. See header for valid modes." >&2
        exit 64
        ;;
esac

# --- Finalize per-hour token usage table ---------------------------------------
TOTAL_COST=$(printf '%s\n' "${COST_VALUES[@]:-0}" | awk 'BEGIN{s=0} {s+=$1} END{printf "%.4f", s}')
{
    printf -- "| **TOTAL** | **%s** | **%s** | **%s** | **%s** | **%s** | **%s** |\n" \
        "${TOTAL_TURNS}" "${TOTAL_INPUT}" "${TOTAL_OUTPUT}" \
        "${TOTAL_CACHE_READ}" "${TOTAL_CACHE_CREATE}" "${TOTAL_COST}"
    echo ""
} >> "${TOKEN_USAGE_FILE}"

echo ""
echo ">>> Hour ${HOUR_STAMP} tokens: in=${TOTAL_INPUT} out=${TOTAL_OUTPUT} cache_read=${TOTAL_CACHE_READ} cost=\$${TOTAL_COST}"

{
    echo ""
    cat "${TOKEN_USAGE_FILE}"
} >> "${TOKEN_USAGE_NIGHTLY}"

# --- Push back to shared branch ------------------------------------------------
if [ "$(git rev-list "origin/${BRANCH}..HEAD" --count 2>/dev/null || echo 0)" -eq 0 ]; then
    echo ">>> No new commits this hour. Nothing to push."
else
    echo ">>> Pushing updates to ${BRANCH}..."
    git push origin "${BRANCH}" 2>/dev/null || true
fi

git checkout "${BASE_BRANCH}" 2>/dev/null || true

echo ""
echo "============================================"
echo "  Pipeline hour complete — ${HOUR_STAMP}"
echo "  Mode: ${MODE}"
echo "  Shared branch: ${BRANCH}"
echo "  $(date)"
echo "============================================"
