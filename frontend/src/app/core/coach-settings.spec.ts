import { formatPlayingTime } from './coach-settings';

describe('formatPlayingTime', () => {
  it('shows a dash when the total game duration is zero or unavailable', () => {
    expect(formatPlayingTime(120, 0, 'PERCENTAGE')).toBe('—');
    expect(formatPlayingTime(120, Number.NaN, 'PERCENTAGE')).toBe('—');
  });
  it('calculates the share of the session duration', () => {
    expect(formatPlayingTime(300, 1200, 'PERCENTAGE')).toBe('25%');
  });
});
