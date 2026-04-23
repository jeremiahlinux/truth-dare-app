import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Game Rooms - Stores room metadata and game configuration
 */
export const rooms = mysqlTable("rooms", {
  id: int("id").autoincrement().primaryKey(),
  roomCode: varchar("roomCode", { length: 8 }).notNull().unique(), // e.g., "ABC123XY"
  gameMode: mysqlEnum("gameMode", ["classic", "spicy", "party"]).notNull(),
  roundCount: int("roundCount").notNull().default(5),
  status: mysqlEnum("status", ["waiting", "in_progress", "completed"]).notNull().default("waiting"),
  currentRound: int("currentRound").notNull().default(0),
  currentPlayerIndex: int("currentPlayerIndex").notNull().default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Room = typeof rooms.$inferSelect;
export type InsertRoom = typeof rooms.$inferInsert;

/**
 * Game Players - Stores player data within a room
 */
export const gamePlayers = mysqlTable("gamePlayers", {
  id: int("id").autoincrement().primaryKey(),
  roomId: int("roomId").notNull().references(() => rooms.id, { onDelete: "cascade" }),
  userId: int("userId").references(() => users.id),
  playerName: varchar("playerName", { length: 64 }).notNull(),
  playerIndex: int("playerIndex").notNull(), // Order in the game
  score: int("score").notNull().default(0),
  streak: int("streak").notNull().default(0),
  completedCount: int("completedCount").notNull().default(0),
  passedCount: int("passedCount").notNull().default(0),
  skippedCount: int("skippedCount").notNull().default(0),
  isReady: int("isReady").notNull().default(0), // 0 = false, 1 = true
  isConnected: int("isConnected").notNull().default(1), // 0 = false, 1 = true
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type GamePlayer = typeof gamePlayers.$inferSelect;
export type InsertGamePlayer = typeof gamePlayers.$inferInsert;

/**
 * Game Sessions - Stores individual game turn data
 */
export const gameSessions = mysqlTable("gameSessions", {
  id: int("id").autoincrement().primaryKey(),
  roomId: int("roomId").notNull().references(() => rooms.id, { onDelete: "cascade" }),
  round: int("round").notNull(),
  playerTurnId: int("playerTurnId").notNull().references(() => gamePlayers.id),
  questionType: mysqlEnum("questionType", ["truth", "dare"]).notNull(),
  status: mysqlEnum("status", ["pending", "awaiting_confirmation", "completed", "skipped"]).notNull().default("pending"),
  promptText: text("promptText").notNull(),
  promptId: int("promptId").references(() => prompts.id),
  action: mysqlEnum("action", ["completed", "passed", "skipped"]),
  performedByPlayerId: int("performedByPlayerId").references(() => gamePlayers.id),
  confirmedByPlayerId: int("confirmedByPlayerId").references(() => gamePlayers.id),
  confirmedAt: timestamp("confirmedAt"),
  responseText: text("responseText"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type GameSession = typeof gameSessions.$inferSelect;
export type InsertGameSession = typeof gameSessions.$inferInsert;

/**
 * Prompts - Stores generated Truth/Dare prompts
 */
export const prompts = mysqlTable("prompts", {
  id: int("id").autoincrement().primaryKey(),
  gameMode: mysqlEnum("gameMode", ["classic", "spicy", "party"]).notNull(),
  playerCount: int("playerCount").notNull(), // Context: number of players
  type: mysqlEnum("type", ["truth", "dare"]).notNull(),
  text: text("text").notNull(),
  difficulty: mysqlEnum("difficulty", ["easy", "medium", "hard"]).notNull().default("medium"),
  usageCount: int("usageCount").notNull().default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Prompt = typeof prompts.$inferSelect;
export type InsertPrompt = typeof prompts.$inferInsert;