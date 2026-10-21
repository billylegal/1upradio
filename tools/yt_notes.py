#!/usr/bin/env python3
"""Short notes about each song, from the uploader's own YouTube description (e.g. '7" on Navara from 1976'): data/song-notes.json {video id: {"n": note, "l": label or "", "y": year or ""}}.
Only short plain descriptions are kept (no links, no 'Provided to YouTube' boilerplate). Resumable: ids already done are skipped.   python3 tools/yt_notes.py"""
import json, os, re, urllib.request
H = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
K = open(os.path.expanduser('~/.config/1upradio/youtube.key')).read().strip()
F = H + '/data/song-notes.json'
ST = ['main', 'movement', 'culture', 'hiphopvinyl']
LAB = re.compile(r'\bon\s+([A-Z0-9][\w\'&.\- ]{1,40}?)(?:\s+(?:from|in|records?|label)\b|\s*[\(\[,;.\-]|\s*$)', re.I)


def clean(d):
    d = re.sub(r'\s+', ' ', d or '').strip()
    if not d or len(d) > 180 or re.search(r'https?://|www\.|provided to youtube|℗|subscribe|follow us|@', d, re.I): return ''
    return d


def main():
    done = json.load(open(F)) if os.path.exists(F) else {}
    ids = []
    for s in ST:
        for v in json.load(open('%s/data/%s-videos.json' % (H, s))):
            if v['id'] not in done and v['id'] not in ids: ids.append(v['id'])
    print('to do', len(ids), flush=True)
    for i in range(0, len(ids), 50):
        chunk = ids[i:i + 50]
        j = json.load(urllib.request.urlopen('https://www.googleapis.com/youtube/v3/videos?part=snippet&id=%s&key=%s' % (','.join(chunk), K), timeout=30))
        got = {it['id']: it['snippet'].get('description', '') for it in j.get('items', [])}
        for vid in chunk:
            n = clean(got.get(vid, '')); lab = yr = ''
            if n:
                m = LAB.search(n); lab = m.group(1).strip(' .') if m else ''
                y = re.search(r'\b(19[4-9]\d|20[0-2]\d)\b', n); yr = y.group(1) if y else ''
                if lab and (len(lab) < 3 or re.match(r'^(the|a|an|vinyl|cd|tape|7|12|youtube|my|this)\b', lab, re.I)): lab = ''
            done[vid] = {'n': n, 'l': lab, 'y': yr} if n else {}
        json.dump(done, open(F, 'w'), ensure_ascii=False, separators=(',', ':'))
        print(i + len(chunk), flush=True)
    k = [v for v in done.values() if v]
    print('notes', len(k), 'with label', sum(1 for v in k if v['l']))


if __name__ == '__main__': main()
