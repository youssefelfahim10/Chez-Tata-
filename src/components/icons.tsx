import type { ReactNode, SVGProps } from "react";

/** Icônes en traits fins (style sobre, une seule épaisseur). Décoratives : masquées aux lecteurs d'écran. */
const PATHS = {
  pointer: "M22 14a8 8 0 0 1-8 8|M18 11v-1a2 2 0 0 0-2-2a2 2 0 0 0-2 2|M14 10V9a2 2 0 0 0-2-2a2 2 0 0 0-2 2v1|M10 9.5V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v10|M18 11a2 2 0 1 1 4 0v3a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15",
  wifiOff: "M12 20h.01|M8.5 16.429a5 5 0 0 1 7 0|M5 12.859a10 10 0 0 1 5.17-2.69|M19 12.859a10 10 0 0 0-2.007-1.523|M2 8.82a15 15 0 0 1 4.177-2.643|M22 8.82a15 15 0 0 0-11.288-3.764|m2 2 20 20",
  mic: "M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z|M19 10v2a7 7 0 0 1-14 0v-2|M12 19v3",
  message: "M7.9 20A9 9 0 1 0 4 16.1L2 22Z",
  receipt: "M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z|M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8|M12 17.5v-11",
  file: "M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z|M14 2v4a2 2 0 0 0 2 2h4|M10 9H8|M16 13H8|M16 17H8",
  chart: "M3 3v16a2 2 0 0 0 2 2h16|M18 17V9|M13 17V5|M8 17v-3",
  shield: "M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z|m9 12 2 2 4-4",
  check: "M20 6 9 17l-5-5",
  home: "M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8|M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z",
  users: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2|M22 21v-2a4 4 0 0 0-3-3.87|M16 3.13a4 4 0 0 1 0 7.75|M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z",
  lock: "M5 11h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2z|M7 11V7a5 5 0 0 1 10 0v4",
  hand: "M18 11V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2|M14 10V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v2|M10 10.5V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2v8|M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15",
  history: "M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8|M3 3v5h5|M12 7v5l4 2",
  globe: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z|M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20|M2 12h20",
  login: "M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4|m10 17 5-5-5-5|M15 12H3",
  logout: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4|m16 17 5-5-5-5|M21 12H9",
  utensils: "M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2|M7 2v20|M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7",
  moon: "M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z",
  droplet: "M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z",
  plus: "M5 12h14|M12 5v14",
  chevron: "m6 9 6 6 6-6",
  phone: "M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z",
  alert: "m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3|M12 9v4|M12 17h.01",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, className = "size-6", ...props }: { name: IconName; className?: string } & Omit<SVGProps<SVGSVGElement>, "name">): ReactNode {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
      {...props}
    >
      {PATHS[name].split("|").map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
