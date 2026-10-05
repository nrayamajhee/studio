// Moves an item index to the same slot on the next or previous page,
// stopping at the first and last page as the knob does.
export const turnPage = (
  index: number,
  direction: 1 | -1,
  perPage: number,
  count: number,
) => {
  const pages = Math.ceil(count / perPage);
  const page = Math.min(
    pages - 1,
    Math.max(0, Math.floor(index / perPage) + direction),
  );
  return Math.min(page * perPage + (index % perPage), count - 1);
};
