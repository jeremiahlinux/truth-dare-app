import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ConnectionStatus } from "@/components/ConnectionStatus";
import { trpc } from "@/lib/trpc";
import { playSound, resumeAudioContext } from "@/utils/soundEffects";
import { CheckCircle2, SkipForward, Volume2, VolumeX, XCircle } from "lucide-react";
import { toast } from "sonner";

export default function GamePage() {
  const { roomId } = useParams<{ roomId: string }>();
  const [, navigate] = useLocation();
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [selectedConfirmerId, setSelectedConfirmerId] = useState<string | null>(null);

  // Fetch game state
  const { data: gameState, refetch: refetchGameState } = trpc.game.getGameState.useQuery(
    { roomId: roomId || "" },
    { enabled: !!roomId, refetchInterval: 2000 }
  );

  const getNextQuestionMutation = trpc.game.getNextQuestion.useMutation();
  const submitActionMutation = trpc.game.submitAction.useMutation();
  const confirmActionMutation = trpc.game.confirmAction.useMutation();

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
    if (gameState?.currentQuestion?.status === "awaiting_confirmation") {
      const options = gameState.players.filter(
        (p) => p.id !== gameState.currentQuestion?.turnPlayerId
      );
      if (!selectedConfirmerId && options.length > 0) {
        setSelectedConfirmerId(options[0].id);
      }
    }
  }, [gameState?.currentQuestion, selectedConfirmerId, gameState?.players]);

  const fetchQuestion = async (choice: "truth" | "dare") => {
    try {
      await getNextQuestionMutation.mutateAsync({
        roomId: roomId || "",
        questionType: choice,
      });
      playSound("select", soundEnabled);
      await refetchGameState();
    } catch (error) {
      console.error("Failed to fetch question:", error);
      toast.error("Failed to load question. Try again.");
    }
  };

  const handleAction = async (action: "completed" | "skipped") => {
    if (!gameState?.players || !gameState.currentQuestion) return;
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    if (!currentPlayer) return;

    try {
      await submitActionMutation.mutateAsync({
        roomId: roomId || "",
        playerId: currentPlayer.id,
        action,
      });

      playSound(action, soundEnabled);
      await refetchGameState();
    } catch (error) {
      console.error("Failed to submit action:", error);
      toast.error("Failed to submit action. Try again.");
    }
  };

  const handleConfirmation = async (approved: boolean) => {
    if (!gameState?.currentQuestion || !selectedConfirmerId) return;
    try {
      await confirmActionMutation.mutateAsync({
        roomId: roomId || "",
        sessionId: gameState.currentQuestion.sessionId,
        confirmerPlayerId: selectedConfirmerId,
        approved,
      });
      playSound(approved ? "completed" : "skipped", soundEnabled);
      await refetchGameState();
    } catch (error) {
      console.error("Failed to confirm action:", error);
      toast.error("Confirmation failed. Try again.");
    }
  };

  if (!gameState) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-xl text-foreground">Loading game...</p>
        </div>
      </div>
    );
  }

  const currentPlayer = gameState.players[gameState.currentPlayerIndex];
  const currentQuestion = gameState.currentQuestion;
  const isWaitingConfirmation = currentQuestion?.status === "awaiting_confirmation";
  const canStartChoice =
    !currentQuestion || ["completed", "skipped"].includes(currentQuestion.status);
  const confirmerOptions = gameState.players.filter(
    (p) => p.id !== currentPlayer?.id
  );

  if (gameState.status === "completed") {
    return (
      <div className="min-h-screen bg-background text-foreground overflow-y-auto">
        <div className="mx-auto flex min-h-screen max-w-4xl flex-col items-center justify-center px-6 py-12 text-center">
          <h2 className="mb-3 text-4xl font-black tracking-tight text-accent">Game Complete</h2>
          <p className="mb-8 text-foreground/70">All rounds are done. Check the final rankings.</p>
          <Button
            size="lg"
            className="bg-accent text-background hover:bg-accent/90"
            onClick={() => navigate(`/results/${roomId}`)}
          >
            View Results
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground overflow-y-auto">
      <div className="fixed inset-0 z-0 opacity-70">
        <div className="absolute left-1/4 top-0 h-96 w-96 rounded-full bg-accent/10 blur-3xl" />
        <div className="absolute bottom-0 right-1/4 h-96 w-96 rounded-full bg-secondary/10 blur-3xl" />
      </div>

      <div className="relative z-10 min-h-screen">
        <div className="border-b border-border/70 bg-card/70 backdrop-blur-md">
          <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-4 md:px-8">
            <div>
              <p className="text-sm text-foreground/60">
                Round {gameState.currentRound} of {gameState.totalRounds}
              </p>
              <h2 className="text-2xl font-bold tracking-tight text-accent">
                {currentPlayer.name}'s Turn
              </h2>
            </div>
            <div className="flex items-center gap-4">
              <ConnectionStatus />
              <Button
                size="sm"
                variant="outline"
                onClick={() => setSoundEnabled(!soundEnabled)}
                className="border-accent/40 text-accent hover:bg-accent/10"
              >
                {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        </div>

        <main className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-6 md:grid-cols-[1fr_320px] md:px-8">
          <section className="rounded-2xl border border-border/70 bg-card/60 p-6 backdrop-blur-sm">
            {canStartChoice && (
              <div className="text-center">
                <h3 className="mb-2 text-3xl font-extrabold tracking-tight">Pick Truth or Dare</h3>
                <p className="mb-8 text-foreground/70">No spinner, no waiting. Keep the energy high.</p>
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <button
                    onClick={() => fetchQuestion("truth")}
                    className="group rounded-xl border border-accent/60 bg-accent/10 p-8 text-left transition hover:scale-[1.01] hover:bg-accent/20"
                    disabled={getNextQuestionMutation.isPending}
                >
                    <div className="mb-4 text-5xl">🎭</div>
                    <h4 className="mb-2 text-2xl font-black tracking-tight text-accent">Truth</h4>
                    <p className="text-sm text-foreground/70">Answer honestly and let the group decide.</p>
                </button>
                <button
                    onClick={() => fetchQuestion("dare")}
                    className="group rounded-xl border border-secondary/60 bg-secondary/10 p-8 text-left transition hover:scale-[1.01] hover:bg-secondary/20"
                    disabled={getNextQuestionMutation.isPending}
                >
                    <div className="mb-4 text-5xl">⚡</div>
                    <h4 className="mb-2 text-2xl font-black tracking-tight text-secondary">Dare</h4>
                    <p className="text-sm text-foreground/70">Do the challenge, then ask another player to verify.</p>
                </button>
                </div>
              </div>
            )}

            {currentQuestion && (
              <div className="mx-auto max-w-2xl animate-scale-pop text-center">
                <div className="mb-4 text-sm font-semibold uppercase tracking-widest text-foreground/60">
                  {currentQuestion.type}
                </div>
                <div className="mb-8 rounded-2xl border border-accent/40 bg-background/50 p-7 text-left">
                  <p className="text-2xl font-semibold leading-relaxed">{currentQuestion.text}</p>
                </div>

                {currentQuestion.status === "pending" && (
                  <div className="flex flex-wrap items-center justify-center gap-3">
                    <Button
                      size="lg"
                      className="bg-accent px-8 text-background hover:bg-accent/90"
                      onClick={() => handleAction("completed")}
                      disabled={submitActionMutation.isPending}
                    >
                      <CheckCircle2 className="mr-2 h-5 w-5" />
                      Mark Done
                    </Button>
                    <Button
                      size="lg"
                      variant="outline"
                      className="border-secondary/60 text-secondary hover:bg-secondary/10"
                      onClick={() => handleAction("skipped")}
                      disabled={submitActionMutation.isPending}
                    >
                      <SkipForward className="mr-2 h-5 w-5" />
                      Skip Turn
                    </Button>
                  </div>
                )}

                {isWaitingConfirmation && (
                  <div className="rounded-xl border border-border bg-card/40 p-4 text-left">
                    <p className="mb-3 text-sm font-semibold text-foreground/70">
                      Another player must confirm this turn before scoring.
                    </p>
                    <label className="mb-2 block text-xs uppercase tracking-widest text-foreground/60">
                      Confirming Player
                    </label>
                    <select
                      className="mb-4 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                      value={selectedConfirmerId ?? ""}
                      onChange={(e) => setSelectedConfirmerId(e.target.value)}
                    >
                      {confirmerOptions.map((player) => (
                        <option key={player.id} value={player.id}>
                          {player.name}
                        </option>
                      ))}
                    </select>
                    <div className="flex flex-wrap gap-3">
                      <Button
                        className="bg-accent text-background hover:bg-accent/90"
                        onClick={() => handleConfirmation(true)}
                        disabled={confirmActionMutation.isPending || !selectedConfirmerId}
                      >
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        Confirm Completed
                      </Button>
                      <Button
                        variant="outline"
                        className="border-destructive/50 text-destructive hover:bg-destructive/10"
                        onClick={() => handleConfirmation(false)}
                        disabled={confirmActionMutation.isPending || !selectedConfirmerId}
                      >
                        <XCircle className="mr-2 h-4 w-4" />
                        Reject / Skip
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>

          <aside className="rounded-2xl border border-border/70 bg-card/50 p-4 backdrop-blur-sm">
            <h4 className="mb-4 text-sm font-bold uppercase tracking-widest text-foreground/60">
              Live Scoreboard
            </h4>
            <div className="space-y-2">
              {gameState.players.map((player, index) => (
                <div
                  key={player.id}
                  className={`rounded-lg p-3 text-sm font-semibold transition ${
                    index === gameState.currentPlayerIndex
                      ? "scale-[1.01] bg-accent text-background"
                      : "bg-background/60 text-foreground"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate">{player.name}</p>
                    <p className="text-xs opacity-80">{player.score} pts</p>
                  </div>
                </div>
              ))}
            </div>
          </aside>
        </main>
      </div>
    </div>
  );
}
