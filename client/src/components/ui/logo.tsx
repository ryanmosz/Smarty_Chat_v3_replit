import * as React from "react";
import { Brain, Cat } from "lucide-react";
import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  size?: "default" | "large"
}

export const Logo = React.forwardRef<HTMLDivElement, LogoProps>(
  ({ className, size = "default" }, ref) => {
    const dimensions = size === "large" ? "w-12 h-12" : "w-8 h-8";
    const iconSize = size === "large" ? "w-6 h-6" : "w-4 h-4";
    const dotSize = size === "large" ? "w-4 h-4" : "w-3 h-3";
    const textSize = size === "large" ? "text-2xl" : "text-xl";

    return (
      <div ref={ref} className={cn("flex items-center gap-2", className)}>
        <div className={`relative ${dimensions}`}>
          <Brain className={`${dimensions} text-primary animate-pulse`} />
          <Cat 
            className={`absolute -top-1 -right-1 ${iconSize} text-[#4C3BCF]`}
          />
          <div className={`absolute -bottom-1 -right-1 ${dotSize} bg-primary rounded-full`} />
        </div>
        <span className={`font-bold ${textSize} text-primary`}>Smarty Chat</span>
      </div>
    );
  }
);

Logo.displayName = "Logo";