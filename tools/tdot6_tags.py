"""T.DOT 6: sort data/tdot6-all-videos.json into sub-genres and write
  data/tdot6-videos.json        the DEFAULT mix = the non-commercial dark / OVO-style core only
  data/tdot6-<sub>-videos.json  old school Toronto, dark R&B, after hours, slow jams, 90s-2000s Toronto hip hop   (subs: old, dark, after, slow, hh)
A song can sit in several subs. Rules are by artist + a list of radio hits that stay OUT of the core."""
import json, os
H = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
V = json.load(open(os.path.join(H, 'data/tdot6-all-videos.json')))
OLD = {'Tamia', 'Deborah Cox', 'Melanie Fiona', 'Jully Black', 'Glenn Lewis', 'Divine Brown'}
HH = {'Maestro Fresh Wes', 'Dream Warriors', 'Michie Mee', 'Kardinal Offishall', 'Choclair', 'Saukrates', 'k-os', 'Organized Rhyme', 'Snow'}
DARK = {'The Weeknd', 'PARTYNEXTDOOR', 'dvsn', 'Majid Jordan', 'Roy Woods', 'Daniel Caesar', 'Tory Lanez', 'Giveon', 'Snoh Aalegra', 'Mustafa'}
AFTER = {'6LACK', 'Bryson Tiller', 'Brent Faiyaz', 'Summer Walker', 'Frank Ocean', 'SZA', 'Jhené Aiko', 'Sabrina Claudio', 'Kehlani', 'Ravyn Lenae'}
HITS = {x.lower() for x in ("Hotline Bling,Fancy,Hype,Controlla,Fake Love,Nice For What,In My Feelings,Girls Love Beyoncé,Nonstop,Ratchet Happy Birthday,Passionfruit,Hold On, We're Going Home,"
        "Too Good,Jaded,Feel No Ways,Over,Take Care,Fireworks,Come Thru,Earned It,Call Out My Name,Die For You,I Feel It Coming,Best Part,Kill Bill,Location,Love Galore,Pillowtalk,Say It,Luv,"
        "Here,2 On,Needs,Heartbreak Anniversary,Like I Want You,Better,Cranes In The Sky,Sex With Me,Free Smoke,Teenage Fever,The Motion,Pound Cake,Tuscan Leather,Starboy,Blinding Lights,Heartless,"
        "Secret,Open Up,We Find Love,Honey,2 Phones,Nights Like This,Say It,Hold Tight,Faded,Cyanide,Sorry,Pillow Talk,Don't Matter To Me,Hold On").replace(", We're", "|We're").split(',')}
HITS = {h.replace('|', ',') for h in HITS}
HITS.add("hold on, we're going home")
subs = {k: [] for k in ('old', 'dark', 'after', 'slow', 'hh')}; core = []
for v in V:
    t, a = v['title'].rsplit(' - ', 1)
    key = t.lower(); hit = key in HITS
    if a in OLD: subs['old'].append(v); continue
    if a in HH: subs['hh'].append(v); continue
    if a == 'Drake':
        subs['slow'].append(v)
        if not hit: subs['after'].append(v); core.append(v)
        continue
    if a in DARK:
        subs['slow'].append(v) if hit else None
        if not hit: subs['dark'].append(v); core.append(v)
        else: subs['slow'].append(v) if v not in subs['slow'] else None
        continue
    if a in AFTER:
        if not hit: subs['after'].append(v); core.append(v)
        else: subs['slow'].append(v)
        continue
    subs['slow'].append(v)
for k, lst in subs.items():
    seen = []; [seen.append(x) for x in lst if x not in seen]
    json.dump(seen, open(os.path.join(H, 'data/tdot6-%s-videos.json' % k), 'w'), ensure_ascii=False, separators=(',', ':'))
    print('%-6s %3d songs %5.1f h' % (k, len(seen), sum(x['dur'] for x in seen) / 3600))
json.dump(core, open(os.path.join(H, 'data/tdot6-videos.json'), 'w'), ensure_ascii=False, separators=(',', ':'))
print('DEFAULT (non-commercial core): %d songs, %.1f h' % (len(core), sum(x['dur'] for x in core) / 3600))
