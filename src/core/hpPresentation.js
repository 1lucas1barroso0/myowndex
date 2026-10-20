// One reading for cards and battle panels; this never changes stored HP.
export function getHpReading(current, maximum) {
    const max = Number.isFinite(Number(maximum)) ? Math.max(1, Math.floor(Number(maximum))) : 1;
    const value = current == null ? max : Number(current);
    const now = Number.isFinite(value) ? Math.max(0, Math.min(max, Math.floor(value))) : max;
    const ratio = now / max;
    return { now, max, percent: ratio * 100, tone: ratio <= .25 ? "danger" : ratio <= .5 ? "warning" : "healthy" };
}
