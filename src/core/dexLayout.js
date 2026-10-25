/** Complete real rows, keeping only a viewport and one reserve row ahead. */
export function dexWindowSize({ columns, rowHeight, viewportHeight, current = 0, total }) {
    const count = Math.max(1, Math.floor(columns) || 1);
    const rows = Math.max(2, Math.ceil(Math.max(0, viewportHeight) / Math.max(1, rowHeight)) + 1);
    return Math.min(total, Math.ceil(Math.max(current, count * rows) / count) * count);
}
