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
MIX_STOP = set('remix mix extended edit version original radio rework the of club vip'.split())
MIX_GENERIC = {'', 'original mix', 'extended mix', 'extended', 'original', 'radio edit', 'original version', 'extended version'}
VERS = re.compile(r'\b(remix|rework|bootleg|mashup|vip|flip|re edit|cover|sped up|slowed|instrumental|acoustic|live)\b')
def right_version(t, vt):
    """the video must be the version the chart names: a remix chart entry needs the remixer's name in the video, an original needs a video that is not someone's remix"""
    h = norm(vt); m = norm(t['mix'])
    if m in MIX_GENERIC: return not VERS.search(h) or bool(VERS.search(norm(t['title'])))
    need = [w for w in m.split() if w not in MIX_STOP]
    if need: return all(w in h for w in need)
    return bool(re.search(r'remix|extended|edit|version|mix', h))
def find(t):
    k = key_of(t)
    if k in CACHE: return k, CACHE[k]
    title = t['title']; art = t['artists'][0] if t['artists'] else ''
    q = '%s %s%s' % (art, title, '' if norm(t['mix']) in MIX_GENERIC else ' ' + t['mix'])
    try:
        lines = subprocess.run(['yt-dlp', '--no-warnings', '--skip-download', '--print', '%(id)s|%(duration)s|%(channel)s|%(title)s', 'ytsearch8:' + q], capture_output=True, text=True, timeout=90).stdout.strip().splitlines()
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
        if not right_version(t, vt): continue   # wrong mix (the official video of the original instead of the remix, or the reverse): never use it
        if tt and not all(w in h for w in tt): continue
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
    return '%s - %s%s' % (', '.join(t['artists'][:3]), t['title'], mix)   # Artist - Song, like every other station
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
NOT_PORTAL = {'dance-pop', 'funky-house', 'house', 'bass-house', 'indie-tech'}   # Billy: no commercial pop on the Portal, only the underground chart genres
COMMERCIAL = re.compile(r'david guetta|hugel|calvin harris|martin garrix|tiësto|tiesto|swedish house mafia|alesso|kygo|avicii|marshmello|the chainsmokers|zedd|dua lipa|ava max|sigala|jonas blue|robin schulz|lost frequencies|ed sheeran|rihanna|bruno mars|justin bieber|ariana grande|the weeknd|david guetta', re.I)
rank_order = [x for x in rank_order if x[1] not in NOT_PORTAL and not COMMERCIAL.search(' '.join(x[2]['artists']))]
for r, s, t in rank_order:
    vid = CACHE.get(key_of(t))
    if vid and vid in meta and vid not in seen:
        seen.add(vid); allv.append({'id': vid, 'title': label(t), 'dur': meta[vid]['dur'], 'pub': meta[vid]['pub']})
json.dump(allv, open(os.path.join(HERE, 'data/portal-videos.json'), 'w'), ensure_ascii=False, separators=(',', ':'))
art = {}   # each song's own cover, straight from the chart data (the release artwork)
for slug, g in CH.items():
    for t in g['tracks']:
        vid = CACHE.get(key_of(t))
        if vid and vid in meta and t.get('img'): art.setdefault(vid, t['img'])
json.dump(art, open(os.path.join(HERE, 'data/portal-art.json'), 'w'), separators=(',', ':'))
print('covers:', len(art))
for s, (a, b) in stats.items(): print('%-28s %3d charted -> %3d playable' % (s, a, b))
print('THE PORTAL: %d unique playable songs, %.1f hours' % (len(allv), sum(v['dur'] for v in allv) / 3600))
# the "All genres" channel: every genre chart in one shuffled pool, commercial genres included
import random
_u, _s = [], set()
for _slug in sorted(CH):
    _p = os.path.join(HERE, 'data/portal-%s-videos.json' % _slug)
    for _x in json.load(open(_p)):
        if _x['id'] not in _s: _s.add(_x['id']); _u.append(_x)
random.Random(7).shuffle(_u)
json.dump(_u, open(os.path.join(HERE, 'data/portal-all-genres-videos.json'), 'w'), ensure_ascii=False, separators=(',', ':'))
print('ALL GENRES: %d songs' % len(_u))
# the "Commercial" channel: the five commercial charts together (kept out of the main Portal)
_c, _cs = [], set()
for _slug in ('dance-pop', 'funky-house', 'house', 'bass-house', 'indie-tech'):
    _p = os.path.join(HERE, 'data/portal-%s-videos.json' % _slug)
    if not os.path.exists(_p): continue
    for _x in json.load(open(_p)):
        if _x['id'] not in _cs: _cs.add(_x['id']); _c.append(_x)
random.Random(11).shuffle(_c)
json.dump(_c, open(os.path.join(HERE, 'data/portal-commercial-videos.json'), 'w'), ensure_ascii=False, separators=(',', ':'))
print('COMMERCIAL: %d songs' % len(_c))
