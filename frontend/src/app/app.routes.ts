import { Routes } from '@angular/router';
import { modeAuthGuard } from './core/mode-auth.guard';
import { HomePageComponent } from './pages/home/home.page';
import { LiveMatchPageComponent } from './pages/live-match/live-match.page';
import { NewGameSetupPageComponent } from './pages/new-game-setup/new-game-setup.page';
import { TeamRosterPageComponent } from './pages/team-roster/team-roster.page';
import { FriendliesPageComponent } from './pages/friendlies/friendlies.page';
import { FriendlyApplicationPageComponent } from './pages/friendlies/friendly-application.page';
import { FriendlyInvitePageComponent } from './pages/friendlies/friendly-invite.page';

export const routes: Routes = [
  {
    path: '',
    component: HomePageComponent,
    title: 'document.title.home'
  },
  {
    path: 'teams/:teamId',
    component: TeamRosterPageComponent,
    canActivate: [modeAuthGuard],
    title: 'document.title.roster'
  },
  {
    path: 'games/new',
    component: NewGameSetupPageComponent,
    canActivate: [modeAuthGuard],
    title: 'document.title.newGame'
  },
  {
    path: 'friendlies/respond/:token',
    component: FriendlyInvitePageComponent,
    title: 'document.title.friendlies'
  },
  {
    path: 'friendlies/applications/:applicationId',
    component: FriendlyApplicationPageComponent,
    title: 'document.title.friendlies'
  },
  {
    path: 'friendlies',
    component: FriendliesPageComponent,
    title: 'document.title.friendlies'
  },
  {
    path: 'friendlies/new',
    component: FriendliesPageComponent,
    title: 'document.title.friendlies'
  },
  {
    path: 'friendlies/:proposalId/edit',
    component: FriendliesPageComponent,
    title: 'document.title.friendlies'
  },
  {
    path: 'friendlies/:proposalId',
    component: FriendliesPageComponent,
    title: 'document.title.friendlies'
  },
  {
    path: 'games/:gameId/live',
    component: LiveMatchPageComponent,
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
