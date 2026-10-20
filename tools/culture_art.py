"""Culture Shock album covers: look every song up on Apple Music (iTunes Search API, no key) and keep the cover URL in data/culture-art.json {video id: url or ''}.
Slow on purpose (the API allows ~20 searches a minute); only songs not looked at yet are searched."""
import json, os, re, sys, time, unicodedata, urllib.parse, urllib.request
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VIDEOS, OUT = os.path.join(HERE, 'data/culture-videos.json'), os.path.join(HERE, 'data/culture-art.json')
def fold(s): return re.sub(r'[^a-z0-9]+', ' ', ''.join(c for c in unicodedata.normalize('NFD', (s or '').lower()) if unicodedata.category(c) != 'Mn')).strip()
STOP = {'version', 'dub', 'the', 'and', 'a', 'of', 'in', 'to', 'mix', 'feat', 'ft', 'pt', 'part'}
def toks(s): return {w for w in fold(s).split() if w not in STOP}
def cands(t):
    s = re.sub(r'\s*[\(\[][^)\]]*[\)\]]', '', t); parts = [x.strip() for x in re.split(r'\s[-–—]\s', s) if x.strip()]
    first = lambda x: re.split(r'\s*/\s*', x)[0].strip()
    if len(parts) < 2:
        segs = [x.strip() for x in (parts[0] if parts else s).split('/') if x.strip()]
        if len(segs) >= 3: return [(segs[-2], segs[0]), (segs[-1], segs[0])]       # "Song / Version / Artist / Artist2"
        return []
    a, b = parts[0], ' - '.join(parts[1:])
    return [(first(b), first(a)), (first(a), first(b))]          # (artist, track): this channel writes "Song - Artist" first
def search(term):
    u = 'https://itunes.apple.com/search?media=music&entity=song&limit=10&term=' + urllib.parse.quote(term)
    for n in range(3):
        try:
            with urllib.request.urlopen(urllib.request.Request(u, headers={'User-Agent': '1upradio'}), timeout=20) as r: return json.load(r).get('results', [])
        except Exception: time.sleep(20)
    return None
def deezer(path, q):
    u = 'https://api.deezer.com/' + path + '?limit=10&q=' + urllib.parse.quote(q)
    for n in range(3):
        try:
            with urllib.request.urlopen(urllib.request.Request(u, headers={'User-Agent': '1upradio'}), timeout=20) as r: d = json.load(r)
            if d.get('error'): time.sleep(5); continue
            return d.get('data', [])
        except Exception: time.sleep(5)
    return []
def ok_match(T, A, xt, xa, xc=''):
    """strict: the song title must be the same words (ignoring Version/Dub) AND the artist the same (or one name inside the other).
    Anything doubtful returns False, and the site then keeps the YouTube picture."""
    if not T or not A or not xt or not xa: return False
    return T == xt and (A <= xa or xa <= A)
ARTIST = {}
def artist_cover(art):
    """no exact song found: the cover of the artist's best-known album (Deezer first, then Apple)"""
    if not art: return ''
    if art in ARTIST: return ARTIST[art]
    A = toks(art); out = ''
    for x in deezer('search/album', art):
        xa = toks((x.get('artist') or {}).get('name'))
        if A and len(A & xa) / len(A) >= 0.99 and len(xa - A) <= 1: out = x.get('cover_xl') or x.get('cover_big') or ''; break
    time.sleep(0.2)
    if not out:
        u = 'https://itunes.apple.com/search?media=music&entity=album&limit=5&term=' + urllib.parse.quote(art)
        try:
            with urllib.request.urlopen(urllib.request.Request(u, headers={'User-Agent': '1upradio'}), timeout=20) as r: rs = json.load(r).get('results', [])
            for x in rs:
                xa = toks(x.get('artistName'))
                if A and len(A & xa) / len(A) >= 0.99 and len(xa - A) <= 1: out = (x.get('artworkUrl100') or '').replace('100x100bb', '600x600bb'); break
        except Exception: pass
        time.sleep(3.2)
    ARTIST[art] = out; return out
def find(title):
    cs = cands(title)
    for art, tr in cs:                                         # 1. the exact song on Deezer (fast, no key)
        T, A = toks(tr), toks(art)
        for x in deezer('search', (art + ' ' + tr).strip()):
            if ok_match(T, A, toks(x.get('title')), toks((x.get('artist') or {}).get('name')), (x.get('album') or {}).get('title')):
                c = (x.get('album') or {}).get('cover_xl') or ''
                if c: return c
        time.sleep(0.2)
    for art, tr in cs:                                         # 2. the exact song on Apple Music
        rs = search((art + ' ' + tr).strip())
        if rs is None: return None
        time.sleep(3.2)
        T, A = toks(tr), toks(art)
        for x in rs:
            if ok_match(T, A, toks(x.get('trackName')), toks(x.get('artistName')), x.get('collectionName')):
                c = (x.get('artworkUrl100') or '').replace('100x100bb', '600x600bb')
                if c: return c
    return ''                                                  # not found: the site keeps the song's own YouTube picture (no guessing with another album)
RETRY = 3 * 86400          # a song with no cover yet is searched again every 3 days (labels and catalogs keep growing)
def main(loop=False):
    TRIED = OUT.replace('.json', '-tried.json')
    while True:
        vids = json.load(open(VIDEOS)); done = json.load(open(OUT)) if os.path.exists(OUT) else {}; tried = json.load(open(TRIED)) if os.path.exists(TRIED) else {}; n = 0; now = time.time()
        try:   # songs about to air first
            sched = json.load(open(os.path.join(HERE, 'schedule-culture.json')))['plays']; rank = {}
            for p in sorted(sched, key=lambda p: p['t']):
                if p['t'] + p['dur'] >= now: rank.setdefault(p['id'], len(rank))
            vids = sorted(vids, key=lambda v: rank.get(v['id'], 10 ** 6))
        except Exception: pass
        for v in vids:
            if done.get(v['id']): continue
            if v['id'] in done and now - tried.get(v['id'], 0) < RETRY: continue
            r = find(v['title'])
            if r is None: break                  # rate-limited: stop, resume next round
            done[v['id']] = r; tried[v['id']] = time.time(); n += 1
            if n % 10 == 0: json.dump(done, open(OUT, 'w'), separators=(',', ':')); json.dump(tried, open(TRIED, 'w'), separators=(',', ':'))
        json.dump(done, open(OUT, 'w'), separators=(',', ':')); json.dump(tried, open(TRIED, 'w'), separators=(',', ':'))
        print('covers:', sum(1 for u in done.values() if u), 'found of', len(done), 'looked up', flush=True)
        if not loop: return
        time.sleep(1800 if not n else 60)
if __name__ == '__main__': main('--loop' in sys.argv)
