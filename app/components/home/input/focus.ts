// Tab (and Shift + Tab) steps focus through the page's controls in the
// Device's order, and Return presses the focused one (Space always plays).
// Esc or any press on the Device ends it.
const FOCUSABLE =
  "a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]";

// Document order doesn't match the layout everywhere: the keybed lists its
// white keys before its black ones. Controls
// inside a [data-focus-group] are visited together, where the group's first
// one is, in reading order: "rows" goes row by row, "columns" left to right
// (so each black key falls between its neighbours).
function readingOrder(controls: HTMLElement[]) {
  const groups = new Map<string, HTMLElement[]>();
  const groupOf = (element: HTMLElement) =>
    element.closest<HTMLElement>("[data-focus-group]");
  for (const element of controls) {
    const group = groupOf(element);
    if (!group) continue;
    const name = group.dataset.focusGroup ?? "";
    groups.set(name, [...(groups.get(name) ?? []), element]);
  }
  for (const members of groups.values()) {
    const columns = groupOf(members[0])?.dataset.focusOrder === "columns";
    members.sort((a, b) => {
      const ra = a.getBoundingClientRect();
      const rb = b.getBoundingClientRect();
      const dx = ra.left + ra.width / 2 - (rb.left + rb.width / 2);
      const dy = ra.top - rb.top;
      return columns || Math.abs(dy) <= 4 ? dx : dy;
    });
  }
  const order: HTMLElement[] = [];
  const placed = new Set<string>();
  for (const element of controls) {
    const name = groupOf(element)?.dataset.focusGroup;
    if (name === undefined) order.push(element);
    else if (!placed.has(name)) {
      placed.add(name);
      order.push(...(groups.get(name) ?? []));
    }
  }
  return order;
}

export function moveFocus(direction: 1 | -1) {
  const controls = readingOrder(
    [...document.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
      (element) => element.tabIndex >= 0 && element.getClientRects().length > 0,
    ),
  );
  if (controls.length === 0) return;
  const current = controls.indexOf(document.activeElement as HTMLElement);
  const next =
    current < 0
      ? direction > 0
        ? 0
        : controls.length - 1
      : (current + direction + controls.length) % controls.length;
  // focusVisible isn't in TypeScript's DOM types yet.
  controls[next].focus({ focusVisible: true } as FocusOptions);
}

// A control focused from the keyboard (not the page itself).
export const keyboardFocus = () =>
  document.activeElement instanceof HTMLElement &&
  document.activeElement !== document.body &&
  document.activeElement.matches(FOCUSABLE);
