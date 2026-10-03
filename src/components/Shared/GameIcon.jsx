import React from "react";

const paths = {
    dice: <><rect x="4" y="4" width="16" height="16" rx="2" /><circle cx="8" cy="8" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="16" cy="16" r="1" /></>,
    generator: <><path d="M12 4v16M4 12h16M6 6l12 12M18 6 6 18" /><path d="M12 2v2M22 12h-2M12 22v-2M2 12h2" /></>,
    adventure: <><path d="m12 3 8 5v8l-8 5-8-5V8Z" /><path d="m15.5 8.5-2 5-5 2 2-5Z" /></>,
    dex: <><rect x="5" y="3" width="14" height="18" /><path d="M5 8h14M9 12h6M9 16h3M8 5.5h2" /></>,
    pc: <><rect x="3" y="4" width="18" height="13" /><path d="M8 21h8M12 17v4M8 9h3v3H8zM14 9h2" /></>,
    guide: <><path d="M12 5c-3-2-6-2-9-1v15c3-1 6-1 9 1 3-2 6-2 9-1V4c-3-1-6-1-9 1ZM12 5v15" /><path d="M6 8h3M6 12h3M15 8h3M15 12h3" /></>,
    star: <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z" />,
    sun: <><path d="M9 9h6v6H9zM12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2" /></>,
    moon: <path d="M11 3H7v3H4v12h3v3h10v-3h3v-4h-6v-3h-3Z" />,
    types: <><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9Z" /><path d="m12 8 4 2.5v5L12 18l-4-2.5v-5ZM12 3v5M20 16.5l-4-1M4 16.5l4-1" /></>,
    move: <><path d="m14 3-8 10h6l-2 8 9-11h-6Z" /><path d="M3 6h4M2 10h3M18 18h3" /></>,
};

export default function GameIcon({ name, className = "" }) {
    return <svg className={`game-icon ${className}`} aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter">{paths[name] || paths.adventure}</svg>;
}
