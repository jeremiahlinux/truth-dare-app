import { invokeLLM } from "../_core/llm.js";
import { storePrompt, getPromptsByContext } from "../db.js";

type GameMode = "classic" | "spicy" | "party";
type QuestionType = "truth" | "dare";

interface GeneratePromptOptions {
  gameMode: GameMode;
  playerCount: number;
  type: QuestionType;
}

const PROMPT_TEMPLATES = {
  classic: {
    truth: [
      "What's the most embarrassing thing that happened to you in public?",
      "Have you ever lied to your best friend? What about?",
      "What's your biggest fear?",
      "Who's someone you secretly have a crush on?",
      "What's the worst advice you've ever given?",
      "Have you ever cheated on a test or exam?",
      "What's something you've never told anyone?",
      "Who do you think is the most annoying person here?",
    ],
    dare: [
      "Do your best impression of someone in this room.",
      "Sing the first verse of your favorite song.",
      "Call a friend and tell them you're getting married.",
      "Do 10 push-ups right now.",
      "Speak in an accent for the next 3 rounds.",
      "Compliment everyone in the room one by one.",
      "Do a funny dance for 30 seconds.",
      "Let someone else post a selfie from your phone.",
    ],
  },
  spicy: {
    truth: [
      "What's the most flirty text you've ever sent?",
      "Have you ever had feelings for someone you shouldn't?",
      "What's your biggest turn-on?",
      "Have you ever been caught in an awkward situation?",
      "What's the wildest thing you've done on a date?",
      "Who here would you most want to kiss?",
      "What's your biggest insecurity?",
      "Have you ever done something you're ashamed of?",
    ],
    dare: [
      "Send a flirty message to someone in your contacts.",
      "Do a lap around the room in a silly way.",
      "Let someone give you a makeover for 5 minutes.",
      "Pretend to be a celebrity for the next 2 rounds.",
      "Do your best seductive pose for a photo.",
      "Tell the person next to you why they're attractive.",
      "Dance with the person across from you.",
      "Act out a scene from a romantic movie.",
    ],
  },
  party: {
    truth: [
      "What's the funniest thing that's happened to you?",
      "If you could have any superpower, what would it be?",
      "What's your most unpopular opinion?",
      "What's the weirdest food combination you actually enjoy?",
      "What's your guilty pleasure TV show?",
      "Have you ever done something completely out of character?",
      "What's the most ridiculous thing you've believed?",
      "What's your most embarrassing talent?",
    ],
    dare: [
      "Make up a funny song about someone in the room.",
      "Do an exaggerated walk across the room.",
      "Speak backwards for your next sentence.",
      "Act like an animal for 30 seconds.",
      "Do an impression of a famous person.",
      "Create a funny TikTok dance move.",
      "Tell a joke in the silliest voice possible.",
      "Pretend to be a news anchor reporting on this game.",
    ],
  },
};

/**
 * Generate contextual prompts based on game mode and player count
 * Uses LLM to create fresh, unique prompts tailored to the game context
 */
export async function generatePrompt(options: GeneratePromptOptions): Promise<string> {
  const { gameMode, playerCount, type } = options;

  try {
    // First, try to get a cached prompt from the database
    const cachedPrompts = await getPromptsByContext(gameMode, playerCount, type, 5);
    
    // If we have cached prompts, randomly select one with low usage
    if (cachedPrompts.length > 0) {
      const randomPrompt = cachedPrompts[Math.floor(Math.random() * cachedPrompts.length)];
      if (randomPrompt) {
        return randomPrompt.text;
      }
    }

    // Otherwise, generate a new prompt using LLM
    const newPrompt = await generateWithLLM(gameMode, playerCount, type);
    
    // Store the generated prompt for future use
    try {
      await storePrompt(gameMode, playerCount, type, newPrompt);
    } catch (error) {
      console.warn("[PromptGenerator] Failed to store prompt:", error);
    }

    return newPrompt;
  } catch (error) {
    console.error("[PromptGenerator] Error generating prompt:", error);
    // Fallback to template-based generation
    return generateFromTemplate(gameMode, type);
  }
}

/**
 * Generate a prompt using the LLM with contextual information
 */
async function generateWithLLM(gameMode: GameMode, playerCount: number, type: QuestionType): Promise<string> {
  const systemPrompt = buildSystemPrompt(gameMode, playerCount, type);
  const userPrompt = buildUserPrompt(gameMode, playerCount, type);

  const response = await invokeLLM({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  });

  const content = response.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("No response from LLM");
  }

  // Extract just the prompt text (remove quotes if present)
  const textContent = typeof content === "string" ? content : "";
  return textContent.trim().replace(/^["']|["']$/g, "");
}

/**
 * Build the system prompt for the LLM
 */
function buildSystemPrompt(gameMode: GameMode, playerCount: number, type: QuestionType): string {
  const modeDescriptions = {
    classic: "family-friendly and suitable for all ages",
    spicy: "flirty and slightly risqué, but not explicit",
    party: "fun, silly, and entertaining for a group setting",
  };

  const typeDescription = type === "truth" ? "a truth question" : "a dare challenge";
  const modeDesc = modeDescriptions[gameMode];

  return `You are a creative game prompt generator for a multiplayer Truth or Dare game. 
Generate ${typeDescription} that is ${modeDesc}. 
The prompt should be engaging, appropriate for ${playerCount} players, and encourage interaction.
Return only the prompt text, nothing else. Do not include quotes or numbering.
Keep it concise (one sentence for truths, one or two sentences for dares).`;
}

/**
 * Build the user prompt for the LLM
 */
function buildUserPrompt(gameMode: GameMode, playerCount: number, type: QuestionType): string {
  const contextDetails = {
    classic: "This is a classic game mode suitable for any group.",
    spicy: "This is a spicy game mode with flirty and slightly risqué content.",
    party: "This is a party game mode focused on fun and silliness.",
  };

  const playerContext =
    playerCount <= 3
      ? "with a small intimate group"
      : playerCount <= 6
        ? "with a medium-sized group"
        : "with a large group";

  return `Generate a unique ${type} ${playerContext}. ${contextDetails[gameMode]}
Make it fresh and different from common prompts. Focus on engagement and fun.`;
}

/**
 * Fallback: Generate a prompt from predefined templates
 */
function generateFromTemplate(gameMode: GameMode, type: QuestionType): string {
  const templates = PROMPT_TEMPLATES[gameMode][type];
  return templates[Math.floor(Math.random() * templates.length)];
}

/**
 * Generate both a truth and a dare for a turn
 */
export async function generateTruthAndDare(gameMode: GameMode, playerCount: number): Promise<{ truth: string; dare: string }> {
  const [truth, dare] = await Promise.all([
    generatePrompt({ gameMode, playerCount, type: "truth" }),
    generatePrompt({ gameMode, playerCount, type: "dare" }),
  ]);

  return { truth, dare };
}
