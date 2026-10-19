import React, { useId, useMemo, useState } from "react";

const normalize = value => String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[-_]+/g, " ").trim();

/** Inline choices keep the next field and the mobile keyboard available. */
export default function CatalogInput({ id, value, options, suggestionsLabel, onChange, onKeyDown, className }) {
    const listId = useId();
    const [expanded, setExpanded] = useState(false);
    const [active, setActive] = useState(-1);
    const catalog = useMemo(() => options.map(option => ({ ...option, search: normalize(`${option.value} ${option.label}`) })), [options]);
    const query = normalize(value);
    const matches = query.length >= 2 && !catalog.some(option => normalize(option.value) === query)
        ? catalog.filter(option => option.search.includes(query)).slice(0, 5) : [];
    const visible = expanded && matches.length > 0;
    const choose = option => { onChange(option.value); setExpanded(false); setActive(-1); };
    return <div className="catalog-input" onBlur={event => {
        if (!event.currentTarget.contains(event.relatedTarget)) { setExpanded(false); setActive(-1); }
    }}>
        <input id={id} className={className} value={value} autoComplete="off" autoCorrect="off" spellCheck={false}
            role="combobox" aria-autocomplete="list" aria-expanded={visible}
            aria-controls={visible ? listId : undefined}
            aria-activedescendant={visible && active >= 0 ? `${listId}-${active}` : undefined}
            onFocus={() => setExpanded(true)}
            onChange={event => { onChange(event.target.value); setExpanded(true); setActive(-1); }}
            onKeyDown={event => {
                if (matches.length && ["ArrowDown", "ArrowUp"].includes(event.key)) {
                    event.preventDefault(); setExpanded(true);
                    setActive(index => event.key === "ArrowDown" ? (index + 1) % matches.length : (index <= 0 ? matches.length - 1 : index - 1));
                    return;
                }
                if (visible && event.key === "Escape") {
                    event.preventDefault(); event.stopPropagation(); setExpanded(false); setActive(-1); return;
                }
                if (visible && active >= 0 && event.key === "Enter") { event.preventDefault(); choose(matches[active]); return; }
                onKeyDown?.(event);
            }} />
        {visible && <div id={listId} role="listbox" aria-label={suggestionsLabel} className="catalog-input-options">
            {matches.map((option, index) => <button key={option.value} id={`${listId}-${index}`} type="button" role="option"
                aria-selected={index === active} tabIndex={-1}
                onPointerDown={event => event.preventDefault()} onClick={() => choose(option)}>{option.label}</button>)}
        </div>}
    </div>;
}
