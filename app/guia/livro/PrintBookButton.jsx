"use client";

export default function PrintBookButton() {
    return <button className="book-print-button" type="button" onClick={() => window.print()}>Imprimir ou salvar em PDF</button>;
}
