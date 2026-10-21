#!/usr/bin/env python3
"""Set the Song of the week for a station:  featured.py STATION VIDEOID ["why it's great"]   |   featured.py STATION --off
STATION = 1up, cultureshock, vault, movement. The title is looked up from the station's songs. Writes data/featured.json (publish it like any site file)."""
import json, os, sys
H = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
F = os.path.join(H, 'data/featured.json')
FILES = {'1up': 'data/main-videos.json', 'cultureshock': 'data/culture-videos.json', 'vault': 'data/hiphopvinyl-videos.json', 'movement': 'data/movement-videos.json'}
if len(sys.argv) < 3 or sys.argv[1] not in FILES: print(__doc__); sys.exit(1)
d = json.load(open(F)) if os.path.exists(F) else {}
st, vid = sys.argv[1], sys.argv[2]
if vid == '--off': d.pop(st, None)
else:
    t = next((v['title'] for v in json.load(open(os.path.join(H, FILES[st]))) if v['id'] == vid), None)
    if not t: print('that video id is not in this station'); sys.exit(1)
    d[st] = {'id': vid, 'title': t, 'note': sys.argv[3] if len(sys.argv) > 3 else ''}
json.dump(d, open(F, 'w'), indent=1, ensure_ascii=False); print(json.dumps(d.get(st), ensure_ascii=False))
