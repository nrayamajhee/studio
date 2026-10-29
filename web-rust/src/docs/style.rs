// The classes web-react's DocsMarkdown gives each element, which build.rs
// sets on the docs' HTML (it `include!`s this file) and Tailwind finds here.

/// A doc's body.
pub const BODY: &str = "leading-[1.7] text-paper-ink [&>:first-child]:mt-0";
/// A level-one heading.
pub const H1: &str =
  "mt-10 mb-6 scroll-mt-24 text-[2.35rem] leading-tight font-semibold tracking-tight";
/// A level-two heading.
pub const H2: &str =
  "mt-12 mb-4 scroll-mt-24 text-[1.65rem] leading-snug font-semibold tracking-tight";
/// A level-three heading.
pub const H3: &str = "mt-9 mb-3 scroll-mt-24 text-[1.3rem] leading-snug font-semibold";
/// A level-four heading.
pub const H4: &str = "mt-7 mb-2 scroll-mt-24 text-[1.1rem] font-semibold";
/// A level-five heading.
pub const H5: &str = "mt-6 mb-2 scroll-mt-24 font-semibold";
/// A level-six heading.
pub const H6: &str = "mt-6 mb-2 scroll-mt-24 font-semibold text-paper-muted";
/// A paragraph.
pub const P: &str = "my-4";
/// A bulleted list.
pub const UL: &str =
  "my-4 list-disc space-y-1.5 pl-6 marker:text-paper-muted [&_ol]:my-2 [&_ul]:my-2";
/// A numbered list.
pub const OL: &str =
  "my-4 list-decimal space-y-1.5 pl-6 marker:text-paper-muted [&_ol]:my-2 [&_ul]:my-2";
/// A list item.
pub const LI: &str = "pl-1";
/// A quote.
pub const BLOCKQUOTE: &str =
  "my-6 border-l-2 border-paper-rule pl-5 text-paper-muted italic [&>p]:my-1";
/// A rule across the page.
pub const HR: &str = "my-10 border-0 border-t border-paper-rule";
/// Bold text.
pub const STRONG: &str = "font-semibold";
/// Code in a line of text.
pub const CODE: &str =
  "rounded bg-paper-well px-[0.3em] py-[0.1em] font-mono text-[0.86em] [overflow-wrap:anywhere]";
/// A code block.
pub const PRE: &str = "my-6 overflow-x-auto rounded-md bg-paper-well px-5 py-4 font-mono text-[13px] leading-relaxed [&_code]:rounded-none [&_code]:bg-transparent [&_code]:p-0 [&_code]:text-[length:inherit] [&_code]:[overflow-wrap:normal]";
/// What a table scrolls in, on narrow screens.
pub const TABLE_WRAP: &str = "my-6 overflow-x-auto";
/// A table.
pub const TABLE: &str =
  "w-full border-collapse text-[0.9rem] leading-snug [&_td:first-child]:whitespace-nowrap";
/// A table's heading cell.
pub const TH: &str = "border-b-2 border-paper-rule px-3 py-2 text-left align-bottom font-semibold";
/// A table's cell.
pub const TD: &str = "border-b border-paper-rule px-3 py-2 align-top";
/// A link.
pub const LINK: &str =
  "text-paper-link underline decoration-current/35 underline-offset-[3px] hover:decoration-current";
/// An image's frame: screenshots sit in one; SVG diagrams go bare.
pub const IMAGE: &str = "my-6 max-w-full";
/// A screenshot's frame, over [`IMAGE`]'s.
pub const SCREENSHOT: &str = "rounded-md shadow-mid";
/// An image with a dark twin: the two stacked, the twin faded in with the
/// theme, and a diagram's light version faded out under it.
pub const TWINS: &str = "grid w-fit overflow-hidden";
/// The light image of a pair, in the grid's one cell.
pub const LIGHT: &str = "[grid-area:1/1]";
/// A diagram's light image, faded out in the dark theme.
pub const LIGHT_DIAGRAM: &str = "opacity-[calc(1-var(--theme-dark))]";
/// The dark twin, faded in with the theme, over the light one.
pub const DARK: &str = "opacity-(--theme-dark) [grid-area:1/1]";
