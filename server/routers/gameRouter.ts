import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc.js";
import { createRoom, getRoomByCode, getGamePlayersByRoomId, addGamePlayer, updatePlayerReady, getRoomById } from "../db.js";
import { initializeGame, getGameState, generateNextQuestion, handlePlayerAction, getCurrentPlayer, getGameResults, cleanupGame, replayGame, confirmPlayerAction } from "../services/gameManager.js";
import { nanoid } from "nanoid";

// Generate a unique room code (8 characters)
function generateRoomCode(): string {
  return nanoid(8).toUpperCase();
}

function sanitizePlayerName(name: string): string {
  return name
    .trim()
    .replace(/[<>]/g, "")
    .replace(/\s+/g, " ")
    .slice(0, 64);
}

const rateWindows = new Map<string, number[]>();

function getClientFingerprint(req: any): string {
  const forwardedFor = req?.headers?.["x-forwarded-for"];
  const firstForwarded = Array.isArray(forwardedFor)
    ? forwardedFor[0]
    : typeof forwardedFor === "string"
      ? forwardedFor.split(",")[0]
      : null;
  const socketIp = req?.socket?.remoteAddress;
  return String(firstForwarded || socketIp || "unknown-client");
}

function enforceProcedureRateLimit(
  req: any,
  routeKey: string,
  maxHits: number,
  windowMs: number
) {
  const clientKey = `${routeKey}:${getClientFingerprint(req)}`;
  const now = Date.now();
  const previous = rateWindows.get(clientKey) ?? [];
  const active = previous.filter((ts) => now - ts < windowMs);
  if (active.length >= maxHits) {
    throw new Error("Too many requests, please slow down.");
  }
  active.push(now);
  rateWindows.set(clientKey, active);
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
    .mutation(async ({ input, ctx }) => {
      enforceProcedureRateLimit(ctx.req, "createRoom", 12, 60_000);
      const roomCode = generateRoomCode();
      const sanitizedPlayerNames = input.playerNames
        .map(sanitizePlayerName)
        .filter((name) => name.length > 0);
      if (sanitizedPlayerNames.length < 2) {
        throw new Error("At least 2 valid player names are required");
      }
      const room = await createRoom(input.gameMode, input.roundCount, roomCode);

      // Add players to the room
      const roomId = room.id;
      for (let i = 0; i < sanitizedPlayerNames.length; i++) {
        await addGamePlayer(roomId, sanitizedPlayerNames[i], i);
      }

      return {
        roomId,
        roomCode,
        gameMode: input.gameMode,
        roundCount: input.roundCount,
        playerCount: sanitizedPlayerNames.length,
      };
    }),

  /**
   * Join an existing room
   */
  joinRoom: publicProcedure
    .input(z.object({ roomCode: z.string().trim().length(8) }))
    .query(async ({ input, ctx }) => {
      enforceProcedureRateLimit(ctx.req, "joinRoom", 60, 60_000);
      const room = await getRoomByCode(input.roomCode.toUpperCase());
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
    .mutation(async ({ input, ctx }) => {
      enforceProcedureRateLimit(ctx.req, "startGame", 30, 60_000);
      const gameState = await initializeGame(input.roomId);
      return gameState;
    }),

  /**
   * Get current game state
   */
  getGameState: publicProcedure
    .input(z.object({ roomId: z.number().int() }))
    .query(async ({ input }) => {
      const gameState = await getGameState(input.roomId);
      return gameState || null;
    }),

  /**
   * Generate the next question
   */
  getNextQuestion: publicProcedure
    .input(z.object({ roomId: z.number().int(), questionType: z.enum(["truth", "dare"]).optional() }))
    .mutation(async ({ input }) => {
      const question = await generateNextQuestion(input.roomId, input.questionType);
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
        action: z.enum(["completed", "skipped"]),
        responseText: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      enforceProcedureRateLimit(ctx.req, "submitAction", 90, 60_000);
      await handlePlayerAction(input.roomId, {
        playerId: input.playerId,
        action: input.action,
        responseText: input.responseText,
      });

      const gameState = await getGameState(input.roomId);

      return {
        success: true,
        gameState,
      };
    }),

  confirmAction: publicProcedure
    .input(
      z.object({
        roomId: z.number().int(),
        sessionId: z.number().int(),
        confirmerPlayerId: z.number().int(),
        approved: z.boolean(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      enforceProcedureRateLimit(ctx.req, "confirmAction", 90, 60_000);
      const gameState = await confirmPlayerAction(
        input.roomId,
        input.sessionId,
        input.confirmerPlayerId,
        input.approved
      );
      return { success: true, gameState };
    }),

  /**
   * Get current player
   */
  getCurrentPlayer: publicProcedure
    .input(z.object({ roomId: z.number().int() }))
    .query(async ({ input }) => {
      return getCurrentPlayer(input.roomId);
    }),

  /**
   * Get game results (for game over screen)
   */
  getResults: publicProcedure
    .input(z.object({ roomId: z.number().int() }))
    .query(async ({ input }) => {
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

  replayGame: publicProcedure
    .input(z.object({ roomId: z.number().int() }))
    .mutation(async ({ input }) => {
      const gameState = await replayGame(input.roomId);
      return gameState;
    }),
});
