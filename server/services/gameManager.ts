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
} from "../db.js";
import { generateTruthAndDare } from "./promptGenerator.js";

type GameMode = "classic" | "spicy" | "party";
type SessionStatus = "pending" | "awaiting_confirmation" | "completed" | "skipped";

interface GameState {
  roomId: number;
  status: "waiting" | "in_progress" | "completed";
  currentRound: number;
  totalRounds: number;
  currentPlayerIndex: number;
  gameMode: GameMode;
  players: any[];
  currentQuestion: null | {
    sessionId: number;
    type: "truth" | "dare";
    text: string;
    status: SessionStatus;
    turnPlayerId: number;
    performedByPlayerId: number | null;
    confirmedByPlayerId: number | null;
  };
}

interface PlayerAction {
  playerId: number;
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
      isReady: p.isReady === 1,
      isConnected: p.isConnected === 1,
    }));
}

async function buildGameState(roomId: number): Promise<GameState | undefined> {
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
    status: room.status as GameState["status"],
    currentRound: room.currentRound,
    totalRounds: room.roundCount,
    currentPlayerIndex: room.currentPlayerIndex,
    gameMode: room.gameMode as GameMode,
    players: mapPlayers(players),
    currentQuestion,
  };
}

export async function initializeGame(roomId: number): Promise<GameState> {
  const room = await getRoomById(roomId);
  if (!room) throw new Error("Room not found");

  await updateRoomStatus(roomId, "in_progress", 1, 0);
  const gameState = await buildGameState(roomId);
  if (!gameState) throw new Error("Failed to initialize game");
  return gameState;
}

export async function getGameState(roomId: number): Promise<GameState | undefined> {
  return buildGameState(roomId);
}

async function advanceTurn(roomId: number): Promise<void> {
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
  roomId: number,
  preferredType?: "truth" | "dare"
): Promise<{ sessionId: number; type: "truth" | "dare"; text: string } | null> {
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

export async function handlePlayerAction(roomId: number, action: PlayerAction): Promise<void> {
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
  roomId: number,
  sessionId: number,
  confirmerPlayerId: number,
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
    throw new Error("Current player cannot confirm their own turn");
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

export async function getCurrentPlayer(roomId: number) {
  const gameState = await getGameState(roomId);
  if (!gameState) return null;
  return gameState.players[gameState.currentPlayerIndex];
}

export async function getGameResults(roomId: number) {
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

export function cleanupGame(_roomId: number): void {
  // DB-authoritative state; no in-memory cleanup needed.
}

export async function replayGame(roomId: number): Promise<GameState> {
  await resetRoomForReplay(roomId);
  return initializeGame(roomId);
}

export function updatePlayerConnection(_roomId: number, _playerId: number, _isConnected: boolean): void {
  // No-op for now. Connection state is polled from DB snapshot.
}
