import { Redis } from "@upstash/redis";
import { ENV } from "./env.js";
import crypto from "node:crypto";

const ROOM_TTL = 24 * 60 * 60; // 24 hours
const SESSION_TTL = 12 * 60 * 60; // 12 hours

// Initialize Redis client
let redis: Redis | null = null;

function getRedis(): Redis {
  if (!redis) {
    if (!ENV.redisUrl || !ENV.redisToken) {
      throw new Error(
        "Redis not configured. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN"
      );
    }
    redis = new Redis({
      url: ENV.redisUrl,
      token: ENV.redisToken,
    });
  }
  return redis;
}

// Type definitions
export interface Room {
  id: string; // UUID instead of auto-increment
  roomCode: string;
  gameMode: "classic" | "spicy" | "party";
  roundCount: number;
  status: "waiting" | "in_progress" | "completed";
  currentRound: number;
  currentPlayerIndex: number;
  createdAt: number;
  updatedAt: number;
}

export interface GamePlayer {
  id: string; // UUID
  roomId: string;
  userId?: number;
  playerName: string;
  playerIndex: number;
  score: number;
  streak: number;
  completedCount: number;
  passedCount: number;
  skippedCount: number;
  isReady: boolean;
  isConnected: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface GameSession {
  id: string; // UUID
  roomId: string;
  round: number;
  playerTurnId: string;
  questionType: "truth" | "dare";
  status: "pending" | "awaiting_confirmation" | "completed" | "skipped";
  promptText: string;
  promptId?: number;
  action?: "completed" | "passed" | "skipped";
  performedByPlayerId?: string;
  confirmedByPlayerId?: string;
  confirmedAt?: number;
  responseText?: string;
  createdAt: number;
  updatedAt: number;
}

// Room operations
export async function createRoom(roomCode: string, gameMode: string, roundCount: number): Promise<Room> {
  const redis = getRedis();
  const roomId = crypto.randomUUID();
  const now = Date.now();

  const room: Room = {
    id: roomId,
    roomCode,
    gameMode: gameMode as any,
    roundCount,
    status: "waiting",
    currentRound: 0,
    currentPlayerIndex: 0,
    createdAt: now,
    updatedAt: now,
  };

  const roomKey = `room:${roomCode}`;
  const roomIdKey = `room-id:${roomId}`;

  // Store both by code and by ID for quick lookups
  await redis.setex(roomKey, ROOM_TTL, room);
  await redis.setex(roomIdKey, ROOM_TTL, roomCode);

  return room;
}

export async function getRoomByCode(roomCode: string): Promise<Room | null> {
  const redis = getRedis();
  const data = await redis.get(`room:${roomCode}`);
  if (!data) return null;
  return data as Room;
}

export async function getRoomById(roomId: string): Promise<Room | null> {
  const redis = getRedis();
  // We need to search by ID, but Redis doesn't have direct ID indexing
  // For now, we'll rely on the client keeping the roomId or deriving from room code
  // In a real app, you'd maintain a separate index or use a different pattern
  const data = await redis.get(`room-id:${roomId}`);
  if (!data) return null;
  const roomCode = data;
  return getRoomByCode(roomCode as string);
}

export async function updateRoomStatus(
  roomId: string,
  status: string,
  currentRound?: number,
  currentPlayerIndex?: number
): Promise<void> {
  const redis = getRedis();
  const roomCode = await redis.get(`room-id:${roomId}`);
  if (!roomCode) throw new Error(`Room ${roomId} not found`);

  const roomKey = `room:${roomCode}`;
  const roomData = await redis.get(roomKey);
  if (!roomData) throw new Error(`Room data for ${roomCode} not found`);

  const room = roomData as Room;
  room.status = status;
  if (currentRound !== undefined) room.currentRound = currentRound;
  if (currentPlayerIndex !== undefined) room.currentPlayerIndex = currentPlayerIndex;
  room.updatedAt = Date.now();

  await redis.setex(roomKey, ROOM_TTL, room);
}

export async function resetRoomForReplay(roomId: string): Promise<void> {
  const redis = getRedis();
  const roomCode = await redis.get(`room-id:${roomId}`);
  if (!roomCode) throw new Error(`Room ${roomId} not found`);

  const roomKey = `room:${roomCode}`;
  const roomData = await redis.get(roomKey);
  if (!roomData) throw new Error(`Room data for ${roomCode} not found`);

  const room = roomData as Room;
  room.status = "waiting";
  room.currentRound = 0;
  room.currentPlayerIndex = 0;
  room.updatedAt = Date.now();

  await redis.setex(roomKey, ROOM_TTL, room);
      
  // Reset all players in this room
  const playerKeys = await redis.keys(`players:${roomId}:*`);
  for (const pKey of playerKeys) {
    const playerData = await redis.get(pKey);
    if (!playerData) continue;
    const player = playerData as GamePlayer;
    player.score = 0;
    player.streak = 0;
    player.completedCount = 0;
    player.passedCount = 0;
    player.skippedCount = 0;
    player.isReady = false;
    player.updatedAt = Date.now();
    await redis.setex(pKey, ROOM_TTL, player);
  }
}

// Player operations
export async function addGamePlayer(
  roomId: string,
  playerName: string,
  playerIndex: number,
  userId?: number
): Promise<GamePlayer> {
  const redis = getRedis();
  const playerId = crypto.randomUUID();
  const now = Date.now();

  const player: GamePlayer = {
    id: playerId,
    roomId,
    userId,
    playerName,
    playerIndex,
    score: 0,
    streak: 0,
    completedCount: 0,
    passedCount: 0,
    skippedCount: 0,
    isReady: false,
    isConnected: true,
    createdAt: now,
    updatedAt: now,
  };

  const key = `players:${roomId}:${playerId}`;
  await redis.setex(key, ROOM_TTL, player);

  return player;
}

export async function getGamePlayersByRoomId(roomId: string): Promise<GamePlayer[]> {
  const redis = getRedis();
  const keys = await redis.keys(`players:${roomId}:*`);
  const players: GamePlayer[] = [];

  for (const key of keys) {
    const data = await redis.get(key);
    if (data) {
      players.push(data as GamePlayer);
    }
  }

  return players.sort((a, b) => a.playerIndex - b.playerIndex);
}

export async function updatePlayerReady(roomId: string, playerId: string, isReady: boolean): Promise<void> {
  const redis = getRedis();
  const key = `players:${roomId}:${playerId}`;
  
  const data = await redis.get(key);
  if (!data) throw new Error(`Player ${playerId} not found in room ${roomId}`);
  
  const player = data as GamePlayer;
  player.isReady = isReady;
  player.updatedAt = Date.now();
  
  await redis.setex(key, ROOM_TTL, player);
}

export async function updatePlayerStats(
  playerId: string,
  action: "completed" | "passed" | "skipped"
): Promise<void> {
  const redis = getRedis();
  const allKeys = await redis.keys("players:*:*");

  for (const key of allKeys) {
    const data = await redis.get(key);
    if (!data) continue;
    const player = data as GamePlayer;
    if (player.id === playerId) {
      if (action === "completed") {
        player.completedCount += 1;
        player.score += 10;
        player.streak += 1;
      } else if (action === "passed") {
        player.passedCount += 1;
        player.streak = 0;
      } else if (action === "skipped") {
        player.skippedCount += 1;
        player.streak = 0;
      }
      player.updatedAt = Date.now();
      await redis.setex(key, ROOM_TTL, player);
      return;
    }
  }
  throw new Error(`Player ${playerId} not found`);
}

// Session operations
export async function createQuestionSession(
  roomId: string,
  round: number,
  playerTurnId: string,
  questionType: "truth" | "dare",
  promptText: string
): Promise<GameSession> {
  const redis = getRedis();
  const sessionId = crypto.randomUUID();
  const now = Date.now();

  const session: GameSession = {
    id: sessionId,
    roomId,
    round,
    playerTurnId,
    questionType,
    status: "pending",
    promptText,
    createdAt: now,
    updatedAt: now,
  };

  const key = `session:${roomId}:${sessionId}`;
  await redis.setex(key, SESSION_TTL, session);

  return session;
}

export async function getLatestRoomSession(roomId: string): Promise<GameSession | null> {
  const redis = getRedis();
  const keys = await redis.keys(`session:${roomId}:*`);
  let latest: GameSession | null = null;

  for (const key of keys) {
    const data = await redis.get(key);
    if (data) {
      const session = data as GameSession;
      if (!latest || session.createdAt > latest.createdAt) {
        latest = session;
      }
    }
  }

  return latest;
}

export async function getGameSessionById(sessionId: string): Promise<GameSession | null> {
  const redis = getRedis();
  const allKeys = await redis.keys("session:*:*");

  for (const key of allKeys) {
    const data = await redis.get(key);
    if (!data) continue;
    const session = data as GameSession;
    if (session.id === sessionId) {
      return session;
    }
  }

  return null;
}

export async function setSessionAwaitingConfirmation(
  sessionId: string,
  playerId: string,
  responseText?: string
): Promise<void> {
  const redis = getRedis();
  const allKeys = await redis.keys("session:*:*");

  for (const key of allKeys) {
    const data = await redis.get(key);
    if (!data) continue;
    const session = data as GameSession;
    if (session.id === sessionId) {
      session.action = "completed";
      session.status = "awaiting_confirmation";
      session.performedByPlayerId = playerId;
      session.responseText = responseText ?? null;
      session.updatedAt = Date.now();
      await redis.setex(key, SESSION_TTL, session);
      return;
    }
  }
  throw new Error(`Session ${sessionId} not found`);
}

export async function finalizeSession(
  sessionId: string,
  status: "completed" | "skipped",
  action: "completed" | "skipped",
  confirmedByPlayerId?: string
): Promise<void> {
  const redis = getRedis();
  const allKeys = await redis.keys("session:*:*");

  for (const key of allKeys) {
    const data = await redis.get(key);
    if (!data) continue;
    const session = data as GameSession;
    if (session.id === sessionId) {
      session.status = status;
      session.action = action;
      session.confirmedByPlayerId = confirmedByPlayerId ?? null;
      session.confirmedAt = confirmedByPlayerId ? Date.now() : null;
      session.updatedAt = Date.now();
      await redis.setex(key, SESSION_TTL, session);
      return;
    }
  }
  throw new Error(`Session ${sessionId} not found`);
}

export async function getRoomCodeForId(roomId: string): Promise<string | null> {
  const redis = getRedis();
  const keys = await redis.keys("room:*");
  
  for (const key of keys) {
    const data = await redis.get(key);
    if (!data) continue;
    const room = data as Room;
    if (room.id === roomId) {
      return room.roomCode;
    }
  }
  return null;
}
