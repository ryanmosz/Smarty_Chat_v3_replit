import { Brain, Cat } from "lucide-react";

export function Logo() {
  return (
    <div className="flex items-center gap-2">
      <div className="relative w-8 h-8">
        <Brain className="w-8 h-8 text-primary animate-pulse" />
        <Cat className="absolute -top-1 -right-1 w-4 h-4 text-primary" />
        <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-primary rounded-full" />
      </div>
      <span className="font-bold text-xl text-primary">Smarty Chat</span>
    </div>
  );
}