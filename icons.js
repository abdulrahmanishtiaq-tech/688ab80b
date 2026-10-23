(function () {
  const paths = {
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18M7 14h3M14 14h3M7 18h3"/>',
    gift: '<path d="M3 10h18v11H3zM12 10v11M2 10h20v-4H2z"/><path d="M12 6H8.5a2.5 2.5 0 1 1 2.5-2.5L12 6ZM12 6h3.5A2.5 2.5 0 1 0 13 3.5L12 6Z"/>',
    bus: '<path d="M5 17h14l1-7c.2-1.4-.8-3-2.2-3H6.2C4.8 7 3.8 8.6 4 10l1 7ZM3 17h18v3H3zM7 20v2M17 20v2M7 12h.01M17 12h.01"/>',
    spark: '<path d="m12 2 1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8L12 2ZM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16Z"/>',
    rings: '<circle cx="9" cy="12" r="6"/><circle cx="15" cy="12" r="6"/>',
    hotel: '<path d="M4 20V8l8-5 8 5v12M2 21h20M8 20v-5h8v5M9 10h.01M15 10h.01"/>',
    hanger: '<path d="M12 4a2 2 0 1 0-2 2M12 6v3l-8 5c-1.2.8-.6 2 1 2h14c1.6 0 2.2-1.2 1-2l-8-5M6 19h12"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9" r="1.5"/><path d="m3 17 5-5 4 4 3-3 6 5"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    map: '<path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Z"/><path d="M9 3v15M15 6v15"/>',
    heart: '<path d="M20.8 8.8c0 5.4-8.8 10.2-8.8 10.2S3.2 14.2 3.2 8.8A4.8 4.8 0 0 1 12 6a4.8 4.8 0 0 1 8.8 2.8Z"/>',
    question: '<circle cx="12" cy="12" r="9"/><path d="M9.7 9a2.4 2.4 0 1 1 4.1 1.7c-1.2 1.1-1.8 1.3-1.8 2.8M12 17h.01"/>',
    video: '<rect x="3" y="6" width="13" height="12" rx="2"/><path d="m16 10 5-3v10l-5-3M8 10l4 2-4 2v-4Z"/>',
    microphone: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3M8 21h8"/>',
    form: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8 11h8M8 15h5"/>',
    car: '<path d="m5 17 1-5 2-4h8l2 4 1 5M4 17h16v3H4zM7 20v2M17 20v2M7 15h.01M17 15h.01"/>',
    star: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z"/>',
    people: '<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 20a6 6 0 0 1 12 0M15 14a5 5 0 0 1 6 5"/>'
  };
  window.DI = window.DI || {};
  window.DI.icons = {
    svg(name) {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', '0 0 24 24');
      svg.setAttribute('aria-hidden', 'true');
      svg.setAttribute('focusable', 'false');
      svg.innerHTML = paths[name] || paths.spark;
      return svg;
    }
  };
}());
