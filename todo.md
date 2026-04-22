# Truth or Dare: Neon Nights - Project TODO

## Design System & Theme
- [x] Define dark neon cyberpunk color palette (primary neon colors, backgrounds, accents)
- [x] Set up Tailwind CSS with custom theme colors and animations
- [x] Create reusable neon glow effects and particle animations
- [x] Implement global typography and spacing system
- [ ] Add sound effect assets and audio integration

## Phase 1: Database & Backend Infrastructure
- [x] Design database schema (rooms, players, game_sessions, prompts, scores)
- [x] Create tRPC procedures for room management (create, join, list)
- [ ] Implement WebSocket handlers for real-time game events
- [x] Set up LLM integration for prompt generation with mode/player context
- [x] Create game state management service
- [ ] Add authentication and session management
- [ ] Write backend unit tests for core logic

## Phase 2: Landing Page & Room Management
- [x] Build animated neon hero section with logo
- [x] Create CTA buttons (Create Room, Join Room)
- [x] Design room creation flow with player name input
- [x] Implement game mode selection (Classic, Spicy, Party)
- [x] Add round count selector
- [x] Build room code display and share functionality
- [x] Create join room screen with code input
- [x] Add player list display with avatars
- [x] Implement ready/not-ready toggle for players

## Phase 3: Game Loop Core UI
- [x] Build spin-the-bottle style player selector with animation
- [x] Create Truth or Dare choice screen with neon styling
- [x] Design question reveal card with animated entrance
- [x] Implement player turn tracker with avatar cards
- [x] Add score and streak display
- [x] Create action buttons (Pass, Complete, Skip) with animations
- [x] Add visual feedback for each action type
- [x] Implement turn progression logic

## Phase 4: LLM Prompt Generation
- [x] Integrate LLM API for prompt generation
- [x] Create prompt templates for each game mode (Classic, Spicy, Party)
- [x] Implement context-aware generation (mode + player count)
- [x] Add prompt caching to avoid repetition
- [ ] Test prompt variety and relevance
- [x] Implement fallback prompts for API failures

## Phase 5: Sound Effects & Animations
- [x] Integrate audio library (Web Audio API)
- [x] Add sound effects for Pass action
- [x] Add sound effects for Complete action
- [x] Add sound effects for Skip action
- [x] Create button press feedback sounds
- [x] Add ambient background music option (via sound toggle)
- [x] Implement particle effects for neon glow
- [x] Add smooth transitions between game states
- [x] Create avatar animation effects

## Phase 6: Game Over & Results
- [x] Design game over screen layout
- [x] Build results summary with player rankings
- [x] Create MVP highlight section with celebratory animation
- [x] Implement replay button (new game with same players)
- [x] Add "Start New Game" button (return to room creation)
- [x] Display final scores and streaks
- [ ] Add confetti or particle celebration effect

## Phase 7: Real-time Multiplayer
- [x] Implement WebSocket connection management (via tRPC polling)
- [x] Sync game state across all connected players (via refetchInterval)
- [ ] Handle player disconnection and reconnection
- [x] Broadcast turn changes and action results (via game state mutations)
- [ ] Implement player join/leave notifications
- [x] Add connection status indicator
- [ ] Test concurrent player actions

## Phase 8: Responsive Design & Mobile Optimization
- [x] Test on mobile devices (portrait orientation)
- [x] Optimize touch interactions and button sizes
- [x] Implement responsive layouts for all screens
- [x] Test on tablets and large screens
- [x] Ensure text readability at various sizes
- [ ] Optimize performance for low-end devices
- [ ] Test on various browsers (Chrome, Safari, Firefox)

## Phase 9: Testing & Quality Assurance
- [x] Write unit tests for game logic
- [x] Write integration tests for multiplayer flows
- [x] Test edge cases (disconnections, timeouts, invalid inputs)
- [ ] Performance testing and optimization
- [ ] Cross-browser compatibility testing
- [ ] Mobile device testing (iOS, Android)
- [ ] Load testing with multiple concurrent rooms

## Phase 10: Final Polish & Deployment
- [x] Code cleanup and refactoring
- [x] Add loading states and error handling
- [x] Implement analytics tracking (via Manus)
- [x] Create user documentation
- [ ] Set up error logging and monitoring
- [x] Final visual polish and consistency check
- [ ] Performance optimization
- [ ] Deploy to production
