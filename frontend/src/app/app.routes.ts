import { Routes } from '@angular/router';
import { modeAuthGuard } from './core/mode-auth.guard';
import { HomePageComponent } from './pages/home/home.page';

export const routes: Routes = [
  {
    path: '',
    component: HomePageComponent,
    title: 'document.title.home'
  },
  {
    path: 'teams/:teamId',
    loadComponent: () => import('./pages/team-roster/team-roster.page').then((module) => module.TeamRosterPageComponent),
    canActivate: [modeAuthGuard],
    title: 'document.title.roster'
  },
  {
    path: 'games/new',
    loadComponent: () => import('./pages/new-game-setup/new-game-setup.page').then((module) => module.NewGameSetupPageComponent),
    canActivate: [modeAuthGuard],
    title: 'document.title.newGame'
  },
  {
    path: 'friendlies/respond/:token',
    loadComponent: () => import('./pages/friendlies/friendly-invite.page').then((module) => module.FriendlyInvitePageComponent),
    title: 'document.title.friendlies'
  },
  {
    path: 'friendlies/applications/:applicationId',
    loadComponent: () => import('./pages/friendlies/friendly-application.page').then((module) => module.FriendlyApplicationPageComponent),
    title: 'document.title.friendlies'
  },
  {
    path: 'friendlies',
    loadComponent: () => import('./pages/friendlies/friendlies.page').then((module) => module.FriendliesPageComponent),
    title: 'document.title.friendlies'
  },
  {
    path: 'friendlies/new',
    loadComponent: () => import('./pages/friendlies/friendlies.page').then((module) => module.FriendliesPageComponent),
    title: 'document.title.friendlies'
  },
  {
    path: 'friendlies/:proposalId/edit',
    loadComponent: () => import('./pages/friendlies/friendlies.page').then((module) => module.FriendliesPageComponent),
    title: 'document.title.friendlies'
  },
  {
    path: 'friendlies/:proposalId',
    loadComponent: () => import('./pages/friendlies/friendlies.page').then((module) => module.FriendliesPageComponent),
    title: 'document.title.friendlies'
  },
  {
    path: 'games/:gameId/live',
    loadComponent: () => import('./pages/live-match/live-match.page').then((module) => module.LiveMatchPageComponent),
    canActivate: [modeAuthGuard],
    title: 'document.title.liveMatch'
  },
  {
    path: 'games/:gameId/summary',
    loadComponent: () =>
      import('./pages/game-summary/game-summary.page').then((module) => module.GameSummaryPageComponent),
    canActivate: [modeAuthGuard],
    title: 'document.title.summary'
  },
  {
    path: '**',
    redirectTo: ''
  }
];
