// Reveal content only inside its own scrollport. Native scrollIntoView also
// scrolls hidden ancestors and can displace the entire installed application.
export function revealInScrollArea(element, { block = "nearest", behavior = "auto" } = {}) {
    if (!element) return false;
    let area = element.parentElement;
    while (area && area !== document.body && area !== document.documentElement) {
        const style = getComputedStyle(area);
        if (/(auto|scroll)/.test(style.overflowY) && area.scrollHeight > area.clientHeight) break;
        area = area.parentElement;
    }
    if (!area || area === document.body || area === document.documentElement) return false;
    const bounds = area.getBoundingClientRect(), target = element.getBoundingClientRect();
    const style = getComputedStyle(area);
    const top = bounds.top + area.clientTop + (parseFloat(style.scrollPaddingTop) || parseFloat(style.paddingTop) || 0);
    const bottom = bounds.top + area.clientTop + area.clientHeight - (parseFloat(style.scrollPaddingBottom) || parseFloat(style.paddingBottom) || 0);
    const delta = block === "start" || target.height > bottom - top || target.top < top
        ? target.top - top : target.bottom > bottom ? target.bottom - bottom : 0;
    if (delta) area.scrollTo({ top: area.scrollTop + delta, behavior });
    return true;
}
