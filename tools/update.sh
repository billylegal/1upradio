#!/bin/bash
# Keep 1UP Radio's schedule current: scrape the newest tracks, find any new songs on YouTube, rebuild schedule.json, publish if a git remote exists.
cd "$HOME/1upradio" || exit 1
python3 tools/scrape.py 2 >/dev/null 2>&1
python3 tools/resolve.py >/dev/null 2>&1
python3 tools/build.py >/dev/null 2>&1
if git remote get-url origin >/dev/null 2>&1; then
  git add schedule.json data/plays.json data/tracks.json 2>/dev/null
  git diff --cached --quiet || { git -c user.name="1UP Radio bot" -c user.email="bot@1upradio.com" commit -qm "schedule update" && git -c credential.helper= -c credential.helper='!gh auth git-credential' push -q origin HEAD 2>/dev/null; }
fi
