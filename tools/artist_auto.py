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


def artists():
    out = {}
    for st, f in FILES:
        for v in json.load(open('%s/data/%s-videos.json' % (H, f))):
            parts = re.split(r'\s[-–—]\s', v['title'])
            cand = [parts[0]] + ([parts[-1]] if len(parts) > 1 and st == 'culture' else [])
            for c in cand:
                a = main_artist(c); n = nrm(a)
                if 2 < len(n) < 40 and not n.startswith('various'): out.setdefault(n, [a, 0])[1] += 1
    return sorted(out.items(), key=lambda kv: -kv[1][1])


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
    out = {}
    for rel in j.get('relations', []):
        url = ((rel.get('url') or {}).get('resource') or '').strip()
        m = re.match(r'https?://(?:www\.|mobile\.)?(twitter\.com|x\.com)/([A-Za-z0-9_]{1,15})/?(?:\?.*)?$', url)
        if m and 'x' not in out: out['x'] = 'https://x.com/' + m.group(2); continue
        m = re.match(r'https?://(?:www\.)?instagram\.com/([A-Za-z0-9_.]{1,30})/?(?:\?.*)?$', url)
        if m and 'ig' not in out: out['ig'] = 'https://www.instagram.com/' + m.group(1) + '/'; continue
        if re.match(r'https?://(?:www\.|m\.)?youtube\.com/(channel/|user/|c/|@)[^/?#]+/?$', url) and 'yt' not in out: out['yt'] = url.rstrip('/')
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
