"""Scrape UP Radio Athens' track history from onlineradiobox.com (today + previous days) -> data/plays.json
Each play: {"t": unix start time, "title": "Artist - Track - Mix", "oid": onlineradiobox track id}"""
import json, re, html, sys, time, urllib.request, datetime, zoneinfo
ATH = zoneinfo.ZoneInfo('Europe/Athens')
def fetch(day):
    url = 'https://onlineradiobox.com/gr/athensup/playlist/%s?cs=gr.athensup&useStationLocation=1' % (day if day else '')
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0', 'Accept-Language': 'en'})
    return urllib.request.urlopen(req, timeout=30).read().decode('utf8', 'ignore')
def parse(h, day, now):
    today = now.astimezone(ATH).date()
    d0 = today - datetime.timedelta(days=day)
    plays = []; prev = None; d = d0
    live = re.search(r'tablelist-schedule__time">\s*<span class="time--schedule">[^<]*[^\d<][^<]*</span>.*?track_history_item">\s*<a href="/track/(\d+)/"[^>]*>(.*?)</a>', h, re.S)
    for m in re.finditer(r'time--schedule">([^<]+)</span></td>\s*<td class="track_history_item">\s*<a href="/track/(\d+)/"[^>]*>(.*?)</a>', h, re.S):
        ts, oid, title = m.group(1).strip(), m.group(2), html.unescape(re.sub(r'<[^>]+>', '', m.group(3))).strip()
        if not re.fullmatch(r'\d\d:\d\d', ts):
            if day == 0: plays.append({'t': int(now.timestamp()), 'title': title, 'oid': oid, 'live': True})
            continue
        hh, mm = map(int, ts.split(':'))
        if prev is not None and (hh * 60 + mm) > prev:   # clock went up while listing goes newest->oldest: crossed midnight backwards
            d = d - datetime.timedelta(days=1)
        prev = hh * 60 + mm
        t = datetime.datetime(d.year, d.month, d.day, hh, mm, tzinfo=ATH)
        plays.append({'t': int(t.timestamp()), 'title': title, 'oid': oid})
    return plays
def main(days=8):
    now = datetime.datetime.now(datetime.timezone.utc)
    try: have = {(p['t'], p['oid']): p for p in json.load(open('data/plays.json'))}
    except Exception: have = {}
    new = 0
    # the song on air has no clock time yet: keep it with an estimated start (last timed song + its length), and drop old estimates
    have = {k: v for k, v in have.items() if not v.get('est')}
    on_air = []
    for day in range(days):
        try: h = fetch(day)
        except Exception as e: print('day', day, 'failed', e, file=sys.stderr); continue
        for p in parse(h, day, now):
            if p.get('live'): on_air.append(p); continue
            k = (p['t'], p['oid'])
            if k not in have: have[k] = p; new += 1
        time.sleep(1.5)
    timed = [p for p in have.values()]
    if on_air and timed:
        last = max(timed, key=lambda p: p['t'])
        try: dur = json.load(open('data/tracks.json')).get(last['oid'], {}).get('dur') or 210
        except Exception: dur = 210
        for li in on_air:
            est = {'t': last['t'] + int(dur), 'title': li['title'], 'oid': li['oid'], 'est': True}
            have.setdefault((est['t'], est['oid']), est)
    plays = sorted(have.values(), key=lambda p: p['t'])
    cutoff = int(now.timestamp()) - 10 * 86400
    plays = [p for p in plays if p['t'] >= cutoff]
    json.dump(plays, open('data/plays.json', 'w'), ensure_ascii=False)
    print(len(plays), 'plays;', new, 'new;', datetime.datetime.fromtimestamp(plays[0]['t'], ATH).strftime('%a %d %H:%M'), '->', datetime.datetime.fromtimestamp(plays[-1]['t'], ATH).strftime('%a %d %H:%M'))
if __name__ == '__main__': main(int(sys.argv[1]) if len(sys.argv) > 1 else 8)
