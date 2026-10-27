//! The Device's icons as SVG markup, set with `set_inner_html` since fluid
//! creates HTML elements only. Lucide icons and the Device's own drawings,
//! as web-react renders them.

/// Each pad's face, in reading order (three rows of twelve).
pub const PADS: [&str; 36] = [
  r#"<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z"></path></svg>"#,
  r#"<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"></rect></svg>"#,
  r#"<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle></svg>"#,
  r#"<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"></path><path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7"></path><path d="M7 3v4a1 1 0 0 0 1 1h7"></path></svg>"#,
  r#"<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="18" rx="2"></rect><circle cx="8" cy="10" r="3"></circle><circle cx="16" cy="10" r="3"></circle><path d="M8 13h8"></path><path d="M6 17h12"></path></svg>"#,
  r#"<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 13a2 2 0 0 0 2-2V7a2 2 0 0 1 4 0v13a2 2 0 0 0 4 0V4a2 2 0 0 1 4 0v13a2 2 0 0 0 4 0v-4a2 2 0 0 1 2-2"></path></svg>"#,
  r#"<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 19 7.5 5l4 7H17l5 7"></path></svg>"#,
  r#"<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12q2.5 2 5 0t5 0 5 0 5 0"></path><path d="M2 19q2.5 2 5 0t5 0 5 0 5 0"></path><path d="M2 5q2.5 2 5 0t5 0 5 0 5 0"></path></svg>"#,
  r#"<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 10v3"></path><path d="M6 6v11"></path><path d="M10 3v18"></path><path d="M14 8v7"></path><path d="M18 5v13"></path><path d="M22 10v3"></path></svg>"#,
  r#"<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"></path><path d="m9 9 12-2"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>"#,
  r#"<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 17H19"></path><path d="M5 12H19"></path><path d="M5 7H19"></path></svg>"#,
  r#"<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 11.4V9.1"></path><path d="m12 17 6.59-6.59"></path><path d="m15.05 5.7-.218-.691a3 3 0 0 0-5.663 0L4.418 19.695A1 1 0 0 0 5.37 21h13.253a1 1 0 0 0 .951-1.31L18.45 16.2"></path><circle cx="20" cy="9" r="2"></circle></svg>"#,
  r#"<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="6" r="3"></circle><path d="M8.12 8.12 12 12"></path><path d="M20 4 8.12 15.88"></path><circle cx="6" cy="18" r="3"></circle><path d="M14.8 14.8 20 20"></path></svg>"#,
  r#"<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4.702a.7.7 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.7.7 0 0 0 11 19.298z"></path><path d="m16.5 14.5 5-5"></path><path d="m16.5 9.5 5 5"></path></svg>"#,
  r#"<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 7-7 7 7"></path><path d="M12 19V5"></path></svg>"#,
  r#"<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 11v6"></path><path d="M14 11v6"></path><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"></path><path d="M3 6h18"></path><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>"#,
  r#"<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3.5" width="12" height="3.5" rx="1"></rect><rect x="8" y="10.25" width="13" height="3.5" rx="1"></rect><rect x="3" y="17" width="9" height="3.5" rx="1"></rect></svg>"#,
  r#"<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="5" height="18" rx="1"></rect><path d="M3 9h5"></path><path d="M3 15h5"></path><path d="M11.5 6H16"></path><path d="M14 12h6"></path><path d="M11.5 18H15"></path></svg>"#,
  r#"<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13v4"></path><path d="M14 13v4"></path><path d="M18 13v4"></path><path d="M2 13h20"></path><path d="M22 11.5A3.5 3.5 0 0018.5 8a3.52 3.52 0 01-3.173-2A7 7 0 002 9v10a2 2 0 002 2h16a2 2 0 002-2z"></path><path d="M6 13v4"></path></svg>"#,
  r#"<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v9.5"></path><path d="M9.6 12.2 7.4 9.8c-1.4.4-2.1 1.7-1.7 3.1.3 1 1 1.5 1 2.4 0 1.1-1.4 1.8-1.4 3.4 0 1.9 1.9 3.3 4.2 3.3h5c2.3 0 4.2-1.4 4.2-3.3 0-1.6-1.4-2.3-1.4-3.4 0-.9.7-1.4 1-2.4.4-1.4-.3-2.7-1.7-3.1l-2.2 2.4"></path><path d="M10 15.5h4"></path><path d="M10 18.5h4"></path></svg>"#,
  r#"<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2.5v5"></path><path d="M11.3 7.5c-1.7 0-2.3 1.4-1.8 2.7.3.9 1.1 1.2 1.1 1.9s-1.9 1.1-1.9 3.4c0 2.3 1.7 3.9 4.3 3.9s4.3-1.6 4.3-3.9c0-2.3-1.9-2.7-1.9-3.4s.8-1 1.1-1.9c.5-1.3-.1-2.7-1.8-2.7z"></path><path d="M11.6 14.2v2"></path><path d="M14.4 14.2v2"></path><path d="M4 21.5 6.5 3"></path></svg>"#,
  r#"Sus4"#,
  r#"Maj7"#,
  r#"Min7"#,
  r#"<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 19a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1v-6a1 1 0 0 1 1-1h3.293a.707.707 0 0 0 .5-1.207l-7.086-7.086a1 1 0 0 0-1.414 0l-7.086 7.086a.707.707 0 0 0 .5 1.207H8a1 1 0 0 1 1 1z"></path></svg>"#,
  r#"<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 19-7-7 7-7"></path><path d="M19 12H5"></path></svg>"#,
  r#"<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14"></path><path d="m19 12-7 7-7-7"></path></svg>"#,
  r#"<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path></svg>"#,
  r#"<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="7" height="7" x="3" y="3" rx="1"></rect><rect width="7" height="7" x="14" y="3" rx="1"></rect><rect width="7" height="7" x="14" y="14" rx="1"></rect><rect width="7" height="7" x="3" y="14" rx="1"></rect></svg>"#,
  r#"<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="4.5" cy="6" r="2" fill="currentColor" stroke="none"></circle><circle cx="9.5" cy="6" r="2" fill="currentColor" stroke="none"></circle><circle cx="14.5" cy="6" r="2" fill="currentColor" stroke="none"></circle><circle cx="19.5" cy="6" r="2" fill="currentColor" stroke="none"></circle><path d="M4.5 12h.01"></path><circle cx="9.5" cy="12" r="2" fill="currentColor" stroke="none"></circle><path d="M14.5 12h.01"></path><circle cx="19.5" cy="12" r="2" fill="currentColor" stroke="none"></circle><circle cx="4.5" cy="18" r="2" fill="currentColor" stroke="none"></circle><path d="M9.5 18h.01"></path><circle cx="14.5" cy="18" r="2" fill="currentColor" stroke="none"></circle><path d="M19.5 18h.01"></path></svg>"#,
  r#"<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="14" r="6"></circle><circle cx="9" cy="14" r="1.5"></circle><path d="m5 19-2 3M13 19l2 3"></path><path d="M14 4.5c2.5-1.3 5.5-1.3 8 0"></path><path d="M18 4v18"></path></svg>"#,
  r#"<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="7" rx="10" ry="4"></ellipse><path d="M2 7v10a10 4 0 0 0 20 0V7"></path><path d="M5 15c1.2-2 2.3-2 3.5 0s2.3 2 3.5 0 2.3-2 3.5 0 2.3 2 3.5 0"></path></svg>"#,
  r#"<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="4.5" cy="12" rx="1.8" ry="4.5"></ellipse><ellipse cx="19.5" cy="12" rx="1.5" ry="3.8"></ellipse><path d="M4.5 7.5c5-1.4 10-1.4 15 .7"></path><path d="M4.5 16.5c5 1.4 10 1.4 15-.7"></path><path d="m7.5 7.6 2.5 8.8 2.5-8.8 2.5 8.8 2.5-8.6"></path></svg>"#,
  r#"7"#,
  r#"Min"#,
  r#"Maj"#,
];

