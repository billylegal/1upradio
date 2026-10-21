#!/usr/bin/env python3
"""Did-you-know facts, built ahead of time (no key): for every song of a station, an artist fact or two from Wikipedia and a release fact from MusicBrainz.
Writes data/facts-<station>.json {video id: [fact, ...]}. Resumable: songs already looked at are skipped.   python3 tools/facts_build.py [main movement culture hiphopvinyl]"""
import json, os, re, sys, time, urllib.parse, urllib.request
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import culture_art as ca
H = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UA = {'User-Agent': '1upradio-facts/1.0 ( https://1upradio.com )'}
MUSIC = re.compile(r'(music|singer|vocalist|\bDJ\b|rapper|\bband\b|producer|songwriter|\bgroup\b|\bduo\b|composer|guitarist|\btrio\b|musical|record label|\bMC\b|beatmaker|instrumentalist)', re.I)
def get(u, sleep=0.0):
    try:
        with urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=25) as r: return json.load(r)
    except Exception: return None
    finally: time.sleep(sleep)
def norm(s): return ca.fold(re.sub(r'\(.*?\)', '', s or ''))
WP = {}
def wiki(name):
    k = norm(name)
    if k in WP: return WP[k]
    out = []
    j = get('https://en.wikipedia.org/w/api.php?action=query&list=search&srlimit=6&format=json&srsearch=' + urllib.parse.quote(name + ' musician OR band OR singer OR DJ OR rapper'), 0.2)
    for h in ((j or {}).get('query', {}).get('search', [])):
        base = norm(h['title'])
        if base != k and not base.startswith(k): continue
        s = get('https://en.wikipedia.org/api/rest_v1/page/summary/' + urllib.parse.quote(h['title'].replace(' ', '_')), 0.2)
        if not s or s.get('type') != 'standard' or not MUSIC.search((s.get('description') or '') + ' ' + (s.get('extract') or '')[:160]): continue
        sents = re.findall(r'[^.!?]+[.!?]+(?=\s|$)', re.sub(r'\s+', ' ', re.sub(r'\s*\([^)]*\)', '', s.get('extract') or '')))
        out = [x.strip() for x in sents if 25 < len(x.strip()) < 260][:3]
        if out: break
    WP[k] = out; return out
def release(art, tr):
    q = 'recording:"%s" AND artist:"%s"' % (tr.replace('"', ' '), art.replace('"', ' '))
    j = get('https://musicbrainz.org/ws/2/recording?fmt=json&limit=5&query=' + urllib.parse.quote(q), 1.1)
    T, A = ca.toks(tr), ca.toks(art)
    for x in (j or {}).get('recordings', []):
        if x.get('score', 0) < 95: continue
        xa = ca.toks(' '.join(c.get('name', '') for c in (x.get('artist-credit') or []) if isinstance(c, dict)))
        if not ca.ok_match(T, A, ca.toks(x.get('title')), xa): continue
        rel = [r for r in (x.get('releases') or []) if r.get('date') and r.get('status') == 'Official' and r.get('title')]
        if not rel: continue
        rel.sort(key=lambda r: r['date']); r = rel[0]; yr = r['date'][:4]
        same = norm(r['title']) == norm(tr)
        return '"%s" first came out in %s%s.' % (x['title'], yr, '' if same else ' on the release "%s"' % r['title'])
    return ''
def station(name, budget):
    vf = {'main': 'main', 'movement': 'movement', 'culture': 'culture', 'hiphopvinyl': 'hiphopvinyl'}[name]
    vids = json.load(open('%s/data/%s-videos.json' % (H, vf))); F = '%s/data/facts-%s.json' % (H, name)
    d = json.load(open(F)) if os.path.exists(F) else {}; n = 0
    for v in vids:
        if v['id'] in d or n >= budget: continue
        facts = []
        cs = ca.cands(v['title'])
        for art, tr in cs[:2]:
            w = wiki(art)
            if w: facts += w[:2]; r = release(art, tr); facts += [r] if r else []; break
        else:
            if cs:
                r = release(cs[0][0], cs[0][1]); facts += [r] if r else []
        d[v['id']] = facts; n += 1
        if n % 10 == 0: json.dump(d, open(F, 'w'), ensure_ascii=False, separators=(',', ':'))
    json.dump(d, open(F, 'w'), ensure_ascii=False, separators=(',', ':'))
    print(name, 'songs with facts:', sum(1 for x in d.values() if x), 'of', len(d), flush=True)
if __name__ == '__main__':
    for st in (sys.argv[1:] or ['main', 'movement']): station(st, 100000)
