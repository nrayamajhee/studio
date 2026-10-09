import { Menu } from "lucide-react";
import { data, Link, useLocation } from "react-router";
import type { Route } from "./+types/docs";
import { DOCS_TREE, findDoc } from "../components/docs/docs.server";
import { DocsMarkdown } from "../components/docs/DocsMarkdown";
import { DocsPaper, paperSheet } from "../components/docs/DocsPaper";
import { DocsSidebar } from "../components/docs/DocsSidebar";
import { SkyBackground } from "../components/page/SkyBackground";
import { ThemeToggle } from "../components/page/ThemeToggle";
import { cn } from "../lib/utils";

export function loader({ params }: Route.LoaderArgs) {
  const doc = findDoc(params["*"] ?? "") ?? null;
  return data({ tree: DOCS_TREE, doc }, { status: doc ? 200 : 404 });
}

export function meta({ loaderData }: Route.MetaArgs) {
  const doc = loaderData?.doc;
  return [
    {
      title: !doc
        ? "Not found - Studio"
        : doc.path === "README.md"
          ? "Docs - Studio"
          : `${doc.title} - Studio`,
    },
    {
      name: "description",
      content:
        "How Studio and The Device work: installation, the Device, the synth engine and Storybook.",
    },
  ];
}

export default function DocsRoute({ loaderData }: Route.ComponentProps) {
  const { tree, doc } = loaderData;
  const { pathname } = useLocation();

  return (
    <div className="relative min-h-dvh">
      <SkyBackground />
      <ThemeToggle />

      <div className="relative mx-auto flex max-w-6xl items-start gap-8 px-4 pt-16 pb-24 sm:px-8 sm:pt-20">
        <aside className="sticky top-20 hidden h-[calc(100dvh-6.5rem)] w-60 shrink-0 lg:block">
          <DocsSidebar tree={tree} className="h-full" />
        </aside>

        <main className="min-w-0 flex-1">
          <details key={pathname} className="mb-6 lg:hidden">
            <summary
              className={cn(
                paperSheet,
                "inline-flex cursor-pointer list-none items-center gap-2 px-3.5 py-2 text-xs font-medium [&::-webkit-details-marker]:hidden",
              )}
            >
              <Menu className="size-3.5" />
              {doc?.name ?? "Docs"}
            </summary>
            <DocsSidebar tree={tree} className="mt-2" />
          </details>

          {doc ? (
            <DocsPaper source={doc.path}>
              <DocsMarkdown
                markdown={doc.markdown}
                path={doc.path}
                tree={tree}
              />
            </DocsPaper>
          ) : (
            <DocsPaper>
              <div className="leading-[1.7]">
                <h1 className="mb-4 text-[2.35rem] leading-tight font-semibold tracking-tight">
                  Not found
                </h1>
                <p>
                  There’s no doc at{" "}
                  <code className="font-mono">{pathname}</code>.{" "}
                  <Link
                    to="/docs"
                    className="text-paper-link underline decoration-current/35 underline-offset-[3px] hover:decoration-current"
                  >
                    Back to the README
                  </Link>
                  .
                </p>
              </div>
            </DocsPaper>
          )}
        </main>
      </div>
    </div>
  );
}
