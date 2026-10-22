"""T.DOT 6 (all Toronto music, slow + mellow): look every song of tools/tdot6_songs.txt up on YouTube (yt-dlp search, no API quota),
then keep only embeddable public videos of a sane length (YouTube Data API, 1 unit per 50 ids). Writes data/tdot6-all-videos.json [{id,title,dur,pub}]."""
import json, os, re, subprocess, sys, urllib.parse, urllib.request
from concurrent.futures import ThreadPoolExecutor
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KEY = open(os.path.expanduser('~/.config/1upradio/youtube.key')).read().strip()
songs = []
for l in open(os.path.join(HERE, 'tools/tdot6_songs.txt')):
    l = l.strip()
    if l and not l.startswith('#') and '|' in l:
        t, a = [x.strip() for x in l.split('|', 1)]
        if (t, a) not in songs: songs.append((t, a))
def find(ta):
    t, a = ta
    try:
        r = subprocess.run(['yt-dlp', '--no-warnings', '--skip-download', '--print', '%(id)s|%(duration)s|%(channel)s|%(title)s', 'ytsearch3:%s %s official audio' % (a, t)], capture_output=True, text=True, timeout=90).stdout.strip().splitlines()
    except Exception: return None
    best = None
    for line in r:
        p = line.split('|', 3)
        if len(p) < 4: continue
        vid, dur, ch, title = p
        try: dur = int(float(dur))
        except Exception: continue
        if not 90 <= dur <= 540: continue
        score = (a.lower().split()[0] in ch.lower() or a.lower().split()[0] in title.lower()) * 2 + (t.lower()[:6] in title.lower())
        if 'live' in title.lower() or 'remix' in title.lower() or 'cover' in title.lower() or 'karaoke' in title.lower(): score -= 3
        if best is None or score > best[0]: best = (score, vid)
    return (ta, best[1]) if best and best[0] >= 2 else (ta, None)
with ThreadPoolExecutor(6) as ex: found = list(ex.map(find, songs))
ids = {}
for ta, vid in found:
    if vid and vid not in ids.values(): ids[ta] = vid
print(len(songs), 'songs;', len(ids), 'found', flush=True)
out = []
items = list(ids.items())
def iso(d):
    m = re.match(r'PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$', d or ''); return int(m.group(1) or 0) * 3600 + int(m.group(2) or 0) * 60 + int(m.group(3) or 0) if m else 0
for i in range(0, len(items), 50):
    chunk = items[i:i + 50]; byid = {v: k for k, v in chunk}
    q = urllib.parse.urlencode({'part': 'snippet,contentDetails,status', 'id': ','.join(byid), 'key': KEY})
    for v in json.load(urllib.request.urlopen('https://www.googleapis.com/youtube/v3/videos?' + q, timeout=30)).get('items', []):
        st = v['status']; d = iso(v['contentDetails']['duration'])
        if st.get('embeddable') and st.get('privacyStatus') == 'public' and 90 <= d <= 540:
            t, a = byid[v['id']]
            out.append({'id': v['id'], 'title': '%s - %s' % (t, a), 'dur': d, 'pub': v['snippet']['publishedAt']})
json.dump(out, open(os.path.join(HERE, 'data/tdot6-all-videos.json'), 'w'), ensure_ascii=False, separators=(',', ':'))
print(len(out), 'songs embeddable ->', 'data/tdot6-all-videos.json')
