import { createContext, createElement, use, type JSX } from "react";
import Markdown, { type Components, type ExtraProps } from "react-markdown";
import { Link } from "react-router";
import rehypeRaw from "rehype-raw";
import rehypeSlug from "rehype-slug";
import remarkGfm from "remark-gfm";
import { cn } from "../../lib/utils";
import type { DocNode } from "../../types/docs";
import { docHrefs, docImage, docLink } from "./docLinks";

type Source = { path: string; hrefs: Map<string, string> };

const SourceContext = createContext<Source>({
  path: "README.md",
  hrefs: new Map(),
});

type Tag = keyof JSX.IntrinsicElements;
type ElementProps<T extends Tag> = JSX.IntrinsicElements[T] & ExtraProps;

const styled = <T extends Tag>(tag: T, base: string) => {
  const Styled = (props: ElementProps<T>) => {
    const {
      node: _node,
      className,
      ...rest
    } = props as ExtraProps & { className?: string };
    return createElement(tag, { ...rest, className: cn(base, className) });
  };
  Styled.displayName = `Doc(${tag})`;
  return Styled;
};

function DocLink({
  node: _node,
  href = "",
  className,
  children,
  id,
  title,
}: ElementProps<"a">) {
  const { path, hrefs } = use(SourceContext);
  const { to, external } = docLink(href, path, hrefs);
  return (
    <Link
      to={to}
      id={id}
      title={title}
      {...(external && { target: "_blank", rel: "noopener noreferrer" })}
      className={cn(
        "text-paper-link underline decoration-current/35 underline-offset-[3px] hover:decoration-current",
        className,
      )}
    >
      {children}
    </Link>
  );
}

function DocImage({
  node: _node,
  src,
  alt = "",
  className,
  ...props
}: ElementProps<"img">) {
  const { path } = use(SourceContext);
  return (
    <img
      {...props}
      src={typeof src === "string" ? docImage(src, path) : src}
      alt={alt}
      className={cn("my-6 max-w-full rounded-md shadow-mid", className)}
    />
  );
}

function DocTable({ node: _node, className, ...props }: ElementProps<"table">) {
  return (
    <div className="my-6 overflow-x-auto">
      <table
        {...props}
        className={cn(
          "w-full border-collapse text-[0.9rem] leading-snug [&_td:first-child]:whitespace-nowrap",
          className,
        )}
      />
    </div>
  );
}

const COMPONENTS: Components = {
  h1: styled(
    "h1",
    "mt-10 mb-6 scroll-mt-24 text-[2.35rem] leading-tight font-semibold tracking-tight",
  ),
  h2: styled(
    "h2",
    "mt-12 mb-4 scroll-mt-24 text-[1.65rem] leading-snug font-semibold tracking-tight",
  ),
  h3: styled(
    "h3",
    "mt-9 mb-3 scroll-mt-24 text-[1.3rem] leading-snug font-semibold",
  ),
  h4: styled("h4", "mt-7 mb-2 scroll-mt-24 text-[1.1rem] font-semibold"),
  h5: styled("h5", "mt-6 mb-2 scroll-mt-24 font-semibold"),
  h6: styled("h6", "mt-6 mb-2 scroll-mt-24 font-semibold text-paper-muted"),
  p: styled("p", "my-4"),
  ul: styled(
    "ul",
    "my-4 list-disc space-y-1.5 pl-6 marker:text-paper-muted [&_ol]:my-2 [&_ul]:my-2",
  ),
  ol: styled(
    "ol",
    "my-4 list-decimal space-y-1.5 pl-6 marker:text-paper-muted [&_ol]:my-2 [&_ul]:my-2",
  ),
  li: styled("li", "pl-1"),
  blockquote: styled(
    "blockquote",
    "my-6 border-l-2 border-paper-rule pl-5 text-paper-muted italic [&>p]:my-1",
  ),
  hr: styled("hr", "my-10 border-0 border-t border-paper-rule"),
  strong: styled("strong", "font-semibold"),
  code: styled(
    "code",
    "rounded bg-paper-well px-[0.3em] py-[0.1em] font-mono text-[0.86em] [overflow-wrap:anywhere]",
  ),
  pre: styled(
    "pre",
    "my-6 overflow-x-auto rounded-md bg-paper-well px-5 py-4 font-mono text-[13px] leading-relaxed [&_code]:rounded-none [&_code]:bg-transparent [&_code]:p-0 [&_code]:text-[length:inherit] [&_code]:[overflow-wrap:normal]",
  ),
  table: DocTable,
  th: styled(
    "th",
    "border-b-2 border-paper-rule px-3 py-2 text-left align-bottom font-semibold",
  ),
  td: styled("td", "border-b border-paper-rule px-3 py-2 align-top"),
  a: DocLink,
  img: DocImage,
};

export type DocsMarkdownProps = {
  markdown: string;
  path?: string;
  tree?: DocNode[];
  className?: string;
};

// A doc's markdown (GFM, with inline HTML) set in the paper's ink. `path` is
// where the file sits in the repo, so its relative links and images resolve;
// links to other docs in `tree` stay in the docs route.
export function DocsMarkdown({
  markdown,
  path = "README.md",
  tree = [],
  className,
}: DocsMarkdownProps) {
  return (
    <SourceContext value={{ path, hrefs: docHrefs(tree) }}>
      <div
        className={cn(
          "leading-[1.7] text-paper-ink [&>:first-child]:mt-0",
          className,
        )}
      >
        <Markdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeRaw, rehypeSlug]}
          components={COMPONENTS}
        >
          {markdown}
        </Markdown>
      </div>
    </SourceContext>
  );
}
