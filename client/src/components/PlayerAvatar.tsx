import { cn } from "@/lib/utils";

interface PlayerAvatarProps {
  name: string;
  isActive?: boolean;
  score?: number;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function PlayerAvatar({
  name,
  isActive = false,
  score,
  size = "md",
  className,
}: PlayerAvatarProps) {
  const initials = name
    .split(" ")
    .map((word) => word[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const sizeClasses = {
    sm: "w-10 h-10 text-xs",
    md: "w-14 h-14 md:w-16 md:h-16 text-base md:text-lg",
    lg: "w-20 h-20 md:w-24 md:h-24 text-xl md:text-2xl",
  };

  const colors = [
    "from-accent to-accent/50",
    "from-secondary to-secondary/50",
    "from-blue-500 to-blue-600",
    "from-cyan-500 to-cyan-600",
    "from-purple-500 to-purple-600",
    "from-pink-500 to-pink-600",
  ];

  // Use name hash to consistently assign colors
  const colorIndex = name.charCodeAt(0) % colors.length;
  const bgGradient = colors[colorIndex];

  return (
    <div
      className={cn(
        "flex flex-col items-center gap-2",
        className
      )}
    >
      <div
        className={cn(
          "flex items-center justify-center rounded-full font-bold text-white transition-all duration-300",
          sizeClasses[size],
          `bg-gradient-to-br ${bgGradient}`,
          isActive && "ring-2 ring-offset-2 ring-offset-background ring-accent scale-105 animate-pulse-glow"
        )}
      >
        {initials}
      </div>
      {score !== undefined && (
        <div className="text-center">
          <p className="text-xs text-foreground/70">Score</p>
          <p className="text-sm font-bold text-accent">{score}</p>
        </div>
      )}
    </div>
  );
}
