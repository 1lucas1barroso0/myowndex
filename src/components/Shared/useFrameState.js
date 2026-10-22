import { useEffect, useMemo, useState } from "react";
import { createFrameQueue } from "../../core/frameQueue.js";

// Keep every pointer event in refs; paint only its latest visual preview.
export default function useFrameState(initialValue) {
    const [value, setValue] = useState(initialValue);
    const queue = useMemo(() => createFrameQueue({
        publish: setValue,
        request: callback => requestAnimationFrame(callback),
        cancel: id => cancelAnimationFrame(id),
    }), []);
    useEffect(() => () => queue.cancel(), [queue]);
    return [value, queue.set, queue.schedule];
}
