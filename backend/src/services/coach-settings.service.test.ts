import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_COACH_SETTINGS, validateCoachSettings } from './coach-settings.service';
import { HttpError } from '../utils/http-error';

test('coach defaults retain the current game format and hide fouls', () => {
  assert.equal(DEFAULT_COACH_SETTINGS.defaultPeriodCount, 4);
  assert.equal(DEFAULT_COACH_SETTINGS.defaultPeriodDurationSeconds, 600);
  assert.equal(DEFAULT_COACH_SETTINGS.playingTimeDisplay, 'PERCENTAGE');
  assert.deepEqual(DEFAULT_COACH_SETTINGS.visibleLiveStats, ['points', 'rebounds', 'assists', 'blocks', 'interceptions']);
});

test('coach settings reject invalid formats and an empty quick-stat selection', () => {
  assert.throws(() => validateCoachSettings({ ...DEFAULT_COACH_SETTINGS, defaultPeriodCount: 3 }), HttpError);
  assert.throws(() => validateCoachSettings({ ...DEFAULT_COACH_SETTINGS, visibleLiveStats: [] }), HttpError);
  assert.throws(() => validateCoachSettings({ ...DEFAULT_COACH_SETTINGS, defaultPeriodDurationSeconds: 420 }), HttpError);
});

test('coach settings accept an independent valid account preference payload', () => {
  const result = validateCoachSettings({ ...DEFAULT_COACH_SETTINGS, defaultPeriodCount: 8, playingTimeDisplay: 'PERCENTAGE', visibleLiveStats: ['blocks'] });
  assert.equal(result.defaultPeriodCount, 8);
  assert.equal(result.playingTimeDisplay, 'PERCENTAGE');
  assert.deepEqual(result.visibleLiveStats, ['blocks']);
});
