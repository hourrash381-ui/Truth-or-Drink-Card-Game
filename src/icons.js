// Inline SVG icons (stroke = currentColor) so they inherit set colours and themes.

const svg = (body, size = 20) =>
  `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

const SET_ICONS = {
  // highball with a lime wedge
  'happy-hour': '<path d="M6 7h12l-1.4 13H7.4z"/><path d="M6.5 11h11"/><path d="M15 3.5a3.5 3.5 0 0 1 3.5 3.5h-3.5z"/>',
  // tumbler with ice
  'on-the-rocks': '<path d="M5 5h14l-1.2 15H6.2z"/><rect x="8" y="10" width="3.6" height="3.6" rx=".6"/><rect x="12.4" y="12.6" width="3.6" height="3.6" rx=".6"/>',
  // crescent moon
  'last-call': '<path d="M19 14.5A8 8 0 1 1 9.5 5a6.5 6.5 0 0 0 9.5 9.5z"/>',
  // martini with olive
  'extra-dirty': '<path d="M4 5h16l-8 8z"/><path d="M12 13v7"/><path d="M8.5 20h7"/><circle cx="14.5" cy="8" r="1.4"/>',
  // pencil / house card
  house: '<path d="M4 20l1-4L16 5l3 3L8 19z"/><path d="M14 7l3 3"/>',
};

export const setIcon = (id, size) => svg(SET_ICONS[id] ?? SET_ICONS.house, size);

export const icons = {
  rules: svg('<path d="M5 4h10l4 4v12H5z"/><path d="M14 4v5h5"/><path d="M8.5 13h7M8.5 16.5h5"/>'),
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
  deck: svg('<rect x="7" y="3" width="12" height="16" rx="2"/><path d="M5 6v13a2 2 0 0 0 2 2h9"/>'),
  menu: svg('<path d="M4 7h16M4 12h16M4 17h16"/>'),
  close: svg('<path d="M6 6l12 12M18 6L6 18"/>'),
  undo: svg('<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>'),
  shuffle: svg('<path d="M16 3h5v5"/><path d="M4 20L21 3"/><path d="M21 16v5h-5"/><path d="M15 15l6 6"/><path d="M4 4l5 5"/>'),
  up: svg('<path d="M6 15l6-6 6 6"/>', 18),
  trash: svg('<path d="M4 7h16M10 11v6M14 11v6"/><path d="M6 7l1 13h10l1-13M9 7V4h6v3"/>', 18),
  check: svg('<path d="M5 12.5l4.5 4.5L19 7.5"/>', 18),
  glass: svg('<path d="M6 4h12l-1.6 16H7.6z"/><path d="M6.6 10h10.8"/>', 18),
  cheers: svg('<path d="M4 3l5 1.5-1.4 6A3 3 0 0 1 4 12.6L2.6 12z"/><path d="M20 3l-5 1.5 1.4 6a3 3 0 0 0 3.6 2.1l1.4-.6z"/><path d="M6 12.6L5 20M18 12.6l1 7.4M3 20h4M17 20h4"/>', 28),
  people: svg('<circle cx="9" cy="8" r="3"/><path d="M3 20a6 6 0 0 1 12 0"/><circle cx="17" cy="9" r="2.4"/><path d="M15.5 14.2A5 5 0 0 1 21 19"/>'),
  bolt: svg('<path d="M13 3L5 13h6l-1 8 8-10h-6z"/>', 18),
  edit: svg('<path d="M4 20l1-4L16 5l3 3L8 19z"/>', 16),
};
