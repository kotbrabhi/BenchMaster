import { Injectable, signal } from '@angular/core';
import { GameDetail, GamePlayerState } from '../core/models';

@Injectable({ providedIn: 'root' })
export class TimeTrackingService {
  private readonly now = signal(Date.now());

  constructor() {
    window.setInterval(() => {
      this.now.set(Date.now());
    }, 1000);
  }

  getClockSeconds(game: Pick<GameDetail, 'clockElapsedSeconds' | 'isClockRunning' | 'lastClockStartedAt'>) {
    this.now();

    if (!game.isClockRunning || !game.lastClockStartedAt) {
      return game.clockElapsedSeconds;
    }

    const liveSeconds = Math.max(0, Math.floor((Date.now() - new Date(game.lastClockStartedAt).getTime()) / 1000));
    return game.clockElapsedSeconds + liveSeconds;
  }

  getPeriodClockSeconds(
    game: Pick<GameDetail, 'periodElapsedSeconds' | 'isClockRunning' | 'lastPeriodStartedAt'>
  ) {
    this.now();

    if (!game.isClockRunning || !game.lastPeriodStartedAt) {
      return game.periodElapsedSeconds;
    }

    const liveSeconds = Math.max(0, Math.floor((Date.now() - new Date(game.lastPeriodStartedAt).getTime()) / 1000));
    return game.periodElapsedSeconds + liveSeconds;
  }

  getPlayerSeconds(game: GameDetail, player: GamePlayerState) {
    this.now();

    if (game.status !== 'LIVE' || !game.isClockRunning || !player.isOnCourt || !player.lastEnteredAt) {
      return player.totalSeconds;
    }

    const liveSeconds = Math.max(0, Math.floor((Date.now() - new Date(player.lastEnteredAt).getTime()) / 1000));
    return player.totalSeconds + liveSeconds;
  }

  getPlayerPeriodSeconds(game: GameDetail, player: GamePlayerState) {
    this.now();

    if (
      game.status !== 'LIVE' ||
      game.currentPeriodStatus !== 'LIVE' ||
      !game.isClockRunning ||
      !player.isOnCourt ||
      !player.lastPeriodEnteredAt
    ) {
      return player.periodSeconds;
    }

    const liveSeconds = Math.max(0, Math.floor((Date.now() - new Date(player.lastPeriodEnteredAt).getTime()) / 1000));
    return player.periodSeconds + liveSeconds;
  }
}
