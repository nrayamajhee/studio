import type { Preview, Decorator } from "@storybook/react-vite";
import { withThemeByClassName } from "@storybook/addon-themes";
import { themes } from "storybook/theming";
import "../app/app.css";

const withThemeWrapper: Decorator = (Story) => {
  return (
    <div className="w-full text-slate-900 dark:text-slate-100 transition-colors duration-200">
      <Story />
    </div>
  );
};

const preview: Preview = {
  parameters: {
    layout: "padded",
    docs: {
      theme: themes.light,
    },
    darkMode: {
      current: "light",
      darkClass: "dark",
      lightClass: "light",
      stylePreview: true,
      classTarget: "html",
      dark: themes.dark,
      light: themes.light,
    },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    a11y: {
      test: "todo",
    },
  },
  decorators: [
    withThemeByClassName({
      themes: {
        light: "",
        dark: "dark",
      },
      defaultTheme: "light",
      parentSelector: "html",
    }),
    withThemeWrapper,
  ],
};

export default preview;
