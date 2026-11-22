import { prisma } from '../lib/prisma';
import { HttpError } from '../utils/http-error';

export const DEFAULT_COACH_SETTINGS = {
  defaultPeriodCount: 4,
  defaultPeriodDurationSeconds: 600,
  playingTimeDisplay: 'MINUTES' as const,
  visibleLiveStats: ['points', 'rebounds', 'assists', 'blocks', 'interceptions', 'fouls'],
  confirmSessionEnd: true,
  openSummaryAfterEnd: true
};

const ALLOWED_PERIOD_COUNTS = [2, 4, 6, 8];
const ALLOWED_DURATIONS = [300, 480, 600, 720];
const ALLOWED_STATS = ['points', 'rebounds', 'assists', 'blocks', 'interceptions', 'fouls'];

export function validateCoachSettings(raw: unknown) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new HttpError(400, 'Les préférences sont invalides.');
  const value = raw as Record<string, unknown>;
  const keys = Object.keys(DEFAULT_COACH_SETTINGS);
  if (Object.keys(value).some((key) => !keys.includes(key))) throw new HttpError(400, 'Les préférences contiennent des champs inconnus.');
  if (!ALLOWED_PERIOD_COUNTS.includes(value.defaultPeriodCount as number)) throw new HttpError(400, 'Le nombre de périodes est invalide.');
  if (!ALLOWED_DURATIONS.includes(value.defaultPeriodDurationSeconds as number)) throw new HttpError(400, 'La durée de période est invalide.');
  if (value.playingTimeDisplay !== 'MINUTES' && value.playingTimeDisplay !== 'PERCENTAGE') throw new HttpError(400, 'L’affichage du temps de jeu est invalide.');
  if (!Array.isArray(value.visibleLiveStats) || value.visibleLiveStats.length === 0 || value.visibleLiveStats.some((stat) => !ALLOWED_STATS.includes(String(stat))) || new Set(value.visibleLiveStats).size !== value.visibleLiveStats.length) throw new HttpError(400, 'Sélectionnez au moins une statistique valide.');
  if (typeof value.confirmSessionEnd !== 'boolean' || typeof value.openSummaryAfterEnd !== 'boolean') throw new HttpError(400, 'Les préférences de fin de session sont invalides.');
  return { ...value, visibleLiveStats: [...value.visibleLiveStats] } as typeof DEFAULT_COACH_SETTINGS;
}

export async function getCoachSettings(userId: number) {
  const settings = await prisma.coachSettings.findUnique({ where: { userId } });
  return settings ? {
    defaultPeriodCount: settings.defaultPeriodCount,
    defaultPeriodDurationSeconds: settings.defaultPeriodDurationSeconds,
    playingTimeDisplay: settings.playingTimeDisplay,
    visibleLiveStats: settings.visibleLiveStats as string[],
    confirmSessionEnd: settings.confirmSessionEnd,
    openSummaryAfterEnd: settings.openSummaryAfterEnd
  } : DEFAULT_COACH_SETTINGS;
}

export async function saveCoachSettings(userId: number, raw: unknown) {
  const settings = validateCoachSettings(raw);
  return prisma.coachSettings.upsert({
    where: { userId },
    create: { userId, ...settings },
    update: settings,
    select: { defaultPeriodCount: true, defaultPeriodDurationSeconds: true, playingTimeDisplay: true, visibleLiveStats: true, confirmSessionEnd: true, openSummaryAfterEnd: true }
  }).then((saved) => ({ ...saved, visibleLiveStats: saved.visibleLiveStats as string[] }));
}
