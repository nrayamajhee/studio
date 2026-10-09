import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";
import { createTV } from "tailwind-variants";

// The theme's own spacing and shadow names (see app.css), so merging classes
// knows `p-bezel` is padding and `shadow-pad` a box shadow, and lets a later
// one replace an earlier one.
const twMergeConfig = {
  extend: {
    theme: {
      spacing: ["bezel", "inset"],
      shadow: [
        "low",
        "mid",
        "high",
        "device",
        "keybed",
        "grille-hole",
        "pad",
        "pad-held",
        "pad-lit",
        "pad-lit-held",
        "key-white",
        "key-white-lit",
        "key-black",
        "key-black-lit",
        "screen",
        "paper",
      ],
      "drop-shadow": ["knob"],
    },
  },
};

const twMerge = extendTailwindMerge(twMergeConfig);

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Variant styles, merged as `cn` merges them.
export const tv = createTV({ twMergeConfig });
