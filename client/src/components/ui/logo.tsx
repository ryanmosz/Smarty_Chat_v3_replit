import { cn } from "@/lib/utils";

interface LogoProps extends React.SVGProps<SVGSVGElement> {
  className?: string;
}

export function Logo({ className, ...props }: LogoProps) {
  return (
    <svg
      width="48"
      height="48"
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("text-primary", className)}
      {...props}
    >
      {/* Circuit board background pattern */}
      <path
        d="M10 60h20M40 60h20M80 60h30M60 40v40M90 30v60"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeOpacity="0.3"
      />
      <circle cx="40" cy="60" r="3" fill="currentColor" fillOpacity="0.3" />
      <circle cx="90" cy="60" r="3" fill="currentColor" fillOpacity="0.3" />
      <circle cx="60" cy="40" r="3" fill="currentColor" fillOpacity="0.3" />
      <circle cx="60" cy="80" r="3" fill="currentColor" fillOpacity="0.3" />

      {/* Cat silhouette */}
      <path
        d="M50 70c0-15 20-25 20-25s20 10 20 25c0 13.75-9 25-20 25s-20-11.25-20-25z"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
      />
      {/* Cat ears */}
      <path
        d="M70 45l-10-10M70 45l10-10"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* Cat eyes */}
      <circle cx="65" cy="60" r="2" fill="currentColor" />
      <circle cx="75" cy="60" r="2" fill="currentColor" />
      {/* Cat nose */}
      <path
        d="M70 65l-2 2 2 2 2-2z"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="currentColor"
      />
      {/* Whiskers */}
      <path
        d="M68 67l-8 3M68 69l-8-1M72 67l8 3M72 69l8-1"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
        strokeOpacity="0.7"
      />

      {/* Binary/AI patterns */}
      <text
        x="15"
        y="25"
        fill="currentColor"
        fontSize="8"
        fontFamily="monospace"
        opacity="0.3"
      >
        01 AI
      </text>
      <text
        x="85"
        y="95"
        fill="currentColor"
        fontSize="8"
        fontFamily="monospace"
        opacity="0.3"
      >
        10 AI
      </text>
    </svg>
  );
}