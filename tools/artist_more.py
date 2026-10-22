#!/usr/bin/env python3
"""More true things about house, electronic and reggae artists for the "Did you know?" bubbles, from Deezer's public API (no key): how many fans, when their first release came out and how many they have, their most-played song, who their fans also listen to.
Names: the artists on 1UP Radio, The Movement, Culture Shock and the Portal charts. -> data/artist-more.json {normalised name: [fact, ...]}. Resumable.   python3 tools/artist_more.py"""
import glob, json, os, re, time, unicodedata, urllib.parse, urllib.request
from concurrent.futures import ThreadPoolExecutor
H = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = H + '/data/artist-more.json'; TRIED = H + '/data/artist-more-tried.json'
nrm = lambda s: re.sub(r'[^a-z0-9]+', ' ', ''.join(c for c in unicodedata.normalize('NFD', (s or '').lower()) if unicodedata.category(c) != 'Mn')).strip()


def get(path, **q):
    time.sleep(0.4)
    for _ in range(3):
        try:
            with urllib.request.urlopen(urllib.request.Request('https://api.deezer.com/' + path + ('?' + urllib.parse.urlencode(q) if q else ''), headers={'User-Agent': '1upradio-facts'}), timeout=20) as r: d = json.load(r)
            if isinstance(d, dict) and d.get('error'): time.sleep(5); continue
            return d
        except Exception: time.sleep(3)
    return None


def human(n):
    if n >= 1e6: return 'over %.1f million' % (n / 1e6) if n < 1e7 else 'over %d million' % round(n / 1e6)
    if n >= 1e3: return 'about {:,}'.format(int(round(n, -3 if n >= 1e4 else -2)))
    return str(n)


def facts(name, titles):
    s = get('search/artist', q=name, limit=6)
    cands = [x for x in sorted((s or {}).get('data', []), key=lambda x: -x.get('nb_fan', 0)) if nrm(x['name']) == nrm(name)][:2]
    mine = [nrm(t) for t in titles]
    hit = None; top = None
    for x in cands:   # make sure it is OUR artist: one of their top 50 songs must appear in a title we play
        tp = get('artist/%d/top' % x['id'], limit=50) or {}
        rows = tp.get('data', [])
        if any(len(nrm(r['title_short'])) >= 5 and any(nrm(r['title_short']) in m for m in mine) for r in rows): hit, top = x, rows; break
    if not hit: return []
    out = []; aid = hit['id']
    if hit.get('nb_fan', 0) >= 3000: out.append('%s has %s fans on Deezer.' % (hit['name'], human(hit['nb_fan'])))
    al = get('artist/%d/albums' % aid, limit=100)
    rows = [a for a in (al or {}).get('data', []) if a.get('release_date', '0000') >= '1950']
    if len(rows) >= 3:
        y0 = min(a['release_date'][:4] for a in rows)
        if y0 >= '2000': out.append('%s has been releasing music since %s, with %d releases listed on Deezer.' % (hit['name'], y0, len(rows)))   # older dates are often reissues, so only modern artists get a year
        else: out.append('Deezer lists %d releases by %s.' % (len(rows), hit['name']))
    if top: out.append('%s\u2019s most-played song on Deezer is \u201c%s\u201d.' % (hit['name'], re.sub(r'\s*[\(\[].*$', '', top[0]['title']).strip()))
    rl = get('artist/%d/related' % aid, limit=3)
    nm_ = [x['name'] for x in (rl or {}).get('data', [])][:3]
    if len(nm_) >= 2: out.append('Fans of %s also listen to %s.' % (hit['name'], ', '.join(nm_[:-1]) + ' and ' + nm_[-1]))
    return out


def names():
    n = {}   # normalised name -> (display name, [our titles])
    for L in glob.glob(H + '/data/artists/*.json'):
        if L.endswith('index.json'): continue
        for nm, songs in json.load(open(L)):
            t = [x[1] for x in songs if x[0] in (0, 1, 2)]   # 1UP Radio, The Movement, Culture Shock
            if t: n[nrm(nm)] = (nm, t)
    try:
        for g in json.load(open(H + '/data/portal-charts.json')).values():
            for t in g['tracks']:
                for a in t['artists'][:2]:
                    e = n.setdefault(nrm(a), (a, [])); e[1].append(t['title'] + ' ' + t.get('mix', ''))
    except Exception: pass
    return n


def main():
    allnames = names(); res = json.load(open(OUT)) if os.path.exists(OUT) else {}; tried = set(json.load(open(TRIED))) if os.path.exists(TRIED) else set()
    todo = [(k, v) for k, v in allnames.items() if k not in tried and 2 < len(k) < 40]
    print('artists', len(allnames), '| to look up', len(todo), flush=True)
    with ThreadPoolExecutor(4) as ex:
        for i in range(0, len(todo), 80):
            ch = todo[i:i + 80]
            for (k, v), f in zip(ch, ex.map(lambda t: facts(t[1][0], t[1][1]), ch)):
                if f: res[k] = f
                tried.add(k)
            json.dump(res, open(OUT, 'w'), ensure_ascii=False, separators=(',', ':')); json.dump(sorted(tried), open(TRIED, 'w'))
            print(i + len(ch), 'of', len(todo), '| artists with facts', len(res), flush=True)


if __name__ == '__main__': main()
