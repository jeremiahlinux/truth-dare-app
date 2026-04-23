import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Zap, Users } from "lucide-react";
import { toast } from "sonner";

const GAME_MODES = [
  { value: "classic", label: "Classic" },
  { value: "spicy", label: "Spicy" },
  { value: "party", label: "Party" },
];

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return fallback;
}

export default function Home() {
  const [, navigate] = useLocation();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showJoinDialog, setShowJoinDialog] = useState(false);
  const [roomCode, setRoomCode] = useState("");
  const [playerNames, setPlayerNames] = useState(["", ""]);
  const [gameMode, setGameMode] = useState<"classic" | "spicy" | "party">("classic");
  const [roundCount, setRoundCount] = useState(5);

  const createRoomMutation = trpc.game.createRoom.useMutation();
  const joinRoomQuery = trpc.game.joinRoom.useQuery(
    { roomCode: roomCode.toUpperCase() },
    { enabled: false }
  );

  const handleAddPlayer = () => {
    if (playerNames.length < 8) {
      setPlayerNames([...playerNames, ""]);
    }
  };

  const handleRemovePlayer = (index: number) => {
    if (playerNames.length > 2) {
      setPlayerNames(playerNames.filter((_, i) => i !== index));
    }
  };

  const handlePlayerNameChange = (index: number, value: string) => {
    const newNames = [...playerNames];
    newNames[index] = value;
    setPlayerNames(newNames);
  };

  const handleCreateRoom = async () => {
    const validNames = playerNames.filter((name) => name.trim().length > 0);
    if (validNames.length < 2) {
      toast.error("Please enter at least 2 player names");
      return;
    }

    try {
      const result = await createRoomMutation.mutateAsync({
        gameMode,
        roundCount,
        playerNames: validNames,
      });

      navigate(`/room/${result.roomCode}`);
    } catch (error) {
      console.error("Failed to create room:", error);
      toast.error(getErrorMessage(error, "Failed to create room. Please try again."));
    }
  };

  const handleJoinRoom = async () => {
    if (roomCode.trim().length !== 8) {
      toast.error("Please enter a valid room code");
      return;
    }

    try {
      const room = await joinRoomQuery.refetch();
      if (room.data) {
        navigate(`/room/${roomCode.toUpperCase()}`);
      }
    } catch (error) {
      console.error("Failed to join room:", error);
      toast.error(getErrorMessage(error, "Room not found. Please check the code and try again."));
    }
  };

  const gameModeLabel = GAME_MODES.find((m) => m.value === gameMode)?.label || gameMode;

  return (
    <div className="min-h-screen bg-background text-foreground overflow-y-auto">
      {/* Animated background */}
      <div className="fixed inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-background" />
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-accent/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-secondary/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: "1s" }} />
      </div>

      {/* Content */}
      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-4 py-10 md:py-14">
        {/* Hero Section */}
        <div className="text-center mb-12 animate-slide-up">
          {/* Logo/Title */}
          <div className="mb-6 md:mb-8">
            <div className="inline-flex items-center justify-center gap-3 mb-6">
              <Zap className="w-12 h-12 text-accent animate-pulse-glow" />
              <h1 className="text-4xl md:text-7xl font-black neon-text tracking-tight">
                TRUTH OR DARE
              </h1>
              <Zap className="w-12 h-12 text-secondary animate-pulse-glow" style={{ animationDelay: "0.5s" }} />
            </div>
            <p className="text-xl md:text-2xl text-muted-foreground font-bold tracking-wider">
              NEON NIGHTS
            </p>
          </div>

          {/* Subtitle */}
          <p className="text-base md:text-xl text-foreground/80 max-w-2xl mx-auto mb-10 md:mb-12 leading-relaxed">
            The ultimate multiplayer party game. Challenge your friends with truth questions and daring dares in real-time.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-6 justify-center mb-12">
            <Button
              size="lg"
              className="bg-accent hover:bg-accent/90 text-background font-bold text-lg px-8 py-6 neon-glow-primary rounded-lg transform transition-all hover:scale-105 active:scale-95"
              onClick={() => setShowCreateDialog(true)}
            >
              <Users className="mr-2 w-6 h-6" />
              CREATE ROOM
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-2 border-secondary text-secondary hover:bg-secondary/10 font-bold text-lg px-8 py-6 neon-border rounded-lg transform transition-all hover:scale-105 active:scale-95"
              onClick={() => setShowJoinDialog(true)}
            >
              <Zap className="mr-2 w-6 h-6" />
              JOIN ROOM
            </Button>
          </div>

          {/* Features Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 max-w-4xl mx-auto">
            {[
              { title: "Real-Time", desc: "Play with friends instantly" },
              { title: "AI-Powered", desc: "Fresh prompts every round" },
              { title: "Mobile-First", desc: "Play on any device" },
            ].map((feature, i) => (
              <div
                key={i}
                className="p-6 rounded-lg bg-card/50 border border-accent/30 neon-glow backdrop-blur-sm transform transition-all hover:scale-105 hover:border-accent/60"
              >
                <h3 className="font-bold text-accent mb-2">{feature.title}</h3>
                <p className="text-sm text-foreground/70">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Create Room Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="bg-card border-2 border-accent/50 max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl neon-text">Create a New Room</DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-6">
            {/* Game Mode Selection */}
            <div>
              <Label className="text-base font-bold mb-3 block">Game Mode</Label>
              <div className="grid grid-cols-3 gap-3">
                {GAME_MODES.map((mode) => (
                  <button
                    key={mode.value}
                    onClick={() => setGameMode(mode.value as any)}
                    className={`p-3 rounded-lg font-bold uppercase transition-all ${
                      gameMode === mode.value
                        ? "bg-accent text-background neon-glow-primary"
                        : "bg-muted text-foreground hover:bg-muted/80"
                    }`}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Round Count */}
            <div>
              <Label className="text-base font-bold mb-3 block">Rounds: {roundCount}</Label>
              <input
                type="range"
                min="1"
                max="20"
                value={roundCount}
                onChange={(e) => setRoundCount(parseInt(e.target.value))}
                className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-accent"
              />
            </div>

            {/* Player Names */}
            <div>
              <Label className="text-base font-bold mb-3 block">Player Names</Label>
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {playerNames.map((name, index) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      placeholder={`Player ${index + 1}`}
                      value={name}
                      onChange={(e) => handlePlayerNameChange(index, e.target.value)}
                      className="bg-input border-border text-foreground"
                    />
                    {playerNames.length > 2 && (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleRemovePlayer(index)}
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                ))}
              </div>
              {playerNames.length < 8 && (
                <Button
                  variant="outline"
                  className="w-full mt-3"
                  onClick={handleAddPlayer}
                >
                  + Add Player
                </Button>
              )}
            </div>

            {/* Create Button */}
            <Button
              size="lg"
              className="w-full bg-accent hover:bg-accent/90 text-background font-bold neon-glow-primary"
              onClick={handleCreateRoom}
              disabled={createRoomMutation.isPending}
            >
              {createRoomMutation.isPending ? "Creating..." : "Create Room"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Join Room Dialog */}
      <Dialog open={showJoinDialog} onOpenChange={setShowJoinDialog}>
        <DialogContent className="bg-card border-2 border-secondary/50">
          <DialogHeader>
            <DialogTitle className="text-2xl neon-text">Join a Room</DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-6">
            <div>
              <Label htmlFor="room-code" className="text-base font-bold mb-3 block">
                Room Code
              </Label>
              <Input
                id="room-code"
                placeholder="e.g., ABC123XY"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                className="bg-input border-border text-foreground text-center text-2xl font-bold tracking-widest"
                maxLength={8}
              />
            </div>

            <Button
              size="lg"
              className="w-full bg-secondary hover:bg-secondary/90 text-background font-bold neon-glow-secondary"
              onClick={handleJoinRoom}
              disabled={roomCode.length !== 8}
            >
              Join Room
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
