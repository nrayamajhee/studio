import { cn } from "../../lib/utils";

export const paperSheet =
  "rounded-[3px] bg-paper paper-grain shadow-paper text-paper-ink";

export type DocsPaperProps = {
  className?: string;
  children?: React.ReactNode;
};

// A sheet of grained paper for a doc to be read on.
export function DocsPaper({ className, children }: DocsPaperProps) {
  return (
    <article
      className={cn(
        paperSheet,
        "px-6 py-8 sm:px-12 sm:py-12 lg:px-16 lg:py-14",
        className,
      )}
    >
      {children}
    </article>
  );
}
