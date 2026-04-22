import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { createRoom, getRoomByCode, getGamePlayersByRoomId, addGamePlayer, updatePlayerReady, getRoomById } from "../db";
import { generateTruthAndDare } from "../services/promptGenerator";
import { initializeGame, getGameState, generateNextQuestion, handlePlayerAction, nextPlayerTurn, getCurrentPlayer, getGameResults, cleanupGame } from "../services/gameManager";
import { nanoid } from "nanoid";

// Generate a unique room code (8 characters)
function generateRoomCode(): string {
  return nanoid(8).toUpperCase();
}

export const gameRouter = router({
  /**
   * Create a new game room
   */
  createRoom: publicProcedure
    .input(
      z.object({
        gameMode: z.enum(["classic", "spicy", "party"]),
        roundCount: z.number().int().min(1).max(20),
        playerNames: z.array(z.string().min(1).max(64)).min(2).max(8),
      })
    )
    .mutation(async ({ input }) => {
      const roomCode = generateRoomCode();
      const hostId = 1; // In a real app, this would be ctx.user.id

      const result = await createRoom(hostId, input.gameMode, input.roundCount, roomCode);

      // Add players to the room
      const roomId = (result as any).insertId || 1;
      for (let i = 0; i < input.playerNames.length; i++) {
        await addGamePlayer(roomId, input.playerNames[i], i);
      }

      return {
        roomId,
        roomCode,
        gameMode: input.gameMode,
        roundCount: input.roundCount,
        playerCount: input.playerNames.length,
      };
    }),

  /**
   * Join an existing room
   */
  joinRoom: publicProcedure
    .input(z.object({ roomCode: z.string().length(8) }))
    .query(async ({ input }) => {
      const room = await getRoomByCode(input.roomCode);
      if (!room) {
        throw new Error("Room not found");
      }

      const players = await getGamePlayersByRoomId(room.id);

      return {
        roomId: room.id,
        roomCode: room.roomCode,
        gameMode: room.gameMode,
        roundCount: room.roundCount,
        status: room.status,
        players: players.map((p) => ({
          id: p.id,
          name: p.playerName,
          isReady: p.isReady === 1,
          score: p.score,
        })),
      };
    }),

  /**
   * Get room details
   */
  getRoom: publicProcedure
    .input(z.object({ roomId: z.number().int() }))
    .query(async ({ input }) => {
      const room = await getRoomById(input.roomId);
      if (!room) {
        throw new Error("Room not found");
      }

      const players = await getGamePlayersByRoomId(input.roomId);

      return {
        roomId: room.id,
        roomCode: room.roomCode,
        gameMode: room.gameMode,
        roundCount: room.roundCount,
        status: room.status,
        currentRound: room.currentRound,
        currentPlayerIndex: room.currentPlayerIndex,
        players: players.map((p) => ({
          id: p.id,
          name: p.playerName,
          isReady: p.isReady === 1,
          score: p.score,
          streak: p.streak,
          completed: p.completedCount,
        })),
      };
    }),

  /**
   * Mark a player as ready
   */
  setPlayerReady: publicProcedure
    .input(z.object({ playerId: z.number().int(), isReady: z.boolean() }))
    .mutation(async ({ input }) => {
      await updatePlayerReady(input.playerId, input.isReady);
      return { success: true };
    }),

  /**
   * Start the game
   */
  startGame: publicProcedure
    .input(z.object({ roomId: z.number().int() }))
    .mutation(async ({ input }) => {
      const gameState = await initializeGame(input.roomId);
      return gameState;
    }),

  /**
   * Get current game state
   */
  getGameState: publicProcedure
    .input(z.object({ roomId: z.number().int() }))
    .query(({ input }) => {
      const gameState = getGameState(input.roomId);
      return gameState || null;
    }),

  /**
   * Generate the next question
   */
  getNextQuestion: publicProcedure
    .input(z.object({ roomId: z.number().int() }))
    .mutation(async ({ input }) => {
      const question = await generateNextQuestion(input.roomId);
      return question;
    }),

  /**
   * Handle player action (complete, pass, skip)
   */
  submitAction: publicProcedure
    .input(
      z.object({
        roomId: z.number().int(),
        playerId: z.number().int(),
        action: z.enum(["completed", "passed", "skipped"]),
        responseText: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      await handlePlayerAction(input.roomId, {
        playerId: input.playerId,
        action: input.action,
        responseText: input.responseText,
      });

      nextPlayerTurn(input.roomId);
      const gameState = getGameState(input.roomId);

      return {
        success: true,
        gameState,
      };
    }),

  /**
   * Get current player
   */
  getCurrentPlayer: publicProcedure
    .input(z.object({ roomId: z.number().int() }))
    .query(({ input }) => {
      return getCurrentPlayer(input.roomId);
    }),

  /**
   * Get game results (for game over screen)
   */
  getResults: publicProcedure
    .input(z.object({ roomId: z.number().int() }))
    .query(({ input }) => {
      return getGameResults(input.roomId);
    }),

  /**
   * End the game and cleanup
   */
  endGame: publicProcedure
    .input(z.object({ roomId: z.number().int() }))
    .mutation(({ input }) => {
      cleanupGame(input.roomId);
      return { success: true };
    }),
});
