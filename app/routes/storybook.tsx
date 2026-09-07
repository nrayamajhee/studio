import React from "react";
import type { Route } from "./+types/storybook";
import { Link } from "react-router";
import { Button } from "../components/design-system/Button";
import { ArrowLeft } from "lucide-react";

export function meta(): Route.MetaDescriptors {
  return [
    { title: "Storybook - Studio" },
    {
      name: "description",
      content:
        "Studio component library, design system tokens, and interactive stories.",
    },
  ];
}

export default function StorybookRoute() {
  const rawBase = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
  const storybookUrl = `${rawBase}/storybook-static/index.html`;

  return (
    <div className="h-screen w-screen overflow-hidden bg-white dark:bg-[#07090e] text-stone-900 dark:text-stone-100 flex flex-col font-sans transition-colors duration-200">
      <header className="h-12 border-b border-stone-200 dark:border-stone-800/80 bg-stone-100/90 dark:bg-[#0c1017]/90 backdrop-blur-md px-3 sm:px-4 flex items-center z-20 flex-shrink-0">
        <Link to="/mixer">
          <Button
            variant="solid"
            tone="secondary"
            size="sm"
            leadingIcon={<ArrowLeft className="w-3.5 h-3.5" />}
            className="bg-white dark:bg-[#151a24] border border-stone-200 dark:border-stone-800 text-stone-700 dark:text-stone-300 hover:text-stone-900 dark:hover:text-white"
          >
            Back to Studio
          </Button>
        </Link>
      </header>

      <main className="flex-1 w-full h-full relative overflow-hidden bg-white dark:bg-[#07090e]">
        <iframe
          src={storybookUrl}
          title="Studio Storybook"
          className="w-full h-full border-0 absolute inset-0"
          allow="clipboard-write"
        />
      </main>
    </div>
  );
}
