import { useParams, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { trpc } from "@/lib/trpc";
import { Trophy, RotateCcw, Home } from "lucide-react";

export default function ResultsPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const [, navigate] = useLocation();

  const { data: results, isLoading } = trpc.game.getResults.useQuery(
    { roomId: parseInt(roomId || "0") },
    { enabled: !!roomId }
  );

  const endGameMutation = trpc.game.endGame.useMutation();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-xl text-foreground">Loading results...</p>
        </div>
      </div>
    );
  }

  if (!results) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-2xl text-destructive font-bold mb-4">Results Not Found</p>
          <Button onClick={() => navigate("/")} className="bg-accent hover:bg-accent/90">
            Back to Home
          </Button>
        </div>
      </div>
    );
  }

  const handlePlayAgain = async () => {
    await endGameMutation.mutateAsync({ roomId: parseInt(roomId || "0") });
    navigate("/");
  };

  const handleNewGame = async () => {
    await endGameMutation.mutateAsync({ roomId: parseInt(roomId || "0") });
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-background text-foreground overflow-hidden">
      {/* Animated background */}
      <div className="fixed inset-0 z-0">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-accent/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-secondary/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: "1s" }} />
      </div>

      {/* Content */}
      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-4 py-12">
        {/* Game Over Header */}
        <div className="text-center mb-16 animate-slide-up">
          <h1 className="text-6xl md:text-7xl font-black neon-text mb-4">GAME OVER</h1>
          <p className="text-xl text-foreground/80">
            Rounds Completed: {results.totalRounds}
          </p>
        </div>

        {/* MVP Highlight */}
        <div className="mb-16 w-full max-w-2xl animate-scale-pop">
          <div className="relative">
            {/* Glow effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-accent via-secondary to-accent rounded-2xl blur-2xl opacity-50 animate-pulse" />

            {/* MVP Card */}
            <div className="relative bg-card border-2 border-accent rounded-2xl p-12 text-center neon-glow-primary">
              <div className="text-7xl mb-6 animate-bounce">🏆</div>
              <h2 className="text-3xl font-bold text-accent mb-6">MVP</h2>
              
              <div className="flex justify-center mb-6">
                <PlayerAvatar
                  name={results.mvp.name}
                  score={results.mvp.score}
                  size="lg"
                />
              </div>

              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-background/50 rounded-lg p-4">
                  <p className="text-sm text-foreground/70 mb-1">Score</p>
                  <p className="text-2xl font-bold text-accent">{results.mvp.score}</p>
                </div>
                <div className="bg-background/50 rounded-lg p-4">
                  <p className="text-sm text-foreground/70 mb-1">Completed</p>
                  <p className="text-2xl font-bold text-secondary">{results.mvp.completed}</p>
                </div>
                <div className="bg-background/50 rounded-lg p-4">
                  <p className="text-sm text-foreground/70 mb-1">Streak</p>
                  <p className="text-2xl font-bold text-accent">{results.mvp.streak}</p>
                </div>
              </div>
              <p className="text-lg text-foreground/80 italic">
                Congratulations on your victory!
              </p>
            </div>
          </div>
        </div>

        {/* Final Scores */}
        <div className="w-full max-w-4xl mb-16">
          <h3 className="text-2xl font-bold mb-6 text-center">Final Rankings</h3>
          <div className="space-y-3">
            {results.finalScores.map((player, index) => (
              <div
                key={player.id}
                className={`p-6 rounded-lg border-2 flex items-center justify-between transition-all ${
                  index === 0
                    ? "border-accent bg-accent/10 neon-glow-primary"
                    : index === 1
                      ? "border-secondary bg-secondary/10"
                      : "border-muted bg-card/50"
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className="text-3xl font-black w-12 text-center">
                    {index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : `#${index + 1}`}
                  </div>
                  <PlayerAvatar
                    name={player.name}
                    size="sm"
                  />
                  <div className="text-left">
                    <p className="text-lg font-bold">{player.name}</p>
                    <p className="text-sm text-foreground/70">
                      {player.completed} completed • {player.passed} passed • {player.skipped} skipped
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-bold text-accent">{player.score}</p>
                  <p className="text-sm text-foreground/70">points</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-6 justify-center">
          <Button
            size="lg"
            className="bg-accent hover:bg-accent/90 text-background font-bold px-8 py-6 neon-glow-primary rounded-lg"
            onClick={handlePlayAgain}
          >
            <RotateCcw className="mr-2 w-6 h-6" />
            Play Again
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="border-2 border-secondary text-secondary hover:bg-secondary/10 font-bold px-8 py-6 rounded-lg"
            onClick={handleNewGame}
          >
            <Home className="mr-2 w-6 h-6" />
            New Game
          </Button>
        </div>
      </div>
    </div>
  );
}
