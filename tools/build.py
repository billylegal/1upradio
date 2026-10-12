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

# --- fill the schedule's holes (songs the station aired that we could not match) with real songs, picked the same way for every listener ---
import bisect
final = []
times = [q['t'] for q in out]
for i, q in enumerate(out):
    final.append(q)
    if i + 1 >= len(out): break
    cur = q['t'] + q['dur']; remaining = out[i + 1]['t'] - cur
    if remaining < 45: continue
    lo = bisect.bisect_left(times, q["t"] - 72 * 3600); hi = bisect.bisect_right(times, q['t'] - 3 * 3600)
    recent = {x['id'] for x in out[max(0, i - 40):i + 1]}
    pool = [x for x in out[lo:hi] if x['id'] not in recent]
    used = set(); k = 0
    while remaining >= 45 and pool:
        fits = [x for x in pool if x['dur'] <= remaining + 3 and x['id'] not in used]
        if not fits: break
        top = sorted(fits, key=lambda x: -x['dur'])[:8]
        pick = top[((q['t'] * 2654435761) + k * 40503) % len(top)]
        final.append({'t': cur, 'id': pick['id'], 'title': pick['title'], 'dur': pick['dur'], 'f': 1})
        used.add(pick['id']); cur += pick['dur']; remaining -= pick['dur']; k += 1
out = final
json.dump({'built': int(datetime.datetime.now().timestamp()), 'delay': DELAY, 'plays': out}, open('schedule.json', 'w'), ensure_ascii=False, separators=(',', ':'))
print(len(out), 'scheduled;', skipped, 'same-day repeats dropped;', miss, 'unresolved skipped')
