import { eq, and, desc, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import type { InsertUser } from "../drizzle/schema.ts";
import { users, rooms, gamePlayers, gameSessions, prompts } from "../drizzle/schema.ts";
import { ENV } from "./_core/env.ts";

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// ============ GAME-SPECIFIC QUERIES ============

export async function createRoom(gameMode: string, roundCount: number, roomCode: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.insert(rooms).values({
    roomCode,
    gameMode: gameMode as any,
    roundCount,
    status: "waiting",
  });

  const createdRoom = await getRoomByCode(roomCode);
  if (!createdRoom) {
    throw new Error("Failed to create room");
  }

  return createdRoom;
}

export async function getRoomByCode(roomCode: string) {
  const db = await getDb();
  if (!db) return null;

  const result = await db.select().from(rooms).where(eq(rooms.roomCode, roomCode)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function getRoomById(roomId: number) {
  const db = await getDb();
  if (!db) return null;

  const result = await db.select().from(rooms).where(eq(rooms.id, roomId)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function updateRoomStatus(roomId: number, status: string, currentRound?: number, currentPlayerIndex?: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const updates: any = { status: status as any };
  if (currentRound !== undefined) updates.currentRound = currentRound;
  if (currentPlayerIndex !== undefined) updates.currentPlayerIndex = currentPlayerIndex;

  await db.update(rooms).set(updates).where(eq(rooms.id, roomId));
}

export async function resetRoomForReplay(roomId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(rooms)
    .set({
      status: "waiting",
      currentRound: 0,
      currentPlayerIndex: 0,
    } as any)
    .where(eq(rooms.id, roomId));

  await db
    .update(gamePlayers)
    .set({
      score: 0,
      streak: 0,
      completedCount: 0,
      passedCount: 0,
      skippedCount: 0,
      isReady: 0,
    })
    .where(eq(gamePlayers.roomId, roomId));
}

export async function addGamePlayer(roomId: number, playerName: string, playerIndex: number, userId?: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(gamePlayers).values({
    roomId,
    playerName,
    playerIndex,
    userId: userId || null,
  });

  return result;
}

export async function getGamePlayersByRoomId(roomId: number) {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(gamePlayers).where(eq(gamePlayers.roomId, roomId));
}

export async function updatePlayerReady(playerId: number, isReady: boolean) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(gamePlayers).set({ isReady: isReady ? 1 : 0 }).where(eq(gamePlayers.id, playerId));
}

export async function updatePlayerStats(playerId: number, action: "completed" | "passed" | "skipped") {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const updates: any = {};
  if (action === "completed") {
    updates.completedCount = sql`completedCount + 1`;
    updates.score = sql`score + 10`;
    updates.streak = sql`streak + 1`;
  } else if (action === "passed") {
    updates.passedCount = sql`passedCount + 1`;
    updates.streak = 0;
  } else if (action === "skipped") {
    updates.skippedCount = sql`skippedCount + 1`;
    updates.streak = 0;
  }

  await db.update(gamePlayers).set(updates).where(eq(gamePlayers.id, playerId));
}

export async function createGameSession(roomId: number, round: number, playerTurnId: number, questionType: string, promptId?: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(gameSessions).values({
    roomId,
    round,
    playerTurnId,
    questionType: questionType as any,
    status: "pending",
    promptText: "",
    promptId: promptId || null,
  });

  return result;
}

export async function createQuestionSession(
  roomId: number,
  round: number,
  playerTurnId: number,
  questionType: "truth" | "dare",
  promptText: string
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.insert(gameSessions).values({
    roomId,
    round,
    playerTurnId,
    questionType,
    status: "pending",
    promptText,
  });

  const [session] = await db
    .select()
    .from(gameSessions)
    .where(and(eq(gameSessions.roomId, roomId), eq(gameSessions.round, round), eq(gameSessions.playerTurnId, playerTurnId)))
    .orderBy(desc(gameSessions.id))
    .limit(1);

  if (!session) {
    throw new Error("Failed to create game session");
  }

  return session;
}

export async function updateGameSessionAction(sessionId: number, action: string, responseText?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const updates: any = { action: action as any };
  if (responseText) updates.responseText = responseText;

  await db.update(gameSessions).set(updates).where(eq(gameSessions.id, sessionId));
}

export async function getLatestRoomSession(roomId: number) {
  const db = await getDb();
  if (!db) return null;

  const [session] = await db
    .select()
    .from(gameSessions)
    .where(eq(gameSessions.roomId, roomId))
    .orderBy(desc(gameSessions.id))
    .limit(1);

  return session ?? null;
}

export async function getGameSessionById(sessionId: number) {
  const db = await getDb();
  if (!db) return null;

  const [session] = await db
    .select()
    .from(gameSessions)
    .where(eq(gameSessions.id, sessionId))
    .limit(1);

  return session ?? null;
}

export async function setSessionAwaitingConfirmation(
  sessionId: number,
  playerId: number,
  responseText?: string
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(gameSessions)
    .set({
      action: "completed",
      status: "awaiting_confirmation",
      performedByPlayerId: playerId,
      responseText: responseText ?? null,
    } as any)
    .where(eq(gameSessions.id, sessionId));
}

export async function finalizeSession(
  sessionId: number,
  status: "completed" | "skipped",
  action: "completed" | "skipped",
  confirmedByPlayerId?: number
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(gameSessions)
    .set({
      status,
      action,
      confirmedByPlayerId: confirmedByPlayerId ?? null,
      confirmedAt: confirmedByPlayerId ? new Date() : null,
    } as any)
    .where(eq(gameSessions.id, sessionId));
}

export async function storePrompt(gameMode: string, playerCount: number, type: string, text: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(prompts).values({
    gameMode: gameMode as any,
    playerCount,
    type: type as any,
    text,
  });

  return result;
}

export async function getPromptsByContext(gameMode: string, playerCount: number, type: string, limit: number = 10) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(prompts)
    .where(and(eq(prompts.gameMode, gameMode as any), eq(prompts.playerCount, playerCount), eq(prompts.type, type as any)))
    .orderBy(desc(prompts.usageCount))
    .limit(limit);
}

export async function incrementPromptUsage(promptId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(prompts).set({ usageCount: sql`usageCount + 1` }).where(eq(prompts.id, promptId));
}
