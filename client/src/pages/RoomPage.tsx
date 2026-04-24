import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { trpc } from "@/lib/trpc";
import { Copy, Check, Play } from "lucide-react";
import { toast } from "sonner";

const GAME_MODE_LABELS: Record<string, string> = {
  classic: "Classic",
  spicy: "Spicy",
  party: "Party",
};

export default function RoomPage() {
  const { roomCode } = useParams<{ roomCode: string }>();
  const [, navigate] = useLocation();
  const [copied, setCopied] = useState(false);
  const [localPlayerId, setLocalPlayerId] = useState<string | null>(() => 
    localStorage.getItem(`claimed_player_${roomCode}`)
  );

  // Fetch room data
  const { data: room, isLoading, error, refetch: refetchRoom } = trpc.game.joinRoom.useQuery(
    { roomCode: roomCode?.toUpperCase() || "" },
    { enabled: !!roomCode, refetchInterval: 1000 }
  );

  const setReadyMutation = trpc.game.setPlayerReady.useMutation({
    onSuccess: () => {
      refetchRoom();
      utils.game.joinRoom.invalidate({ roomCode: roomCode?.toUpperCase() || "" });
    }
  });
  const startGameMutation = trpc.game.startGame.useMutation();
  const claimPlayerMutation = trpc.game.claimPlayer.useMutation({
    onSuccess: () => {
      utils.game.joinRoom.invalidate({ roomCode: roomCode?.toUpperCase() || "" });
    }
  });
  const utils = trpc.useUtils();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-xl text-foreground">Loading room...</p>
        </div>
      </div>
    );
  }

  if (error || !room) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-2xl text-destructive font-bold mb-4">Room Not Found</p>
          <Button onClick={() => navigate("/")} className="bg-accent hover:bg-accent/90">
            Back to Home
          </Button>
        </div>
      </div>
    );
  }

  const handleCopyCode = () => {
    navigator.clipboard.writeText(roomCode || "");
    setCopied(true);
    toast.success("Room code copied");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleToggleReady = async (playerId: string) => {
    console.log("Toggling ready for:", playerId, "current localPlayerId:", localPlayerId);
    // Only allow toggling if it's the local player
    if (playerId !== localPlayerId) {
      toast.error("You can only toggle your own ready state!");
      return;
    }

    const player = room.players.find((p) => p.id === playerId);
    if (player) {
      console.log("Found player, isReady currently:", player.isReady);
      try {
        await setReadyMutation.mutateAsync({
          roomId: room.roomId,
          playerId,
          isReady: !player.isReady,
        });
        console.log("Mutation successful");
      } catch (err) {
        console.error("Mutation failed:", err);
        toast.error("Failed to update status");
      }
    }
  };

  const handleClaimPlayer = async (playerId: string) => {
    try {
      await claimPlayerMutation.mutateAsync({
        roomId: room.roomId,
        playerId,
      });
      localStorage.setItem(`claimed_player_${roomCode}`, playerId);
      setLocalPlayerId(playerId);
      toast.success("You have claimed this player!");
    } catch (err) {
      toast.error("Failed to claim player");
    }
  };

  const handleStartGame = async () => {
    if (!room.roomId) return;

    try {
      await startGameMutation.mutateAsync({ roomId: room.roomId });
      navigate(`/game/${room.roomId}`);
    } catch (error) {
      console.error("Failed to start game:", error);
      toast.error("Failed to start game. Please try again.");
    }
  };

  const allPlayersReady = room.players.every((p) => p.isReady);
  const gameModeLabel = GAME_MODE_LABELS[room.gameMode] || room.gameMode;

  return (
    <div className="min-h-screen bg-background text-foreground overflow-y-auto">
      {/* Animated background */}
      <div className="fixed inset-0 z-0">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-accent/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-secondary/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: "1s" }} />
      </div>

      {/* Content */}
      <div className="relative z-10 min-h-screen flex flex-col">
        {/* Header */}
        <div className="border-b border-accent/30 bg-card/50 backdrop-blur-sm p-4 md:p-6">
          <div className="max-w-6xl mx-auto flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold neon-text mb-2">Room: {roomCode}</h1>
              <p className="text-foreground/70">
                Mode: <span className="font-bold text-accent uppercase">{gameModeLabel}</span> • Rounds: {room.roundCount}
              </p>
            </div>
            <Button
              variant="outline"
              className="border-accent text-accent hover:bg-accent/10"
              onClick={handleCopyCode}
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 mr-2" />
                  Copy Code
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Players Grid */}
        <div className="flex-1 p-4 md:p-10">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-2xl font-bold mb-6 tracking-tight">Players ({room.players.length})</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-10">
              {console.log("Room Players:", room.players)}
              {room.players.map((player) => (
                <div
                  key={player.id}
                  className={`p-6 rounded-lg border-2 transition-all transform hover:scale-105 cursor-pointer flex flex-col items-center text-center ${
                    player.isReady
                      ? "border-accent bg-accent/10 neon-glow-primary"
                      : "border-muted bg-card/50 hover:border-accent/50"
                  }`}
                >
                  <PlayerAvatar
                    name={player.name}
                    score={player.score}
                    isActive={player.isReady}
                    size="md"
                    className="mb-4"
                  />

                  <h3 className="text-lg font-bold text-foreground mb-4">
                    {player.name} {player.id === localPlayerId && "(You)"}
                  </h3>

                  {player.id === localPlayerId ? (
                    <Button
                      size="sm"
                      className={`w-full ${
                        player.isReady
                          ? "bg-accent/20 text-accent hover:bg-accent/30"
                          : "bg-muted text-foreground hover:bg-muted/80"
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleReady(player.id);
                      }}
                      disabled={setReadyMutation.isPending}
                    >
                      {setReadyMutation.isPending ? "Updating..." : (player.isReady ? "✓ Ready" : "Set Ready")}
                    </Button>
                  ) : !localPlayerId && !player.isOccupied ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full border-accent text-accent hover:bg-accent/10"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleClaimPlayer(player.id);
                      }}
                    >
                      This is Me
                    </Button>
                  ) : (
                    <div className="text-sm text-foreground/40 italic">
                      {(player.isOccupied || player.isReady) ? (player.isReady ? "✓ Ready" : "Waiting...") : "Open Slot"}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Start Game Button */}
            <div className="flex gap-4 justify-center">
              <Button
                size="lg"
                className="bg-accent hover:bg-accent/90 text-background font-bold px-8 py-6 neon-glow-primary disabled:opacity-50"
                onClick={handleStartGame}
                disabled={!allPlayersReady || startGameMutation.isPending}
              >
                <Play className="mr-2 w-6 h-6" />
                {startGameMutation.isPending ? "Starting..." : "Start Game"}
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="border-2 border-secondary text-secondary hover:bg-secondary/10"
                onClick={() => navigate("/")}
              >
                Back to Home
              </Button>
            </div>

            {!allPlayersReady && (
              <p className="text-center text-foreground/60 mt-6">
                Waiting for all players to be ready...
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
