import React from "react";
import { Brain, Cat } from "lucide-react";

interface LogoProps {
  className?: string;
  size?: "default" | "large"
}

export function Logo({ className, size = "default" }: LogoProps) {
  const dimensions = size === "large" ? "w-12 h-12" : "w-8 h-8";
  const iconSize = size === "large" ? "w-6 h-6" : "w-4 h-4";
  const dotSize = size === "large" ? "w-4 h-4" : "w-3 h-3";
  const textSize = size === "large" ? "text-2xl" : "text-xl";

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className={`relative ${dimensions}`}>
        <Brain className={`${dimensions} text-primary animate-pulse`} />
        <Cat className={`absolute -top-1 -right-1 ${iconSize} text-primary`} />
        <div className={`absolute -bottom-1 -right-1 ${dotSize} bg-primary rounded-full`} />
      </div>
      <span className={`font-bold ${textSize} text-primary`}>Smarty Chat</span>
    </div>
  );
}