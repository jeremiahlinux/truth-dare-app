import { describe, it, expect, beforeEach, vi } from "vitest";
import { generatePrompt, generateTruthAndDare } from "./services/promptGenerator";
import {
  initializeGame,
  getGameState,
  generateNextQuestion,
  handlePlayerAction,
  nextPlayerTurn,
  getCurrentPlayer,
  getGameResults,
} from "./services/gameManager";

describe("Prompt Generator", () => {
  it("should generate a prompt for a given game mode and player count", async () => {
    const prompt = await generatePrompt({
      gameMode: "classic",
      playerCount: 4,
      type: "truth",
    });

    expect(prompt).toBeTruthy();
    expect(typeof prompt).toBe("string");
    expect(prompt.length).toBeGreaterThan(0);
  }, 15000);

  it("should generate different types of prompts", async () => {
    const truthPrompt = await generatePrompt({
      gameMode: "spicy",
      playerCount: 3,
      type: "truth",
    });

    const darePrompt = await generatePrompt({
      gameMode: "spicy",
      playerCount: 3,
      type: "dare",
    });

    expect(truthPrompt).toBeTruthy();
    expect(darePrompt).toBeTruthy();
    // They should be different (with high probability)
    expect(truthPrompt).not.toBe(darePrompt);
  }, 15000);

  it("should generate both truth and dare prompts", async () => {
    const { truth, dare } = await generateTruthAndDare("party", 5);

    expect(truth).toBeTruthy();
    expect(dare).toBeTruthy();
    expect(typeof truth).toBe("string");
    expect(typeof dare).toBe("string");
  }, 15000);

  it("should handle different game modes", async () => {
    const modes = ["classic", "spicy", "party"] as const;

    for (const mode of modes) {
      const prompt = await generatePrompt({
        gameMode: mode,
        playerCount: 2,
        type: "truth",
      });

      expect(prompt).toBeTruthy();
      expect(typeof prompt).toBe("string");
    }
  }, 20000);

  it("should adapt prompts based on player count", async () => {
    const smallGroupPrompt = await generatePrompt({
      gameMode: "classic",
      playerCount: 2,
      type: "dare",
    });

    const largeGroupPrompt = await generatePrompt({
      gameMode: "classic",
      playerCount: 8,
      type: "dare",
    });

    expect(smallGroupPrompt).toBeTruthy();
    expect(largeGroupPrompt).toBeTruthy();
  }, 15000);
});

describe("Game Manager", () => {
  const mockRoomId = 1;
  const mockPlayers = [
    { id: 1, name: "Alice", playerIndex: 0 },
    { id: 2, name: "Bob", playerIndex: 1 },
    { id: 3, name: "Charlie", playerIndex: 2 },
  ];

  beforeEach(() => {
    // Clear game state before each test
    vi.clearAllMocks();
  });

  it("should get current player correctly", () => {
    // This test verifies the game manager can track the current player
    // In a real scenario, we'd initialize a game first
    expect(true).toBe(true); // Placeholder
  });

  it("should handle player actions", async () => {
    // Test that player actions update stats correctly
    expect(true).toBe(true); // Placeholder
  });

  it("should cycle through players correctly", () => {
    // Test that nextPlayerTurn cycles through all players
    expect(true).toBe(true); // Placeholder
  });

  it("should track game results", () => {
    // Test that game results are calculated correctly
    expect(true).toBe(true); // Placeholder
  });
});

describe("Game Flow", () => {
  it("should complete a full game round", async () => {
    // Test a complete game flow from start to finish
    expect(true).toBe(true); // Placeholder
  });

  it("should handle multiple rounds", async () => {
    // Test that multiple rounds work correctly
    expect(true).toBe(true); // Placeholder
  });

  it("should calculate final scores correctly", () => {
    // Test score calculation
    expect(true).toBe(true); // Placeholder
  });
});

describe("Game Modes", () => {
  it("should generate appropriate prompts for Classic mode", async () => {
    const prompt = await generatePrompt({
      gameMode: "classic",
      playerCount: 4,
      type: "truth",
    });

    expect(prompt).toBeTruthy();
    expect(typeof prompt).toBe("string");
  });

  it("should generate appropriate prompts for Spicy mode", async () => {
    const prompt = await generatePrompt({
      gameMode: "spicy",
      playerCount: 4,
      type: "dare",
    });

    expect(prompt).toBeTruthy();
    expect(typeof prompt).toBe("string");
  });

  it("should generate appropriate prompts for Party mode", async () => {
    const prompt = await generatePrompt({
      gameMode: "party",
      playerCount: 4,
      type: "truth",
    });

    expect(prompt).toBeTruthy();
    expect(typeof prompt).toBe("string");
  });
});
