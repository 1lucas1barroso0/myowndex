"use client";

export default function PrintBookButton() {
    const print = () => {
        const closed = [...document.querySelectorAll(".book-reader details:not([open])")];
        closed.forEach(detail => { detail.open = true; });
        const restore = () => {
            closed.forEach(detail => { detail.open = false; });
            window.removeEventListener("afterprint", restore);
        };
        window.addEventListener("afterprint", restore, { once: true });
        window.print();
    };
    return <button className="book-print-button" type="button" onClick={print}>Imprimir ou salvar em PDF</button>;
}
