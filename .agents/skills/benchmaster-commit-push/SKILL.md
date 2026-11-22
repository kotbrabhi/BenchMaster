---
name: benchmaster-commit-push
description: Prepare and push BenchMaster changes when asked to commit or push; inspect the diff, run relevant build checks (especially Angular component style budgets), then commit and push the intended changes.
---

# Commit and push BenchMaster changes

Use this skill when the user asks to commit, push, or commit and push work in this repository. Treat the current user request as authorization for those Git actions, but do not include unrelated changes in the commit.

## Workflow

1. Read the repository instructions and inspect `git status`, the current branch, upstream, and the full diff. Identify generated files, unrelated edits, secrets, and untracked files. Never stage unrelated files just to make the tree clean.
2. Infer the checks from the changed files. For frontend or shared application changes, run `npm run build --workspace frontend` (or the root `npm run build` when backend changes also need coverage). The Angular production build enforces `anyComponentStyle` budgets in `frontend/angular.json`; treat a budget error as a release blocker and fix the source stylesheet before committing. Review warnings, especially styles near the error threshold, and report them accurately.
3. For backend changes, run the relevant backend build. Run tests or other checks when they exist and are relevant; do not invent tests or alter budget configuration merely to hide a failure.
4. Review the final diff and `git diff --check`. Stage only the files needed for the requested change. Use a concise commit message consistent with recent repository history.
5. Push the requested branch to its configured upstream. If no upstream exists, inspect remotes and branch state and report the exact command or destination needed rather than guessing. If checks fail, credentials are unavailable, or the push is rejected, stop and report the concrete blocker without claiming success.
6. Afterward, verify the commit hash and push result, and summarize checks, warnings, committed files, and any unrelated work left untouched.

## BenchMaster build details

- Root `npm run build` builds the backend and frontend workspaces.
- `npm run build --workspace frontend` runs the Angular production build.
- Production Angular budgets are in `frontend/angular.json`. Component styles warn above 10 kB and fail above 12 kB. Fix component stylesheet size when it exceeds the error budget; do not raise the project budget unless the user specifically asks for a budget policy change.
