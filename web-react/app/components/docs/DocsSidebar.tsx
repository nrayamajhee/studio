import { useEffect } from "react";
import {
  ArrowLeft,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  FileText,
} from "lucide-react";
import { Link, NavLink, useLocation } from "react-router";
import { cn } from "../../lib/utils";
import type { DocNode } from "../../types/docs";
import { Button } from "../design-system/Button";
import { docsCollapsed, setDocsCollapsed, useDocsCollapsed } from "./docsStore";

type DocsTreeProps = {
  nodes: DocNode[];
  depth?: number;
  collapsed: ReadonlySet<string>;
  onToggle: (path: string) => void;
};

// Each folder's files are indented under its parent's. The top folder
// (docs/, the route itself) hangs under the README without a row of its own;
// the folders inside it are labelled, and their labels fold them away.
function DocsTree({ nodes, depth = 0, collapsed, onToggle }: DocsTreeProps) {
  return (
    <ul className={cn(depth > 0 && "pl-4")}>
      {nodes.map((node) => (
        <li key={node.path}>
          {node.kind === "folder" ? (
            <>
              {depth > 0 && (
                <Button
                  unstyled
                  aria-expanded={!collapsed.has(node.path)}
                  onClick={() => onToggle(node.path)}
                  className="flex w-full cursor-pointer items-center gap-1.5 rounded px-2 pt-3 pb-1 text-left text-xs font-semibold tracking-wide uppercase opacity-60 hover:opacity-100"
                >
                  <ChevronRight
                    className={cn(
                      "size-3 shrink-0 transition-transform",
                      !collapsed.has(node.path) && "rotate-90",
                    )}
                  />
                  {node.title}
                </Button>
              )}
              {!collapsed.has(node.path) && (
                <DocsTree
                  nodes={node.children}
                  depth={depth + 1}
                  collapsed={collapsed}
                  onToggle={onToggle}
                />
              )}
            </>
          ) : (
            <NavLink
              to={node.href}
              end
              title={node.title}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2 rounded px-2 py-1.5 text-sm",
                  isActive
                    ? "bg-sky-well font-semibold"
                    : "opacity-80 hover:bg-sky-well hover:opacity-100",
                )
              }
            >
              <FileText className="size-3.5 shrink-0 opacity-70" />
              <span className="truncate">{node.name}</span>
            </NavLink>
          )}
        </li>
      ))}
    </ul>
  );
}

// Every folder with a row of its own (all but the top one), by path.
const foldersOf = (nodes: readonly DocNode[], depth = 0): string[] =>
  nodes.flatMap((node) =>
    node.kind === "folder"
      ? [
          ...(depth > 0 ? [node.path] : []),
          ...foldersOf(node.children, depth + 1),
        ]
      : [],
  );

// The home footer's links: plain, underlined.
const footLink =
  "font-medium underline decoration-current/40 underline-offset-4 hover:decoration-current";

export type DocsSidebarProps = {
  tree: DocNode[];
  // A button by the way back that folds every folder, or opens them all.
  foldAll?: boolean;
  className?: string;
};

// The docs' file tree floating on the sky, in the order their TOML gives, with
// the way back to the Device above it and the home footer's GitHub and
// coffee links at the foot (the bottom of the column when it fills one). The
// folders folded stay folded (see docsStore), but going to a doc opens the
// ones it is in, so it isn't hidden.
export function DocsSidebar({ tree, foldAll, className }: DocsSidebarProps) {
  const { pathname } = useLocation();
  const folded = useDocsCollapsed();
  const collapsed = new Set(folded);
  const folders = foldersOf(tree);
  const allFolded = folders.every((path) => collapsed.has(path));
  useEffect(() => {
    const now = docsCollapsed();
    const open = now.filter((path) => !pathname.startsWith(`/${path}/`));
    if (open.length < now.length) setDocsCollapsed(open);
  }, [pathname]);
  const toggle = (path: string) =>
    setDocsCollapsed(
      collapsed.has(path)
        ? folded.filter((other) => other !== path)
        : [...folded, path],
    );

  return (
    <nav
      aria-label="Docs"
      className={cn("flex flex-col text-sky-ink", className)}
    >
      <div className="flex items-center justify-between gap-2">
        <Link
          to="/"
          className="flex items-center gap-2 rounded px-2 py-1.5 text-[15px] font-semibold hover:bg-sky-well"
        >
          <ArrowLeft className="size-3.5" />
          Studio
        </Link>
        {foldAll && (
          <Button
            unstyled
            onClick={() => setDocsCollapsed(allFolded ? [] : folders)}
            className="flex cursor-pointer items-center gap-1.5 rounded px-2 py-1.5 text-xs font-medium opacity-70 hover:bg-sky-well hover:opacity-100"
          >
            {allFolded ? (
              <ChevronsUpDown className="size-3.5" />
            ) : (
              <ChevronsDownUp className="size-3.5" />
            )}
            <span>{allFolded ? "Expand all" : "Collapse all"}</span>
          </Button>
        )}
      </div>
      {/* Only the sticky desktop column keeps its scroll from the page's;
          on phones the menu scrolls on into the page. */}
      <div className="mt-3 min-h-0 overflow-y-auto lg:overscroll-contain">
        <DocsTree nodes={tree} collapsed={collapsed} onToggle={toggle} />
      </div>
      <div className="mt-auto px-2 pt-4 text-sm whitespace-nowrap">
        <Link
          to="https://github.com/nrayamajhee/studio"
          target="_blank"
          rel="noopener noreferrer"
          className={footLink}
        >
          GitHub
        </Link>
        {" | "}
        <Link
          to="https://buymeacoffee.com/nrayamajhee"
          target="_blank"
          rel="noopener noreferrer"
          className={footLink}
        >
          Buy me a coffee!
        </Link>
      </div>
    </nav>
  );
}
