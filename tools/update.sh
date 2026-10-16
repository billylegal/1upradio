#!/bin/bash
# Keep 1UP Radio's schedule current (PC backup for the GitHub Actions job): start from the newest published copy, scrape, rebuild, publish.
cd "$HOME/1upradio" || exit 1
GH=(-c credential.helper= -c 'credential.helper=!gh auth git-credential')
exec 9>/tmp/1upradio-update.lock; flock -n 9 || exit 0
if [ -d .git/rebase-merge ] || [ -d .git/rebase-apply ]; then git rebase --abort >/dev/null 2>&1; fi
ONLINE=0
if git remote get-url origin >/dev/null 2>&1 && timeout 15 git "${GH[@]}" ls-remote -q origin HEAD >/dev/null 2>&1; then ONLINE=1; fi   # GitHub unreachable (account suspended): skip git, keep building the schedule here
if [ "$ONLINE" = 1 ]; then
  git checkout -q -- schedule.json data/plays.json data/tracks.json 2>/dev/null
  git "${GH[@]}" pull -q --rebase --autostash origin main >/dev/null 2>&1 || { git rebase --abort >/dev/null 2>&1; exit 0; }
fi
python3 tools/scrape.py 2 >/dev/null 2>&1
python3 tools/resolve.py >/dev/null 2>&1
python3 tools/build.py >/dev/null 2>&1
if [ "$ONLINE" = 1 ]; then
  git add schedule.json data/plays.json data/tracks.json 2>/dev/null
  git diff --cached --quiet || { git -c user.name="5ive7 Development Labs" -c user.email="5ive7@mail.com" commit -qm "schedule update" && git "${GH[@]}" push -q origin HEAD:main 2>/dev/null; }
fi
