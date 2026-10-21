#!/usr/bin/env python3
"""The A-Z artists page: every artist credited on any station, with their songs.
Writes data/artists/index.json {letters: {A: count, ...}, stations: [...]} and data/artists/<letter>.json  [[artist name, [[station index, title, video id], ...]], ...]  (sorted, one file per letter, loaded on demand).
Credits: the artist part of the title (main artist and featured artists) and, for remixes, the remixer."""
import json, os, re, sys, unicodedata
H = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ST = [('1UP Radio', 'main'), ('The Movement', 'movement'), ('Culture Shock', 'culture'), ('The Vault', 'hiphopvinyl')]
BAD = re.compile(r'^(original|extended|radio|club|main|album|instrumental|vocal|dub|full|short|long|new|re ?edit|lp|single|version|official|unofficial|various|various artists|unknown|n/?a|\d+)$', re.I)


def nrm(s):
    s = unicodedata.normalize('NFD', str(s).lower()); s = ''.join(c for c in s if not unicodedata.category(c).startswith('M'))
    return re.sub(r'[^a-z0-9]+', ' ', s).strip()


def credits(title, culture):
    parts = re.split(r'\s[-–—]\s', title); segs = [parts[0]] + ([parts[-1]] if len(parts) > 1 and culture else [])
    names = []
    for sg in segs:
        sg = re.sub(r'\s*[\(\[].*?[\)\]]', '', sg)
        for n in re.split(r'\s*(?:,|&|\band\b|\bx\b|\bvs\.?|\bfeat\.?|\bft\.?|\bfeaturing|\bwith|/|;)\s*', sg, flags=re.I):
            n = n.strip()
            if n: names.append(n)
    m = re.search(r'[\(\[]([^()\[\]]*?)\s+(?:remix|rework|bootleg|edit|flip|vip|refix|mix)\s*[\)\]]', title, re.I)
    if m:
        w = re.split(r"['’]s\s", m.group(1))[0]; w = re.sub(r"['’]s$", '', w).strip()
        if w and not BAD.match(w): names.append(w)
    out, seen = [], set()
    for n in names:
        k = nrm(n)
        if 1 < len(k) < 40 and not re.search(r'[\u266b"\u201c\u201d]', n) and not BAD.match(n) and k not in seen: seen.add(k); out.append(n)
    return out


def main():
    arts = {}
    for si, (label, f) in enumerate(ST):
        for v in json.load(open('%s/data/%s-videos.json' % (H, f))):
            for n in credits(v['title'], f == 'culture'):
                k = nrm(n); e = arts.setdefault(k, [n, []])
                if len(e[1]) < 60: e[1].append([si, v['title'], v['id']])
                if len(n) > len(e[0]) and n.lower() == e[0].lower(): e[0] = n
    byl = {}
    for k, (n, songs) in arts.items():
        c = unicodedata.normalize('NFD', n.strip()[:1].upper()); c = ''.join(x for x in c if not unicodedata.category(x).startswith('M'))
        L = c if re.fullmatch(r'[A-Z]', c) else '#'
        byl.setdefault(L, []).append([n, songs])
    os.makedirs(H + '/data/artists', exist_ok=True)
    for L, rows in byl.items():
        rows.sort(key=lambda r: nrm(r[0]))
        json.dump(rows, open('%s/data/artists/%s.json' % (H, 'num' if L == '#' else L.lower()), 'w'), ensure_ascii=False, separators=(',', ':'))
    json.dump({'stations': [s[0] for s in ST], 'letters': {L: len(r) for L, r in sorted(byl.items())}}, open(H + '/data/artists/index.json', 'w'), separators=(',', ':'))
    print('artists:', sum(len(r) for r in byl.values()), '| per letter:', {L: len(r) for L, r in sorted(byl.items())})


if __name__ == '__main__': main()
