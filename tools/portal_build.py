"""The Portal: for every track of data/portal-charts.json find its official upload on YouTube (yt-dlp search, no API quota; results cached in
data/portal-cache.json so a daily refresh only looks up NEW chart entries), keep embeddable public videos (Data API, 1 unit / 50 ids), and write
data/portal-<genre>-videos.json  [{id,title,dur,pub}]  plus data/portal-videos.json (all genres, each song once, ordered by chart rank interleaved)."""
import json, os, re, subprocess, sys, urllib.parse, urllib.request
from concurrent.futures import ThreadPoolExecutor
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KEY = open(os.path.expanduser('~/.config/1upradio/youtube.key')).read().strip()
CH = json.load(open(os.path.join(HERE, 'data/portal-charts.json')))
CACHE_P = os.path.join(HERE, 'data/portal-cache.json')
try: CACHE = json.load(open(CACHE_P))
except Exception: CACHE = {}
BAD = ('live set', 'live at', 'cover', 'karaoke', 'mashup', '1 hour', 'hour mix', 'full album', 'reaction', 'tutorial', 'lyrics video')
def norm(s): return re.sub(r'[^a-z0-9]+', ' ', (s or '').lower()).strip()
def key_of(t): return norm(' '.join(t['artists'][:2]) + ' ' + t['title'] + ' ' + t['mix'])
def find(t):
    k = key_of(t)
    if k in CACHE: return k, CACHE[k]
    title = t['title']; art = t['artists'][0] if t['artists'] else ''
    q = '%s %s' % (art, title)
    try:
        lines = subprocess.run(['yt-dlp', '--no-warnings', '--skip-download', '--print', '%(id)s|%(duration)s|%(channel)s|%(title)s', 'ytsearch4:' + q], capture_output=True, text=True, timeout=90).stdout.strip().splitlines()
    except Exception: return k, None
    best = None; at = norm(art).split(); tt = [w for w in norm(title).split() if len(w) > 2][:3]
    for line in lines:
        p = line.split('|', 3)
        if len(p) < 4: continue
        vid, dur, ch, vt = p
        try: dur = int(float(dur))
        except Exception: continue
        if not 120 <= dur <= 720: continue
        h = norm(vt + ' ' + ch)
        if any(b in h for b in BAD): continue
        s = (2 if at and at[0] in h else 0) + sum(1 for w in tt if w in h)
        if best is None or s > best[0]: best = (s, vid)
    res = best[1] if best and best[0] >= 3 else None
    CACHE[k] = res
    return k, res
tracks = []
for slug, g in CH.items():
    for rank, t in enumerate(g['tracks']): tracks.append((slug, rank, t))
uniq = {key_of(t): t for _, _, t in tracks}
with ThreadPoolExecutor(6) as ex: list(ex.map(find, uniq.values()))
json.dump(CACHE, open(CACHE_P, 'w'), separators=(',', ':'))
ids = sorted({v for v in CACHE.values() if v})
def iso(d):
    m = re.match(r'PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$', d or ''); return int(m.group(1) or 0) * 3600 + int(m.group(2) or 0) * 60 + int(m.group(3) or 0) if m else 0
meta = {}
for i in range(0, len(ids), 50):
    q = urllib.parse.urlencode({'part': 'snippet,contentDetails,status', 'id': ','.join(ids[i:i + 50]), 'key': KEY})
    for v in json.load(urllib.request.urlopen('https://www.googleapis.com/youtube/v3/videos?' + q, timeout=30)).get('items', []):
        st = v['status']; d = iso(v['contentDetails']['duration'])
        if st.get('embeddable') and st.get('privacyStatus') == 'public' and 120 <= d <= 720: meta[v['id']] = {'dur': d, 'pub': v['snippet']['publishedAt']}
def label(t):
    mix = '' if t['mix'] in ('Original Mix', 'Extended Mix', 'Extended', 'Original', '') else ' (%s)' % t['mix']
    return '%s%s - %s' % (t['title'], mix, ', '.join(t['artists'][:3]))
allv, seen = [], set(); stats = {}
for slug, g in CH.items():
    out = []
    for t in g['tracks']:
        vid = CACHE.get(key_of(t))
        if vid and vid in meta and vid not in {o['id'] for o in out}:
            out.append({'id': vid, 'title': label(t), 'dur': meta[vid]['dur'], 'pub': meta[vid]['pub']})
    json.dump(out, open(os.path.join(HERE, 'data/portal-%s-videos.json' % slug), 'w'), ensure_ascii=False, separators=(',', ':'))
    stats[slug] = (len(g['tracks']), len(out))
# the main Portal channel: chart rank 1..100 of every genre interleaved
rank_order = sorted(((r, s, t) for s, r, t in tracks), key=lambda x: (x[0], x[1]))
NOT_PORTAL = {'dance-pop', 'funky-house'}   # Billy: no commercial pop on the Portal, only the underground chart genres
COMMERCIAL = re.compile(r'david guetta|hugel|calvin harris|martin garrix|tiësto|tiesto|swedish house mafia|alesso|kygo|avicii|marshmello|the chainsmokers|zedd|dua lipa|ava max|sigala|jonas blue|robin schulz|lost frequencies|ed sheeran|rihanna|bruno mars|justin bieber|ariana grande|the weeknd|david guetta', re.I)
rank_order = [x for x in rank_order if x[1] not in NOT_PORTAL and not COMMERCIAL.search(' '.join(x[2]['artists']))]
for r, s, t in rank_order:
    vid = CACHE.get(key_of(t))
    if vid and vid in meta and vid not in seen:
        seen.add(vid); allv.append({'id': vid, 'title': label(t), 'dur': meta[vid]['dur'], 'pub': meta[vid]['pub']})
json.dump(allv, open(os.path.join(HERE, 'data/portal-videos.json'), 'w'), ensure_ascii=False, separators=(',', ':'))
for s, (a, b) in stats.items(): print('%-28s %3d charted -> %3d playable' % (s, a, b))
print('THE PORTAL: %d unique playable songs, %.1f hours' % (len(allv), sum(v['dur'] for v in allv) / 3600))
