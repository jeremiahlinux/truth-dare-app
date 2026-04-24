# Supabase Migration Guide

This document provides a complete setup and migration guide for transitioning from Upstash Redis to Supabase Realtime for the Truth or Dare game.

## Table of Contents

1. [Why Supabase?](#why-supabase)
2. [Prerequisites](#prerequisites)
3. [Supabase Project Setup](#supabase-project-setup)
4. [Database Schema](#database-schema)
5. [Row-Level Security (RLS)](#row-level-security-rls)
6. [TypeScript Types](#typescript-types)
7. [Server Implementation](#server-implementation)
8. [Environment Variables](#environment-variables)
9. [Client Integration](#client-integration)
10. [Real-time Features](#real-time-features)
11. [Migration Checklist](#migration-checklist)

---

## Why Supabase?

**Supabase vs. Upstash Redis vs. PartyKit:**

| Feature | Upstash Redis | Supabase | PartyKit |
|---------|---------------|----------|---------|
| Real-time Sync | Polling (2s) | Native Broadcast | True WebSocket |
| Database | Key-value | PostgreSQL | In-memory + Optional DB |
| Query Language | Redis Commands | SQL + Realtime | Custom SDK |
| Scalability | Per-request | Always available | Per-room |
| Analytics | Limited | Full audit logs | Limited |
| Setup Complexity | Easy | Medium | Easy |
| Cost | Per-request | Per-database | Per-connection |
| Offline Support | No | Yes (with SDK) | No |

**Choose Supabase if:**
- You want hosted Postgres with SQL power
- You need audit logs and table dashboards
- You plan to add user auth and profiles later
- You want broadcast/presence without polling
- RLS policies matter for security

---

## Prerequisites

- Node.js 18+
- npm or pnpm
- A Supabase account (free tier available at https://supabase.com)
- Existing Truth-or-Dare app with Redis setup

---

## Supabase Project Setup

### Step 1: Create a Supabase Project

1. Go to https://supabase.com and sign up or log in
2. Click **"New project"**
3. **Name:** `truth-dare-game` (or your preferred name)
4. **Database password:** Generate a strong password (save it!)
5. **Region:** Choose closest to your users
6. Click **"Create new project"** (wait 2-3 minutes for setup)

### Step 2: Get API Credentials

In Supabase Dashboard, go to **Settings** → **API**:

- Copy `Project URL` (starts with `https://`)
- Copy `anon public` key (starts with `eyJ...`)
- Copy `service_role` key (for server-side only!)

Save these in your `.env.local`:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## Database Schema

### Rooms Table

```sql
create table rooms (
  id uuid primary key default gen_random_uuid(),
  room_code varchar(8) not null unique,
  game_mode text not null check (game_mode in ('classic', 'spicy', 'party')),
  round_count integer not null default 5,
  status text not null default 'waiting' check (status in ('waiting', 'in_progress', 'completed')),
  current_round integer not null default 0,
  current_player_index integer not null default 0,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create index idx_rooms_room_code on rooms(room_code);
```

### Game Players Table

```sql
create table game_players (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms(id) on delete cascade,
  user_id integer references users(id) on delete set null,
  player_name varchar(64) not null,
  player_index integer not null,
  score integer not null default 0,
  streak integer not null default 0,
  completed_count integer not null default 0,
  passed_count integer not null default 0,
  skipped_count integer not null default 0,
  is_ready boolean not null default false,
  is_connected boolean not null default true,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  constraint unique_room_player unique(room_id, player_index)
);

create index idx_game_players_room on game_players(room_id);
```

### Game Sessions Table

```sql
create table game_sessions (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms(id) on delete cascade,
  round integer not null,
  player_turn_id uuid not null references game_players(id) on delete cascade,
  question_type text not null check (question_type in ('truth', 'dare')),
  status text not null default 'pending' check (status in ('pending', 'awaiting_confirmation', 'completed', 'skipped')),
  prompt_text text not null,
  prompt_id integer references prompts(id) on delete set null,
  action text check (action in ('completed', 'passed', 'skipped')),
  performed_by_player_id uuid references game_players(id) on delete set null,
  confirmed_by_player_id uuid references game_players(id) on delete set null,
  confirmed_at timestamp with time zone,
  response_text text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create index idx_game_sessions_room on game_sessions(room_id);
create index idx_game_sessions_player_turn on game_sessions(player_turn_id);
```

### Set Up in Supabase

1. Go to **SQL Editor** in Supabase Dashboard
2. Create a new query
3. Paste the SQL above (all three tables)
4. Click **"RUN"**

---

## Row-Level Security (RLS)

RLS policies ensure players can only access their own room data.

### Enable RLS

```sql
-- Rooms Table
alter table rooms enable row level security;

-- Game Players Table
alter table game_players enable row level security;

-- Game Sessions Table
alter table game_sessions enable row level security;
```

### RLS Policies

For a public game (no authentication required yet), allow all reads and writes from the room code:

```sql
-- Rooms: Anyone can read
create policy rooms_read on rooms for select using (true);

-- Rooms: Anyone can insert
create policy rooms_insert on rooms for insert with check (true);

-- Rooms: Anyone can update
create policy rooms_update on rooms for update using (true) with check (true);

-- Game Players: Anyone can read/insert/update for their room
create policy game_players_read on game_players for select using (true);
create policy game_players_insert on game_players for insert with check (true);
create policy game_players_update on game_players for update using (true) with check (true);

-- Game Sessions: Anyone can read/insert/update for their room
create policy game_sessions_read on game_sessions for select using (true);
create policy game_sessions_insert on game_sessions for insert with check (true);
create policy game_sessions_update on game_sessions for update using (true) with check (true);
```

**Future Enhancement:** When adding authentication, replace `true` with `auth.role() = 'authenticated'` and add user ID checks.

---

## TypeScript Types

Create `server/_core/supabaseTypes.ts`:

```typescript
export interface DbRoom {
  id: string;
  room_code: string;
  game_mode: "classic" | "spicy" | "party";
  round_count: number;
  status: "waiting" | "in_progress" | "completed";
  current_round: number;
  current_player_index: number;
  created_at: string;
  updated_at: string;
}

export interface DbGamePlayer {
  id: string;
  room_id: string;
  user_id: number | null;
  player_name: string;
  player_index: number;
  score: number;
  streak: number;
  completed_count: number;
  passed_count: number;
  skipped_count: number;
  is_ready: boolean;
  is_connected: boolean;
  created_at: string;
  updated_at: string;
}

export interface DbGameSession {
  id: string;
  room_id: string;
  round: number;
  player_turn_id: string;
  question_type: "truth" | "dare";
  status: "pending" | "awaiting_confirmation" | "completed" | "skipped";
  prompt_text: string;
  prompt_id: number | null;
  action: "completed" | "passed" | "skipped" | null;
  performed_by_player_id: string | null;
  confirmed_by_player_id: string | null;
  confirmed_at: string | null;
  response_text: string | null;
  created_at: string;
  updated_at: string;
}
```

---

## Server Implementation

### Option A: Using Supabase JavaScript Client

Create `server/_core/supabaseStore.ts`:

```typescript
import { createClient } from "@supabase/supabase-js";
import { ENV } from "./env.js";
import type { DbRoom, DbGamePlayer, DbGameSession } from "./supabaseTypes.js";

const supabase = createClient(ENV.supabaseUrl, ENV.supabaseServiceRoleKey);

// Room operations
export async function createRoom(
  roomCode: string,
  gameMode: string,
  roundCount: number
): Promise<DbRoom> {
  const { data, error } = await supabase
    .from("rooms")
    .insert([
      {
        room_code: roomCode,
        game_mode: gameMode,
        round_count: roundCount,
        status: "waiting",
      },
    ])
    .select()
    .single();

  if (error) throw new Error(`Failed to create room: ${error.message}`);
  return data;
}

export async function getRoomByCode(roomCode: string): Promise<DbRoom | null> {
  const { data, error } = await supabase
    .from("rooms")
    .select()
    .eq("room_code", roomCode)
    .single();

  if (error && error.code !== "PGRST116") throw error; // PGRST116 = no rows
  return data || null;
}

export async function getRoomById(roomId: string): Promise<DbRoom | null> {
  const { data, error } = await supabase
    .from("rooms")
    .select()
    .eq("id", roomId)
    .single();

  if (error && error.code !== "PGRST116") throw error;
  return data || null;
}

export async function updateRoomStatus(
  roomId: string,
  status: string,
  currentRound?: number,
  currentPlayerIndex?: number
): Promise<void> {
  const updates: any = { status, updated_at: new Date().toISOString() };
  if (currentRound !== undefined) updates.current_round = currentRound;
  if (currentPlayerIndex !== undefined) updates.current_player_index = currentPlayerIndex;

  const { error } = await supabase
    .from("rooms")
    .update(updates)
    .eq("id", roomId);

  if (error) throw new Error(`Failed to update room: ${error.message}`);
}

// Player operations
export async function addGamePlayer(
  roomId: string,
  playerName: string,
  playerIndex: number,
  userId?: number
): Promise<DbGamePlayer> {
  const { data, error } = await supabase
    .from("game_players")
    .insert([
      {
        room_id: roomId,
        player_name: playerName,
        player_index: playerIndex,
        user_id: userId || null,
      },
    ])
    .select()
    .single();

  if (error) throw new Error(`Failed to add player: ${error.message}`);
  return data;
}

export async function getGamePlayersByRoomId(roomId: string): Promise<DbGamePlayer[]> {
  const { data, error } = await supabase
    .from("game_players")
    .select()
    .eq("room_id", roomId)
    .order("player_index", { ascending: true });

  if (error) throw new Error(`Failed to get players: ${error.message}`);
  return data || [];
}

export async function updatePlayerReady(playerId: string, isReady: boolean): Promise<void> {
  const { error } = await supabase
    .from("game_players")
    .update({ is_ready: isReady, updated_at: new Date().toISOString() })
    .eq("id", playerId);

  if (error) throw new Error(`Failed to update player ready: ${error.message}`);
}

export async function updatePlayerStats(
  playerId: string,
  action: "completed" | "passed" | "skipped"
): Promise<void> {
  let updates: any = { updated_at: new Date().toISOString() };

  if (action === "completed") {
    updates.completed_count = supabase.rpc("increment_col", {
      table_name: "game_players",
      col_name: "completed_count",
      row_id: playerId,
    });
    updates.score = supabase.rpc("increment_col", {
      table_name: "game_players",
      col_name: "score",
      row_id: playerId,
      increment_by: 10,
    });
    updates.streak = supabase.rpc("increment_col", {
      table_name: "game_players",
      col_name: "streak",
      row_id: playerId,
    });
  } else if (action === "passed") {
    updates.passed_count = supabase.rpc("increment_col", {
      table_name: "game_players",
      col_name: "passed_count",
      row_id: playerId,
    });
    updates.streak = 0;
  } else if (action === "skipped") {
    updates.skipped_count = supabase.rpc("increment_col", {
      table_name: "game_players",
      col_name: "skipped_count",
      row_id: playerId,
    });
    updates.streak = 0;
  }

  const { error } = await supabase
    .from("game_players")
    .update(updates)
    .eq("id", playerId);

  if (error) throw new Error(`Failed to update player stats: ${error.message}`);
}

// Session operations
export async function createGameSession(
  roomId: string,
  round: number,
  playerTurnId: string,
  questionType: "truth" | "dare",
  promptText: string
): Promise<DbGameSession> {
  const { data, error } = await supabase
    .from("game_sessions")
    .insert([
      {
        room_id: roomId,
        round,
        player_turn_id: playerTurnId,
        question_type: questionType,
        status: "pending",
        prompt_text: promptText,
      },
    ])
    .select()
    .single();

  if (error) throw new Error(`Failed to create session: ${error.message}`);
  return data;
}

export async function getGameSessionById(sessionId: string): Promise<DbGameSession | null> {
  const { data, error } = await supabase
    .from("game_sessions")
    .select()
    .eq("id", sessionId)
    .single();

  if (error && error.code !== "PGRST116") throw error;
  return data || null;
}

export async function setSessionAwaitingConfirmation(
  sessionId: string,
  playerId: string,
  responseText?: string
): Promise<void> {
  const { error } = await supabase
    .from("game_sessions")
    .update({
      action: "completed",
      status: "awaiting_confirmation",
      performed_by_player_id: playerId,
      response_text: responseText || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", sessionId);

  if (error) throw new Error(`Failed to set awaiting confirmation: ${error.message}`);
}

export async function finalizeSession(
  sessionId: string,
  status: "completed" | "skipped",
  action: "completed" | "skipped",
  confirmedByPlayerId?: string
): Promise<void> {
  const { error } = await supabase
    .from("game_sessions")
    .update({
      status,
      action,
      confirmed_by_player_id: confirmedByPlayerId || null,
      confirmed_at: confirmedByPlayerId ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", sessionId);

  if (error) throw new Error(`Failed to finalize session: ${error.message}`);
}
```

### Option B: Using Raw SQL (Alternative)

If you prefer direct SQL queries with `@neondatabase/serverless` (which Supabase also supports):

```typescript
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(ENV.supabaseUrl, ENV.supabaseServiceRoleKey);

export async function createRoom(
  roomCode: string,
  gameMode: string,
  roundCount: number
) {
  const { data, error } = await supabase
    .rpc("create_room", {
      p_room_code: roomCode,
      p_game_mode: gameMode,
      p_round_count: roundCount,
    });

  if (error) throw error;
  return data;
}
```

---

## Environment Variables

Update `server/_core/env.ts`:

```typescript
export const ENV = {
  // ... existing variables ...
  supabaseUrl: process.env.VITE_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.VITE_SUPABASE_ANON_KEY ?? "",
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
};
```

Add to `.env.local`:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
```

For Vercel deployment, add these to project settings **Settings** → **Environment Variables**.

---

## Client Integration

### Option A: Using Supabase Realtime Subscriptions (Better UX)

Replace polling in `RoomPage.tsx`:

```typescript
import { useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

export default function RoomPage() {
  const { roomCode } = useParams<{ roomCode: string }>();
  const [room, setRoom] = useState(null);

  useEffect(() => {
    // Subscribe to real-time updates
    const channel = supabase
      .channel(`room:${roomCode}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "game_players",
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          // Refresh room data
          fetchRoomData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomCode]);

  // ... rest of component ...
}
```

### Option B: Keep Polling (Minimal Changes)

If you prefer to keep the 2-second polling approach, the `trpc` calls remain the same. Just change the backend from Redis to Supabase.

---

## Real-time Features

### Broadcasting Messages

```typescript
// Send a message to all players in a room
const channel = supabase.channel(`room:${roomId}`);

channel.send({
  type: "broadcast",
  event: "game_state_change",
  payload: { gameState },
});
```

### Presence (Who's Online)

```typescript
const channel = supabase.channel(`room:${roomId}`, {
  config: {
    presence: {
      key: playerId,
    },
  },
});

channel
  .on("presence", { event: "sync" }, () => {
    const state = channel.presenceState();
    console.log("Online players:", state);
  })
  .subscribe();
```

---

## Migration Checklist

### Phase 1: Setup (Day 1)

- [ ] Create Supabase project
- [ ] Get API credentials
- [ ] Create database schema (3 tables)
- [ ] Enable RLS policies
- [ ] Add environment variables to `.env.local` and Vercel

### Phase 2: Backend Implementation (Day 2)

- [ ] Create `server/_core/supabaseStore.ts`
- [ ] Update `server/_core/env.ts`
- [ ] Update `server/db.ts` to use `supabaseStore` instead of `redisStore`
- [ ] Update `server/services/gameManager.ts` (minimal changes, IDs already UUIDs)
- [ ] Run tests: `npm run test`

### Phase 3: Testing (Day 3)

- [ ] Test room creation
- [ ] Test player join/ready
- [ ] Test game start and turn flow
- [ ] Test confirm/complete actions
- [ ] Load test with multiple concurrent rooms

### Phase 4: Deployment (Day 4)

- [ ] Deploy to Vercel
- [ ] Verify Supabase connection in production
- [ ] Monitor logs for errors
- [ ] Performance test

### Phase 5: Cleanup (Optional)

- [ ] Remove Upstash Redis dependency from `package.json`
- [ ] Remove `server/_core/redisStore.ts`
- [ ] Remove Redis environment variables

---

## Troubleshooting

### Connection Refused

**Error:** `connect ECONNREFUSED`

**Solution:** Verify `SUPABASE_SERVICE_ROLE_KEY` is set in server environment, not just client.

### RLS Policies Blocking

**Error:** `new row violates row-level security policy`

**Solution:** Check RLS policies allow the operation. Use `SELECT session_user;` to debug.

### UUID Conflicts

**Error:** `duplicate key value violates unique constraint`

**Solution:** Ensure all UUIDs are generated server-side, not client-side.

### Performance

**Slow Queries:** Create indexes on `room_id` and `room_code`. Use `EXPLAIN ANALYZE` in Supabase SQL Editor.

---

## API Differences

| Operation | Redis | Supabase |
|-----------|-------|----------|
| Create Room | In-memory JSON | INSERT to `rooms` table |
| List Players | KEYS scan | SELECT from `game_players` |
| Update Score | In-memory increment | UPDATE with arithmetic |
| Get Latest Session | KEYS scan | ORDER BY created_at DESC LIMIT 1 |
| Cleanup | TTL expires | Manual DELETE or trigger |

---

## Next Steps

1. **Authentication:** Add Supabase Auth (email, OAuth)
2. **Profiles:** Store user preferences, avatar
3. **Leaderboards:** Add ranking system across games
4. **Analytics:** Track popular modes, question difficulty
5. **Mobile:** Supabase SDK works great with React Native

---

## Resources

- **Supabase Docs:** https://supabase.com/docs
- **JavaScript Client:** https://supabase.com/docs/reference/javascript
- **Realtime API:** https://supabase.com/docs/guides/realtime
- **Row-Level Security:** https://supabase.com/docs/guides/auth/row-level-security

---

## Support

For issues:
1. Check Supabase status: https://status.supabase.com
2. Review logs in Supabase Dashboard → **Database** → **Logs**
3. Check server logs: `vercel logs --tail`
4. Community: https://discord.supabase.com
