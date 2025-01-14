import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
}

export function Logo({ className }: LogoProps) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <svg 
        width="32" 
        height="32" 
        viewBox="0 0 32 32" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
        className="text-primary"
      >
        <path
          d="M16 2C8.268 2 2 8.268 2 16s6.268 14 14 14 14-6.268 14-14S23.732 2 16 2z"
          className="stroke-current"
          strokeWidth="2"
        />
        <path
          d="M23 15.5c0 .828-.672 1.5-1.5 1.5s-1.5-.672-1.5-1.5.672-1.5 1.5-1.5 1.5.672 1.5 1.5z"
          className="fill-current"
        />
        <path
          d="M12 15.5c0 .828-.672 1.5-1.5 1.5s-1.5-.672-1.5-1.5.672-1.5 1.5-1.5 1.5.672 1.5 1.5z"
          className="fill-current"
        />
        <path
          d="M16 20c-1.5 0-2.5-1-3-2 1 0 2 .5 3 .5s2-.5 3-.5c-.5 1-1.5 2-3 2z"
          className="fill-current"
        />
        <path
          d="M8 10l4-2M24 10l-4-2"
          className="stroke-current"
          strokeWidth="2"
          strokeLinecap="round"
        />
        {/* Circuit patterns to represent AI */}
        <path
          d="M4 16h2m20 0h2M16 4v2m0 20v2"
          className="stroke-current"
          strokeWidth="1"
          strokeDasharray="2 2"
        />
      </svg>
      <span className="font-semibold text-xl">AI Chat</span>
    </div>
  );
}
