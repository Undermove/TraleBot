# pr-utils.sh — shared "open / refresh the nightly PR + CI-gate" helper.
#
# Factored from the proven block in run-qa.sh so other on-demand flows (the
# "finish epic" dispatch) can land work as a reviewable PR the same way the
# morning cron does — without duplicating the REST/CI-gate quirks.
#
# open_or_refresh_pr <branch> <title> <body>
#   - Opens a DRAFT PR (base=main, head=<branch>), or refreshes the body of the
#     existing open PR via REST PATCH (gh pr edit fails on repos with classic
#     Projects attached — REST avoids the GraphQL projects enumeration).
#   - Waits up to CI_GATE_SECONDS for GitHub Actions. Green → promote to "ready
#     for review". Red/timeout → leave as draft and comment the failing checks.
#   - Sets globals PR_NUMBER, PR_URL, PR_CI ("green" | "red") for the caller.
#     Returns 1 (and leaves PR_NUMBER empty) if the PR could not be created.
#
# Sourced — defines a function, runs nothing on its own.

CI_GATE_SECONDS="${CI_GATE_SECONDS:-900}"

open_or_refresh_pr() {
    local branch="$1" title="$2" body="$3"
    local repo_slug existing
    PR_NUMBER=""; PR_URL=""; PR_CI=""

    repo_slug=$(git config --get remote.origin.url | sed -E 's#.*github\.com[:/]([^/]+/[^/.]+).*#\1#')
    existing=$(gh pr list --head "${branch}" --state open --json number --jq '.[0].number' 2>/dev/null || true)

    if [ -n "${existing}" ]; then
        echo ">>> PR #${existing} already exists for ${branch}. Updating body via REST."
        gh api "repos/${repo_slug}/pulls/${existing}" --method PATCH -f body="${body}" --jq .html_url >/dev/null 2>&1 || true
        PR_NUMBER="${existing}"
    else
        PR_NUMBER=$(gh pr create --title "${title}" --body "${body}" --base main --head "${branch}" --draft \
            | grep -oE '/pull/[0-9]+' | grep -oE '[0-9]+' || true)
    fi
    [ -z "${PR_NUMBER}" ] && return 1
    PR_URL="https://github.com/${repo_slug}/pull/${PR_NUMBER}"

    echo ">>> Waiting for CI on PR #${PR_NUMBER} (up to ${CI_GATE_SECONDS}s)..."
    if timeout "${CI_GATE_SECONDS}" gh pr checks "${PR_NUMBER}" --watch --fail-fast >/dev/null 2>&1; then
        gh pr ready "${PR_NUMBER}" 2>/dev/null || true
        echo ">>> CI green → PR #${PR_NUMBER} promoted to ready for review."
        PR_CI="green"
    else
        local failed
        failed=$(gh pr checks "${PR_NUMBER}" --json name,state,link \
            --jq '.[] | select(.state != "SUCCESS") | "- " + .name + " (" + .state + ") " + .link' 2>/dev/null || echo "- see Actions tab")
        gh pr comment "${PR_NUMBER}" --body "🚧 Оставлен в draft — CI не зелёный.

${failed}

Следующему developer-слоту стоит взять это как priority #1." 2>/dev/null || true
        echo ">>> CI red/timeout → PR #${PR_NUMBER} stays draft."
        PR_CI="red"
    fi
    return 0
}
