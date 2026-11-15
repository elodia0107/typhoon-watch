import importlib.util
import unittest
from pathlib import Path
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('fetch', Path(__file__).parents[1] / 'scripts/fetch_typhoons.py')
fetch = importlib.util.module_from_spec(spec)
spec.loader.exec_module(fetch)

class FetchTests(unittest.TestCase):
    def point(self):
        return dict(time='2026-11-11 17:00:00', lat='29.4', lng='143.1', power='8', speed='20')

    def test_invalid_observation_rejected(self):
        with self.assertRaises(ValueError):
            fetch.validate_point(dict(self.point(), lat='999'))

    def test_no_active_returns_labeled_history(self):
        row = dict(tfid='202632', isactive='0', endtime='2026-11-11 17:00:00')
        with patch.object(fetch, 'get_json', side_effect=[[], [row], dict(tfid='202632', points=[self.point()])]):
            result = fetch.collect()
        self.assertEqual(result['activeCount'], 0)
        self.assertEqual(result['storms'][0]['isactive'], '0')
        self.assertEqual(result['warnings']['status'], 'unavailable')

    def test_upstream_failure_not_silenced(self):
        with patch.object(fetch, 'get_json', side_effect=OSError('unavailable')):
            with self.assertRaises(OSError):
                fetch.collect()

    def test_active_and_invalid_forecast(self):
        row = dict(tfid='202632', isactive='1')
        p = self.point()
        p['forecast'] = [dict(tm='中国', forecastpoints=[dict(p, lng='999')])]
        with patch.object(fetch, 'get_json', side_effect=[[], [row], dict(tfid='202632', points=[p])]):
            result = fetch.collect()
        self.assertEqual(result['activeCount'], 1)
        self.assertEqual(result['storms'][0]['points'][0]['forecast'][0]['forecastpoints'], [])

if __name__ == '__main__':
    unittest.main()
