"""Fetch public Zhejiang typhoon snapshots; fail closed without overwriting good data."""
import json
import os
import time
from datetime import datetime, timezone, timedelta
from pathlib import Path
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
SOURCE = 'https://typhoon.slt.zj.gov.cn/'


def get_json(path):
    for attempt in range(3):
        try:
            req = Request(SOURCE + 'Api/' + path, headers={
                'User-Agent': 'CoastalWatch/1.0 (public typhoon information)',
                'Referer': SOURCE, 'Accept': 'application/json'})
            with urlopen(req, timeout=30) as response:
                return json.loads(response.read().decode('utf-8-sig'))
        except Exception:
            if attempt == 2:
                raise
            time.sleep(2 ** attempt)


def validate_point(p):
    if not -90 <= float(p['lat']) <= 90 or not -180 <= float(p['lng']) <= 180:
        raise ValueError('Invalid coordinates')
    datetime.strptime(p['time'], '%Y-%m-%d %H:%M:%S')
    for field in ('power', 'speed'):
        raw = str(p.get(field) or '').strip()
        if raw and float(raw) < 0:
            raise ValueError('Invalid wind measurement')


def collect():
    now = datetime.now(timezone(timedelta(hours=8)))
    records = []
    # Include the previous year to retain storms crossing New Year.
    for year in (now.year - 1, now.year):
        rows = get_json(f'TyphoonList/{year}')
        if not isinstance(rows, list):
            raise ValueError('Unexpected list schema')
        for row in rows:
            if not str(row.get('tfid', '')).isdigit() or str(row.get('isactive')) not in ('0', '1'):
                raise ValueError('Unexpected storm schema')
        records.extend(rows)
    active = [r for r in records if str(r['isactive']) == '1']
    selected = active or sorted(records, key=lambda r: r.get('endtime', ''), reverse=True)[:1]
    storms = []
    for row in selected:
        storm = get_json('TyphoonInfo/' + str(row['tfid']))
        if not isinstance(storm, dict) or str(storm.get('tfid')) != str(row['tfid']):
            raise ValueError('Unexpected detail schema')
        points = storm.get('points')
        if not isinstance(points, list) or not points:
            raise ValueError('Missing observations')
        for point in points:
            validate_point(point)
            for forecast in point.get('forecast') or []:
                valid = []
                for future in forecast.get('forecastpoints') or []:
                    try:
                        validate_point(future)
                        valid.append(future)
                    except (ValueError, KeyError, TypeError):
                        print('Omitted invalid forecast point', row['tfid'], future.get('time'))
                forecast['forecastpoints'] = valid
        points.sort(key=lambda p: p['time'])
        storm['isactive'] = str(row['isactive'])
        storms.append(storm)
    return {'schemaVersion': 1, 'fetchedAt': now.isoformat(),
            'source': {'name': '浙江省台风路径实时发布系统', 'url': SOURCE},
            'activeCount': len(active), 'storms': storms,
            'warnings': {'status': 'unavailable', 'message': '尚未接入地方官方预警数据，请查阅当地气象部门。'}}


if __name__ == '__main__':
    data = collect()
    destination = ROOT / 'data' / 'typhoons.json'
    destination.parent.mkdir(exist_ok=True)
    temporary = destination.with_suffix('.tmp')
    temporary.write_text(json.dumps(data, ensure_ascii=False), encoding='utf-8')
    os.replace(temporary, destination)
    print(f"Fetched {len(data['storms'])} storm(s); active: {data['activeCount']}")
