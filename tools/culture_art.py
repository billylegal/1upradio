"""Culture Shock album covers: look every song up on Apple Music (iTunes Search API, no key) and keep the cover URL in data/culture-art.json {video id: url or ''}.
Slow on purpose (the API allows ~20 searches a minute); only songs not looked at yet are searched."""
import json, os, re, sys, time, difflib, unicodedata, urllib.parse, urllib.request
try:
    from ytmusicapi import YTMusic
    _YTM = YTMusic()
except Exception:
    _YTM = None
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
def squash(t): return re.sub(r'[^a-z0-9]', '', fold(t))
def title_same(a, b):
    """same title: equal once spaces/punctuation are ignored ("Superstar" = "Super Star"), or nearly equal; Version/Dub words are ignored"""
    ta, tb = ''.join(sorted(toks(a))) if False else squash(' '.join(w for w in fold(a).split() if w not in STOP)), squash(' '.join(w for w in fold(b).split() if w not in STOP))
    return bool(ta) and bool(tb) and (ta == tb or difflib.SequenceMatcher(None, ta, tb).ratio() >= 0.88)
def ok_match(T, A, xt, xa, xc=''):
    """strict: the song title must be the same (words, ignoring Version/Dub) AND the artist the same (or one name inside the other).
    Anything doubtful returns False, and the site then keeps the YouTube picture."""
    if not T or not A or not xt or not xa: return False
    return (T == xt or title_same(' '.join(T), ' '.join(xt))) and (A <= xa or xa <= A)
def ytm_cover(art, tr):
    """YouTube Music: the song's album art (search without a key through ytmusicapi)"""
    if _YTM is None or not art or not tr: return ''
    try: rs = _YTM.search((art + ' ' + tr).strip(), filter='songs', limit=6)
    except Exception: return ''
    A = toks(art)
    for x in rs:
        xa = toks(' '.join(a['name'] for a in (x.get('artists') or [])))
        if A and (A <= xa or xa <= A) and title_same(tr, x.get('title') or '') and x.get('thumbnails'):
            u = x['thumbnails'][-1]['url']
            return re.sub(r'=w\d+-h\d+', '=w600-h600', u)
    return ''

DISCOGS_KEY = os.path.expanduser('~/.config/1upradio/discogs.token')
def discogs_cover(art, tr):
    """Discogs (needs the free token in ~/.config/1upradio/discogs.token): the cover / label picture of a release that has this song by this artist"""
    if not os.path.exists(DISCOGS_KEY) or not art or not tr: return ''
    tok = open(DISCOGS_KEY).read().strip()
    u = 'https://api.discogs.com/database/search?type=release&per_page=8&artist=%s&track=%s&token=%s' % (urllib.parse.quote(art), urllib.parse.quote(tr), tok)
    try:
        with urllib.request.urlopen(urllib.request.Request(u, headers={'User-Agent': '1upradio/1.0 +https://1upradio.com'}), timeout=25) as r: rs = json.load(r).get('results', [])
    except Exception: return ''
    finally: time.sleep(1.1)           # 60 requests a minute
    A = toks(art)
    for x in rs:
        name = x.get('title') or ''; who = toks(name.split(' - ')[0])
        img = x.get('cover_image') or ''
        if img and 'spacer' not in img and A and (A <= who or who <= A): return img
    return ''

