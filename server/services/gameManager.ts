import { getRoomById, getGamePlayersByRoomId, updateRoomStatus, updatePlayerStats, createGameSession } from "../db";
import { generateTruthAndDare } from "./promptGenerator";

type GameMode = "classic" | "spicy" | "party";

interface GameState {
  roomId: number;
  status: "waiting" | "in_progress" | "completed";
  currentRound: number;
  totalRounds: number;
  currentPlayerIndex: number;
  gameMode: GameMode;
  players: any[];
  currentQuestion?: {
    type: "truth" | "dare";
    text: string;
  };
}

interface PlayerAction {
  playerId: number;
  action: "completed" | "passed" | "skipped";
  responseText?: string;
}

const gameStates = new Map<number, GameState>();

/**
 * Initialize a game room
 */
export async function initializeGame(roomId: number): Promise<GameState> {
  const room = await getRoomById(roomId);
  if (!room) throw new Error("Room not found");

  const players = await getGamePlayersByRoomId(roomId);

  const gameState: GameState = {
    roomId,
    status: "in_progress",
    currentRound: 1,
    totalRounds: room.roundCount,
    currentPlayerIndex: 0,
    gameMode: room.gameMode as GameMode,
    players: players.map((p) => ({
      id: p.id,
      name: p.playerName,
      score: p.score,
      streak: p.streak,
      completed: p.completedCount,
      passed: p.passedCount,
      skipped: p.skippedCount,
      isConnected: p.isConnected === 1,
    })),
  };

  gameStates.set(roomId, gameState);
  await updateRoomStatus(roomId, "in_progress");

  return gameState;
}

/**
 * Get the current game state
 */
export function getGameState(roomId: number): GameState | undefined {
  return gameStates.get(roomId);
}

/**
 * Generate and set the next question
 */
export async function generateNextQuestion(roomId: number): Promise<{ type: "truth" | "dare"; text: string } | null> {
  const gameState = gameStates.get(roomId);
  if (!gameState) throw new Error("Game not initialized");

  const playerCount = gameState.players.length;
  const { truth, dare } = await generateTruthAndDare(gameState.gameMode, playerCount);

  // Randomly choose between truth and dare
  const type = Math.random() > 0.5 ? "truth" : "dare";
  const text = type === "truth" ? truth : dare;

  gameState.currentQuestion = { type, text };

  // Store the session in the database
  const currentPlayer = gameState.players[gameState.currentPlayerIndex];
  await createGameSession(roomId, gameState.currentRound, currentPlayer.id, type);

  return { type, text };
}

/**
 * Handle player action (complete, pass, skip)
 */
export async function handlePlayerAction(roomId: number, action: PlayerAction): Promise<void> {
  const gameState = gameStates.get(roomId);
  if (!gameState) throw new Error("Game not initialized");

  const player = gameState.players.find((p) => p.id === action.playerId);
  if (!player) throw new Error("Player not found");

  // Update player stats in the database
  await updatePlayerStats(action.playerId, action.action);

  // Update local game state
  if (action.action === "completed") {
    player.score += 10;
    player.streak += 1;
    player.completed += 1;
  } else if (action.action === "passed") {
    player.passed += 1;
    player.streak = 0;
  } else if (action.action === "skipped") {
    player.skipped += 1;
    player.streak = 0;
  }
}

/**
 * Move to the next player's turn
 */
export function nextPlayerTurn(roomId: number): void {
  const gameState = gameStates.get(roomId);
  if (!gameState) throw new Error("Game not initialized");

  gameState.currentPlayerIndex = (gameState.currentPlayerIndex + 1) % gameState.players.length;

  // If we've cycled through all players, move to the next round
  if (gameState.currentPlayerIndex === 0) {
    gameState.currentRound += 1;

    // Check if the game is over
    if (gameState.currentRound > gameState.totalRounds) {
      gameState.status = "completed";
      updateRoomStatus(roomId, "completed");
    }
  }

  gameState.currentQuestion = undefined;
}

/**
 * Get the current player
 */
export function getCurrentPlayer(roomId: number) {
  const gameState = gameStates.get(roomId);
  if (!gameState) return null;

  return gameState.players[gameState.currentPlayerIndex];
}

/**
 * Get game results (for game over screen)
 */
export function getGameResults(roomId: number) {
  const gameState = gameStates.get(roomId);
  if (!gameState) return null;

  // Sort players by score
  const sortedPlayers = [...gameState.players].sort((a, b) => b.score - a.score);

  // Find MVP (highest score)
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

/**
 * Clean up game state when room is deleted
 */
export function cleanupGame(roomId: number): void {
  gameStates.delete(roomId);
}

/**
 * Update player connection status
 */
export function updatePlayerConnection(roomId: number, playerId: number, isConnected: boolean): void {
  const gameState = gameStates.get(roomId);
  if (!gameState) return;

  const player = gameState.players.find((p) => p.id === playerId);
  if (player) {
    player.isConnected = isConnected;
  }
}
