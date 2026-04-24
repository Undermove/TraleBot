#!/bin/bash
set -e

# Sequential agent pipeline on a SHARED nightly branch.
#
# FLOW (one hour = one pass through this pipeline):
#   1. methodist            — pedagogical audit, files issues (label: methodist)
#   2. native-reviewer      — bilingual ge+ru native speaker: proofreads content,
#                             commits small fixes directly, files issues (label: native)
#   3. designer             — UX audit, files design ideas as issues (label: design);
#                             optional design-specs/*.md for big features
#   4. product              — triages methodist/native/design issues + generates own
#                             ideas, updates STRATEGY.md/ROADMAP.md
#   5. tech-lead-breakdown  — breaks [designed]/[launch] ROADMAP items into small
#                             technical GitHub issues with acceptance criteria
#                             (labels: task, P1/P2/P3)
#   6. developer            — picks the highest-priority open 'task' issue and
#                             implements it on the shared branch
#   7. qa                   — integration-tests the whole shared branch after the
#                             new commit lands
#   8. tech-lead-review     — architecture review of developer's commit + qa report;
#                             opens 'needs-fix' issues for regressions
#
# SINGLE SOURCE OF TRUTH: GitHub issues drive execution. ROADMAP.md is strategic.
# SHARED BRANCH: agents/nightly-YYYY-MM-DD — each hour continues the previous.
# NO PR HERE: the morning 09:00 run (run-qa.sh) opens the single daily PR.

source /etc/environment

# MODE selects which subset of agents runs this hour.
#   full  — all 8 agents (audit + build). Expensive; scheduled 2×/night.
#   build — only tech-lead-breakdown, developer, qa, tech-lead-review.
#           Cheapest pass that still makes code progress — audit agents
#           (methodist, native-reviewer, designer, product) are skipped
#           because running them every hour produces duplicate triage
#           churn and burns tokens re-reading the same backlog.
MODE="${1:-full}"

TODAY=$(date '+%Y-%m-%d')
HOUR_STAMP=$(date '+%Y-%m-%d_%H-%M')
BRANCH="agents/nightly-${TODAY}"
REPO_DIR="/workspace/repo"
LOG_DIR="/logs/pipeline_${HOUR_STAMP}"
SUMMARY_FILE="${LOG_DIR}/summaries.md"
SHARED_CONTEXT_FILE="${LOG_DIR}/shared-context.md"

mkdir -p "${LOG_DIR}"

# Per-hour token accounting table. Each agent appends a row; a total row is
# added after the loop. Morning QA can concatenate these across the night to
# answer "how much did last night cost and where".
TOKEN_USAGE_FILE="${LOG_DIR}/token-usage.md"
# Per-night rolling log — every hour appends its section here so morning QA
# has a single file to read across 8 hours.
TOKEN_USAGE_NIGHTLY="/logs/token-usage-${TODAY}.md"

echo "============================================"
echo "  Pipeline hour: ${HOUR_STAMP}"
echo "  Mode:          ${MODE}"
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
# Generous limits — developer does actual implementation, tech-lead runs twice
# (breakdown up front, architecture review at the end), QA runs full integration.
# Methodist/native/designer/product are lighter but raised from 25 so they don't
# truncate triage.
MAX_TURNS_PER_AGENT=(40 60 40 50 80 100 60 50)

AGENTS=("methodist" "native-reviewer" "designer" "product" "tech-lead-breakdown" "developer" "qa" "tech-lead-review")
AGENT_LABELS=("Methodist" "Native Reviewer" "Designer" "Product" "Tech Lead (Breakdown)" "Developer" "QA" "Tech Lead (Review)")

# Which indices into AGENTS to actually run this hour. Audit agents (0..3) are
# the expensive re-reading crew; build agents (4..7) convert approved backlog
# into commits. See MODE comment at top.
case "${MODE}" in
    full)
        AGENT_INDICES=(0 1 2 3 4 5 6 7)
        ;;
    build)
        AGENT_INDICES=(4 5 6 7)
        ;;
    *)
        echo "Unknown MODE '${MODE}'. Expected 'full' or 'build'." >&2
        exit 64
        ;;
