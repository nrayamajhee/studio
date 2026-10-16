import { useState } from "react";
import { ArrowLeft, ChevronRight, FileText } from "lucide-react";
import { Link, NavLink, useLocation } from "react-router";
import { cn } from "../../lib/utils";
import type { DocNode } from "../../types/docs";
import { Button } from "../design-system/Button";

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

// The home footer's links: plain, underlined.
const footLink =
  "font-medium underline decoration-current/40 underline-offset-4 hover:decoration-current";

export type DocsSidebarProps = {
  tree: DocNode[];
  className?: string;
};

// The docs' file tree floating on the sky, in the order their TOML gives, with
// the way back to the Device above it and the home footer's GitHub and
// coffee links at the foot (the bottom of the column when it fills one).
export function DocsSidebar({ tree, className }: DocsSidebarProps) {
  const { pathname } = useLocation();
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const [shown, setShown] = useState(pathname);
  // Opening a doc opens the folders it is in, so it is never hidden.
  if (shown !== pathname) {
    setShown(pathname);
    setCollapsed(
      (current) =>
        new Set(
          [...current].filter((path) => !pathname.startsWith(`/${path}/`)),
        ),
    );
  }
  const toggle = (path: string) =>
    setCollapsed((current) => {
      const next = new Set(current);
      if (!next.delete(path)) next.add(path);
      return next;
    });

  return (
    <nav
      aria-label="Docs"
      className={cn("flex flex-col text-sky-ink", className)}
    >
      <Link
        to="/"
        className="flex items-center gap-2 rounded px-2 py-1.5 text-[15px] font-semibold hover:bg-sky-well"
      >
        <ArrowLeft className="size-3.5" />
        Studio
      </Link>
      <div className="mt-3 min-h-0 overflow-y-auto overscroll-contain">
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
