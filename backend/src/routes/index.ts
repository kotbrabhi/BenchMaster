import { Router } from 'express';
import { requireAuth } from '../auth/auth.middleware';
import { asyncHandler } from '../utils/async-handler';
import * as authController from '../controllers/auth.controller';
import * as gameController from '../controllers/game.controller';
import * as friendlyMatchController from '../controllers/friendly-match.controller';
import * as liveMatchController from '../controllers/live-match.controller';
import * as playerController from '../controllers/player.controller';
import * as teamController from '../controllers/team.controller';

const router = Router();

router.get('/health', (_request, response) => {
  response.json({ status: 'ok' });
});

router.post('/auth/register', asyncHandler(authController.register));
router.post('/auth/login', asyncHandler(authController.login));
router.get('/auth/me', asyncHandler(requireAuth), asyncHandler(authController.me));
router.post('/public/game-shares', asyncHandler(gameController.createPublicShare));
router.get('/public/game-shares/:shareId', asyncHandler(gameController.getPublicSharedSummary));
router.get('/public/friendly-match-invites/:token', asyncHandler(friendlyMatchController.getPublicInvite));
router.put('/public/friendly-match-invites/:token/response', asyncHandler(friendlyMatchController.setPublicAvailability));

router.use(asyncHandler(requireAuth));

router.get('/teams', asyncHandler(teamController.listTeams));
router.post('/teams', asyncHandler(teamController.createTeam));
router.put('/teams/:teamId', asyncHandler(teamController.updateTeam));
router.delete('/teams/:teamId', asyncHandler(teamController.deleteTeam));

router.get('/teams/:teamId/players', asyncHandler(playerController.listPlayers));
router.post('/teams/:teamId/players', asyncHandler(playerController.createPlayer));
router.put('/players/:playerId', asyncHandler(playerController.updatePlayer));
router.delete('/players/:playerId', asyncHandler(playerController.deletePlayer));

router.get('/games', asyncHandler(gameController.listGames));
router.get('/friendly-matches', asyncHandler(friendlyMatchController.listAllProposals));
router.get('/friendly-matches/mine', asyncHandler(friendlyMatchController.listMyProposals));
router.get('/friendly-matches/:proposalId/applications', asyncHandler(friendlyMatchController.listProposalApplications));
router.post('/friendly-matches', asyncHandler(friendlyMatchController.createProposal));
router.get('/friendly-matches/:proposalId', asyncHandler(friendlyMatchController.getProposal));
router.put('/friendly-matches/:proposalId', asyncHandler(friendlyMatchController.updateProposal));
router.post('/friendly-matches/:proposalId/cancel', asyncHandler(friendlyMatchController.cancelProposal));
router.post('/friendly-matches/:proposalId/applications', asyncHandler(friendlyMatchController.createInterest));
router.get('/my/friendly-match-applications', asyncHandler(friendlyMatchController.listMyApplications));
router.get('/friendly-match-applications/:applicationId', asyncHandler(friendlyMatchController.getMyApplication));
router.post('/friendly-match-applications/:applicationId/invites', asyncHandler(friendlyMatchController.createOrRotateInvites));
router.delete('/friendly-match-applications/:applicationId/team-invite', asyncHandler(friendlyMatchController.revokeTeamInvite));
router.delete('/friendly-match-applications/:applicationId/invites/:responseId', asyncHandler(friendlyMatchController.revokeInvite));
router.post('/friendly-match-applications/:applicationId/submit', asyncHandler(friendlyMatchController.submitApplication));
router.post('/friendly-match-applications/:applicationId/withdraw', asyncHandler(friendlyMatchController.withdrawApplication));
router.post('/friendly-match-applications/:applicationId/accept', asyncHandler(friendlyMatchController.acceptApplication));
router.post('/friendly-match-applications/:applicationId/reject', asyncHandler(friendlyMatchController.rejectApplication));
router.get('/my/friendly-matches', asyncHandler(friendlyMatchController.listMyFriendlyMatches));
router.get('/my/friendly-notifications', asyncHandler(friendlyMatchController.listMyFriendlyNotifications));
router.post('/my/friendly-notifications/:notificationId/read', asyncHandler(friendlyMatchController.markFriendlyNotificationRead));
router.post('/games', asyncHandler(gameController.createGame));
router.get('/games/:gameId', asyncHandler(gameController.getGame));
router.get('/games/:gameId/players', asyncHandler(gameController.getGamePlayers));
router.get('/games/:gameId/summary', asyncHandler(gameController.getGameSummary));
router.post('/games/:gameId/share', asyncHandler(gameController.createShare));

router.post('/games/:gameId/start', asyncHandler(liveMatchController.startGame));
router.post('/games/:gameId/pause', asyncHandler(liveMatchController.pauseGame));
router.post('/games/:gameId/resume', asyncHandler(liveMatchController.resumeGame));
router.post('/games/:gameId/periods/complete', asyncHandler(liveMatchController.completePeriod));
router.post('/games/:gameId/periods/start', asyncHandler(liveMatchController.startNextPeriod));
router.post('/games/:gameId/substitutions', asyncHandler(liveMatchController.substitutePlayers));
router.post('/games/:gameId/players/:playerId/points', asyncHandler(liveMatchController.recordPlayerPoints));
router.post('/games/:gameId/players/:playerId/stats', asyncHandler(liveMatchController.recordPlayerStat));
router.post('/games/:gameId/end', asyncHandler(liveMatchController.endGame));

export default router;
