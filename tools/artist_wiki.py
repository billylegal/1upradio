#!/usr/bin/env python3
"""A short, true line about each artist for the "Did you know?" bubbles: the first sentences of their Wikipedia page (musicians, bands, DJs only).
Names come from the A-Z artist index (data/artists/*.json); one polite request per artist. -> data/artist-wiki.json {normalised name: {"x": text, "t": page title}} (CC BY-SA, credited in the bubble). Resumable.
python3 tools/artist_wiki.py"""
import glob, json, os, re, time, urllib.parse, urllib.request
from concurrent.futures import ThreadPoolExecutor
H = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = H + '/data/artist-wiki.json'; TRIED = H + '/data/artist-wiki-tried.json'
UA = {'User-Agent': '1upradio-facts/1.0 (https://1upradio.com; contact via site)'}
nrm = lambda s: re.sub(r'[^a-z0-9]+', ' ', re.sub(r'[̀-ͯ]', '', __import__('unicodedata').normalize('NFD', (s or '').lower()))).strip()
MUSIC = re.compile(r'\b(singer|rapper|musician|band|duo|group|disc jockey|dj|producer|songwriter|composer|vocalist|artist|reggae|hip hop|record producer|trio|rock|r&b|soul|dancehall|electronic|house|techno)\b', re.I)


def clean(x):
    x = re.sub(r'\s*\([^)]*\)', '', x); x = re.sub(r'\[\d+\]', '', x); x = re.sub(r'\s+', ' ', x).strip()
    sents = re.split(r'(?<=[.!?])\s+(?=[A-Z])', x)
    out = ''
    for s in sents[:3]:
        if len(out) + len(s) > 280:
            if not out: out = re.sub(r'\s+\S*$', '', s[:277]) + '\u2026'
            break
        out += (' ' if out else '') + s
    return out


def look(name):
    q = urllib.parse.urlencode({'action': 'query', 'format': 'json', 'generator': 'search', 'gsrsearch': name + ' musician OR band OR singer OR DJ OR rapper', 'gsrlimit': 3, 'prop': 'extracts', 'exintro': 1, 'explaintext': 1, 'exsentences': 4, 'exlimit': 3, 'redirects': 1})
    for _ in range(2):
        try:
            with urllib.request.urlopen(urllib.request.Request('https://en.wikipedia.org/w/api.php?' + q, headers=UA), timeout=25) as r: d = json.load(r)
            break
        except Exception: time.sleep(3); d = None
    if not d: return None
    k = nrm(name)
    for p in sorted((d.get('query') or {}).get('pages', {}).values(), key=lambda p: p.get('index', 9)):
        t = nrm(re.sub(r'\([^)]*\)', '', p.get('title', '')))
        ex = p.get('extract') or ''
        if t == k and MUSIC.search(ex[:300]) and len(ex) > 60:
            x = clean(ex)
            if len(x) > 50: return {'x': x, 't': p['title']}
    return {}


def main():
    names = {}
    for f in glob.glob(H + '/data/artists/*.json'):
        if f.endswith('index.json'): continue
        for n, songs in json.load(open(f)): names[nrm(n)] = n
    res = json.load(open(OUT)) if os.path.exists(OUT) else {}; tried = set(json.load(open(TRIED))) if os.path.exists(TRIED) else set()
    todo = [(k, n) for k, n in names.items() if k not in res and k not in tried and 2 < len(k) < 40]
    print('artists', len(names), '| to look up', len(todo), flush=True)
    with ThreadPoolExecutor(3) as ex:
        for i in range(0, len(todo), 60):
            ch = todo[i:i + 60]
            for (k, n), r in zip(ch, ex.map(lambda t: (time.sleep(0.25), look(t[1]))[1], ch)):
                if r: res[k] = r
                tried.add(k)
            json.dump(res, open(OUT, 'w'), ensure_ascii=False, separators=(',', ':')); json.dump(sorted(tried), open(TRIED, 'w'))
            print(i + len(ch), 'of', len(todo), '| with a Wikipedia line', len(res), flush=True)


if __name__ == '__main__': main()