esac

# --- Per-agent plugin loadout --------------------------------------------------
# tech-lead / developer / qa work on C# code. They load the official .NET Agent
# Skills (dotnet/skills) vendored at /opt/dotnet-skills in the Dockerfile.
# Each --plugin-dir loads one plugin for the session (Claude Code doesn't
# auto-enumerate sub-plugins from a marketplace, so we list the ones we want).
# qa additionally gets dotnet-diag for build/test diagnostics.
DOTNET_SKILLS_ROOT="/opt/dotnet-skills/plugins"
DOTNET_CORE_PLUGINS=(
    "${DOTNET_SKILLS_ROOT}/dotnet"
    "${DOTNET_SKILLS_ROOT}/dotnet-aspnet"
    "${DOTNET_SKILLS_ROOT}/dotnet-data"
    "${DOTNET_SKILLS_ROOT}/dotnet-test"
    "${DOTNET_SKILLS_ROOT}/dotnet-nuget"
)
DOTNET_QA_PLUGINS=("${DOTNET_CORE_PLUGINS[@]}" "${DOTNET_SKILLS_ROOT}/dotnet-diag")

# Anthropic frontend-design plugin — used by designer and developer agents for
# mini-app UI work. Vendored in the Dockerfile via sparse clone.
FRONTEND_DESIGN_PLUGIN="/opt/anthropic-plugins/plugins/frontend-design"

# Build --plugin-dir argument arrays once. Used in the per-agent claude invocation.
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
        # Defensive: skip silently if the skills repo wasn't vendored (image built
        # before skills landed) so the agent still runs, just without skills.
        if [ -d "$d" ]; then
            printf -- '--plugin-dir %s ' "$d"
        fi
    done
}

CONTEXT_PREFIX="You are working on the SHARED nightly branch '${BRANCH}'. Previous agents (this hour AND earlier hours tonight) have already pushed work to this branch. GitHub issues are the SINGLE SOURCE OF TRUTH for executable work — ROADMAP.md is strategic context only.

BEFORE doing anything else, read the pre-built shared context at '${SHARED_CONTEXT_FILE}'. It already contains: recent commits on the nightly branch, touched files, open-issue counts by label, the most recently filed issues. Do NOT re-run 'git log main..HEAD', 'git diff --stat main..HEAD', or an unfiltered 'gh issue list --state open --limit 50' — that information is already in the shared context. Use labeled queries only when you need the BODIES of issues you intend to act on this hour (e.g. 'gh issue list --label task --label P1 --state open --limit 20', 'gh issue view <N>').

After reading the shared context, read STRATEGY.md (current phase + launch checklist) and ROADMAP.md (strategic backlog) — these are your priority signal.

Do NOT create a PR. Do NOT redo work that is already committed. Commit your own work with clear messages referencing issue numbers when applicable.

