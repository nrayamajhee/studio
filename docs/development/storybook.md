# Storybook

The built Storybook is served in the app at [`/storybook`](/storybook) by the production build (`npm run build`, then `npm start`); each component named below opens its own page there. In development, run `npm run storybook` and open [localhost:6006](http://localhost:6006).

Stories are colocated with their components (`Component.stories.tsx`) and organized under five top-level titles.

- **`Design System/*`** — [`Key`](/storybook?path=/docs/design-system-key--docs), [`Knob`](/storybook?path=/docs/design-system-knob--docs), [`Pad`](/storybook?path=/docs/design-system-pad--docs) and the base controls ([`Button`](/storybook?path=/docs/design-system-button--docs), [`Card`](/storybook?path=/docs/design-system-card--docs), [`Slider`](/storybook?path=/docs/design-system-slider--docs), [`Typography`](/storybook?path=/docs/design-system-typography--docs)).
- **`Home/*`** — [`Device`](/storybook?path=/docs/home-device--docs) (`SynthDevice`), [`Screen`](/storybook?path=/docs/home-screen--docs) (`DeviceScreen`), [`Layout`](/storybook?path=/docs/home-layout--docs) and `Parts/*` ([`Device Knob`](/storybook?path=/docs/home-parts-device-knob--docs), [`Device Pad`](/storybook?path=/docs/home-parts-device-pad--docs), [`Pad Buttons`](/storybook?path=/docs/home-parts-pad-buttons--docs), [`Display`](/storybook?path=/docs/home-parts-display--docs), [`Keybed`](/storybook?path=/docs/home-parts-keybed--docs), [`Grille`](/storybook?path=/docs/home-parts-grille--docs)).
- **`Page/*`** — [`Sky Background`](/storybook?path=/docs/page-sky-background--docs) and [`Theme Toggle`](/storybook?path=/docs/page-theme-toggle--docs), shared by the home page and the docs.
- **`Docs/*`** — [`Sidebar`](/storybook?path=/docs/docs-sidebar--docs), [`Paper`](/storybook?path=/docs/docs-paper--docs) and [`Markdown`](/storybook?path=/docs/docs-markdown--docs), the parts of the `/docs` route.
- **`Lab/*`** — [`Instrument Lab`](/storybook?path=/docs/lab-instrument-lab--docs) (dev tool; not mounted in any route).

Setup conventions:

- Every component starts with a `Default` story that binds cleanly to its props so Autodocs and the Controls panel work out of the box.
- Components use the `autodocs` tag and `layout: "centered"` (or `"padded"` for surfaces).
- The Device story renders over the `.home-background` gradient via a decorator.
- Parts that read the Device's state use the `withDevice` decorator (`app/components/home/storybook/`), which supplies only its providers; `parameters.device.view` opens a view. Stories show the component alone, without decoration.
- The docs parts use the `withDocs` decorator (`app/components/docs/storybook/`), which gives them a router and the sky's gradient to sit on.
- Every component's meta carries a one- or two-line `docs.description.component`.
- Light/dark coverage comes from the theme addon (`@storybook/addon-themes`); components must be correct in both modes.
