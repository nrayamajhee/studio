/**
 * Studio Atmospheric Color Palette Tokens
 * - Primary: Blue Hour Blue (twilight cobalt / deep sky blue)
 * - Accent: Sunset Purple / Dusk Violet
 * - Warning: Sunset Glow Orange / Amber
 * - Error: Sunset Crimson Red
 * - Success: Natural Forest Emerald Green
 * - Background: Grayscale with subtle warm brown tone
 * - White: Cream color leaning almost white
 * - Text: Warm charcoal / cream white
 *
 * Interaction States:
 * - Normal: Middle (600)
 * - Hover: Brighter (500)
 * - Click/Active: Darker (700)
 */

export const palette = {
  primary: {
    name: "Primary (Blue Hour)",
    50: "#eff4fe",
    100: "#dbe6fd",
    200: "#bfd3fc",
    300: "#93b8f9",
    400: "#6093f4",
    500: "#3b71ee",
    600: "#2554d7", // Blue Hour Blue (Normal)
    700: "#1d41b8",
    800: "#1b3695",
    900: "#1b3076",
    DEFAULT: "#2554d7",
    hover: "#3b71ee", // Brighter
    active: "#1d41b8", // Darker
    border: "#2554d7",
    text: "#ffffff",
  },
  accent: {
    name: "Accent (Twilight Purple)",
    50: "#faf5ff",
    100: "#f3e8ff",
    200: "#e9d5ff",
    300: "#d8b4fe",
    400: "#c084fc",
    500: "#a855f7",
    600: "#7c3aed", // Dusk Purple (Normal)
    700: "#6d28d9",
    800: "#5b21b6",
    900: "#4c1d95",
    DEFAULT: "#7c3aed",
    hover: "#a855f7", // Brighter
    active: "#6d28d9", // Darker
    border: "#7c3aed",
    text: "#ffffff",
  },
  warning: {
    name: "Warning (Sunset Orange)",
    50: "#fff7ed",
    100: "#ffedd5",
    200: "#fed7aa",
    300: "#fdba74",
    400: "#fb923c",
    500: "#f97316",
    600: "#ea580c", // Sunset Orange (Normal)
    700: "#c2410c",
    800: "#9a3412",
    900: "#7c2d12",
    DEFAULT: "#ea580c",
    hover: "#f97316", // Brighter
    active: "#c2410c", // Darker
    border: "#ea580c",
    text: "#ffffff",
  },
  error: {
    name: "Error (Sunset Crimson)",
    50: "#fef2f2",
    100: "#fee2e2",
    200: "#fecaca",
    300: "#fca5a5",
    400: "#f87171",
    500: "#ef4444",
    600: "#dc2626", // Sunset Crimson Red (Normal)
    700: "#b91c1c",
    800: "#991b1b",
    900: "#7f1d1d",
    DEFAULT: "#dc2626",
    hover: "#ef4444", // Brighter
    active: "#b91c1c", // Darker
    border: "#dc2626",
    text: "#ffffff",
  },
  success: {
    name: "Success (Forest Emerald)",
    50: "#ecfdf5",
    100: "#d1fae5",
    200: "#a7f3d0",
    300: "#6ee7b7",
    400: "#34d399",
    500: "#10b981",
    600: "#059669", // Emerald Green (Normal)
    700: "#047857",
    800: "#065f46",
    900: "#064e3b",
    DEFAULT: "#059669",
    hover: "#10b981", // Brighter
    active: "#047857", // Darker
    border: "#059669",
    text: "#ffffff",
  },
  cream: {
    name: "Cream White",
    DEFAULT: "#fdfbf7",
    pure: "#fffefc",
    soft: "#f9f7f2",
    surface: "#fffdfa",
  },
  background: {
    name: "Background (Warm Gray with Brown Tone)",
    light: "#f6f4f0",
    lightSurface: "#ffffff",
    lightBorder: "#e7e5e1",
    dark: "#141211",
    darkSurface: "#1c1917",
    darkBorder: "#292524",
  },
  text: {
    name: "Typography Colors",
    primaryLight: "#1c1917",
    secondaryLight: "#78716c",
    primaryDark: "#fdfbf7",
    secondaryDark: "#a8a29e",
  },
} as const;

export type PaletteName = keyof typeof palette;
