import { eq, and, desc, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { migrate } from "drizzle-orm/mysql2/migrator";
import { fileURLToPath } from "node:url";
import type { InsertUser } from "../drizzle/schema.js";
import { users, prompts } from "../drizzle/schema.js";
import { ENV } from "./_core/env.js";
import * as redisStore from "./_core/redisStore.js";
import type { Room, GamePlayer, GameSession } from "./_core/redisStore.js";

let _db: ReturnType<typeof drizzle> | null = null;
let _dbReady: Promise<void> | null = null;
let _dbUnavailableReason: string | null = null;
const MIGRATIONS_FOLDER = fileURLToPath(new URL("../drizzle", import.meta.url));

function getDatabaseUrlError(databaseUrl: string) {
  try {
    const parsed = new URL(databaseUrl);
    const protocol = parsed.protocol.toLowerCase();
    const host = parsed.hostname.toLowerCase();

    if (protocol === "postgres:" || protocol === "postgresql:") {
      return "Unsupported DATABASE_URL: this app currently requires a MySQL-compatible database. Neon/Postgres URLs are not supported.";
    }

    if (host.includes("neon.tech")) {
      return "Unsupported DATABASE_URL host: this app currently requires a MySQL-compatible database. Neon/Postgres URLs are not supported.";
    }
  } catch {
    // Let the driver surface malformed URL errors.
  }

  return null;
}

function describeDatabaseError(error: unknown) {
  const details = new Set<string>();

  const collect = (value: unknown) => {
    if (!value || typeof value !== "object") {
      return;
    }

    const record = value as Record<string, unknown>;
    const candidates = [
      record.message,
      record.sqlMessage,
      record.code,
      record.errno,
      record.sqlState,
    ];

    for (const candidate of candidates) {
      if (candidate !== undefined && candidate !== null && String(candidate).trim().length > 0) {
        details.add(String(candidate));
      }
    }
  };

  collect(error);
  collect((error as { cause?: unknown } | null | undefined)?.cause);

  return Array.from(details).join(" | ");
}

async function bootstrapUserSchema(db: ReturnType<typeof drizzle>) {
  const statements = [
    `CREATE TABLE IF NOT EXISTS \`users\` (
      \`id\` int AUTO_INCREMENT NOT NULL,
      \`openId\` varchar(64) NOT NULL,
      \`name\` text,
      \`email\` varchar(320),
      \`loginMethod\` varchar(64),
      \`role\` enum('user','admin') NOT NULL DEFAULT 'user',
      \`createdAt\` timestamp NOT NULL DEFAULT (now()),
      \`updatedAt\` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
      \`lastSignedIn\` timestamp NOT NULL DEFAULT (now()),
      CONSTRAINT \`users_id\` PRIMARY KEY(\`id\`),
      CONSTRAINT \`users_openId_unique\` UNIQUE(\`openId\`)
    )`,
    `CREATE TABLE IF NOT EXISTS \`prompts\` (
      \`id\` int AUTO_INCREMENT NOT NULL,
      \`gameMode\` enum('classic','spicy','party') NOT NULL,
      \`playerCount\` int NOT NULL,
      \`type\` enum('truth','dare') NOT NULL,
      \`text\` text NOT NULL,
      \`difficulty\` enum('easy','medium','hard') NOT NULL DEFAULT 'medium',
      \`usageCount\` int NOT NULL DEFAULT 0,
      \`createdAt\` timestamp NOT NULL DEFAULT (now()),
      CONSTRAINT \`prompts_id\` PRIMARY KEY(\`id\`)
    )`,
  ];

  for (const statement of statements) {
    await db.execute(sql.raw(statement));
  }
}

async function ensureDbReady(db: ReturnType<typeof drizzle>) {
  if (_dbReady) {
    return _dbReady;
  }

  _dbReady = (async () => {
    try {
      await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
    } catch (error) {
      console.warn("[Database] Migration bootstrap failed:", error);
    }

    try {
      await bootstrapUserSchema(db);
    } catch (error) {
      console.warn("[Database] Schema bootstrap failed:", error);
    }
  })();

  return _dbReady;
}

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      const urlError = getDatabaseUrlError(process.env.DATABASE_URL);
      if (urlError) {
        _dbUnavailableReason = urlError;
        throw new Error(urlError);
      }

      _db = drizzle(process.env.DATABASE_URL);
      await ensureDbReady(_db);
      _dbUnavailableReason = null;
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _dbUnavailableReason = error instanceof Error ? error.message : "Database not available";
      _db = null;
      _dbReady = null;
    }
  } else if (!_db && !process.env.DATABASE_URL) {
    _dbUnavailableReason = "DATABASE_URL is not configured.";
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

// ============ GAME ROOM OPERATIONS (REDIS) ============

export async function createRoom(gameMode: string, roundCount: number, roomCode: string): Promise<Room> {
  return redisStore.createRoom(roomCode, gameMode, roundCount);
}

export async function getRoomByCode(roomCode: string): Promise<Room | null> {
  return redisStore.getRoomByCode(roomCode);
}

export async function getRoomById(roomId: string): Promise<Room | null> {
  return redisStore.getRoomById(roomId);
}

export async function updateRoomStatus(
  roomId: string,
  status: string,
  currentRound?: number,
  currentPlayerIndex?: number
): Promise<void> {
  return redisStore.updateRoomStatus(roomId, status, currentRound, currentPlayerIndex);
}

export async function resetRoomForReplay(roomId: string): Promise<void> {
  return redisStore.resetRoomForReplay(roomId);
}

// ============ GAME PLAYER OPERATIONS (REDIS) ============

export async function addGamePlayer(
  roomId: string,
  playerName: string,
  playerIndex: number,
  userId?: number
): Promise<GamePlayer> {
  return redisStore.addGamePlayer(roomId, playerName, playerIndex, userId);
}

export async function getGamePlayersByRoomId(roomId: string): Promise<GamePlayer[]> {
  return redisStore.getGamePlayersByRoomId(roomId);
}

export async function updatePlayerReady(roomId: string, playerId: string, isReady: boolean): Promise<void> {
  return redisStore.updatePlayerReady(roomId, playerId, isReady);
}

export async function claimPlayerSlot(roomId: string, playerId: string): Promise<void> {
  return redisStore.claimPlayerSlot(roomId, playerId);
}

export async function updatePlayerStats(playerId: string, action: "completed" | "passed" | "skipped"): Promise<void> {
  return redisStore.updatePlayerStats(playerId, action);
}

// ============ GAME SESSION OPERATIONS (REDIS) ============

export async function createGameSession(
  roomId: string,
  round: number,
  playerTurnId: string,
  questionType: string,
  promptId?: number
): Promise<GameSession> {
  const session = await redisStore.createQuestionSession(
    roomId,
    round,
    playerTurnId,
    questionType as "truth" | "dare",
    ""
  );
  if (promptId) {
    session.promptId = promptId;
  }
  return session;
}

export async function createQuestionSession(
  roomId: string,
  round: number,
  playerTurnId: string,
  questionType: "truth" | "dare",
  promptText: string
): Promise<GameSession> {
  return redisStore.createQuestionSession(roomId, round, playerTurnId, questionType, promptText);
}

export async function updateGameSessionAction(sessionId: string, action: string, responseText?: string): Promise<void> {
  const session = await redisStore.getGameSessionById(sessionId);
  if (!session) throw new Error("Session not found");
  session.action = action as any;
  if (responseText) session.responseText = responseText;
  session.updatedAt = Date.now();
  // The session is updated via other methods, this is a simplified version
}

export async function getLatestRoomSession(roomId: string): Promise<GameSession | null> {
  return redisStore.getLatestRoomSession(roomId);
}

export async function getGameSessionById(sessionId: string): Promise<GameSession | null> {
  return redisStore.getGameSessionById(sessionId);
}

export async function setSessionAwaitingConfirmation(
  sessionId: string,
  playerId: string,
  responseText?: string
): Promise<void> {
  return redisStore.setSessionAwaitingConfirmation(sessionId, playerId, responseText);
}

export async function finalizeSession(
  sessionId: string,
  status: "completed" | "skipped",
  action: "completed" | "skipped",
  confirmedByPlayerId?: string
): Promise<void> {
  return redisStore.finalizeSession(sessionId, status, action, confirmedByPlayerId);
}

// ============ PROMPT OPERATIONS (SQL) ============

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

// ============ HELPER EXPORTS ============

export async function getRoomCodeForId(roomId: string): Promise<string | null> {
  return redisStore.getRoomCodeForId(roomId);
}
