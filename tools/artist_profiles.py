#!/usr/bin/env python3
"""Artist profiles from EVERYWHERE, so the cards in Artists A-Z stop looking plain.
Per artist (every name in the A-Z list, the busiest first) it asks, with the right manners for each service (no keys needed):
  - Apple Music / iTunes search  -> genre, official Apple Music page (the artist's name must match exactly; clashes are settled by our own song titles)
  - MusicBrainz                  -> type, country/city, start year, genres, official links (Spotify, Bandcamp, SoundCloud, Beatport, Discogs, Instagram, ...)
  - Wikipedia (only through MusicBrainz's own link, so it is the right person) -> short bio + photo
  - Deezer                       -> photo, fans, number of releases (identity checked against our song titles)
  - YouTube (Data API, own key)  -> the artist's own channel from the videos we play: subscribers, description, picture
  - our own data                 -> Beatport chart genres + labels, tempo, years and notes from the uploaders
Everything is cached in ~/.cache/artist-profiles/ (resumable, never asks twice) and merged into data/artist-profile/<letter>.json
  { normalised name: { "p": photo, "b": bio, "bs": bio credit, "f": [facts], "l": {link name: url}, "s": [credits] } }
Run:  python3 tools/artist_profiles.py            (all sources in parallel, rebuilds the shards every few minutes)
      python3 tools/artist_profiles.py --build    (only merge what is cached into the shards)
Spotify has no key-free API (links only come through MusicBrainz); Beatport blocks automatic reading (only what its charts gave us)."""
import glob, json, os, re, sys, threading, time, unicodedata, urllib.parse, urllib.request
H = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CD = os.environ.get('AP_CACHE') or os.path.expanduser('~/.cache/artist-profiles'); os.makedirs(CD, exist_ok=True)
OUT = os.environ.get('AP_OUT') or (H + '/data/artist-profile'); os.makedirs(OUT, exist_ok=True)
UA = '1UPRadio-artist-profiles/1.0 (https://1upradio.com; billylegalmusic@outlook.com)'
nrm = lambda s: re.sub(r'[^a-z0-9]+', ' ', ''.join(c for c in unicodedata.normalize('NFD', (s or '').lower()) if unicodedata.category(c) != 'Mn')).strip()
LOCK = threading.Lock()


def jget(url, headers=None, tries=3, wait=4):
    for i in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=dict({'User-Agent': UA}, **(headers or {}))), timeout=25) as r: return json.load(r)
        except urllib.error.HTTPError as e:
            if e.code == 404: return None
            time.sleep(wait * (i + 1) * (3 if e.code in (429, 503) else 1))
        except Exception: time.sleep(wait)
    return None


def load(p, d):
    try: return json.load(open(p))
    except Exception: return d


def save(p, o):
    with LOCK:
        json.dump(o, open(p + '.tmp', 'w'), ensure_ascii=False, separators=(',', ':')); os.replace(p + '.tmp', p)


def song_part(t):   # "A, B - Song (Mix)" -> "Song"
    s = t.split(' - ', 1)[-1]; return re.sub(r'\s*[\(\[].*$', '', s).strip()


# ---------------- the artists ----------------
def artists():
    """normalised name -> {'name', 'songs': [(station, title, vid)]}, busiest first"""
    A = {}
    for f in glob.glob(H + '/data/artists/*.json'):
        if f.endswith('index.json'): continue
        for nm, songs in json.load(open(f)):
            k = nrm(nm)
            if len(k) < 2: continue
            A[k] = {'name': nm, 'songs': songs}
    return sorted(A.items(), key=lambda kv: -len({s[2] for s in kv[1]['songs']}))


def our_titles(a): return [nrm(song_part(s[1])) for s in a['songs'] if len(nrm(song_part(s[1]))) >= 5]


