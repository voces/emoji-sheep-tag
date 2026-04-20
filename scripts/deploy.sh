#!/bin/bash
set -euo pipefail

REPO="voces/emoji-sheep-tag"
SHA=$(git rev-parse HEAD)

echo "Waiting for CI to pass on $(git log --oneline -1)..."

while true; do
  RESULT=$(gh api "repos/$REPO/commits/$SHA/check-runs" \
    --jq '[.check_runs[] | select(.name == "build" or .name == "Tests" or .name == "Lint & Format" or .name == "Test Summary")] |
      if length == 0 then "pending"
      elif any(.conclusion == null) then "pending"
      elif all(.conclusion == "success") then "success"
      else "failure"
      end')

  case "$RESULT" in
    success) echo "CI passed."; break ;;
    failure) echo "CI failed!"; exit 1 ;;
    *) printf "."; sleep 10 ;;
  esac
done

echo "Triggering deploy..."
RUN_URL=$(gh workflow run deploy -R "$REPO" 2>&1 | grep -o 'https://[^ ]*')
RUN_ID=$(basename "$RUN_URL")

gh run watch "$RUN_ID" -R "$REPO" --exit-status
