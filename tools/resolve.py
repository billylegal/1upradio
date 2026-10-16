"""Find a YouTube video for every distinct track in data/plays.json -> data/tracks.json  {oid: {id, yt_title, dur, score}}"""
import json, re, sys, os, unicodedata, urllib.parse, urllib.request
from concurrent.futures import ThreadPoolExecutor
def fold(t):
    t = unicodedata.normalize('NFD', t.lower()); t = ''.join(c for c in t if unicodedata.category(c) != 'Mn')
    return re.sub(r'[^a-z0-9 ]+', ' ', t)
def toks(t): return {w for w in fold(t).split() if len(w) > 1 and w not in ('the','and','feat','ft','mix','original','remix','edit','radio','version','extended','video','official','audio')}
def query(title):
    t = re.sub(r'\s+-\s+(Original|Extended|Radio|Club|Video|Dub)\s*(Mix|Edit|Version)?\s*$', '', title, flags=re.I)
    return t
def pick(title, entries):
    want = toks(title); best = None
    for d in entries:
        yt = d.get('title') or ''; dur = d.get('duration') or 0
        if dur and (dur < 90 or dur > 900): continue          # no 1-hour mixes, no snippets
        if re.search(r'\b(live|cover|karaoke|reaction|slowed|sped up|nightcore|8d|full album|mix \d+|hour)\b', yt, re.I) and not re.search(r'\b(live|cover|karaoke|reaction|slowed|sped up|nightcore|8d|full album|mix \d+|hour)\b', title, re.I): continue
        have = toks(yt + ' ' + (d.get('channel') or ''))
        score = len(want & have) / max(1, len(want))
        if re.search(r'official|audio|topic', yt + (d.get('channel') or ''), re.I): score += 0.08
        if best is None or score > best[0]: best = (score, d)
    return best
KEY_FILE = os.path.expanduser("~/.config/1upradio/youtube.key")
API = "https://www.googleapis.com/youtube/v3/"
def api(path, params):
    key = open(KEY_FILE).read().strip()
    q = urllib.parse.urlencode(dict(params, key=key))
    with urllib.request.urlopen(API + path + "?" + q, timeout=30) as r:
        return json.load(r)
def iso_secs(d):
    m = re.match(r'PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$', d or '')
    return (int(m.group(1) or 0) * 3600 + int(m.group(2) or 0) * 60 + int(m.group(3) or 0)) if m else 0
def search(title):
    # official Data API (search = 100 quota units each); durations come from one cheap videos.list call
    found = api("search", {"part": "snippet", "q": query(title), "type": "video", "maxResults": 5})
    ids = [i["id"]["videoId"] for i in found.get("items", []) if i.get("id", {}).get("videoId")]
    if not ids: return []
    vids = api("videos", {"part": "contentDetails,snippet", "id": ",".join(ids)})
    out = []
    for v in vids.get("items", []):
        out.append({"id": v["id"], "title": v["snippet"]["title"], "channel": v["snippet"]["channelTitle"],
                    "duration": iso_secs(v["contentDetails"]["duration"])})
    return out
def resolve(item):
    oid, title = item
    try: ents = search(title)
    except Exception: return oid, None
    b = pick(title, ents)
    if not b or b[0] < 0.5: return oid, {'miss': True, 'q': title}
    d = b[1]; return oid, {'id': d['id'], 'yt': d.get('title'), 'dur': d.get('duration'), 'score': round(b[0], 2), 'ch': d.get('channel')}
def main(limit=None, workers=4):
    plays = json.load(open('data/plays.json'))
    titles = {}
    for p in plays: titles.setdefault(p['oid'], p['title'])
    have = json.load(open('data/tracks.json')) if os.path.exists('data/tracks.json') else {}
    todo = [(o, t) for o, t in titles.items() if o not in have][:limit]
    with ThreadPoolExecutor(workers) as ex:
        for i, (oid, r) in enumerate(ex.map(resolve, todo)):
            if r is not None: have[oid] = r
            if i % 25 == 0: json.dump(have, open('data/tracks.json', 'w'), ensure_ascii=False)
    json.dump(have, open('data/tracks.json', 'w'), ensure_ascii=False)
    hit = sum(1 for v in have.values() if v.get('id')); print(hit, 'resolved,', len(have) - hit, 'missing of', len(have))
if __name__ == '__main__': main(int(sys.argv[1]) if len(sys.argv) > 1 else None)
