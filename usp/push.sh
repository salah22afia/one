#!/bin/sh
# Commit everything and push to GitHub. Usage: ./push.sh ["commit message"]
set -e
cd "$(dirname "$0")"
git add -A
git diff --cached --quiet || git commit -m "${1:-wip $(date '+%Y-%m-%d %H:%M')}"
git push
