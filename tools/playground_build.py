#!/usr/bin/env python3
"""The Playground: every track the PLAYGRND SERIES DJs play (their set videos list each track as a chapter) -> a YouTube video for each song.
data/playgrnd/chapters.json -> data/playgrnd/tracks.json (unique songs) -> data/playground-videos.json [{id,title,dur,pub}] (embeddable public videos, 2-8 min). Resumable; search results cached in data/playgrnd/cache.json.
python3 tools/playground_build.py"""
import json, os, re, subprocess, sys, urllib.parse, urllib.request
from concurrent.futures import ThreadPoolExecutor
H = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KEY = open(os.path.expanduser('~/.config/1upradio/youtube.key')).read().strip()
D = H + '/data/playgrnd'; CACHE_P = D + '/cache.json'
CACHE = json.load(open(CACHE_P)) if os.path.exists(CACHE_P) else {}
BAD = ('live set', 'live at', 'cover', 'karaoke', 'mashup', 'reaction', 'tutorial', 'lyrics video', 'slowed', 'sped up', 'nightcore', '8d audio', 'instrumental', 'type beat', 'full album', 'megamix')
norm = lambda s: re.sub(r'[^a-z0-9]+', ' ', (s or '').lower()).strip()
EDIT = re.compile(r'\s*[\(\[][^\)\]]*(intro|outro|edit|clean|dirty|transition|bd |dj |blend|mashup|flip|rework|bootleg|vip|extended|acapella|quick hit|hype|remix|mix|version)[^\)\]]*[\)\]]', re.I)


def pretty(s):
    s = re.sub(r'\s+', ' ', s).strip()
    if s.upper() == s and any(c.isalpha() for c in s):
        s = s.title(); s = re.sub(r"\b(Ft|Feat)\b\.?", 'ft.', s); s = re.sub(r"(?<=\w)'S\b", "'s", s)
    return s


def tracks():
    ch = json.load(open(D + '/chapters.json')); u = {}
    for vid, v in ch.items():
        for t, c in v['chapters']:
            c = re.sub(r'\s+', ' ', c).strip()
            m = re.match(r'^(.*?)\s+[—–]\s+(.+)$', c) or re.match(r'^(.*)\s-\s(.+)$', c)
            if not m: continue
            title, art = m.group(1).strip(), m.group(2).strip()
            if re.search(r'^(intro|outro|interlude|transition|mic|hype)\b', title, re.I): continue
            core = EDIT.sub('', title).strip() or title
            k = norm(core) + '|' + norm(re.split(r' ft\.? | feat\.? | x | & |, ', art, flags=re.I)[0])
            e = u.setdefault(k, {'title': pretty(core), 'artist': pretty(art), 'n': 0}); e['n'] += 1
    return u


def find(item):
    k, t = item
    if k in CACHE: return
    q = '%s %s' % (re.split(r' ft\.? | feat\.? | x | & |, ', t['artist'], flags=re.I)[0], t['title'])
    try:
        lines = subprocess.run(['yt-dlp', '--no-warnings', '--skip-download', '--print', '%(id)s|%(duration)s|%(channel)s|%(title)s', 'ytsearch4:' + q], capture_output=True, text=True, timeout=90).stdout.strip().splitlines()
    except Exception: return
    best = None; at = norm(t['artist']).split(); tt = [w for w in norm(t['title']).split() if len(w) > 2][:3]
    for line in lines:
        p = line.split('|', 3)
        if len(p) < 4: continue
        vid, dur, ch, vt = p
        try: dur = int(float(dur))
        except Exception: continue
        if not 100 <= dur <= 480: continue
        h = norm(vt + ' ' + ch)
        if any(b in h for b in BAD): continue
        s = (2 if at and at[0] in h else 0) + sum(1 for w in tt if w in h) + (1 if 'official' in h or 'vevo' in h or 'topic' in h else 0)
        if best is None or s > best[0]: best = (s, vid)
    CACHE[k] = best[1] if best and best[0] >= 3 else ''


def iso(d):
    m = re.match(r'PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$', d or ''); return int(m.group(1) or 0) * 3600 + int(m.group(2) or 0) * 60 + int(m.group(3) or 0) if m else 0


def main():
    u = tracks(); json.dump(u, open(D + '/tracks.json', 'w'), ensure_ascii=False, separators=(',', ':')); print('unique songs', len(u), flush=True)
    todo = [(k, t) for k, t in u.items() if k not in CACHE]
    with ThreadPoolExecutor(6) as ex:
        for i in range(0, len(todo), 60):
            list(ex.map(find, todo[i:i + 60])); json.dump(CACHE, open(CACHE_P, 'w'), separators=(',', ':')); print('searched', min(i + 60, len(todo)), 'of', len(todo), flush=True)
    ids = sorted({v for v in CACHE.values() if v}); meta = {}
    for i in range(0, len(ids), 50):
        q = urllib.parse.urlencode({'part': 'snippet,contentDetails,status', 'id': ','.join(ids[i:i + 50]), 'key': KEY})
        for v in json.load(urllib.request.urlopen('https://www.googleapis.com/youtube/v3/videos?' + q, timeout=30)).get('items', []):
            st = v['status']; d = iso(v['contentDetails']['duration'])
            if st.get('embeddable') and st.get('privacyStatus') == 'public' and 100 <= d <= 480: meta[v['id']] = {'dur': d, 'pub': v['snippet']['publishedAt']}
    out, seen = [], set()
    for k, t in sorted(u.items(), key=lambda kv: -kv[1]['n']):
        vid = CACHE.get(k)
        if vid and vid in meta and vid not in seen:
            seen.add(vid); out.append({'id': vid, 'title': '%s - %s' % (t['title'], t['artist']), 'dur': meta[vid]['dur'], 'pub': meta[vid]['pub']})
    json.dump(out, open(H + '/data/playground-videos.json', 'w'), ensure_ascii=False, separators=(',', ':'))
    print('THE PLAYGROUND: %d playable songs of %d unique, %.1f hours' % (len(out), len(u), sum(v['dur'] for v in out) / 3600))


if __name__ == '__main__': main()
