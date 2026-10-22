#!/usr/bin/env python3
"""PLAYGRND SERIES: every DJ set lists its tracks as chapters ("TITLE — ARTIST"). Read the chapters of each long video with yt-dlp (metadata only, nothing is downloaded) -> data/playgrnd/chapters.json {video id: {title, dur, chapters:[[start, text]...]}}. Resumable.
python3 tools/playgrnd_chapters.py"""
import json, os, re, subprocess, sys
from concurrent.futures import ThreadPoolExecutor
H = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
raw = json.load(open(H + '/data/playgrnd/videos-raw.json'))
OUT = H + '/data/playgrnd/chapters.json'
done = json.load(open(OUT)) if os.path.exists(OUT) else {}


def secs(d):
    m = re.match(r'PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$', d); return int(m.group(1) or 0) * 3600 + int(m.group(2) or 0) * 60 + int(m.group(3) or 0)


def one(v):
    for _ in range(2):
        try:
            r = subprocess.run(['yt-dlp', '-J', '--no-warnings', '--skip-download', 'https://www.youtube.com/watch?v=' + v['id']], capture_output=True, text=True, timeout=120)
            d = json.loads(r.stdout); return v['id'], {'title': v['title'], 'dur': secs(v['dur']), 'pub': v['pub'], 'chapters': [[c['start_time'], c['title']] for c in (d.get('chapters') or [])]}
        except Exception: continue
    return v['id'], None


todo = [v for v in raw if secs(v['dur']) > 1200 and v['id'] not in done]
print('sets to read', len(todo), flush=True)
with ThreadPoolExecutor(3) as ex:
    for n, (vid, r) in enumerate(ex.map(one, todo), 1):
        if r is not None: done[vid] = r
        if n % 5 == 0 or n == len(todo):
            json.dump(done, open(OUT, 'w'), ensure_ascii=False, separators=(',', ':')); print(n, 'of', len(todo), '| chapters so far', sum(len(x['chapters']) for x in done.values()), flush=True)
