/**
 * Sound Effects Utility
 * Provides consistent sound feedback for game actions
 */

type SoundType = "select" | "completed" | "passed" | "skipped" | "spin" | "reveal";

interface SoundConfig {
  frequency: number;
  duration: number;
  volume: number;
  waveform: OscillatorType;
}

const SOUND_CONFIGS: Record<SoundType, SoundConfig> = {
  select: {
    frequency: 800,
    duration: 150,
    volume: 0.3,
    waveform: "sine",
  },
  completed: {
    frequency: 1000,
    duration: 300,
    volume: 0.4,
    waveform: "square",
  },
  passed: {
    frequency: 600,
    duration: 200,
    volume: 0.3,
    waveform: "sine",
  },
  skipped: {
    frequency: 400,
    duration: 200,
    volume: 0.3,
    waveform: "sine",
  },
  spin: {
    frequency: 700,
    duration: 100,
    volume: 0.25,
    waveform: "triangle",
  },
  reveal: {
    frequency: 900,
    duration: 250,
    volume: 0.35,
    waveform: "sine",
  },
};

let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioContext;
}

export function playSound(type: SoundType, enabled: boolean = true): void {
  if (!enabled) return;

  try {
    const ctx = getAudioContext();
    const config = SOUND_CONFIGS[type];

    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();

    oscillator.connect(gain);
    gain.connect(ctx.destination);

    oscillator.type = config.waveform;
    oscillator.frequency.value = config.frequency;

    gain.gain.setValueAtTime(config.volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + config.duration / 1000);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + config.duration / 1000);
  } catch (error) {
    console.warn("[SoundEffects] Failed to play sound:", error);
  }
}

export function playMultiSound(types: SoundType[], enabled: boolean = true, delay: number = 100): void {
  if (!enabled) return;

  types.forEach((type, index) => {
    setTimeout(() => {
      playSound(type, enabled);
    }, delay * index);
  });
}

/**
 * Resume audio context if suspended (required for user interaction)
 */
export function resumeAudioContext(): void {
  try {
    const ctx = getAudioContext();
    if (ctx.state === "suspended") {
      ctx.resume();
    }
  } catch (error) {
    console.warn("[SoundEffects] Failed to resume audio context:", error);
  }
}
