import { cn } from "../../lib/utils";

export type SkyBackgroundProps = {
  className?: string;
};

// The sky behind every page: the sunset gradient with its drifting glow,
// cross-fading to blue hour in dark mode. Fixed to the viewport, so a page
// scrolls over it.
export function SkyBackground({ className }: SkyBackgroundProps) {
  return (
    <div
      aria-hidden
      className={cn(
        "home-background fixed inset-0 overflow-hidden pointer-events-none",
        className,
      )}
    >
      <div className="absolute inset-0 transition-opacity duration-400 ease-in-out opacity-100 dark:opacity-0">
        <div
          className="absolute -bottom-[60vmax] -left-[60vmax] w-[120vmax] h-[120vmax] animate-sunset-traverse mix-blend-screen"
          style={{
            background:
              "radial-gradient(circle closest-side at 50% 50%, rgba(255, 248, 221, 0.98) 0%, rgba(255, 232, 173, 0.88) 15%, rgba(255, 207, 134, 0.65) 32%, rgba(250, 183, 139, 0.36) 52%, rgba(239, 189, 184, 0.13) 72%, rgba(239, 189, 184, 0.025) 88%, rgba(239, 189, 184, 0) 100%)",
          }}
        />
        <div
          className="absolute inset-x-0 bottom-0 h-1/3"
          style={{
            background:
              "radial-gradient(ellipse 120% 60% at 50% 100%, rgba(246, 197, 163, 0.2) 0%, rgba(239, 189, 184, 0.07) 45%, rgba(239, 189, 184, 0) 100%)",
          }}
        />
      </div>

      <div className="absolute inset-0 transition-opacity duration-400 ease-in-out opacity-0 dark:opacity-100">
        <div
          className="absolute -bottom-[45vmax] -left-[45vmax] w-[90vmax] h-[90vmax] animate-sunset-traverse mix-blend-screen"
          style={{
            background:
              "radial-gradient(circle closest-side at 50% 50%, rgba(167, 185, 211, 0.3) 0%, rgba(144, 165, 196, 0.23) 18%, rgba(112, 137, 173, 0.14) 38%, rgba(89, 103, 129, 0.06) 60%, rgba(89, 103, 129, 0.015) 80%, rgba(89, 103, 129, 0) 100%)",
          }}
        />
        <div
          className="absolute inset-x-0 bottom-0 h-1/3"
          style={{
            background:
              "radial-gradient(ellipse 120% 60% at 50% 100%, rgba(124, 121, 140, 0.12) 0%, rgba(89, 103, 129, 0.04) 45%, rgba(89, 103, 129, 0) 100%)",
          }}
        />
      </div>
    </div>
  );
}
