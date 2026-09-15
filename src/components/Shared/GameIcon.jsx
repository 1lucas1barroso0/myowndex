import React from "react";

const paths = {
    adventure: <><path d="m12 3 8 5v8l-8 5-8-5V8Z" /><path d="m15.5 8.5-2 5-5 2 2-5Z" /></>,
    dex: <><rect x="5" y="3" width="14" height="18" rx="3" /><path d="M5 8h14M9 12h6M9 16h3" /><circle cx="9" cy="5.5" r=".5" /></>,
    pc: <><rect x="3" y="4" width="18" height="13" rx="2" /><path d="M8 21h8M12 17v4M8 9h3v3H8zM14 9h2" /></>,
    guide: <><path d="M12 5c-3-2-6-2-9-1v15c3-1 6-1 9 1 3-2 6-2 9-1V4c-3-1-6-1-9 1ZM12 5v15" /><path d="M6 8h3M6 12h3M15 8h3M15 12h3" /></>,
    star: <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z" />,
};

export default function GameIcon({ name, className = "" }) {
    return <svg className={`game-icon ${className}`} aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{paths[name] || paths.adventure}</svg>;
}
