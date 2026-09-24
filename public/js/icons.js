/* JARVIS — jeu d'icônes SVG (aucun emoji dans l'interface) */
(function () {
  const P = {
    chat: '<path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9.6 9.6 0 0 1-3.3-.6L3 21l1.7-4.4A8.3 8.3 0 0 1 3.6 11 8.4 8.4 0 0 1 12 2.6a8.4 8.4 0 0 1 9 8.4z"/>',
    sparkle: '<path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z"/><path d="M18.5 15l.8 2.1 2.2.9-2.2.8-.8 2.2-.9-2.2-2.1-.8 2.1-.9z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
    gear: '<circle cx="12" cy="12" r="3.2"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2V21a2 2 0 1 1-4 0v-.1A1.7 1.7 0 0 0 7 19.3a1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0-1.2-2.9H1a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 2.7 7a1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.7 1.7 0 0 0 8 2.6h.1A2 2 0 0 1 12 1v.1A2 2 0 0 1 14 2.6a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.9l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0 1.2 2.9h.1a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" transform="translate(2 2) scale(0.83)"/>',
    mic: '<path d="M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3z"/><path d="M19 11a7 7 0 0 1-14 0"/><path d="M12 18v3"/>',
    camera: '<rect x="2" y="6" width="14" height="12" rx="2.5"/><path d="M16 11l6-3.5v9L16 13z"/>',
    send: '<path d="M12 19V5"/><path d="M5.5 11.5L12 5l6.5 6.5"/>',
    clip: '<path d="M20.5 12.5l-7.8 7.8a4.6 4.6 0 0 1-6.5-6.5l8-8a3 3 0 0 1 4.3 4.3l-7.9 7.9a1.5 1.5 0 0 1-2.1-2.1l7.2-7.2"/>',
    image: '<rect x="3" y="4" width="18" height="16" rx="2.5"/><circle cx="8.5" cy="9.5" r="1.6"/><path d="M21 16l-5-5-9 9"/>',
    film: '<rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="M8 4v16M16 4v16M3 9h5M3 15h5M16 9h5M16 15h5"/>',
    layers: '<path d="M12 3l8.5 4.7L12 12.4 3.5 7.7z"/><path d="M3.5 12.3L12 17l8.5-4.7"/><path d="M3.5 16.6L12 21.3l8.5-4.7"/>',
    scale: '<path d="M12 4v16"/><path d="M7 20h10"/><path d="M5 8l-3 6h6z"/><path d="M19 8l-3 6h6z"/><path d="M5 8l7-2 7 2"/>',
    code: '<path d="M9 18l-6-6 6-6"/><path d="M15 6l6 6-6 6"/>',
    shield: '<path d="M12 3l7 3v6c0 4.3-2.9 7.6-7 9-4.1-1.4-7-4.7-7-9V6z"/><path d="M9.5 12.5l1.8 1.8 3.4-3.6"/>',
    offline: '<path d="M3 3l18 18"/><path d="M5 12.5a9.8 9.8 0 0 1 4.2-2.3"/><path d="M19 12.5a9.8 9.8 0 0 0-3.2-2"/><path d="M8.5 16a4.6 4.6 0 0 1 5.6-.3"/><path d="M12 20h.01"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7.5V12l3.2 2"/>',
    brain: '<path d="M9.5 3A3.5 3.5 0 0 0 6 6.5 3.5 3.5 0 0 0 4 12a3.5 3.5 0 0 0 2 6.5A3.5 3.5 0 0 0 9.5 21c1 0 2-.4 2.5-1.1V4.1A3.4 3.4 0 0 0 9.5 3z"/><path d="M14.5 3A3.5 3.5 0 0 1 18 6.5 3.5 3.5 0 0 1 20 12a3.5 3.5 0 0 1-2 6.5A3.5 3.5 0 0 1 14.5 21c-1 0-2-.4-2.5-1.1"/>',
    terminal: '<rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="M7.5 9.5l2.5 2.5-2.5 2.5"/><path d="M12.5 15h4"/>',
    plug: '<path d="M9 3v6M15 3v6"/><path d="M6 9h12v3a6 6 0 0 1-12 0z"/><path d="M12 18v3"/>',
    user: '<circle cx="12" cy="8.5" r="3.5"/><path d="M5 20a7 7 0 0 1 14 0"/>',
    logout: '<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3"/><path d="M10 8l-4 4 4 4"/><path d="M6 12h9"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    chevron: '<path d="M6 9.5l6 6 6-6"/>',
    check: '<path d="M5 13l4.5 4.5L19 7"/>',
    trash: '<path d="M4 7h16"/><path d="M9 7V4.8A1.8 1.8 0 0 1 10.8 3h2.4A1.8 1.8 0 0 1 15 4.8V7"/><path d="M6 7l1 13a2 2 0 0 0 2 1.8h6A2 2 0 0 0 17 20l1-13"/>',
    pencil: '<path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17z"/><path d="M14.5 6.5l3 3"/>',
    copy: '<rect x="9" y="9" width="12" height="12" rx="2.5"/><path d="M6 15H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1"/>',
    volume: '<path d="M11 5L6.5 9H3v6h3.5L11 19z"/><path d="M15.5 9.5a4 4 0 0 1 0 5"/><path d="M18 7a7.5 7.5 0 0 1 0 10"/>',
    refresh: '<path d="M20 12a8 8 0 1 1-2.6-5.9"/><path d="M20 4v4.5h-4.5"/>',
    download: '<path d="M12 4v11"/><path d="M7.5 10.5L12 15l4.5-4.5"/><path d="M5 20h14"/>',
    warning: '<path d="M12 4l9 16H3z"/><path d="M12 10v4.5"/><path d="M12 17.5h.01"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3.5 9.5h17M3.5 14.5h17"/><path d="M12 3c2.6 3 2.6 15 0 18M12 3c-2.6 3-2.6 15 0 18"/>',
    sliders: '<path d="M6 4v6M6 14v6M12 4v10M12 18v2M18 4v2M18 10v10"/><circle cx="6" cy="12" r="2"/><circle cx="12" cy="16" r="2"/><circle cx="18" cy="8" r="2"/>',
    palette: '<path d="M12 3a9 9 0 1 0 0 18c1.4 0 2-.9 2-1.8 0-1.6-1.5-1.7-1.5-3 0-.9.7-1.7 1.8-1.7H17a4 4 0 0 0 4-4c0-4.1-4-7.5-9-7.5z"/><circle cx="8" cy="10" r="1.2"/><circle cx="12" cy="7.5" r="1.2"/><circle cx="16" cy="10" r="1.2"/>',
    cpu: '<rect x="7" y="7" width="10" height="10" rx="2.5"/><path d="M11 3v3M13 3v3M11 18v3M13 18v3M3 11h3M3 13h3M18 11h3M18 13h3"/>',
    folder: '<path d="M3 7.5A2.5 2.5 0 0 1 5.5 5h3l2 2.5h8A2.5 2.5 0 0 1 21 10v7.5A2.5 2.5 0 0 1 18.5 20h-13A2.5 2.5 0 0 1 3 17.5z"/>',
    link: '<path d="M10 13.5a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10.5a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    bolt: '<path d="M13 3L5 13.5h5l-1 7.5 8-10.5h-5z"/>',
    stop: '<rect x="7" y="7" width="10" height="10" rx="2"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    panel: '<rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="M15 4v16"/>',
    monitor: '<rect x="3" y="4" width="18" height="12.5" rx="2.5"/><path d="M8 20h8M12 16.5V20"/>',
    grid: '<rect x="4" y="4" width="6.5" height="6.5" rx="1.6"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.6"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.6"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.6"/>',
    robot: '<rect x="4.5" y="7.5" width="15" height="11" rx="3"/><path d="M12 3v4.5"/><circle cx="9" cy="13" r="1.3"/><circle cx="15" cy="13" r="1.3"/><path d="M9.5 16.5h5"/>',
    eye: '<path d="M2.5 12S6 6.5 12 6.5 21.5 12 21.5 12 18 17.5 12 17.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/>',
    book: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H19v15.5H6.5A2.5 2.5 0 0 0 4 21z"/><path d="M4 18.5A2.5 2.5 0 0 1 6.5 16H19"/>',
    downloadCloud: '<path d="M6 17a4 4 0 0 1 .6-8A5.5 5.5 0 0 1 17 9.5a3.8 3.8 0 0 1 .4 7.5"/><path d="M12 12v7"/><path d="M9 16.5l3 3 3-3"/>',
    loader: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8"/>',
    circle: '<circle cx="12" cy="12" r="9"/>',
    key: '<circle cx="8.5" cy="15.5" r="4"/><path d="M11.5 12.5L20 4M17 4h3.5v3.5"/>',
    wand: '<path d="M4 20l9-9"/><path d="M14 3l1 3 3 1-3 1-1 3-1-3-3-1 3-1z"/><path d="M19 15l.6 1.8 1.8.6-1.8.6-.6 1.8-.6-1.8-1.8-.6 1.8-.6z"/>',
  };
  function ico(name, size = 18, cls = '') {
    const d = P[name] || P.chat;
    return `<svg class="ic ${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  }
  function el(name, size = 18, cls = '') {
    const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('viewBox', '0 0 24 24');
    s.setAttribute('width', size); s.setAttribute('height', size);
    s.setAttribute('fill', 'none'); s.setAttribute('stroke', 'currentColor');
    s.setAttribute('stroke-width', '1.7'); s.setAttribute('stroke-linecap', 'round'); s.setAttribute('stroke-linejoin', 'round');
    s.setAttribute('class', 'ic ' + cls);
    s.innerHTML = P[name] || P.chat;
    return s;
  }
  window.J.ico = ico;
  window.J.icon = el;
  window.ICONS = Object.keys(P);
})();
