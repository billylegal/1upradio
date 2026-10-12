"""plays.json + tracks.json -> schedule.json for the website (same-day repeats removed)"""
import json, datetime, zoneinfo
A = zoneinfo.ZoneInfo('Europe/Athens'); TOR = zoneinfo.ZoneInfo('America/Toronto')
_n = datetime.datetime.now(datetime.timezone.utc)
# play each track at the same wall-clock time it aired in Athens, but on Toronto's clock (7 h later in real time; 6 h for a week around the DST changes)
DELAY = int((_n.astimezone(A).utcoffset() - _n.astimezone(TOR).utcoffset()).total_seconds())
plays = json.load(open('data/plays.json')); tracks = json.load(open('data/tracks.json'))
out = []; seen = set(); skipped = 0; miss = 0
for p in sorted(plays, key=lambda p: p['t']):
    tr = tracks.get(p['oid'])
    if not tr or not tr.get('id'): miss += 1; continue
    day = datetime.datetime.fromtimestamp(p['t'], A).date().isoformat()
    if (day, p['oid']) in seen: skipped += 1; continue          # never play the same song twice in one (Athens) day
    seen.add((day, p['oid']))
    out.append({'t': p['t'], 'id': tr['id'], 'title': p['title'], 'dur': tr.get('dur') or 240})
json.dump({'built': int(datetime.datetime.now().timestamp()), 'delay': DELAY, 'plays': out}, open('schedule.json', 'w'), ensure_ascii=False, separators=(',', ':'))
print(len(out), 'scheduled;', skipped, 'same-day repeats dropped;', miss, 'unresolved skipped')
