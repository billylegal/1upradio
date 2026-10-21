#!/usr/bin/env python3
"""Facts about every artist on the four stations, from MusicBrainz (open music database): where they are from, since when, and how listeners tag their style,
and their OFFICIAL accounts (X/Twitter, Instagram, YouTube) as entered in MusicBrainz's links.
Writes data/artist-auto.json {normalised artist name: [fact, ...]} and data/artist-links.json {normalised name: {x, ig, yt}}. One request a second (MusicBrainz asks for that), resumable, polite.   python3 tools/artist_auto.py [max artists]"""
import json, os, re, sys, time, unicodedata, urllib.request, urllib.parse
H = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = H + '/data/artist-auto.json'; TRIED = H + '/data/artist-auto-tried.json'; LINKS = H + '/data/artist-links.json'
UA = {'User-Agent': '1upradio-facts/1.0 ( https://1upradio.com )'}
FILES = [('main', 'main'), ('culture', 'culture'), ('movement', 'movement'), ('vault', 'hiphopvinyl')]


def nrm(s):
    s = unicodedata.normalize('NFD', str(s).lower()); s = ''.join(c for c in s if not unicodedata.category(c).startswith('M'))
    return re.sub(r'[^a-z0-9]+', ' ', s).strip()


def main_artist(seg):
    seg = re.sub(r'\s*[\(\[].*?[\)\]]', '', seg)
    seg = re.split(r'\s+(?:feat\.?|ft\.?|featuring|with|x|vs\.?|&|and)\s+|\s*[,/;]\s*', seg, flags=re.I)[0]
    return seg.strip()


def upcoming_names():
    names = set()
    for st, f in (('main', 'schedule.json'), ('culture', 'schedule-culture.json'), ('vault', 'schedule-hiphopvinyl.json'), ('movement', 'schedule-movement.json')):
        try:
            with urllib.request.urlopen(urllib.request.Request('https://1upradio.com/%s?x=%d' % (f, time.time()), headers=UA), timeout=40) as r: s = json.load(r)
        except Exception: continue
        now = time.time() - s.get('delay', 0)
        for p in s.get('plays', []):
            if now - 600 <= p['t'] <= now + 36 * 3600:
                parts = re.split(r'\s[-\u2013\u2014]\s', p['title'])
                for c in [parts[0]] + ([parts[-1]] if len(parts) > 1 and st == 'culture' else []): names.add(nrm(main_artist(c)))
    return names


def artists():
    out = {}
    for st, f in FILES:
        for v in json.load(open('%s/data/%s-videos.json' % (H, f))):
            parts = re.split(r'\s[-–—]\s', v['title'])
            cand = [parts[0]] + ([parts[-1]] if len(parts) > 1 and st == 'culture' else [])
            for c in cand:
                a = main_artist(c); n = nrm(a)
                if 2 < len(n) < 40 and not n.startswith('various'): out.setdefault(n, [a, 0])[1] += 1
    soon = upcoming_names()
    return sorted(out.items(), key=lambda kv: (kv[0] not in soon, -kv[1][1]))   # songs about to air first, then by how often the artist appears


def lookup(name):
    u = 'https://musicbrainz.org/ws/2/artist/?fmt=json&limit=3&query=' + urllib.parse.quote('artist:"%s"' % name.replace('"', ' '))
    with urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=30) as r: j = json.load(r)
    for a in j.get('artists', []):
        if a.get('score', 0) < 96: continue
        names = [a.get('name', '')] + [x.get('name', '') for x in a.get('aliases', [])]
        if nrm(name) not in [nrm(x) for x in names]: continue
        return a
    return None