COMMIT SUBJECT CONVENTION — ROADMAP section numbers are NOT GitHub issue numbers. When referencing a ROADMAP section in a commit subject, write it as \`ROADMAP-46\`, \`§46\`, or \`ROADMAP §46\` — NEVER \`#46\` — because GitHub auto-links any bare \`#NN\` to issue/PR #NN in this repo, which produces wrong cross-references in the nightly PR. Use bare \`#NN\` ONLY for real GitHub issues (e.g. \`Refs #403\`, \`Fixes #370\`, \`create #433 for ROADMAP-46\`).

"

INSTRUCTIONS=(
    # 1. METHODIST
    "${CONTEXT_PREFIX}Read .claude/agents/methodist.md. Your role this hour:
- Scan pedagogical structure of course modules (skip Alphabet and Numbers — owner is happy with them). Focus on 'Verbs of Movement' and later modules.
- First, read your existing feedback: 'gh issue list --label methodist --state open --limit 50'. Do NOT duplicate issues you already filed.
- For NEW pedagogical problems only, file GitHub issues with 'gh issue create --label methodist'. Title should be concise, body should state: problem, affected module, suggested fix.
- Do NOT edit code. Do NOT touch ROADMAP.md directly — product does that.
At the very end output '=== SUMMARY ===' with 3-7 bullets."

    # 2. NATIVE REVIEWER
    "${CONTEXT_PREFIX}Read .claude/agents/native-reviewer.md. Your role this hour:
- You are a BILINGUAL Georgian+Russian native speaker. Your job is real-language proofreading, NOT pedagogy. Methodist already handles lesson ordering — you only look at whether each Georgian sentence is correct, natural, and whether the Russian translation accurately conveys it.
- Priority #1 is VERBS: conjugation (personal forms), tense (present vs future vs aorist), class (transitive/intransitive/inverse — მინდა/მიყვარს/მესმის take dative subjects), preverbs (და-/შე-/გა-/მო-/მი-/გადა-), version vowels (-ი-/-უ-/-ე-), ergative case in aorist for transitive verbs. Owner explicitly flagged verbs as the problem zone.
- Priority #2: cases, adjective agreement, word order (no Russian calques).
- Priority #3: naturalness + accurate Russian translation + register (ты/вы).
- Priority #4: typos, Georgian letter confusions (ჩ/ც, ძ/ზ, ჰ/ხ).
- First check 'gh issue list --label native --state all --limit 30' — don't duplicate.
- Sources: src/Trale/Lessons/**/questions*.json and src/Trale/MiniApp/MiniAppContentProvider.cs (theory examples/list/paragraph blocks). Skip .cs/.tsx for code review — only extract Georgian text from them.
- Minimum per session: one launch-module (Alphabet/Numbers/Intro/Pronouns/Present-Tense/My-Vocab) + one non-launch module. Verbs of Movement and verb-classes are top priority.
- SMALL fixes (typos, wrong personal form, wrong case in an example pair, wrong preverb when obviously required) — commit directly with 'content(<module>): native fix — <what> <lessonN>' and reference file:line.
- LARGER/disputed cases (replace whole example, swap lexicon, fix depends on unknown context, 'sounds unnatural' is an opinion) — 'gh issue create --label native' with title '[native] <module> L<N>: <short>' and body with file:line, current text, why wrong, native phrasing, confidence (уверен/сомневаюсь).
- HARD RULES: no rewriting to taste; no pedagogy changes; standard Tbilisi Georgian; Russian stylistic preferences are NOT errors; when in doubt — issue, not commit.
- Do NOT touch ROADMAP.md.
At the very end output '=== SUMMARY ===' with 3-7 bullets: modules reviewed, fixes committed, issues filed."

    # 3. DESIGNER (idea generator — runs BEFORE product)
    "${CONTEXT_PREFIX}Read .claude/agents/designer.md. You have the official Anthropic 'frontend-design' skill loaded — check '/skills' and use it when proposing aesthetic direction, typography, color, and animation. It steers AWAY from generic 'AI aesthetic' toward distinctive, production-grade UI.

NEW ROLE THIS HOUR: you are an IDEA GENERATOR, not a spec bottleneck. Methodist and native-reviewer feed product with content/language ideas — you feed product with DESIGN ideas on the same input-phase. tech-lead writes the acceptance criteria later; you do NOT need to produce a formal spec for every idea.

- First check 'gh issue list --label design --state open --limit 30' so you don't duplicate.
- AUDIT the current mini-app UI (src/Trale/miniapp-src/src/) and the onboarding/checkout/profile flows. Spot:
  * Screens that feel generic or inconsistent with Minankari (palette, jewel-tile, kilim-progress).
  * Moments where a grusinian 'reveal' (letter, numeral, word) could replace a generic element.
  * Friction points: ambiguous CTAs, unclear state, bad empty states, misaligned spacing.
  * Missed opportunities in launch-checklist features (STRATEGY.md).
- For each finding, file 'gh issue create --label design' with: title '[design] <area>: <short>', body with: current state (path + what's wrong), proposed direction (palette/component/motion notes, 3-8 bullets), expected UX impact, whether tech-lead can decompose from these notes alone OR a full design-specs/ file is needed.
- For BIG features (whole new flow, new major component) where notes aren't enough: create design-specs/<slug>.md with goal, user flows, screen sketches, component breakdown, states, copy, accessibility. Still open the design issue and link the spec from it. This is the EXCEPTION, not the default.
- Do NOT touch ROADMAP.md directly — product does that based on your issues.
At the very end output '=== SUMMARY ===' with 3-7 bullets: areas audited, issues filed, specs created (if any)."

    # 4. PRODUCT
    "${CONTEXT_PREFIX}Read .claude/agents/product.md. Also read STRATEGY.md FIRST — it defines the current product phase and the launch checklist. Your role this hour:

AGGREGATE inputs from the three upstream reviewers (methodist, native-reviewer, designer):
- Read STRATEGY.md (current phase, launch checklist).
- Read ROADMAP.md (backlog, philosophy).
- 'gh issue list --label methodist --state open --limit 50'
- 'gh issue list --label native --state open --limit 50'
- 'gh issue list --label design --state open --limit 50'
- 'gh issue list --label product --state open --limit 50'

TRIAGE all three streams: for each relevant issue, add to ROADMAP.md as [idea] or [launch] if it closes a checklist item; source-link the issue number; close/comment on the issue once reflected. Max 5 per session. Note: native-reviewer issues are usually content-fix granularity — most do NOT need ROADMAP entries, they go straight to developer; only surface here if the fix is big enough (whole example swap or lexicon change). Design issues with clear acceptance criteria can skip ROADMAP and go straight to tech-lead as a [launch] entry.

GENERATE your own ideas (you are not just reacting): features closing launch-checklist items, marketing angles (Batumi expat chats, referral loops), retention mechanics (Bombora feeding tamagotchi), onboarding copy, positioning. File them as GitHub issues with label 'product' (and 'launch' if applicable).

BACKLOG RULE: if ROADMAP already has 5+ [idea]/[launch] tasks, DO NOT generate new ideas — only triage and prioritize.

PRIORITIZE: move tasks in ROADMAP. Items closing launch-checklist rank highest. Update STRATEGY.md if a checklist item is done.

Do NOT create small technical issues — that is tech-lead's job.
At the very end output '=== SUMMARY ===' with 3-7 bullets."

    # 5. TECH-LEAD (BREAKDOWN only — review slot runs after QA)
    "${CONTEXT_PREFIX}Read .claude/agents/tech-lead.md AND ARCHITECTURE.md. You have the official Microsoft .NET Agent Skills loaded (dotnet, dotnet-aspnet, dotnet-data, dotnet-test, dotnet-nuget) — check '/skills' to discover them and invoke when writing acceptance criteria that touch EF migrations, tests, ASP.NET endpoints, or NuGet decisions.

THIS SLOT IS BREAKDOWN ONLY. Architecture review runs AFTER QA in a separate tech-lead-review slot — do NOT do that work here.

BREAKDOWN (creating the execution backlog with acceptance criteria):
- Preferred source: ROADMAP.md entries with status [designed] or [launch]. For [designed] items, a design-spec in design-specs/ exists — link it from the task body. For [launch] items without a full spec, acceptance criteria from the related design issue ('gh issue list --label design') are usually enough.
- [idea] entries skip until product or designer has promoted them.
- For each qualifying entry without a corresponding open GitHub 'task' issue, break it into SMALL technical issues (ideally 1-4 hours each).
- Priority rule: if the ROADMAP section is tagged [launch] OR directly closes a STRATEGY.md launch-checklist item, the task gets label P1. Other useful work is P2. Polish / post-launch ideas are P3.
- Create each with 'gh issue create --label task --label <priority>'. Body MUST include: acceptance criteria (3-7 bullets, testable), design-spec path (if [designed]), linked design/native/methodist issues it closes, sketch of files/classes to touch.
- Cross-link: in the ROADMAP section, add a reference like '(issues: #N, #M)'.
At the very end output '=== SUMMARY ===' with 3-7 bullets: issues created, backlog state."

    # 6. DEVELOPER
    "${CONTEXT_PREFIX}Read .claude/agents/developer.md AND ARCHITECTURE.md. You have the official Microsoft .NET Agent Skills loaded (dotnet, dotnet-aspnet, dotnet-data, dotnet-test, dotnet-nuget) plus the Roslyn language server via lsp.json, AND the Anthropic 'frontend-design' skill for mini-app React/CSS work — check '/skills' to list all. When writing C#/ASP.NET/EF code, invoke the relevant .NET skill (e.g. for new endpoints, EF migrations, test scaffolding). When touching miniapp-src (React, Tailwind, CSS), invoke frontend-design so the implementation matches the designer's aesthetic intent instead of generic defaults. LSP diagnostics are available for reading symbols/references in the sln.

TTS for Georgian audio content: when an issue asks for audio files (e.g. Listen & Choose content, pronunciation samples), use the Piper wrapper: /scripts/tts-generate.sh \"<Georgian text>\" <output.ogg>. Voice is ka_GE-natia-medium (neural, female). Output audio goes under src/Trale/miniapp-src/public/audio/<module>/<slug>.ogg — Vite's public/ folder is copied into wwwroot during build, so these files DO get shipped with the app. Commit the generated .ogg files with the code that references them. Do NOT write audio into wwwroot/ directly (it's gitignored).

Your role this hour:
- Pick ONE task to work on, in this priority order:
    1) any open issue labelled 'needs-fix' (tech-lead sent back for rework) assigned to you or unassigned,
    2) else any open issue labelled 'bug' with no assignee (CONTENT BUGS from methodist are HIGHEST product priority — users will see wrong grammar; prefer issues that also have 'methodist' label),
    3) else highest-priority open issue labelled 'task' AND 'P1' with no assignee,
    4) else 'task' + 'P2' with no assignee,
    5) else 'task' + 'P3' with no assignee.
- Assign the issue to yourself: 'gh issue edit <N> --add-assignee @me' (or just add a comment 'Taking this' if assignment fails).
- Implement it on the shared branch. Follow ARCHITECTURE.md: new use cases as services (not MediatR), Clean Architecture layers, unit tests for new business logic.
- Run 'dotnet test' (must be green) and 'cd src/Trale/miniapp-src && npm run build'.
- Commit with 'Fixes #<N>' or 'Refs #<N>' in the message.
- Do NOT close the issue yourself — tech-lead/QA decides.
At the very end output '=== SUMMARY ===' with 3-7 bullets: issue picked, files changed, test results."

    # 7. QA
    "${CONTEXT_PREFIX}Read .claude/agents/qa.md. You have the official Microsoft .NET Agent Skills loaded including dotnet-diag (performance/debugging/incident analysis) and dotnet-test (test execution, filtering, failure triage) — check '/skills' and use them to diagnose failing tests or flaky integration runs. Your role this hour (after developer):
- Run the FULL test pass on the current state of the shared branch: 'dotnet test TraleBot.sln' (ALL projects, IntegrationTests included — Testcontainers works here, env vars TESTCONTAINERS_RYUK_DISABLED + TESTCONTAINERS_HOST_OVERRIDE are set in compose) + 'cd src/Trale/miniapp-src && npm run build'. Check migrations if DB code changed.
- HARD GATE: the hour does NOT close until 'dotnet test TraleBot.sln' is green locally. If IntegrationTests fail — do NOT write 'skipped/unavailable' in the report, that is always an infra bug and must be filed as such.
- If builds/tests fail: either fix small things yourself (stale snapshot, missing lemma in theory, wwwroot rebuild, missing migration .Designer.cs), or revert the last developer commit to return to green, or comment on the issue that developer just touched with the failure details and add label 'needs-fix'. Do NOT leave the branch red for the next hour.
- Append integration findings to 'qa-report-${TODAY}.md' at repo root (create if absent). One dated section per hour. Explicitly record the result of 'dotnet test TraleBot.sln' (pass/fail + count).
At the very end output '=== SUMMARY ===' with 3-7 bullets: what you ran, whether 'dotnet test TraleBot.sln' ended green, what passed, what failed, follow-ups filed."

    # 8. TECH-LEAD-REVIEW (architecture review — runs LAST, after QA)
    "${CONTEXT_PREFIX}Read .claude/agents/tech-lead.md AND ARCHITECTURE.md. You have the official Microsoft .NET Agent Skills loaded (dotnet, dotnet-aspnet, dotnet-data, dotnet-test, dotnet-nuget) — invoke them when reviewing C# code, tests, EF migrations, or package decisions so feedback matches Microsoft's own .NET team standards.

THIS SLOT IS ARCHITECTURE REVIEW ONLY. The breakdown happened earlier this hour in the tech-lead-breakdown slot — do NOT create more task issues here.

ARCHITECTURE REVIEW (of this hour's developer + QA work):
- Look at the last developer commit (git log --author-date-order --grep='\\[developer\\]' -1) AND the QA output from this hour (latest '[qa]' commit notes + qa-report-${TODAY}.md).
- Compare against ARCHITECTURE.md: Clean Architecture layers respected, new use cases as services (NOT MediatR), SRP, no dead code, no leaky abstractions, EF queries sane (no N+1), migrations reversible, tests cover the real behaviour (not just the happy path).
- Boy-scout fixes (small): apply in place — tighten types, delete dead code, add missing unit tests, split a too-big file.
- Real regressions (bigger): re-open the relevant GitHub issue OR open a follow-up with label 'needs-fix' and a 3-7 bullet remediation plan. Do NOT silently leave the issue closed if the implementation is broken.
- Run 'dotnet test' at the end — must be green when you finish your part.
At the very end output '=== SUMMARY ===' with 3-7 bullets: commits reviewed, fixes applied, needs-fix opened."
)

# --- Build shared hour context -------------------------------------------------
# Each agent previously re-ran the same git-log / git-diff / gh-issue-list
# queries at the top of its prompt, which (a) chewed tokens on redundant tool
# calls and (b) produced subtly different snapshots when issues landed mid-hour.
# We now snapshot this context ONCE per hour and point every agent at it.
{
    echo "# Shared context — ${HOUR_STAMP}"
    echo ""
    echo "Nightly branch: \`${BRANCH}\`  •  Mode: \`${MODE}\`"
    echo ""
    echo "## Recent commits on nightly branch (main..HEAD, up to 50)"
    echo ""
    echo '```'
    git log --oneline -50 "main..HEAD" 2>/dev/null || echo "(no commits yet tonight)"
    echo '```'
    echo ""
    echo "## Touched files (main..HEAD)"
    echo ""
    echo '```'
    git diff --stat "main..HEAD" 2>/dev/null || echo "(no diff)"
    echo '```'
    echo ""
    echo "## Open issue counts by label"
    echo ""
    for lbl in methodist native design product task bug needs-fix P1 P2 P3; do
        count=$(gh issue list --label "$lbl" --state open --limit 100 --json number 2>/dev/null \
                    | jq 'length' 2>/dev/null || echo "?")
        printf -- "- **%s**: %s\n" "$lbl" "$count"
    done
    echo ""
    echo "## Most recently filed open issues (last 15)"
    echo ""
    gh issue list --state open --limit 15 --json number,title,labels \
        --template '{{range .}}- #{{.number}} {{.title}} {{range .labels}}[{{.name}}] {{end}}
{{end}}' 2>/dev/null || echo "(gh unavailable)"
    echo ""
} > "${SHARED_CONTEXT_FILE}"

