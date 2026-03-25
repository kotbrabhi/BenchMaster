import { Routes } from '@angular/router';
import { modeAuthGuard } from './core/mode-auth.guard';
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
    canActivate: [modeAuthGuard],
    title: 'Effectif'
  },
  {
    path: 'games/new',
    component: NewGameSetupPageComponent,
    canActivate: [modeAuthGuard],
    title: 'Nouveau match'
  },
  {
    path: 'games/:gameId/live',
    component: LiveMatchPageComponent,
    canActivate: [modeAuthGuard],
    title: 'Match en direct'
  },
  {
    path: 'games/:gameId/summary',
    loadComponent: () =>
      import('./pages/game-summary/game-summary.page').then((module) => module.GameSummaryPageComponent),
    canActivate: [modeAuthGuard],
    title: 'Résumé du match'
  },
  {
    path: '**',
    redirectTo: ''
  }
];
