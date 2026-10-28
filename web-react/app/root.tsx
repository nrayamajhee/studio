import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";

import type { Route } from "./+types/root";
import "./app.css";
import { Heading, Paragraph } from "./components/design-system/Typography";
import { Card } from "./components/design-system/Card";

// The Device in miniature: its body and black screen, the white and green
// knobs left, red and blue right, and the keys along the bottom. Inlined as a
// data URL (the CSS-Tricks SVG favicon trick); the media query inside swaps
// the body and white parts between the Device's light and dark colours.
const FAVICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
<style>
.body{fill:#d6d5d0}.chalk{fill:#f4f3ef}.edge{stroke:#a9a8a3}
@media (prefers-color-scheme:dark){.body{fill:#3a3a3e}.chalk{fill:#e9e8e4}.edge{stroke:#2a2a2d}}
</style>
<rect class="body" x="1" y="2" width="30" height="28" rx="7"/>
<rect x="9" y="5" width="14" height="10" rx="1.5" fill="#050505"/>
<circle class="chalk edge" cx="5.5" cy="7.5" r="2.4" stroke-width="0.8"/>
<circle cx="5.5" cy="13" r="2.4" fill="#4ba078"/>
<circle cx="26.5" cy="7.5" r="2.4" fill="#cd5951"/>
<circle cx="26.5" cy="13" r="2.4" fill="#2f7de1"/>
<rect class="chalk" x="4" y="18" width="24" height="9" rx="1.5"/>
<path d="M8 18v5M12 18v5M18 18v5M22 18v5" stroke="#1d1d1f" stroke-width="2"/>
</svg>`;

export const links: Route.LinksFunction = () => [
  {
    rel: "icon",
    type: "image/svg+xml",
    href: `data:image/svg+xml,${encodeURIComponent(FAVICON)}`,
  },
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap",
  },
];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  let theme = localStorage.getItem('theme');
                  try { theme = JSON.parse(theme); } catch (e) {}
                  const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
                  if (theme === 'dark' || ((!theme || theme === 'system') && systemTheme === 'dark')) {
                    document.documentElement.classList.add('dark');
                  } else {
                    document.documentElement.classList.remove('dark');
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Oops!";
  let details = "An unexpected error occurred.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : "Error";
    details =
      error.status === 404
        ? "The requested page could not be found."
        : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main className="pt-16 p-4 container mx-auto space-y-4">
      <Heading className="text-2xl font-bold">{message}</Heading>
      <Paragraph>{details}</Paragraph>
      {stack && (
        <Card elevation="low" className="w-full p-4 overflow-x-auto">
          <code>{stack}</code>
        </Card>
      )}
    </main>
  );
}