echo ">>> Shared context written to ${SHARED_CONTEXT_FILE}"
echo ""

# --- Run agents -----------------------------------------------------------------
> "${SUMMARY_FILE}"

# Initialise the per-hour token usage table.
{
    echo "# Token usage — ${HOUR_STAMP} (mode: ${MODE})"
    echo ""
    echo "| Agent | Turns | Input | Output | Cache read | Cache create | Cost (USD) |"
    echo "|-------|------:|------:|-------:|-----------:|-------------:|-----------:|"
} > "${TOKEN_USAGE_FILE}"

# Running totals for the final row.
TOTAL_TURNS=0
TOTAL_INPUT=0
TOTAL_OUTPUT=0
TOTAL_CACHE_READ=0
TOTAL_CACHE_CREATE=0
# Cost is a float — accumulate via awk at print time.
COST_VALUES=()

for i in "${AGENT_INDICES[@]}"; do
    agent="${AGENTS[$i]}"
    label="${AGENT_LABELS[$i]}"
    instruction="${INSTRUCTIONS[$i]}"
    turns="${MAX_TURNS_PER_AGENT[$i]}"
    log_file="${LOG_DIR}/${agent}.log"
    jsonl_file="${LOG_DIR}/${agent}.jsonl"
    stderr_file="${LOG_DIR}/${agent}.stderr.log"

    echo ""
    echo ">>> [${agent}] starting at $(date)"

    # Commit anything the previous agent left uncommitted. We look up the last
    # executed agent from LAST_AGENT rather than $((i-1)), because AGENT_INDICES
    # may be non-contiguous in build mode (4,5,6,7 skips 0..3).
    if ! git diff --quiet || ! git diff --staged --quiet || [ -n "$(git ls-files --others --exclude-standard)" ]; then
        prev_agent="${LAST_AGENT:-prev}"
        git add -A
        git commit -m "[${prev_agent}] ${HOUR_STAMP}" --allow-empty 2>/dev/null || true
    fi

    # stream-json gives us per-event JSON (system/assistant/user/result) which
    # (a) contains the final usage+cost report in the `result` event, and
    # (b) still lets us emit a human-readable .log by filtering assistant text.
    # We keep the raw jsonl for audit and feed text through jq into the .log
    # so the existing === SUMMARY === / max-turns detection keeps working.
    # shellcheck disable=SC2046  # word-splitting is intentional here
    claude \
        $(agent_plugin_args "${agent}") \
        -p "${instruction}" \
        --dangerously-skip-permissions \
        --max-turns "${turns}" \
        --output-format stream-json \
        --verbose \
        2>"${stderr_file}" \
        | tee "${jsonl_file}" \
        | jq -r 'select(.type=="assistant") | .message.content[]? | select(.type=="text") | .text // empty' 2>/dev/null \
        | tee "${log_file}"

    # Commit this agent's work immediately so the next agent sees it in git log
    if ! git diff --quiet || ! git diff --staged --quiet || [ -n "$(git ls-files --others --exclude-standard)" ]; then
        git add -A
        git commit -m "[${agent}] ${HOUR_STAMP}" 2>/dev/null || true
    fi

    # --- Extract usage from the final `result` event ---------------------------
    USAGE_JSON=$(jq -c 'select(.type=="result")' "${jsonl_file}" 2>/dev/null | tail -1)
    if [ -n "${USAGE_JSON}" ]; then
        u_turns=$(echo "${USAGE_JSON}"      | jq -r '.num_turns                     // 0')
        u_input=$(echo "${USAGE_JSON}"      | jq -r '.usage.input_tokens            // 0')
        u_output=$(echo "${USAGE_JSON}"     | jq -r '.usage.output_tokens           // 0')
        u_cache_read=$(echo "${USAGE_JSON}" | jq -r '.usage.cache_read_input_tokens // 0')
        u_cache_cr=$(echo "${USAGE_JSON}"   | jq -r '.usage.cache_creation_input_tokens // 0')
        u_cost=$(echo "${USAGE_JSON}"       | jq -r '.total_cost_usd // .cost_usd   // 0')
        u_subtype=$(echo "${USAGE_JSON}"    | jq -r '.subtype                       // "unknown"')

        printf -- "| %s | %s | %s | %s | %s | %s | %s |\n" \
            "${agent} (${u_subtype})" \
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
        printf -- "| %s | ? | ? | ? | ? | ? | ? |\n" "${agent} (no result event)" \
            >> "${TOKEN_USAGE_FILE}"
    fi

    AGENT_SUMMARY=$(sed -n '/=== SUMMARY ===/,$ p' "${log_file}" | tail -n +2)

    # Turn-limit detection: if the agent produced no "=== SUMMARY ===" marker
    # AND the log tail hints at a cutoff, assume max-turns was reached.
    # Claude CLI prints a "Reached max turns" / "Max turns reached" line when
    # --max-turns is exhausted. Record this in a distinct audit file so the
    # morning QA pass can see which slots ran out of headroom.
    TURN_ALERTS_FILE="${LOG_DIR}/turn-alerts.md"
    if [ -z "${AGENT_SUMMARY}" ]; then
        # u_subtype is set by the result-event extractor above; in stream-json,
        # a non-"success" subtype (e.g. "error_max_turns") is the authoritative
        # signal. Fall back to grep on the text log for older behavior.
        if [ "${u_subtype:-}" != "success" ] && [ -n "${u_subtype:-}" ]; then
            alert="⚠️  ${label} (${agent}) ended with result subtype=${u_subtype} at ${HOUR_STAMP} (max-turns=${turns}). No === SUMMARY === produced. See ${log_file} and ${jsonl_file}."
        elif grep -qiE 'max.?turns.*(reached|exceeded|hit)|reached.*max.?turns' "${log_file}" 2>/dev/null; then
            alert="⚠️  ${label} (${agent}) hit max-turns cap of ${turns} at ${HOUR_STAMP} — no === SUMMARY === produced. See ${log_file}."
        else
            alert="⚠️  ${label} (${agent}) did not produce === SUMMARY === at ${HOUR_STAMP}. Max-turns=${turns}. Could be early exit, crash, or silent truncation. See ${log_file}."
        fi
        echo "${alert}"
        echo "- ${alert}" >> "${TURN_ALERTS_FILE}"
    fi

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
    LAST_AGENT="${agent}"
