import { eq, and, desc, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, rooms, gamePlayers, gameSessions, prompts } from "../drizzle/schema";
import { ENV } from './_core/env';

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

export async function createRoom(hostId: number, gameMode: string, roundCount: number, roomCode: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(rooms).values({
    roomCode,
    hostId,
    gameMode: gameMode as any,
    roundCount,
    status: "waiting",
  });

  return result;
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
    promptId: promptId || null,
  });

  return result;
}

export async function updateGameSessionAction(sessionId: number, action: string, responseText?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const updates: any = { action: action as any };
  if (responseText) updates.responseText = responseText;

  await db.update(gameSessions).set(updates).where(eq(gameSessions.id, sessionId));
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