def links(mbid):
    u = 'https://musicbrainz.org/ws/2/artist/%s?fmt=json&inc=url-rels' % mbid
    with urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=30) as r: j = json.load(r)
    out, qid = {}, None
    for rel in j.get('relations', []):
        url = ((rel.get('url') or {}).get('resource') or '').strip()
        m = re.match(r'https?://(?:www\.|mobile\.)?(twitter\.com|x\.com)/([A-Za-z0-9_]{1,15})/?(?:\?.*)?$', url)
        if m and 'x' not in out: out['x'] = 'https://x.com/' + m.group(2); continue
        m = re.match(r'https?://(?:www\.)?instagram\.com/([A-Za-z0-9_.]{1,30})/?(?:\?.*)?$', url)
        if m and 'ig' not in out: out['ig'] = 'https://www.instagram.com/' + m.group(1) + '/'; continue
        m = re.match(r'https?://(?:www\.|m\.)?tiktok\.com/@([A-Za-z0-9_.]{1,30})/?(?:\?.*)?$', url)
        if m and 'tt' not in out: out['tt'] = 'https://www.tiktok.com/@' + m.group(1); continue
        if re.match(r'https?://(?:www\.|m\.)?youtube\.com/(channel/|user/|c/|@)[^/?#]+/?$', url) and 'yt' not in out: out['yt'] = url.rstrip('/')
        m = re.match(r'https?://(?:www\.)?wikidata\.org/wiki/(Q\d+)', url)
        if m: qid = m.group(1)
    if qid and len(out) < 4:   # fill what MusicBrainz lacks from Wikidata (official accounts entered there)
        try:
            time.sleep(0.4)
            with urllib.request.urlopen(urllib.request.Request('https://www.wikidata.org/w/api.php?action=wbgetentities&props=claims&format=json&ids=' + qid, headers=UA), timeout=30) as r: cl = json.load(r)['entities'][qid]['claims']
            def one(pid):
                for c in cl.get(pid, []):
                    if c.get('rank') == 'deprecated': continue
                    v = (c.get('mainsnak', {}).get('datavalue') or {}).get('value')
                    if isinstance(v, str) and v: return v
            tw, ig, tt, yt = one('P2002'), one('P2003'), one('P7085'), one('P2397')
            if tw and 'x' not in out and re.fullmatch(r'[A-Za-z0-9_]{1,15}', tw): out['x'] = 'https://x.com/' + tw
            if ig and 'ig' not in out and re.fullmatch(r'[A-Za-z0-9_.]{1,30}', ig): out['ig'] = 'https://www.instagram.com/' + ig + '/'
            if tt and 'tt' not in out and re.fullmatch(r'[A-Za-z0-9_.]{1,30}', tt): out['tt'] = 'https://www.tiktok.com/@' + tt
            if yt and 'yt' not in out and re.fullmatch(r'UC[A-Za-z0-9_-]{22}', yt): out['yt'] = 'https://www.youtube.com/channel/' + yt
        except Exception: pass
    return out


def facts(name, a):
    area = (a.get('area') or {}).get('name') or ''
    yr = ((a.get('life-span') or {}).get('begin') or '')[:4]
    ty = a.get('type')
    out = []
    if area and yr.isdigit() and ty in ('Group', 'Orchestra'):      # a group's begin date is when it formed; for a person it is a birth year, which we do not use
        out.append('%s is a group from %s, formed in %s.' % (name, area, yr))
    elif area: out.append('%s comes from %s.' % (name, area))
    tags = [t['name'] for t in sorted(a.get('tags', []), key=lambda t: -t.get('count', 0)) if t.get('count', 0) >= 1 and len(t['name']) < 28][:3]
    if len(tags) >= 2: out.append('Listeners tag %s as %s.' % (name, ', '.join(tags[:-1]) + ' and ' + tags[-1]))
    elif len(tags) == 1 and out: out[0] = out[0]
    return out


def main():
    cap = int(sys.argv[1]) if len(sys.argv) > 1 else 100000
    try: d = json.load(open(OUT))
    except Exception: d = {}
    try: tried = json.load(open(TRIED))
    except Exception: tried = {}
    try: L = json.load(open(LINKS))
    except Exception: L = {}
    todo = [(n, v[0]) for n, v in artists() if n not in L][:cap]   # an artist is done once the links file has an entry for them (it may be empty)
    print('artists to look up:', len(todo), flush=True); k = 0
    for n, name in todo:
        a = 'err'
        for attempt in range(4):                                   # MusicBrainz answers 503 when it is busy: wait and try again
            try: a = lookup(name); break
            except Exception: time.sleep(6 * (attempt + 1))
        if a == 'err': continue
        f = facts(name, a) if a else []
        if f: d[n] = f
        else: tried[n] = 1
        lk = {}
        if a:
            time.sleep(1.1)
            for attempt in range(3):
                try: lk = links(a['id']); break
                except Exception: time.sleep(6 * (attempt + 1))
        L[n] = lk
        k += 1
        if k % 25 == 0:
            for p, o in ((OUT, d), (TRIED, tried), (LINKS, L)): json.dump(o, open(p + '.tmp', 'w'), ensure_ascii=False, separators=(',', ':')); os.replace(p + '.tmp', p)
            print('%d looked up, %d with facts, %d with links' % (k, len(d), sum(1 for v in L.values() if v)), flush=True)
        time.sleep(1.1)
    for p, o in ((OUT, d), (TRIED, tried), (LINKS, L)): json.dump(o, open(p + '.tmp', 'w'), ensure_ascii=False, separators=(',', ':')); os.replace(p + '.tmp', p)
    print('done:', len(d), 'artists with facts', flush=True)


if __name__ == '__main__': main()
