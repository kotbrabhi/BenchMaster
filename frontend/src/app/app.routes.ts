import { Routes } from '@angular/router';
import { GameSummaryPageComponent } from './pages/game-summary/game-summary.page';
import { HomePageComponent } from './pages/home/home.page';
import { LiveMatchPageComponent } from './pages/live-match/live-match.page';
import { NewGameSetupPageComponent } from './pages/new-game-setup/new-game-setup.page';
import { TeamRosterPageComponent } from './pages/team-roster/team-roster.page';

export const routes: Routes = [
  {
    path: '',
    component: HomePageComponent,
    title: 'BenchMaster'
  },
  {
    path: 'teams/:teamId',
    component: TeamRosterPageComponent,
    title: 'Effectif'
  },
  {
    path: 'games/new',
    component: NewGameSetupPageComponent,
    title: 'Nouveau match'
  },
  {
    path: 'games/:gameId/live',
    component: LiveMatchPageComponent,
    title: 'Match en direct'
  },
  {
    path: 'games/:gameId/summary',
    component: GameSummaryPageComponent,
    title: 'Résumé du match'
  },
  {
    path: '**',
    redirectTo: ''
  }
];
