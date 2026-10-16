---
order = 4
---

# Design rules

The rules the Device's look and controls keep to.

- The Device has a fixed native size and is scaled uniformly by CSS (`--scale`) to fit. Never reflow or squeeze its parts.
- Two spacing values, theme tokens in `app.css`: `bezel` (`p-bezel`; also the page margin, from twice it on wide screens down to half on phones) and `inset` (`gap-inset`) for everything else.
- Theme colours are `color-mix(in srgb, <light>, <dark> var(--theme-mix))` tokens in `app.css` (`bg-device`, `bg-pad`, `shadow-pad`…) so they fade with the 400 ms theme cross-fade. Keep colour transitions off those elements; their own transitions snap mid-fade.
- Keyboard hotkeys must never overlap between keys and pads.
- A pad with nothing bound to it (an empty preset pad) stays blank. A pad that does nothing in the current view keeps its icon.
- The screen's title leads its top line, or the footer where the top's left is taken (a pager's tabs, the scope's octave). Guides in the footer are `ScreenHint`s, the same size as the rest.
