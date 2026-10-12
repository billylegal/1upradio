"""Find a YouTube video for every distinct track in data/plays.json -> data/tracks.json  {oid: {id, yt_title, dur, score}}"""
import json, re, subprocess, sys, os, unicodedata
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
def resolve(item):
    oid, title = item
    try:
        out = subprocess.run(["yt-dlp", "--flat-playlist", "--dump-json", "-I", "1:6", "ytsearch6:" + query(title)], capture_output=True, text=True, timeout=60).stdout
    except Exception: return oid, None
    ents = []
    for l in out.splitlines():
        try: ents.append(json.loads(l))
        except Exception: pass
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
