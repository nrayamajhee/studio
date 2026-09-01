import type { Preview, Decorator } from '@storybook/react-vite';
import { withThemeByClassName } from '@storybook/addon-themes';
import '../app/app.css';

// Decorator to ensure story containers inherit foreground and dark background colors properly from top-left
const withThemeWrapper: Decorator = (Story) => {
  return (
    <div className="w-full text-slate-900 dark:text-slate-100 transition-colors duration-200">
      <Story />
    </div>
  );
};

const preview: Preview = {
  parameters: {
    layout: 'padded',
    darkMode: {
      current: 'light',
      darkClass: 'dark',
      lightClass: 'light',
      stylePreview: true,
      classTarget: 'html',
    },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    a11y: {
      test: 'todo',
    },
  },
  decorators: [
    withThemeByClassName({
      themes: {
        light: '',
        dark: 'dark',
      },
      defaultTheme: 'light',
      parentSelector: 'html',
    }),
    withThemeWrapper,
  ],
};

export default preview;