pub const KEYBOARD_MUSIC: &str = r#"<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"></rect><path d="M6 8h4"></path><path d="M14 8h.01"></path><path d="M18 8h.01"></path><path d="M2 12h20"></path><path d="M6 12v4"></path><path d="M10 12v4"></path><path d="M14 12v4"></path><path d="M18 12v4"></path></svg>"#;
pub const MOON: &str = r#"<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401"></path></svg>"#;
pub const SUN: &str = r#"<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"></circle><path d="M12 2v2"></path><path d="M12 20v2"></path><path d="m4.93 4.93 1.41 1.41"></path><path d="m17.66 17.66 1.41 1.41"></path><path d="M2 12h2"></path><path d="M20 12h2"></path><path d="m6.34 17.66-1.41 1.41"></path><path d="m19.07 4.93-1.41 1.41"></path></svg>"#;

/// Lucide icons for the Debug panel and the docs, as their inner markup;
/// [`crate::ui::icon`] wraps one in its `<svg>` with a class.
pub const ARROW_LEFT: (&str, &str) = (
  "arrow-left",
  r#"<path d="m12 19-7-7 7-7"></path><path d="M19 12H5"></path>"#,
);
pub const CHECK: (&str, &str) = ("check", r#"<path d="M20 6 9 17l-5-5"></path>"#);
pub const CHEVRON_RIGHT: (&str, &str) = ("chevron-right", r#"<path d="m9 18 6-6-6-6"></path>"#);
pub const CHEVRONS_DOWN_UP: (&str, &str) = (
  "chevrons-down-up",
  r#"<path d="m7 20 5-5 5 5"></path><path d="m7 4 5 5 5-5"></path>"#,
);
pub const CHEVRONS_UP_DOWN: (&str, &str) = (
  "chevrons-up-down",
  r#"<path d="m7 15 5 5 5-5"></path><path d="m7 9 5-5 5 5"></path>"#,
);
pub const COPY: (&str, &str) = (
  "copy",
  r#"<rect width="14" height="14" x="8" y="8" rx="2" ry="2"></rect><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"></path>"#,
);
pub const FILE_TEXT: (&str, &str) = (
  "file-text",
  r#"<path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z"></path><path d="M14 2v5a1 1 0 0 0 1 1h5"></path><path d="M10 9H8"></path><path d="M16 13H8"></path><path d="M16 17H8"></path>"#,
);
pub const MENU: (&str, &str) = (
  "menu",
  r#"<path d="M4 5h16"></path><path d="M4 12h16"></path><path d="M4 19h16"></path>"#,
);
pub const X: (&str, &str) = (
  "x",
  r#"<path d="M18 6 6 18"></path><path d="m6 6 12 12"></path>"#,
);