# ---------------- workers ----------------
def worker_itunes(items):
    P = CD + '/itunes.json'; C = load(P, {}); n = 0
    for k, a in items:
        if k in C: continue
        res = 0
        d = jget('https://itunes.apple.com/search?' + urllib.parse.urlencode({'term': a['name'], 'entity': 'musicArtist', 'limit': 8}))
        time.sleep(1.2)
        ex = [r for r in (d or {}).get('results', []) if r.get('artistId') and nrm(r.get('artistName')) == k]
        pick = None; ver = 0
        if len(ex) == 1: pick = ex[0]
        elif len(ex) > 1:   # name clash: the one whose songs include one of ours
            mine = our_titles(a)
            for r in ex[:3]:
                s = jget('https://itunes.apple.com/lookup?id=%d&entity=song&limit=60' % r['artistId']); time.sleep(1.2)
                if any(any(m and (m == nrm(song_part(x.get('trackName', ''))) or (len(m) >= 8 and m in nrm(x.get('trackName', '')))) for m in mine) for x in (s or {}).get('results', [])): pick = r; ver = 1; break
        if pick: res = {'id': pick['artistId'], 'g': pick.get('primaryGenreName') or '', 'u': (pick.get('artistLinkUrl') or '').split('?')[0], 'v': ver}
        C[k] = res; n += 1
        if n % 50 == 0: save(P, C); print('itunes', len(C), flush=True)
    save(P, C)


