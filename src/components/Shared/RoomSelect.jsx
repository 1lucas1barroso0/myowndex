import React, { Children, Fragment } from "react";

const getOptions = children => Children.toArray(children).flatMap(child => child?.type === "optgroup" || child?.type === Fragment
    ? getOptions(child.props.children)
    : [child]);

/** Keeps the platform picker and keyboard behavior while letting its value wrap. */
export default function RoomSelect({ children, value, disabled, className = "", wrapperClassName = "", ...props }) {
    const options = getOptions(children);
    const selected = options.find(option => option?.type === "option"
        && String(option.props.value ?? option.props.children) === String(value));
    const label = selected?.props.children ?? "Selecione uma opção";

    return (
        <span className={`room-select${disabled ? " is-disabled" : ""}${wrapperClassName ? ` ${wrapperClassName}` : ""}`}>
            <span className="room-select-value" aria-hidden="true">{label}</span>
            <svg className="room-select-chevron" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="m4 6 4 4 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <select {...props} value={value} disabled={disabled} className={className}>{children}</select>
        </span>
    );
}
