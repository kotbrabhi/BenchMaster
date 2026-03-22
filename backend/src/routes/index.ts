import { Router } from 'express';
import { asyncHandler } from '../utils/async-handler';
import * as gameController from '../controllers/game.controller';
import * as liveMatchController from '../controllers/live-match.controller';
import * as playerController from '../controllers/player.controller';
import * as teamController from '../controllers/team.controller';

const router = Router();

router.get('/health', (_request, response) => {
  response.json({ status: 'ok' });
});

router.get('/teams', asyncHandler(teamController.listTeams));
router.post('/teams', asyncHandler(teamController.createTeam));
router.put('/teams/:teamId', asyncHandler(teamController.updateTeam));
router.delete('/teams/:teamId', asyncHandler(teamController.deleteTeam));

router.get('/teams/:teamId/players', asyncHandler(playerController.listPlayers));
router.post('/teams/:teamId/players', asyncHandler(playerController.createPlayer));
router.put('/players/:playerId', asyncHandler(playerController.updatePlayer));
router.delete('/players/:playerId', asyncHandler(playerController.deletePlayer));

router.get('/games', asyncHandler(gameController.listGames));
router.post('/games', asyncHandler(gameController.createGame));
router.get('/games/:gameId', asyncHandler(gameController.getGame));
router.get('/games/:gameId/players', asyncHandler(gameController.getGamePlayers));
router.get('/games/:gameId/summary', asyncHandler(gameController.getGameSummary));

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
