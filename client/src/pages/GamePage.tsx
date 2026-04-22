import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { ConnectionStatus } from "@/components/ConnectionStatus";
import { trpc } from "@/lib/trpc";
import { playSound, resumeAudioContext } from "@/utils/soundEffects";
import { SkipForward, Volume2, VolumeX } from "lucide-react";

type GamePhase = "spinner" | "choice" | "question" | "action" | "results";

const GAME_MODE_LABELS: Record<string, string> = {
  classic: "Classic",
  spicy: "Spicy",
  party: "Party",
};

export default function GamePage() {
  const { roomId } = useParams<{ roomId: string }>();
  const [, navigate] = useLocation();
  const [phase, setPhase] = useState<GamePhase>("spinner");
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [spinning, setSpinning] = useState(false);
  const [selectedChoice, setSelectedChoice] = useState<"truth" | "dare" | null>(null);

  // Fetch game state
  const { data: gameState, refetch: refetchGameState } = trpc.game.getGameState.useQuery(
    { roomId: parseInt(roomId || "0") },
    { enabled: !!roomId, refetchInterval: 1000 }
  );

  const { data: currentPlayer } = trpc.game.getCurrentPlayer.useQuery(
    { roomId: parseInt(roomId || "0") },
    { enabled: !!roomId }
  );

  const getNextQuestionMutation = trpc.game.getNextQuestion.useMutation();
  const submitActionMutation = trpc.game.submitAction.useMutation();

  // Resume audio context on first interaction
  useEffect(() => {
    const handleInteraction = () => {
      resumeAudioContext();
      document.removeEventListener("click", handleInteraction);
      document.removeEventListener("touchstart", handleInteraction);
    };

    document.addEventListener("click", handleInteraction);
    document.addEventListener("touchstart", handleInteraction);

    return () => {
      document.removeEventListener("click", handleInteraction);
      document.removeEventListener("touchstart", handleInteraction);
    };
  }, []);

  useEffect(() => {
    if (gameState?.status === "completed") {
      setPhase("results");
    }
  }, [gameState?.status]);

  const handleSpin = async () => {
    setSpinning(true);
    playSound("spin", soundEnabled);
    // Simulate spinning animation
    await new Promise((resolve) => setTimeout(resolve, 3000));
    setSpinning(false);
    playSound("reveal", soundEnabled);
    setPhase("choice");
  };

  const handleChoiceSelect = (choice: "truth" | "dare") => {
    setSelectedChoice(choice);
    setPhase("question");
    playSound("select", soundEnabled);
    fetchQuestion();
  };

  const fetchQuestion = async () => {
    try {
      await getNextQuestionMutation.mutateAsync({ roomId: parseInt(roomId || "0") });
    } catch (error) {
      console.error("Failed to fetch question:", error);
    }
  };

  const handleAction = async (action: "completed" | "passed" | "skipped") => {
    if (!currentPlayer) return;

    try {
      await submitActionMutation.mutateAsync({
        roomId: parseInt(roomId || "0"),
        playerId: currentPlayer.id,
        action,
      });

      playSound(action, soundEnabled);
      setPhase("spinner");
      setSelectedChoice(null);
      await refetchGameState();
    } catch (error) {
      console.error("Failed to submit action:", error);
    }
  };

  if (!gameState || !currentPlayer) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-xl text-foreground">Loading game...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground overflow-hidden">
      {/* Animated background */}
      <div className="fixed inset-0 z-0">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-accent/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-secondary/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: "1s" }} />
      </div>

      {/* Content */}
      <div className="relative z-10 min-h-screen flex flex-col">
        {/* Header */}
        <div className="border-b border-accent/30 bg-card/50 backdrop-blur-sm p-4 md:p-6">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <div>
              <p className="text-sm text-foreground/70">
                Round {gameState.currentRound} of {gameState.totalRounds}
              </p>
              <h2 className="text-2xl font-bold neon-text">
                {currentPlayer.name}'s Turn
              </h2>
            </div>
            <div className="flex items-center gap-4">
              <ConnectionStatus />
              <Button
                size="sm"
                variant="outline"
                onClick={() => setSoundEnabled(!soundEnabled)}
                className="border-accent text-accent"
              >
                {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        </div>

        {/* Game Content */}
        <div className="flex-1 flex items-center justify-center p-6">
          {phase === "spinner" && (
            <div className="text-center">
              <h3 className="text-2xl font-bold mb-8">Spin the Bottle!</h3>
              <div className="mb-12">
                <div className="w-48 h-48 mx-auto mb-8 relative">
                  <div
                    className={`w-full h-full rounded-full border-4 border-accent flex items-center justify-center text-4xl font-bold neon-glow-primary ${
                      spinning ? "animate-spin-bottle" : ""
                    }`}
                  >
                    🎯
                  </div>
                </div>
              </div>
              <Button
                size="lg"
                className="bg-accent hover:bg-accent/90 text-background font-bold px-12 py-6 neon-glow-primary"
                onClick={handleSpin}
                disabled={spinning}
              >
                {spinning ? "Spinning..." : "SPIN"}
              </Button>
            </div>
          )}

          {phase === "choice" && (
            <div className="text-center max-w-2xl">
              <h3 className="text-3xl font-bold mb-12">Choose Your Challenge</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                <button
                  onClick={() => handleChoiceSelect("truth")}
                  className="group p-12 rounded-lg border-2 border-accent bg-accent/10 hover:bg-accent/20 transition-all transform hover:scale-105 neon-glow-primary"
                >
                  <div className="text-6xl mb-4">🎭</div>
                  <h4 className="text-2xl font-bold text-accent mb-2">TRUTH</h4>
                  <p className="text-foreground/70">Answer honestly</p>
                </button>
                <button
                  onClick={() => handleChoiceSelect("dare")}
                  className="group p-12 rounded-lg border-2 border-secondary bg-secondary/10 hover:bg-secondary/20 transition-all transform hover:scale-105 neon-glow-secondary"
                >
                  <div className="text-6xl mb-4">⚡</div>
                  <h4 className="text-2xl font-bold text-secondary mb-2">DARE</h4>
                  <p className="text-foreground/70">Accept the challenge</p>
                </button>
              </div>
            </div>
          )}

          {phase === "question" && getNextQuestionMutation.data && (
            <div className="text-center max-w-2xl animate-scale-pop">
              <div className="mb-8">
                <div
                  className={`inline-block text-6xl mb-6 ${
                    selectedChoice === "truth" ? "text-accent" : "text-secondary"
                  }`}
                >
                  {selectedChoice === "truth" ? "🎭" : "⚡"}
                </div>
              </div>
              <h3 className="text-2xl font-bold mb-4 uppercase">
                {selectedChoice}
              </h3>
              <div className="bg-card/80 border-2 border-accent/50 rounded-lg p-8 mb-12 neon-glow min-h-32 flex items-center justify-center">
                <p className="text-2xl font-bold text-foreground leading-relaxed">
                  {getNextQuestionMutation.data.text}
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button
                  size="lg"
                  className="bg-accent hover:bg-accent/90 text-background font-bold px-8 py-6 neon-glow-primary"
                  onClick={() => handleAction("completed")}
                  disabled={submitActionMutation.isPending}
                >
                  ✓ Complete
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="border-2 border-muted text-foreground hover:bg-muted/20"
                  onClick={() => handleAction("passed")}
                  disabled={submitActionMutation.isPending}
                >
                  ⏭ Pass
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="border-2 border-secondary text-secondary hover:bg-secondary/20"
                  onClick={() => handleAction("skipped")}
                  disabled={submitActionMutation.isPending}
                >
                  <SkipForward className="mr-2 w-4 h-4" />
                  Skip
                </Button>
              </div>
            </div>
          )}

          {phase === "results" && (
            <div className="text-center max-w-2xl">
              <h3 className="text-4xl font-bold mb-12 neon-text">Game Over!</h3>
              <Button
                size="lg"
                className="bg-accent hover:bg-accent/90 text-background font-bold px-12 py-6 neon-glow-primary"
                onClick={() => navigate(`/results/${roomId}`)}
              >
                View Results
              </Button>
            </div>
          )}
        </div>

        {/* Player Tracker */}
        <div className="border-t border-accent/30 bg-card/50 backdrop-blur-sm p-4">
          <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
              {gameState.players.map((player, index) => (
                <div
                  key={player.id}
                  className={`p-3 rounded-lg text-center text-sm font-bold transition-all ${
                    index === gameState.currentPlayerIndex
                      ? "bg-accent text-background neon-glow-primary scale-105"
                      : "bg-muted text-foreground"
                  }`}
                >
                  <p className="truncate">{player.name}</p>
                  <p className="text-xs opacity-70">{player.score} pts</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
