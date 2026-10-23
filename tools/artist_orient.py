#!/usr/bin/env python3
"""For titles like "Sunday, Monday - Derrick Morgan" where nothing says which side is the artist: ask Deezer whether "Derrick Morgan" has a track "Sunday, Monday" (or the other way round).
Result -> ~/.cache/artist-profiles/orient.json {title: 'L' (left is the artist) | 'R' (right is the artist) | '?'}. Resumable. Used by tools/artist_index.py."""
import json, os, re, sys, time, urllib.parse, urllib.request, importlib.util
from concurrent.futures import ThreadPoolExecutor
H = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
spec = importlib.util.spec_from_file_location('ai', H + '/tools/artist_index.py'); ai = importlib.util.module_from_spec(spec); spec.loader.exec_module(ai)
P = ai.ORIENT_P; os.makedirs(os.path.dirname(P), exist_ok=True)
STATIONS = {'playground', 'culture'}
nrm = ai.nrm


def deezer(q):
    for _ in range(3):
        try:
            with urllib.request.urlopen(urllib.request.Request('https://api.deezer.com/search?' + urllib.parse.urlencode({'q': q, 'limit': 12}), headers={'User-Agent': '1upradio-orient'}), timeout=20) as r: d = json.load(r)
            if d.get('error'): time.sleep(5); continue
            return d.get('data', [])
        except Exception: time.sleep(3)
    return None


def side(rows, a_part, b_part):
    """is a_part an artist (any of its names) with a track called b_part in these results?"""
    song = re.split(r'\s*/\s*', b_part)[0]; s = nrm(song); an = {nrm(x) for x in ai.names_of(a_part)}
    if not s or not an: return False
    for r in rows:
        t = nrm(r['title']); t2 = nrm(r.get('title_short', ''))
        if nrm(r['artist']['name']) in an and (s == t or s == t2 or (len(s) >= 6 and s in t)): return True
    return False


def decide(title, A, B):
    rows = deezer('%s %s' % (ai.names_of(A)[0] if ai.names_of(A) else A, re.split(r'\s*/\s*', B)[0]))
    time.sleep(0.35)
    if rows is None: return None
    rows2 = deezer('%s %s' % (ai.names_of(B)[0] if ai.names_of(B) else B, re.split(r'\s*/\s*', A)[0]))
    time.sleep(0.35)
    if rows2 is None: return None
    l = side(rows + rows2, A, B); r = side(rows + rows2, B, A)
    return 'L' if l and not r else 'R' if r and not l else '?'


def itunes_rows(q):
    for _ in range(3):
        try:
            with urllib.request.urlopen(urllib.request.Request('https://itunes.apple.com/search?' + urllib.parse.urlencode({'term': q, 'entity': 'song', 'limit': 15}), headers={'User-Agent': '1upradio-orient'}), timeout=20) as r: d = json.load(r)
            return [{'artist': {'name': x.get('artistName', '')}, 'title': x.get('trackName', ''), 'title_short': re.sub(r'\s*[\(\[].*$', '', x.get('trackName', ''))} for x in d.get('results', [])]
        except Exception: time.sleep(4)
    return None


def mb_rows(a, b):
    out = []
    for q in ('recording:"%s" AND artist:"%s"' % (re.split(r'\s*/\s*', b)[0].replace('"', ' '), a.replace('"', ' ')),):
        for _ in range(3):
            try:
                with urllib.request.urlopen(urllib.request.Request('https://musicbrainz.org/ws/2/recording?' + urllib.parse.urlencode({'query': q, 'limit': 8, 'fmt': 'json'}), headers={'User-Agent': '1UPRadio-orient/1.0 (billylegalmusic@outlook.com)'}), timeout=25) as r: d = json.load(r)
                for x in d.get('recordings', []):
                    if x.get('score', 0) >= 90:
                        for ac in x.get('artist-credit', []): out.append({'artist': {'name': ac.get('name', '')}, 'title': x.get('title', ''), 'title_short': x.get('title', '')})
                break
            except Exception: time.sleep(4)
        time.sleep(1.1)
    return out


def decide_more(title, A, B, source):
    if source == 'itunes':
        rows = itunes_rows('%s %s' % (ai.names_of(A)[0] if ai.names_of(A) else A, re.split(r'\s*/\s*', B)[0])); time.sleep(1.3)
        if rows is None: return None
    else:
        r1 = mb_rows(ai.names_of(A)[0] if ai.names_of(A) else A, B); r2 = mb_rows(ai.names_of(B)[0] if ai.names_of(B) else B, A); rows = r1 + r2
        if source == 'mb' and not rows: return '?'
    l = side(rows, A, B); r = side(rows, B, A)
    return 'L' if l and not r else 'R' if r and not l else '?'


def more(source):
    """second and third opinion for the titles the first pass could not settle"""
    C = json.load(open(P)); per = [(f, json.load(open('%s/data/%s-videos.json' % (H, f)))) for _, f in ai.ST]; ev = ai.Evidence(per)
    try: sw = json.load(open(H + '/data/culture-swap.json'))
    except Exception: sw = {}
    todo = {}
    for f, vs in per:
        if f not in STATIONS: continue
        for v in vs:
            a = ai.ambiguous(v['title'], f, ev, sw if f == 'culture' else None)
            if a and C.get(v['title']) == '?' and not C.get('~' + source + v['title']): todo[v['title']] = a
    print(source, 'unsettled titles:', len(todo), flush=True); n = 0
    for t, (A, B) in todo.items():
        res = decide_more(t, A, B, source)
        C['~' + source + t] = 1
        if res in ('L', 'R'): C[t] = res
        n += 1
        if n % 25 == 0: json.dump(C, open(P, 'w'), ensure_ascii=False, separators=(',', ':')); print(source, n, 'of', len(todo), '| settled so far', sum(1 for x in C.values() if x in ('L', 'R')), flush=True)
    json.dump(C, open(P, 'w'), ensure_ascii=False, separators=(',', ':'))


def main():
    if len(sys.argv) > 1 and sys.argv[1] == '--more': more('itunes'); more('mb'); return
    per = [(f, json.load(open('%s/data/%s-videos.json' % (H, f)))) for _, f in ai.ST]; ev = ai.Evidence(per)
    try: sw = json.load(open(H + '/data/culture-swap.json'))
    except Exception: sw = {}
    todo = {}
    for f, vs in per:
        if f not in STATIONS: continue
        for v in vs:
            a = ai.ambiguous(v['title'], f, ev, sw if f == 'culture' else None)
            if a: todo[v['title']] = a
    C = json.load(open(P)) if os.path.exists(P) else {}
    items = [(t, ab) for t, ab in todo.items() if t not in C]
    print('ambiguous', len(todo), '| to look up', len(items), flush=True)
    with ThreadPoolExecutor(2) as ex:
        for i in range(0, len(items), 40):
            ch = items[i:i + 40]
            for (t, ab), res in zip(ch, ex.map(lambda x: decide(x[0], *x[1]), ch)):
                if res: C[t] = res
            json.dump(C, open(P, 'w'), ensure_ascii=False, separators=(',', ':'))
            print(i + len(ch), 'of', len(items), '| L', sum(1 for x in C.values() if x == 'L'), 'R', sum(1 for x in C.values() if x == 'R'), '?', sum(1 for x in C.values() if x == '?'), flush=True)


if __name__ == '__main__': main()
