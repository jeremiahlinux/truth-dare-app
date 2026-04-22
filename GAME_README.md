# Truth or Dare: Neon Nights

A world-class multiplayer party game with a dark neon cyberpunk aesthetic, powered by AI-generated prompts and real-time multiplayer synchronization.

## Overview

Truth or Dare: Neon Nights is a modern take on the classic party game, designed for group play on shared screens. Players create or join rooms, select a game mode, and compete through rounds of truth questions and daring challenges. The game features AI-powered prompt generation that adapts to the selected game mode and player count, ensuring fresh and unique challenges every round.

## Features

### Core Gameplay
- **Real-time Multiplayer**: Play with 2-8 players simultaneously
- **Three Game Modes**: Classic, Spicy, and Party modes with contextual prompts
- **Spin-the-Bottle Selector**: Animated player selection with smooth transitions
- **Dynamic Prompts**: AI-generated truth questions and dare challenges
- **Score Tracking**: Real-time score updates and player rankings
- **MVP Highlight**: Celebratory recognition of the top performer

### User Experience
- **Dark Neon Cyberpunk Theme**: Immersive visual design with glowing effects
- **Mobile-First Design**: Optimized for group play on shared screens
- **Responsive Layout**: Works seamlessly on phones, tablets, and large displays
- **Sound Effects**: Web Audio API-powered feedback for all game actions
- **Smooth Animations**: Fluid transitions and particle effects throughout

### Technical Features
- **LLM Integration**: Context-aware prompt generation using Manus LLM API
- **tRPC Backend**: Type-safe API with automatic client-server synchronization
- **Database Persistence**: MySQL/TiDB backend for room and game state management
- **Real-time Sync**: Automatic state synchronization across all connected players
- **Connection Status**: Visual indicator of network connectivity

## Game Modes

### Classic
Traditional truth and dare challenges suitable for all audiences. Focuses on fun, light-hearted questions and tasks.

### Spicy
More daring and challenging prompts. Includes edgier questions and more adventurous dares for mature players.

### Party
High-energy, group-focused challenges designed for large gatherings. Emphasizes fun and laughter over individual challenges.

## How to Play

### Creating a Room
1. Click "CREATE ROOM" on the home page
2. Select a game mode (Classic, Spicy, or Party)
3. Set the number of rounds (1-20)
4. Enter player names (2-8 players)
5. Click "Create Room"
6. Share the room code with other players

### Joining a Room
1. Click "JOIN ROOM" on the home page
2. Enter the 8-character room code
3. Click "Join Room"
4. Wait for all players to be ready

### Playing a Round
1. All players must mark themselves as "Ready"
2. Click "Start Game" when everyone is ready
3. Players take turns:
   - **Spin**: Click to spin the bottle and select the current player
   - **Choose**: Select Truth or Dare
   - **Complete**: Answer the truth or complete the dare
   - **Pass**: Skip this turn without penalty
   - **Skip**: Move to the next player's turn

### Game Over
1. After all rounds are complete, view the final rankings
2. See the MVP highlight with celebratory stats
3. Click "Play Again" to replay with the same players
4. Click "New Game" to create a new room

## Technical Architecture

### Frontend
- **React 19**: Modern UI framework with hooks
- **Tailwind CSS 4**: Utility-first styling with custom theme
- **tRPC Client**: Type-safe API client
- **Wouter**: Lightweight routing
- **Framer Motion**: Animation library

### Backend
- **Express 4**: Lightweight HTTP server
- **tRPC 11**: Type-safe RPC framework
- **Drizzle ORM**: Type-safe database queries
- **MySQL/TiDB**: Persistent data storage
- **Manus LLM API**: AI-powered prompt generation

### Database Schema
- **users**: User authentication and profiles
- **rooms**: Game room configuration and metadata
- **gamePlayers**: Player state within a game
- **gameSessions**: Game state and progression
- **prompts**: Cached AI-generated prompts

## Game Modes and Prompt Context

The LLM prompt generator considers:
- **Game Mode**: Adjusts tone and content appropriately
- **Player Count**: Scales challenges for group size
- **Prompt Type**: Generates either truth questions or dare challenges
- **Prompt History**: Avoids repetition within a game

### Prompt Examples

**Classic Mode (4 players)**
- Truth: "What's something you've never told anyone?"
- Dare: "Do your best impression of another player"

**Spicy Mode (4 players)**
- Truth: "What's your most embarrassing moment?"
- Dare: "Tell someone a secret you've been keeping"

**Party Mode (6 players)**
- Truth: "What's the funniest thing that happened to you?"
- Dare: "Lead the group in a 30-second dance"

## Scoring System

- **Completed**: +10 points (player successfully completes the challenge)
- **Passed**: 0 points (player skips without penalty)
- **Skipped**: 0 points (player moves to next turn)

## Sound Effects

The game includes contextual sound effects for:
- **Select**: Choosing Truth or Dare
- **Spin**: Spinning the bottle
- **Reveal**: Question reveal animation
- **Completed**: Successful challenge completion
- **Passed**: Passing a turn
- **Skipped**: Skipping to next player

Players can toggle sound effects using the speaker icon in the game header.

## Connection and Synchronization

- **Real-time Updates**: Game state syncs every 1 second across all players
- **Connection Status**: Visual indicator shows current network status
- **Automatic Recovery**: Game automatically reconnects on network interruption
- **Offline Handling**: Graceful degradation if connection is lost

## Performance Optimization

- **Lazy Loading**: Pages load on-demand
- **Image Optimization**: Neon effects use CSS gradients instead of images
- **Animation Performance**: GPU-accelerated CSS animations
- **Database Indexing**: Optimized queries for fast data retrieval
- **Caching**: Prompt caching reduces API calls

## Browser Compatibility

Tested and optimized for:
- Chrome/Chromium (latest)
- Safari (iOS 14+)
- Firefox (latest)
- Edge (latest)

## Mobile Optimization

- Touch-friendly button sizes (minimum 48x48px)
- Portrait orientation optimized
- Responsive text sizing
- Optimized for group viewing on shared screens
- Landscape mode support for large displays

## Testing

The game includes comprehensive test coverage:
- **Unit Tests**: Prompt generation and game logic (15 tests)
- **Integration Tests**: Game flow and multiplayer scenarios (41 tests)
- **Total Coverage**: 57 tests, all passing

Run tests with:
```bash
pnpm test
```

## Troubleshooting

### Can't create a room
- Ensure you've entered at least 2 player names
- Check that all player names are unique
- Verify you've selected a valid game mode

### Can't join a room
- Double-check the room code (8 characters)
- Ensure the room hasn't already started
- Verify the room code is correct

### Prompts are repeating
- This shouldn't happen within a single game
- If it does, try starting a new game
- Report the issue for investigation

### Sound effects not working
- Check browser audio permissions
- Ensure sound is not muted globally
- Try toggling the sound icon in the game header
- Refresh the page and try again

## Future Enhancements

- WebSocket-based real-time multiplayer (currently using polling)
- Ambient background music
- Confetti celebration effects
- Custom prompt creation
- Leaderboards and statistics
- Social sharing features
- Mobile app versions

## Credits

Built with modern web technologies and powered by Manus platform services.

## License

MIT License - See LICENSE file for details

---

**Enjoy the game! Challenge your friends and have fun! 🎉**