def worker_mb(items):
    P = CD + '/mb.json'; C = load(P, {}); W = load(CD + '/wiki.json', {}); n = 0
    WP = CD + '/wiki.json'
    for k, a in items:
        if k in C and (not C[k] or C[k].get('id')): continue      # entries from the first version (no MusicBrainz id) are looked up again for the new fields
        res = 0
        d = jget('https://musicbrainz.org/ws/2/artist?' + urllib.parse.urlencode({'query': 'artist:"%s"' % a['name'].replace('"', ' '), 'limit': 6, 'fmt': 'json'})); time.sleep(1.1)
        ex = [x for x in (d or {}).get('artists', []) if nrm(x.get('name')) == k or any(nrm(al.get('name')) == k for al in x.get('aliases', []))]
        top = sorted(ex, key=lambda x: -x.get('score', 0))
        if top and top[0].get('score', 0) >= 95 and (len(top) == 1 or top[1].get('score', 0) < 90):
            m = top[0]
            L = jget('https://musicbrainz.org/ws/2/artist/%s?inc=url-rels+tags+genres+annotation&fmt=json' % m['id']); time.sleep(1.1)
            if L:
                rels = {}
                for r in L.get('relations', []):
                    u = (r.get('url') or {}).get('resource', ''); t = r.get('type', ''); h = urllib.parse.urlparse(u).netloc.lower().replace('www.', '')
                    key = None
                    if t == 'official homepage': key = 'Website'
                    elif 'spotify.com' in h: key = 'Spotify'
                    elif h.endswith('music.apple.com') or h.endswith('itunes.apple.com'): key = 'Apple Music'
                    elif h.endswith('deezer.com'): key = 'Deezer'
                    elif h.endswith('beatport.com'): key = 'Beatport'
                    elif h.endswith('bandcamp.com'): key = 'Bandcamp'
                    elif h.endswith('soundcloud.com'): key = 'SoundCloud'
                    elif h.endswith('discogs.com'): key = 'Discogs'
                    elif h.endswith('last.fm'): key = 'Last.fm'
                    elif h.endswith('allmusic.com'): key = 'AllMusic'
                    elif h.endswith('mixcloud.com'): key = 'Mixcloud'
                    elif h.endswith('tidal.com'): key = 'Tidal'
                    elif 'amazon.' in h: key = 'Amazon Music'
                    elif h.endswith('traxsource.com'): key = 'Traxsource'
                    elif h.endswith('junodownload.com'): key = 'Juno Download'
                    elif h.endswith('songkick.com'): key = 'Songkick'
                    elif h.endswith('bandsintown.com'): key = 'Bandsintown'
                    elif h.endswith('genius.com'): key = 'Genius'
                    elif h.endswith('linktr.ee') or h.endswith('beacons.ai'): key = 'Linktree'
                    elif h.endswith('wikidata.org'): key = 'Wikidata'; rels['_qid'] = u.rsplit('/', 1)[-1]
                    elif h.endswith('imdb.com'): key = 'IMDb'
                    elif h.endswith('ra.co') or h.endswith('residentadvisor.net'): key = 'Resident Advisor'
                    elif h.endswith('facebook.com'): key = 'Facebook'
                    elif h.endswith('instagram.com'): key = 'Instagram'
                    elif h.endswith('tiktok.com'): key = 'TikTok'
                    elif h.endswith('twitter.com') or h == 'x.com': key = 'X'
                    elif h.endswith('youtube.com'): key = 'YouTube'
                    elif t == 'wikipedia' and h == 'en.wikipedia.org': key = 'Wikipedia'
                    elif t == 'wikidata': rels['_qid'] = u.rsplit('/', 1)[-1]
                    if key and key not in rels: rels[key] = u
                tags = [t['name'] for t in sorted(L.get('genres', []) or L.get('tags', []), key=lambda t: -t.get('count', 0))][:4]
                ar = L.get('area') or {}; ba = L.get('begin-area') or {}
                an = re.sub(r'\[\[(?:[^\]|]*\|)?([^\]]*)\]\]', r'\1', re.sub(r"'{2,}", '', (L.get('annotation') or {}).get('text', '') if isinstance(L.get('annotation'), dict) else ''))
                an = re.sub(r'\s+', ' ', re.sub(r'https?://\S+|\{\{[^}]*\}\}', '', an)).strip()[:600]
                res = {'id': m['id'], 'an': an, 't': L.get('type') or '', 'c': L.get('country') or '', 'ar': ar.get('name') or '', 'ba': ba.get('name') or '', 'y': ((L.get('life-span') or {}).get('begin') or '')[:4],
                       'e': 1 if (L.get('life-span') or {}).get('ended') else 0, 'g': tags, 'd': L.get('disambiguation') or '', 'r': {a_: b_ for a_, b_ in rels.items() if a_ != '_qid'}}
                # Wikipedia, only through the link MusicBrainz itself gives (the right person)
                title = None
                if rels.get('Wikipedia'): title = urllib.parse.unquote(rels['Wikipedia'].rsplit('/wiki/', 1)[-1])
                elif rels.get('_qid'):
                    w = jget('https://www.wikidata.org/w/api.php?' + urllib.parse.urlencode({'action': 'wbgetentities', 'ids': rels['_qid'], 'props': 'sitelinks', 'sitefilter': 'enwiki', 'format': 'json'}))
                    sl = (((w or {}).get('entities') or {}).get(rels['_qid']) or {}).get('sitelinks', {}).get('enwiki')
                    if sl: title = sl['title']; res['r']['Wikipedia'] = 'https://en.wikipedia.org/wiki/' + urllib.parse.quote(title.replace(' ', '_'))
                if rels.get('_qid'):
                    wd = jget('https://www.wikidata.org/w/api.php?' + urllib.parse.urlencode({'action': 'wbgetentities', 'ids': rels['_qid'], 'props': 'descriptions', 'languages': 'en', 'format': 'json'}))
                    res['wd'] = ((((wd or {}).get('entities') or {}).get(rels['_qid']) or {}).get('descriptions') or {}).get('en', {}).get('value', '')
                if title:
                    s = jget('https://en.wikipedia.org/api/rest_v1/page/summary/' + urllib.parse.quote(title.replace(' ', '_'), safe=''))
                    if s and s.get('type') == 'standard' and s.get('extract'):
                        sents = re.split(r'(?<=[.!?])\s+(?=[A-Z])', s['extract'].strip()); txt = ''
                        for x in sents:
                            if len(txt) + len(x) > 460 and txt: break
                            txt += (' ' if txt else '') + x
                        W[k] = {'x': txt[:520], 'p': (s.get('thumbnail') or {}).get('source', ''), 'u': ((s.get('content_urls') or {}).get('desktop') or {}).get('page', '')}
        C[k] = res; n += 1
        if n % 25 == 0: save(P, C); save(WP, W); print('musicbrainz', len(C), 'wiki', len(W), flush=True)
    save(P, C); save(WP, W)


