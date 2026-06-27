#!/usr/bin/env bash
set -Eeuo pipefail

REPO_URL="https://github.com/abdullahak07/HealthApp.git"
BRANCH="main"
SOURCE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORK_ROOT="${TMPDIR:-/tmp}/healthapp-deploy"
CLONE_DIR="$WORK_ROOT/repository"
TEXT_REPORT="$SOURCE_DIR/deploy-report.txt"
JSON_REPORT="$SOURCE_DIR/deploy-report.json"
STARTED_AT="$(date -Iseconds)"

mkdir -p "$WORK_ROOT"

write_report() {
  local verdict="$1"
  local message="$2"
  local finished_at
  finished_at="$(date -Iseconds)"

  cat > "$TEXT_REPORT" <<REPORT
HealthApp Ubuntu deployment report
==================================
Started:  $STARTED_AT
Finished: $finished_at
Verdict:  $verdict
Message:  $message
Repository: $REPO_URL
Branch: $BRANCH
REPORT

  python3 - "$JSON_REPORT" "$verdict" "$message" "$STARTED_AT" "$finished_at" <<'PY'
import json
import sys
from pathlib import Path

path, verdict, message, started, finished = sys.argv[1:]
Path(path).write_text(json.dumps({
    "project": "HealthApp",
    "verdict": verdict,
    "message": message,
    "started_at": started,
    "finished_at": finished,
    "repository": "https://github.com/abdullahak07/HealthApp",
    "branch": "main"
}, indent=2) + "\n", encoding="utf-8")
PY
}

on_error() {
  local exit_code=$?
  write_report "FAIL" "Deployment stopped at line ${BASH_LINENO[0]} with exit code $exit_code. Review the terminal output above."
  echo
  echo "OVERALL VERDICT: FAIL"
  echo "Report: $TEXT_REPORT"
  exit "$exit_code"
}
trap on_error ERR

for command in git node npm python3 rsync; do
  if ! command -v "$command" >/dev/null 2>&1; then
    echo "Missing required command: $command"
    echo "Install prerequisites with:"
    echo "sudo apt update && sudo apt install -y git nodejs npm python3 rsync"
    false
  fi
done

NODE_MAJOR="$(node -p "process.versions.node.split('.')[0]")"
if (( NODE_MAJOR < 18 )); then
  echo "Node.js 18 or newer is required. Current version: $(node -v)"
  false
fi

echo "[1/6] Installing and verifying the local application..."
cd "$SOURCE_DIR"
npm ci
npm run build
[[ -f "$SOURCE_DIR/dist/index.html" ]]

echo "[2/6] Preparing a clean Git clone..."
rm -rf "$CLONE_DIR"
git clone --branch "$BRANCH" "$REPO_URL" "$CLONE_DIR"

echo "[3/6] Copying the tested source code..."
rsync -a --delete \
  --exclude='.git/' \
  --exclude='node_modules/' \
  --exclude='dist/' \
  --exclude='deploy-report.txt' \
  --exclude='deploy-report.json' \
  "$SOURCE_DIR/" "$CLONE_DIR/"

echo "[4/6] Rebuilding inside the cloned repository..."
cd "$CLONE_DIR"
npm ci
npm run build
[[ -f "$CLONE_DIR/dist/index.html" ]]

echo "[5/6] Creating the Git commit..."
git config user.name "${GIT_USER_NAME:-Abdullah Ahmad Khan}"
git config user.email "${GIT_USER_EMAIL:-53994342+abdullahak07@users.noreply.github.com}"
git add --all

if git diff --cached --quiet; then
  echo "No source changes were detected; the repository is already current."
  COMMIT_SHA="$(git rev-parse HEAD)"
else
  git commit -m "Build initial HealthAI MVP"
  COMMIT_SHA="$(git rev-parse HEAD)"
fi

echo "[6/6] Pushing to GitHub..."
git push origin "$BRANCH"

write_report "PASS" "Production build passed and commit $COMMIT_SHA was pushed to $BRANCH."

echo
echo "OVERALL VERDICT: PASS"
echo "Commit: $COMMIT_SHA"
echo "Repository: https://github.com/abdullahak07/HealthApp"
echo "Report: $TEXT_REPORT"