done

# --- Finalize per-hour token usage table --------------------------------------
TOTAL_COST=$(printf '%s\n' "${COST_VALUES[@]:-0}" | awk 'BEGIN{s=0} {s+=$1} END{printf "%.4f", s}')
{
    printf -- "| **TOTAL** | **%s** | **%s** | **%s** | **%s** | **%s** | **%s** |\n" \
        "${TOTAL_TURNS}" "${TOTAL_INPUT}" "${TOTAL_OUTPUT}" \
        "${TOTAL_CACHE_READ}" "${TOTAL_CACHE_CREATE}" "${TOTAL_COST}"
    echo ""
} >> "${TOKEN_USAGE_FILE}"

echo ""
echo ">>> Hour ${HOUR_STAMP} tokens: in=${TOTAL_INPUT} out=${TOTAL_OUTPUT} cache_read=${TOTAL_CACHE_READ} cost=\$${TOTAL_COST}"

# Append this hour's table to the nightly rolling log so morning QA has one
# file per night instead of chasing 8 directories.
{
    echo ""
    cat "${TOKEN_USAGE_FILE}"
} >> "${TOKEN_USAGE_NIGHTLY}"

# --- Append turn-limit alerts to qa-report so owner can see them --------------
if [ -f "${LOG_DIR}/turn-alerts.md" ]; then
    QA_REPORT="${REPO_DIR}/qa-report-${TODAY}.md"
    {
        echo ""
        echo "## Turn-limit alerts — ${HOUR_STAMP}"
        echo ""
        cat "${LOG_DIR}/turn-alerts.md"
    } >> "${QA_REPORT}"
    # Stage this update so it lands in the next commit (usually the next agent's,
    # or the final nothing-to-push check below commits an empty agent-less change).
    if ! git diff --quiet -- "${QA_REPORT}"; then
        git add "${QA_REPORT}"
        git commit -m "pipeline: turn-limit alerts ${HOUR_STAMP}" 2>/dev/null || true
    fi
fi

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
