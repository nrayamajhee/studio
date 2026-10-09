import { ExternalLink } from "lucide-react";
import { Link } from "react-router";
import { cn } from "../../lib/utils";
import { sourceUrl } from "./docLinks";

export const paperSheet =
  "rounded-[3px] bg-paper paper-grain shadow-paper text-paper-ink";

export type DocsPaperProps = {
  source?: string;
  className?: string;
  children?: React.ReactNode;
};

// A sheet of grained paper for a doc to be read on. `source` heads it with
// the file's repo path, linked to GitHub.
export function DocsPaper({ source, className, children }: DocsPaperProps) {
  return (
    <article
      className={cn(
        paperSheet,
        "px-6 py-8 sm:px-12 sm:py-12 lg:px-16 lg:py-14",
        className,
      )}
    >
      {source && (
        <Link
          to={sourceUrl(source)}
          target="_blank"
          rel="noopener noreferrer"
          className="mb-8 inline-flex items-center gap-1.5 font-mono text-xs text-paper-muted hover:text-paper-ink"
        >
          {source}
          <ExternalLink className="size-3" />
        </Link>
      )}
      {children}
    </article>
  );
}
