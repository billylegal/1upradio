#!/usr/bin/env python3
"""BPM of every song on every station -> data/bpm.json {video id: bpm}. Sources, best first: our own beat analysis (data/portal-techhouse-grid.json), the store charts (Portal), Deezer's track tempo.
Resumable (data/bpm-tried.json remembers songs Deezer had no tempo for). Polite: a few requests per second.   python3 tools/bpm_build.py"""
import json, os, re, sys, time, urllib.request
from concurrent.futures import ThreadPoolExecutor
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import culture_art as ca
H = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
F, TRIED = H + '/data/bpm.json', H + '/data/bpm-tried.json'
FILES = ['main', 'movement', 'culture', 'hiphopvinyl', 'tdot6', 'portal']


def jl(p, d):
    try: return json.load(open(p))
    except Exception: return d


def dz_track(i):
    for n in range(3):
        try:
            with urllib.request.urlopen(urllib.request.Request('https://api.deezer.com/track/%s' % i, headers={'User-Agent': '1upradio'}), timeout=20) as r: d = json.load(r)
            if d.get('error'): time.sleep(4); continue
            return d
        except Exception: time.sleep(4)
    return {}


def one(v):
    for art, tr in ca.cands(v['title'])[:2]:
        T, A = ca.toks(tr), ca.toks(art)
        for x in ca.deezer('search', (art + ' ' + tr).strip())[:6]:
            if not ca.ok_match(T, A, ca.toks(x.get('title')), ca.toks((x.get('artist') or {}).get('name'))): continue
            b = float(dz_track(x['id']).get('bpm') or 0)
            if 55 <= b <= 200: return round(b)
            break
    return 0


def main():
    bpm = jl(F, {}); tried = set(jl(TRIED, []))
    # 1) free sources
    for vid, g in jl(H + '/data/portal-techhouse-grid.json', {}).items(): bpm[vid] = round(g['bpm'], 1)
    c = jl(H + '/data/portal-charts.json', {}); cache = jl(H + '/data/portal-cache.json', {})
    nm = lambda s: re.sub(r'[^a-z0-9]+', ' ', (s or '').lower()).strip()
    for g in c.values():
        for t in g['tracks']:
            vid = cache.get(nm(' '.join(t['artists'][:2]) + ' ' + t['title'] + ' ' + t['mix']))
            if vid and t.get('bpm') and vid not in bpm: bpm[vid] = t['bpm']
    for f in ('main', 'movement', 'culture', 'hiphopvinyl'):
        for vid, fs in jl(H + '/data/facts-%s.json' % f, {}).items():
            for x in fs:
                m = re.search(r'about (\d+) beats per minute', x)
                if m and vid not in bpm: bpm[vid] = int(m.group(1)); break
    json.dump(bpm, open(F, 'w'), separators=(',', ':'))
    # 2) Deezer for the rest
    todo = []
    for f in FILES:
        for v in jl(H + '/data/%s-videos.json' % f, []):
            if v['id'] not in bpm and v['id'] not in tried and v['id'] not in {t['id'] for t in todo}: todo.append(v)
    print('have', len(bpm), '| to look up', len(todo), flush=True)
    n = 0
    with ThreadPoolExecutor(4) as ex:
        for i in range(0, len(todo), 40):
            chunk = todo[i:i + 40]
            for v, b in zip(chunk, ex.map(one, chunk)):
                if b: bpm[v['id']] = b
                else: tried.add(v['id'])
            n += len(chunk); json.dump(bpm, open(F, 'w'), separators=(',', ':')); json.dump(sorted(tried), open(TRIED, 'w'))
            print(n, 'looked up,', len(bpm), 'with BPM', flush=True)
    print('done:', len(bpm), 'songs with a BPM')


if __name__ == '__main__': main()
