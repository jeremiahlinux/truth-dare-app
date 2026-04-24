import {
  createQuestionSession,
  finalizeSession,
  getGamePlayersByRoomId,
  getGameSessionById,
  getLatestRoomSession,
  getRoomById,
  resetRoomForReplay,
  setSessionAwaitingConfirmation,
  updatePlayerStats,
  updateRoomStatus,
  getRoomCodeForId,
} from "../db.js";
import { generateTruthAndDare } from "./promptGenerator.js";

type GameMode = "classic" | "spicy" | "party";
type SessionStatus = "pending" | "awaiting_confirmation" | "completed" | "skipped";

interface GameState {
  roomId: string;
  roomCode: string;
  status: "waiting" | "in_progress" | "completed";
  currentRound: number;
  totalRounds: number;
  currentPlayerIndex: number;
  gameMode: GameMode;
  players: any[];
  currentQuestion: null | {
    sessionId: string;
    type: "truth" | "dare";
    text: string;
    status: SessionStatus;
    turnPlayerId: string;
    performedByPlayerId: string | null;
    confirmedByPlayerId: string | null;
  };
}

interface PlayerAction {
  playerId: string;
  action: "completed" | "skipped";
  responseText?: string;
}

function mapPlayers(players: any[]) {
  return players
    .sort((a, b) => a.playerIndex - b.playerIndex)
    .map((p) => ({
      id: p.id,
      name: p.playerName,
      score: p.score,
      streak: p.streak,
      completed: p.completedCount,
      passed: p.passedCount,
      skipped: p.skippedCount,
      isReady: p.isReady,
      isConnected: p.isConnected,
    }));
}

async function buildGameState(roomId: string): Promise<GameState | undefined> {
  const room = await getRoomById(roomId);
  if (!room) return undefined;

  const players = await getGamePlayersByRoomId(roomId);
  if (players.length === 0) return undefined;

  const latestSession = await getLatestRoomSession(roomId);
  const currentQuestion =
    latestSession && latestSession.round === room.currentRound
      ? {
          sessionId: latestSession.id,
          type: latestSession.questionType as "truth" | "dare",
          text: latestSession.promptText,
          status: latestSession.status as SessionStatus,
          turnPlayerId: latestSession.playerTurnId,
          performedByPlayerId: latestSession.performedByPlayerId ?? null,
          confirmedByPlayerId: latestSession.confirmedByPlayerId ?? null,
        }
      : null;

  return {
    roomId,
    roomCode: room.roomCode,
    status: room.status as GameState["status"],
    currentRound: room.currentRound,
    totalRounds: room.roundCount,
    currentPlayerIndex: room.currentPlayerIndex,
    gameMode: room.gameMode as GameMode,
    players: mapPlayers(players),
    currentQuestion,
  };
}

export async function initializeGame(roomId: string): Promise<GameState> {
  const players = await getGamePlayersByRoomId(roomId);
  if (players.length < 2) throw new Error("At least 2 players are required to start the game");

  await updateRoomStatus(roomId, "in_progress", 1, 0);
  const gameState = await buildGameState(roomId);
  if (!gameState) throw new Error("Failed to initialize game");
  return gameState;
}

export async function getGameState(roomId: string): Promise<GameState | undefined> {
  return buildGameState(roomId);
}

async function advanceTurn(roomId: string): Promise<void> {
  const room = await getRoomById(roomId);
  if (!room) throw new Error("Room not found");

  const players = await getGamePlayersByRoomId(roomId);
  if (players.length === 0) throw new Error("No players in room");

  const nextPlayerIndex = (room.currentPlayerIndex + 1) % players.length;
  let nextRound = room.currentRound;
  let nextStatus: "in_progress" | "completed" = "in_progress";

  if (nextPlayerIndex === 0) {
    nextRound += 1;
    if (nextRound > room.roundCount) {
      nextStatus = "completed";
    }
  }

  await updateRoomStatus(roomId, nextStatus, nextRound, nextPlayerIndex);
}

