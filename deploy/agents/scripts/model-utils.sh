# model-utils.sh — shared per-role model routing for the agent pipeline.
#
# Why: Opus costs roughly 5x Sonnet at API rates. Since the 2026-06-15 billing
# split, a headless `claude -p` run no longer draws on the subscription's
# interactive pool — it spends a separate monthly agent credit at API rates.
# To stretch that credit, the code-heavy roles (write / break down / review)
# run on Opus, where the extra capability pays for itself, and the planning /
# pedagogy / text / QA roles run on Sonnet.
#
# Routing keys off the role/phase name each script already passes to its agent
# runner, covering both naming schemes in use:
#   - run-pipeline.sh phase labels: `developer`, `tech-lead-breakdown`,
#     `tech-lead-review`, `product`, `methodist`, `native-reviewer`, `qa`
#   - dispatch / run-agent role names: `developer`, `tech-lead`, `designer`, `qa`, …
#
# Overrides (either tier, via env):
#   PIPELINE_MODEL_HEAVY=sonnet  → run the whole pipeline cheap
#   PIPELINE_MODEL_LIGHT=opus    → put everything back on Opus
#
# Sourced — defines functions and (overridable) config, runs nothing on its own.

HEAVY_MODEL="${PIPELINE_MODEL_HEAVY:-opus}"
LIGHT_MODEL="${PIPELINE_MODEL_LIGHT:-sonnet}"

# resolve_model <role/phase name> → prints the model alias for that agent.
# `tech-lead-*` covers the run-pipeline phase variants (breakdown / review);
# bare `tech-lead` covers the dispatch + legacy role name. Everything else
# (product / designer / methodist / native-reviewer / qa) is light.
resolve_model() {
    case "$1" in
        developer|tech-lead|tech-lead-*) echo "${HEAVY_MODEL}" ;;
        *)                               echo "${LIGHT_MODEL}" ;;
    esac
}

# agent_model_args <role/phase name> → prints `--model <alias> ` for splicing
# into a `claude` invocation, or nothing if the model can't be resolved.
agent_model_args() {
    local model
    model="$(resolve_model "$1")"
    [ -n "${model}" ] && printf -- '--model %s ' "${model}"
}