BOILER = re.compile(r'(^|\b)(cookie|javascript|log ?in|sign ?up|stream |listen to|listen on|discover |download |follow |buy |shop|official site|welcome to|monthly listeners|404|not found|the world.s (largest|biggest)|free to|all rights|bandcamp$|soundcloud$)', re.I)


BAD_BIO = re.compile(r'@|\\b(booking|mgmt|management|contact|enquir|inquir|press kit|e-?mail)\\b|\\breleased \\d|, released\\b|\\bby [^,]{2,40}, released|\\btrack(s)? from\\b|\\bforms? of\\b.*\\bcookie|\\bsubscribe\\b|\\bnew (album|single|ep|release)\\b.*\\b(out now|available)', re.I)


def og_text(url):
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (compatible; 1UPRadio-profiles/1.0; +https://1upradio.com)', 'Accept-Language': 'en'})
        with urllib.request.urlopen(req, timeout=15) as r: html = r.read(250000).decode('utf-8', 'replace')
    except Exception: return ''
    best = ''
    for pat in (r'<meta[^>]+(?:property|name)=["\'](?:og:description|twitter:description|description)["\'][^>]+content=["\']([^"\']{40,900})["\']', r'<meta[^>]+content=["\']([^"\']{40,900})["\'][^>]+(?:property|name)=["\'](?:og:description|twitter:description|description)["\']'):
        for m in re.finditer(pat, html, re.I):
            t = re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', ' ', m.group(1))).replace('&amp;', '&').replace('&quot;', '"').replace('&#39;', "'").replace('&#x27;', "'").strip()
            if len(t) >= 60 and not BOILER.search(t[:80]) and not BAD_BIO.search(t) and len(t) > len(best): best = t
    return best[:520]


def worker_pages(items):
    """the artist's own words (Bandcamp, SoundCloud, website, Last.fm, Mixcloud) for everyone MusicBrainz found; waits for MusicBrainz, so it keeps looping until it has caught up"""
    P = CD + '/pages.json'; C = load(P, {}); n = 0; idle = 0
    while idle < 3:
        MB = load(CD + '/mb.json', {}); did = 0
        for k, a in items:
            if k in C: continue
            M = MB.get(k)
            if not M or not M.get('id'): continue
            res = {}
            for kind in ('Bandcamp', 'SoundCloud', 'Website', 'Last.fm', 'Mixcloud'):
                u = (M.get('r') or {}).get(kind)
                if u:
                    t = og_text(u); time.sleep(1.0)
                    if t: res[kind] = t
            C[k] = res; n += 1; did += 1
            if n % 25 == 0: save(P, C); print('pages', len(C), flush=True)
        save(P, C)
        if len(MB) >= len(items) and not did: idle += 1
        elif not did: time.sleep(120)


def worker_deezer(items):
    P = CD + '/deezer.json'; C = load(P, {}); n = 0

    def g(path, **q):
        time.sleep(0.3); return jget('https://api.deezer.com/' + path + ('?' + urllib.parse.urlencode(q) if q else ''), tries=2, wait=3)
    for k, a in items:
        if k in C: continue
        res = 0
        s = g('search/artist', q=a['name'], limit=8)
        cands = [x for x in sorted((s or {}).get('data', []), key=lambda x: -x.get('nb_fan', 0)) if nrm(x.get('name')) == k][:2]
        mine = our_titles(a)
        for x in cands:
            tp = g('artist/%d/top' % x['id'], limit=50) or {}
            if any(len(nrm(r.get('title_short', ''))) >= 5 and any(nrm(r['title_short']) in m or m in nrm(r['title_short']) for m in mine) for r in tp.get('data', [])):
                al = g('artist/%d/albums' % x['id'], limit=100) or {}
                yrs = sorted(r['release_date'][:4] for r in al.get('data', []) if r.get('release_date', '0000') >= '1990')
                res = {'id': x['id'], 'p': x.get('picture_big') or x.get('picture_medium') or '', 'f': x.get('nb_fan', 0), 'u': x.get('link', ''), 'n': len(al.get('data', [])), 'y': yrs[0] if yrs else ''}
                break
        C[k] = res; n += 1
        if n % 50 == 0: save(P, C); print('deezer', len(C), flush=True)
    save(P, C)


def worker_youtube(items):
    key = open(os.path.expanduser('~/.config/1upradio/youtube.key')).read().strip()
    P = CD + '/youtube.json'; C = load(P, {})
    todo = [(k, a) for k, a in items if k not in C]
    for i in range(0, len(todo), 40):
        ch = todo[i:i + 40]; vids = {}
        for k, a in ch:
            vids[k] = list(dict.fromkeys(s[2] for s in a['songs']))[:3]
        allv = sorted({v for vs in vids.values() for v in vs})
        vi = {}
        for j in range(0, len(allv), 50):
            d = jget('https://www.googleapis.com/youtube/v3/videos?' + urllib.parse.urlencode({'part': 'snippet', 'id': ','.join(allv[j:j + 50]), 'key': key}))
            for it in (d or {}).get('items', []): vi[it['id']] = (it['snippet'].get('channelId'), it['snippet'].get('channelTitle', ''))
        cand = {}
        for k, a in ch:
            for v in vids[k]:
                cid, ct = vi.get(v, (None, ''))
                t = nrm(ct)
                if cid and (t == k or t in (k + ' topic', k + ' official', k + ' music', k + ' vevo', k + 'vevo', 'the ' + k) or t == k + ' official channel'): cand[k] = cid; break
        cids = sorted(set(cand.values())); info = {}
        for j in range(0, len(cids), 50):
            d = jget('https://www.googleapis.com/youtube/v3/channels?' + urllib.parse.urlencode({'part': 'snippet,statistics', 'id': ','.join(cids[j:j + 50]), 'key': key}))
            for it in (d or {}).get('items', []): info[it['id']] = it
        for k, a in ch:
            res = 0
            it = info.get(cand.get(k))
            if it:
                sn = it['snippet']; st = it.get('statistics', {})
                res = {'id': it['id'], 'tt': sn.get('title', ''), 'topic': 1 if ' - topic' in sn.get('title', '').lower() else 0, 'd': re.sub(r'\s+', ' ', sn.get('description', '')).strip()[:300],
                       'th': ((sn.get('thumbnails') or {}).get('medium') or {}).get('url', ''), 'c': sn.get('country', ''), 's': int(st.get('subscriberCount', 0)) if not st.get('hiddenSubscriberCount') else 0}
            C[k] = res
        save(P, C); print('youtube', len(C), flush=True)


# ---------------- our own data ----------------
def own_data():
    D = {}
    try: LAB = json.load(open(H + '/data/labels.json'))
    except Exception: LAB = {}
    try: BPM = json.load(open(H + '/data/bpm.json'))
    except Exception: BPM = {}
    try: NOTE = json.load(open(H + '/data/song-notes.json'))
    except Exception: NOTE = {}
    ch = {}
    try:
        for slug, g in json.load(open(H + '/data/portal-charts.json')).items():
            for t in g['tracks']:
                for a in t['artists'][:3]:
                    e = ch.setdefault(nrm(a), {'g': [], 'l': []})
                    if g['name'] not in e['g']: e['g'].append(g['name'])
                    if t.get('label') and t['label'] not in e['l']: e['l'].append(t['label'])
    except Exception: pass
    return LAB, BPM, NOTE, ch


STN_GENRE_SKIP = ('1UP Radio', 'The Movement', 'Culture Shock', 'The Vault', 'City Culture')


def compose(k, a, I, M, W, Dz, Y, own, PG=None):
    LAB, BPM, NOTE, CH = own
    f = []; links = {}; cred = []; photo = ''; bio = ''; bs = ''
    vids = list(dict.fromkeys(s[2] for s in a['songs']))
    # --- photo
    if Dz and Dz.get('p') and 'default' not in Dz['p'] and '/artist//' not in Dz['p']: photo = Dz['p']; cred.append('Deezer')
    if not photo and W and W.get('p'): photo = W['p']
    if not photo and Y and not Y.get('topic') and Y.get('th'): photo = Y['th']
    # --- bio: every source offers its text, the best one wins (an encyclopedia article > the artist's own words > a note by the MusicBrainz editors > the YouTube channel > a generated line)
    cands = []
    if W and W.get('x'): cands.append((100 + min(len(W['x']), 520) / 10.0, W['x'], 'Wikipedia (CC BY-SA)')); links['Wikipedia'] = W.get('u') or (M or {}).get('r', {}).get('Wikipedia', '')
    for kind, t in sorted((PG or {}).items(), key=lambda kv: -len(kv[1])):
        if len(t) >= 60: cands.append((70 + min(len(t), 520) / 20.0, t, kind if kind != 'Website' else 'the artist\u2019s website'))
    if M and len(M.get('an', '')) >= 60: cands.append((60 + min(len(M['an']), 520) / 20.0, M['an'], 'MusicBrainz'))
    if Y and not Y.get('topic') and len(Y.get('d', '')) >= 80: cands.append((55 + min(len(Y['d']), 300) / 25.0, Y['d'], 'the artist\u2019s YouTube channel'))
    if cands:
        cands.sort(key=lambda c: -c[0]); bio, bs = cands[0][1], cands[0][2]
        if len(cands) > 1 and bs != 'Wikipedia (CC BY-SA)' and len(bio) < 160 and cands[1][1][:60] != bio[:60]:   # a short best text gets a second one from another source
            pass
    # --- about (from MusicBrainz / Apple Music)
    if M:
        T = M.get('t')
        kind = {'Group': 'a group', 'Person': 'an artist', 'Orchestra': 'an orchestra', 'Choir': 'a choir', 'Character': 'a project'}.get(T, '')
        if T == 'Person': place = M.get('ar') or M.get('c') or ''          # a person's "begin area" is where they were born, not where they work
        else: place = ', '.join(x for x in dict.fromkeys([M.get('ba') or '', M.get('ar') or '']) if x) or M.get('c') or ''
        if kind: line = a['name'] + ' is ' + kind + (' from ' + place if place else '')
        else: line = a['name'] + (' is from ' + place if place else '')
        if M.get('y'): line += (', ' if (kind or place) else ' ') + ('active since ' if not M.get('e') else 'formed in ') + M['y']
        line += '.'
        if not bio and M.get('wd'): bio = a['name'] + ' \u2014 ' + M['wd'][:1].upper() + M['wd'][1:] + ('.' if not M['wd'].endswith('.') else ''); bs = 'Wikidata'
        if not bio and (place or M.get('y')): bio = line; bs = 'MusicBrainz'
        elif place or M.get('y'): f.append(line)
        if M.get('g'): f.append('Style: ' + ', '.join(M['g'][:4]) + '.')
        for kk, u in (M.get('r') or {}).items():
            links.setdefault(kk, u)
        cred.append('MusicBrainz')
    if I:
        if I.get('u'): links.setdefault('Apple Music', I['u']); cred.append('Apple Music')
        if I.get('g') and not (M and M.get('g')): f.append('Apple Music files this artist under ' + I['g'] + '.')
    if Dz:
        if Dz.get('u'): links.setdefault('Deezer', Dz['u'])
        if Dz.get('f', 0) >= 1000: f.append('%s fans on Deezer.' % '{:,}'.format(Dz['f']))
        if Dz.get('n', 0) >= 2: f.append('%d releases on Deezer%s.' % (Dz['n'], (', the first in ' + Dz['y']) if Dz.get('y') and Dz['y'] >= '2000' else ''))
    if Y:
        if Y.get('s', 0) >= 1000: f.append('%s subscribers on YouTube.' % '{:,}'.format(Y['s']))
        if Y.get('id'): links.setdefault('YouTube', 'https://www.youtube.com/channel/' + Y['id']); cred.append('YouTube')
    # --- our own data
    stn = sorted({s[0] for s in a['songs']})
    ce = CH.get(k)
    if ce and ce['g']: f.append('Charted on Beatport in ' + ', '.join(ce['g'][:3]) + '.'); links.setdefault('Beatport', 'https://www.beatport.com/search?q=' + urllib.parse.quote(a['name']))
    labs = []
    for v in vids:
        l = LAB.get(v)
        if l and l not in labs and nrm(l) != k: labs.append(l)
    for l in (ce['l'] if ce else []):
        if l not in labs and nrm(l) != k: labs.append(l)
    if labs: f.append('Released on ' + ', '.join(labs[:3]) + '.')
    bp = sorted(BPM[v] for v in vids if isinstance(BPM.get(v), (int, float)) and 60 <= BPM[v] <= 200)
    if len(bp) >= 2: f.append('Plays at about %d BPM on our stations.' % round(bp[len(bp) // 2]))
    ys = sorted(str((NOTE.get(v) or {}).get('y')) for v in vids if (NOTE.get(v) or {}).get('y'))
    if ys: f.append('Songs on 1UP from ' + (ys[0] if ys[0] == ys[-1] else ys[0] + ' to ' + ys[-1]) + '.')
    if not (photo or bio or f or links): return None
    out = {}
    if photo: out['p'] = photo
    if bio: out['b'] = bio
    if bs: out['bs'] = bs
    if f: out['f'] = f[:6]
    links = {kk: u for kk, u in links.items() if u}
    if links: out['l'] = links
    out['s'] = list(dict.fromkeys(cred + (['our station data'] if (labs or bp or ys or ce) else [])))
    return out


def build():
    A = artists(); I = load(CD + '/itunes.json', {}); M = load(CD + '/mb.json', {}); W = load(CD + '/wiki.json', {}); Dz = load(CD + '/deezer.json', {}); Y = load(CD + '/youtube.json', {}); PGS = load(CD + '/pages.json', {}); own = own_data()
    shards = {}; n = 0
    for k, a in A:
        r = compose(k, a, I.get(k) or None, M.get(k) or None, W.get(k) or None, Dz.get(k) or None, Y.get(k) or None, own, PGS.get(k) or None)
        if not r: continue
        c = a['name'].strip()[:1].upper(); c = unicodedata.normalize('NFD', c)[:1]; c = c.lower() if re.match('[A-Z]', c) else 'num'
        shards.setdefault(c, {})[k] = r; n += 1
    for c, d in shards.items(): json.dump(d, open('%s/%s.json' % (OUT, c), 'w'), ensure_ascii=False, separators=(',', ':'))
    print('built', n, 'artist profiles of', len(A), '| photos', sum(1 for d in shards.values() for v in d.values() if v.get('p')), '| bios', sum(1 for d in shards.values() for v in d.values() if v.get('b')), '| links', sum(1 for d in shards.values() for v in d.values() if v.get('l')), flush=True)


def main():
    if '--build' in sys.argv: build(); return
    items = artists(); print('artists', len(items), flush=True)
    ts = [threading.Thread(target=f, args=(items,), daemon=True) for f in (worker_itunes, worker_mb, worker_pages, worker_deezer, worker_youtube)]
    for t in ts: t.start()
    while any(t.is_alive() for t in ts):
        time.sleep(300); build()
    build()


if __name__ == '__main__': main()