export async function generateNextQuestion(
  roomId: string,
  preferredType?: "truth" | "dare"
): Promise<{ sessionId: string; type: "truth" | "dare"; text: string } | null> {
  const gameState = await getGameState(roomId);
  if (!gameState || gameState.status !== "in_progress") {
    throw new Error("Game not initialized");
  }

  if (gameState.currentQuestion && ["pending", "awaiting_confirmation"].includes(gameState.currentQuestion.status)) {
    return {
      sessionId: gameState.currentQuestion.sessionId,
      type: gameState.currentQuestion.type,
      text: gameState.currentQuestion.text,
    };
  }

  const playerCount = gameState.players.length;
  const { truth, dare } = await generateTruthAndDare(gameState.gameMode, playerCount);
  const type = preferredType ?? (Math.random() > 0.5 ? "truth" : "dare");
  const text = type === "truth" ? truth : dare;
  const currentPlayer = gameState.players[gameState.currentPlayerIndex];

  const session = await createQuestionSession(
    roomId,
    gameState.currentRound,
    currentPlayer.id,
    type,
    text
  );

  return { sessionId: session.id, type, text };
}

export async function handlePlayerAction(roomId: string, action: PlayerAction): Promise<void> {
  const gameState = await getGameState(roomId);
  if (!gameState || gameState.status !== "in_progress") throw new Error("Game not initialized");

  const currentPlayer = gameState.players[gameState.currentPlayerIndex];
  if (!currentPlayer || currentPlayer.id !== action.playerId) {
    throw new Error("Only the current player can submit an action");
  }

  const currentQuestion = gameState.currentQuestion;
  if (!currentQuestion || currentQuestion.turnPlayerId !== action.playerId) {
    throw new Error("No active question for the current player");
  }

  const session = await getGameSessionById(currentQuestion.sessionId);
  if (!session) throw new Error("Active session not found");
  if (!["pending", "awaiting_confirmation"].includes(session.status)) {
    throw new Error("This turn is already resolved");
  }

  if (action.action === "completed") {
    await setSessionAwaitingConfirmation(session.id, action.playerId, action.responseText);
    return;
  }

  await finalizeSession(session.id, "skipped", "skipped");
  await updatePlayerStats(action.playerId, "skipped");
  await advanceTurn(roomId);
}

export async function confirmPlayerAction(
  roomId: string,
  sessionId: string,
  confirmerPlayerId: string,
  approved: boolean
) {
  const gameState = await getGameState(roomId);
  if (!gameState || gameState.status !== "in_progress") {
    throw new Error("Game is not active");
  }

  const session = await getGameSessionById(sessionId);
  if (!session || session.roomId !== roomId) {
    throw new Error("Session not found");
  }
  if (session.status !== "awaiting_confirmation") {
    throw new Error("Session is not awaiting confirmation");
  }

  if (session.playerTurnId === confirmerPlayerId) {
    throw new Error(`Current player (${confirmerPlayerId}) cannot confirm their own turn`);
  }

  if (!gameState.players.some((p) => p.id === confirmerPlayerId)) {
    throw new Error("Confirmer is not in this room");
  }

  if (approved) {
    await finalizeSession(sessionId, "completed", "completed", confirmerPlayerId);
    await updatePlayerStats(session.playerTurnId, "completed");
  } else {
    await finalizeSession(sessionId, "skipped", "skipped", confirmerPlayerId);
    await updatePlayerStats(session.playerTurnId, "skipped");
  }

  await advanceTurn(roomId);
  return getGameState(roomId);
}

export async function getCurrentPlayer(roomId: string) {
  const gameState = await getGameState(roomId);
  if (!gameState) return null;
  return gameState.players[gameState.currentPlayerIndex];
}

export async function getGameResults(roomId: string) {
  const gameState = await getGameState(roomId);
  if (!gameState) return null;

  const sortedPlayers = [...gameState.players].sort((a, b) => {
    if (b.score === a.score) return b.completed - a.completed;
    return b.score - a.score;
  });

  const mvp = sortedPlayers[0];
  return {
    finalScores: sortedPlayers,
    mvp: {
      name: mvp.name,
      score: mvp.score,
      completed: mvp.completed,
      streak: mvp.streak,
    },
    totalRounds: gameState.totalRounds,
  };
}

export function cleanupGame(_roomId: string): void {
  // Redis-backed state; TTL handles auto cleanup.
}

export async function replayGame(roomId: string): Promise<GameState> {
  await resetRoomForReplay(roomId);
  return initializeGame(roomId);
}

export function updatePlayerConnection(_roomId: string, _playerId: string, _isConnected: boolean): void {
  // No-op for now. Connection state is polled from Redis snapshot.
}