MB_UA = {'User-Agent': '1upradio/1.0 ( https://1upradio.com )'}
def mb_cover(art, tr):
    """MusicBrainz + Cover Art Archive (no key): the sleeve scan of a release that has this recording by this artist - often the real record / vinyl cover"""
    if not art or not tr: return ''
    q = 'recording:"%s" AND artist:"%s"' % (tr.replace('"', ' '), art.replace('"', ' '))
    try:
        with urllib.request.urlopen(urllib.request.Request('https://musicbrainz.org/ws/2/recording?fmt=json&limit=6&query=' + urllib.parse.quote(q), headers=MB_UA), timeout=25) as r: rs = json.load(r).get('recordings', [])
    except Exception: return ''
    finally: time.sleep(1.1)
    T, A = toks(tr), toks(art); tried = 0
    for x in rs:
        if x.get('score', 0) < 90: continue
        xa = toks(' '.join(c.get('name', '') for c in (x.get('artist-credit') or []) if isinstance(c, dict)))
        if not ok_match(T, A, toks(x.get('title')), xa): continue
        for rel in (x.get('releases') or [])[:6]:
            if tried >= 6: return ''
            tried += 1
            try:
                with urllib.request.urlopen(urllib.request.Request('https://coverartarchive.org/release/' + rel['id'], headers=MB_UA), timeout=25) as r: im = json.load(r).get('images', [])
            except Exception: im = []
            finally: time.sleep(1.1)
            for i in im:
                if i.get('front'):
                    u = (i.get('thumbnails') or {}).get('500') or (i.get('thumbnails') or {}).get('large') or ''
                    if u: return u.replace('http://', 'https://')
    return ''
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
    for art, tr in cs:                                         # 3. YouTube Music
        c = ytm_cover(art, tr); time.sleep(0.4)
        if c: return c
    for art, tr in cs:                                         # 4. Discogs (original sleeves and labels of old singles)
        c = discogs_cover(art, tr)
        if c: return c
    for art, tr in cs:                                         # 5. MusicBrainz / Cover Art Archive (sleeve scans)
        c = mb_cover(art, tr)
        if c: return c
    return ''                                                  # not found: the site keeps the song's own YouTube picture (no guessing with another album)
RETRY = 3 * 86400          # a song with no cover yet is searched again every 3 days (labels and catalogs keep growing)
STATIONS = [('main', 'data/main-videos.json', 'data/main-art.json', 'schedule.json'),
            ('culture', 'data/culture-videos.json', 'data/culture-art.json', 'schedule-culture.json'),
            ('movement', 'data/movement-videos.json', 'data/movement-art.json', 'schedule-movement.json'),
            ('hiphopvinyl', 'data/hiphopvinyl-videos.json', 'data/hiphopvinyl-art.json', 'schedule-hiphopvinyl.json')]
def station(name, vfile, afile, sfile, budget):
    """one pass over a station's songs; stops after `budget` searches so the stations take turns"""
    V, OUT_ = os.path.join(HERE, vfile), os.path.join(HERE, afile); TRIED = OUT_.replace('.json', '-tried.json')
    if not os.path.exists(V): return 0
    vids = json.load(open(V)); done = json.load(open(OUT_)) if os.path.exists(OUT_) else {}; tried = json.load(open(TRIED)) if os.path.exists(TRIED) else {}; n = 0; now = time.time()
    try:   # covers found by Magic Ear (listening + AcoustID) fill the gaps
        for k, u in json.load(open(OUT_.replace('-art.json', '-art-ear.json'))).items():
            if u and not done.get(k): done[k] = u
    except Exception: pass
    try:   # songs about to air first
        sched = json.load(open(os.path.join(HERE, sfile)))['plays']; rank = {}
        for p in sorted(sched, key=lambda p: p['t']):
            if p['t'] + p['dur'] >= now: rank.setdefault(p['id'], len(rank))
        vids = sorted(vids, key=lambda v: rank.get(v['id'], 10 ** 6))
    except Exception: pass
    for v in vids:
        if n >= budget: break
        if done.get(v['id']): continue
        if v['id'] in done and now - tried.get(v['id'], 0) < RETRY: continue
        r = find(v['title'])
        if r is None: break                  # rate-limited: stop, resume next round
        done[v['id']] = r; tried[v['id']] = time.time(); n += 1
        if n % 10 == 0: json.dump(done, open(OUT_, 'w'), separators=(',', ':')); json.dump(tried, open(TRIED, 'w'), separators=(',', ':'))
    json.dump(done, open(OUT_, 'w'), separators=(',', ':')); json.dump(tried, open(TRIED, 'w'), separators=(',', ':'))
    print('%s: covers %d found of %d looked up (%d searched now)' % (name, sum(1 for u in done.values() if u), len(done), n), flush=True)
    return n
def main(loop=False):
    while True:
        total = 0
        for st in STATIONS: total += station(*st, budget=60)
        if not loop: return
        time.sleep(1800 if not total else 20)
if __name__ == '__main__': main('--loop' in sys.argv)
