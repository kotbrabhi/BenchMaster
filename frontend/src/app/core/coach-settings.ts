export type LiveStatKey = 'points' | 'rebounds' | 'assists' | 'blocks' | 'interceptions' | 'fouls';
export interface CoachSettings {
  defaultPeriodCount: 2 | 4 | 6 | 8;
  defaultPeriodDurationSeconds: 300 | 480 | 600 | 720;
  playingTimeDisplay: 'MINUTES' | 'PERCENTAGE';
  visibleLiveStats: LiveStatKey[];
  confirmSessionEnd: boolean;
  openSummaryAfterEnd: boolean;
}
export const DEFAULT_COACH_SETTINGS: CoachSettings = {
  defaultPeriodCount: 4, defaultPeriodDurationSeconds: 600, playingTimeDisplay: 'MINUTES',
  visibleLiveStats: ['points', 'rebounds', 'assists', 'blocks', 'interceptions', 'fouls'],
  confirmSessionEnd: true, openSummaryAfterEnd: true
};
export function formatPlayingTime(totalSeconds: number, totalGameSeconds: number, display: CoachSettings['playingTimeDisplay']) {
  if (display === 'MINUTES') return String(Math.round(Math.max(0, totalSeconds) / 60));
  if (!Number.isFinite(totalGameSeconds) || totalGameSeconds <= 0 || !Number.isFinite(totalSeconds) || totalSeconds < 0) return '—';
  return `${Math.round((totalSeconds / totalGameSeconds) * 100)}%`;
}
