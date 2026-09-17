import { rollDie, secureRandomId } from "./random.js";
import { getFumbleSuggestion, rollAttributeTest, rollPercentTest } from "./rpgRules.js";
import { normalizeRollHistory } from "./rollHistory.js";

export const LOCAL_ROLL_PREFIX = "myowndex_local_roll_v2:";
export const LOCAL_ROLL_LIMIT = 100;
export const LOCAL_ROLL_MODES = { normal: "Normal", advantage: "Vantagem", disadvantage: "Desvantagem" };
export const LOCAL_DICE_SIDES = [4, 6, 8, 10, 12, 20, 100];
const integer = (value, min, max, name) => {
    if (!["number", "string"].includes(typeof value) || String(value).trim() === "" || !Number.isInteger(Number(value)) || Number(value) < min || Number(value) > max) throw new RangeError(`${name}: use um número inteiro entre ${min} e ${max}.`);
    return Number(value);
};
export function localRollSpec(input = {}) {
    const kind = input.kind || "attribute";
    if (!["attribute", "percent", "free"].includes(kind)) throw new RangeError("Escolha um tipo de rolagem válido.");
    const mode = input.mode || "normal";
    if (!Object.hasOwn(LOCAL_ROLL_MODES, mode)) throw new RangeError("Escolha um modo de rolagem válido.");
    const common = { kind, mode: kind === "free" ? "normal" : mode, label: String(input.label || "").trim().slice(0, 80) };
    if (kind === "percent") return { ...common, chance: integer(input.chance ?? 50, 0, 100, "Chance") };
    if (kind === "free") {
        const sides = integer(input.sides ?? 6, 4, 100, "Faces");
        if (!LOCAL_DICE_SIDES.includes(sides)) throw new RangeError("Escolha d4, d6, d8, d10, d12, d20 ou d100.");
        return { ...common, sides, quantity: integer(input.quantity ?? 1, 1, 20, "Quantidade"), modifier: integer(input.modifier ?? 0, -99999, 99999, "Modificador") };
    }
    return { ...common, attribute: integer(input.attribute ?? 0, -99999, 99999, "Atributo"), opposition: input.opposition === "" || input.opposition == null ? null : integer(input.opposition, -99999, 99999, "Dificuldade") };
}
export function localRollOdds(input) {
    const spec = localRollSpec(input);
    if (spec.kind === "free") return { minimum: spec.quantity + spec.modifier, maximum: spec.quantity * spec.sides + spec.modifier };
    if (spec.kind === "percent") {
        const p = spec.chance / 100;
        return { success: spec.mode === "advantage" ? 1 - (1-p)**2 : spec.mode === "disadvantage" ? p*p : p };
    }
    let outcomes = 0, successes = 0, criticals = 0, fumbles = 0;
    for (let a=1; a<=6; a++) for (let b=1; b<=6; b++) for (let c=1; c<=(spec.mode === "normal" ? 1 : 6); c++) {
        const values = spec.mode === "normal" ? [a,b] : [a,b,c].sort((x,y)=>x-y);
        const kept = spec.mode === "advantage" ? values.slice(-2) : values.slice(0,2);
        outcomes++;
        if (kept[0]+kept[1]+spec.attribute > spec.opposition) successes++;
        if (kept.every(v=>v===6)) criticals++;
        if (kept.every(v=>v===1)) fumbles++;
    }
    return { success: spec.opposition === null ? null : successes/outcomes, critical: criticals/outcomes, fumble: fumbles/outcomes };
}
export function performLocalRoll(input, options = {}) {
    const spec = localRollSpec(input);
    // Validate before consuming entropy. The immutable receipt is complete before
    // persistence or animation; neither can reroll an outcome.
    const id = options.id ?? secureRandomId("local-roll");
    const createdAt = options.createdAt ?? Date.now();
    const random = options.random;
    let result;
    if (spec.kind === "attribute") {
        const test = rollAttributeTest({ ...spec, random });
        result = { values: test.dice, kept: test.kept, total: test.total, success: test.success, critical: test.critical, fumble: test.fumble, margin: test.margin };
        if (test.fumble) result.suggestion = getFumbleSuggestion(random);
    } else if (spec.kind === "percent") {
        const test = rollPercentTest({ ...spec, random });
        result = { values: test.rolls, kept: [test.result], total: test.result, success: test.success };
    } else {
        const values = Array.from({length:spec.quantity},()=>rollDie(spec.sides, random));
        result = { values, kept: [...values], total: values.reduce((a,b)=>a+b,0)+spec.modifier, success:null };
    }
    return Object.freeze({ version:2, id, createdAt, context:options.context === "aventura" ? "aventura" : "guia", spec:Object.freeze(spec), ...result, values:Object.freeze(result.values), kept:Object.freeze(result.kept) });
}
const sortRecords = (a,b) => b.createdAt-a.createdAt || b.id.localeCompare(a.id);
export function mergeLocalRolls(...histories) {
    const unique = new Map();
    for (const entry of histories.flat()) if (entry?.id && !unique.has(entry.id)) unique.set(entry.id, entry);
    return [...unique.values()].sort(sortRecords).slice(0,LOCAL_ROLL_LIMIT);
}
function validReceipt(value) {
    try {
        if (!value || value.version !== 2 || typeof value.id !== "string" || !/^[a-zA-Z0-9_-]{1,120}$/.test(value.id) || !Number.isSafeInteger(value.createdAt) || value.createdAt < 0 || value.createdAt > 8640000000000000 || !value.spec) return null;
        const spec = localRollSpec(value.spec);
        const sides = spec.kind === "attribute" ? 6 : spec.kind === "percent" ? 100 : spec.sides;
        const count = spec.kind === "attribute" ? spec.mode === "normal" ? 2 : 3 : spec.kind === "percent" ? spec.mode === "normal" ? 1 : 2 : spec.quantity;
        if (!Array.isArray(value.values) || value.values.length !== count || !value.values.every(v=>Number.isInteger(v) && v>=1 && v<=sides)) return null;
        const ordered = [...value.values].sort((a,b)=>a-b);
        const kept = spec.kind === "attribute" ? spec.mode === "advantage" ? ordered.slice(-2) : spec.mode === "disadvantage" ? ordered.slice(0,2) : value.values : spec.kind === "percent" ? [spec.mode === "disadvantage" ? Math.max(...value.values) : Math.min(...value.values)] : value.values;
        const total = kept.reduce((a,b)=>a+b,0)+(spec.attribute ?? spec.modifier ?? 0);
        if (total !== value.total || JSON.stringify(kept) !== JSON.stringify(value.kept)) return null;
        const success = spec.kind === "percent" ? total <= spec.chance : spec.kind === "attribute" && spec.opposition !== null ? total > spec.opposition : null;
        if (value.success !== success) return null;
        if (spec.kind === "attribute" && (value.critical !== kept.every(v=>v===6) || value.fumble !== kept.every(v=>v===1))) return null;
        return Object.freeze({ version:2, id:value.id, createdAt:value.createdAt, spec:Object.freeze(spec), values:Object.freeze([...value.values]), kept:Object.freeze([...kept]), total, success, critical:spec.kind === "attribute" && kept.every(v=>v===6), fumble:spec.kind === "attribute" && kept.every(v=>v===1), margin:spec.kind === "attribute" && spec.opposition !== null ? total-spec.opposition : null, context:value.context === "aventura" ? "aventura" : "guia", suggestion:spec.kind === "attribute" && value.fumble ? String(value.suggestion || "").slice(0,300) : "" });
    } catch { return null; }
}
function browserStorage() { try { return typeof window === "undefined" ? null : window.localStorage; } catch { return null; } }
export function readLocalRolls(storage = browserStorage()) {
    const entries = [];
    if (!storage) return entries;
    try {
        for (let i=0; i<storage.length; i++) {
            const key = storage.key(i);
            if (!key?.startsWith(LOCAL_ROLL_PREFIX)) continue;
            try { const value = validReceipt(JSON.parse(storage.getItem(key))); if (value) entries.push(value); } catch { /* An invalid record never changes a valid outcome. */ }
        }
        const legacy = normalizeRollHistory(JSON.parse(storage.getItem("myowndex_guide_roll_history_v1") || "[]"));
        for (const value of legacy) entries.push({ ...value, legacy:true, total:value.result, spec:{kind:value.kind,mode:value.mode,label:value.label}, context:value.context });
    } catch { /* Keep every record already recovered if storage becomes unavailable. */ }
    return mergeLocalRolls(entries);
}
export function saveLocalRoll(record, storage = browserStorage()) {
    if (!storage || !validReceipt(record)) return false;
    try {
        const key = LOCAL_ROLL_PREFIX+record.id;
        const existing = storage.getItem(key);
        if (existing !== null) return JSON.stringify(JSON.parse(existing)) === JSON.stringify(record);
        // One key per receipt prevents two open tabs from overwriting each other.
        storage.setItem(key,JSON.stringify(record));
        try {
            const keys=[];
            for (let i=0;i<storage.length;i++) { const k=storage.key(i); if(k?.startsWith(LOCAL_ROLL_PREFIX)) keys.push(k); }
            if (keys.length>LOCAL_ROLL_LIMIT) {
                const keep = new Set(readLocalRolls(storage).filter(r=>!r.legacy).map(r=>LOCAL_ROLL_PREFIX+r.id));
                for(const k of keys) if(!keep.has(k)) storage.removeItem(k);
            }
        } catch { /* Cleanup failure does not invalidate an already saved result. */ }
        return true;
    } catch { return false; }
}
export function clearLocalRolls(storage = browserStorage()) {
    if (!storage) return false;
    try {
        const keys=[];
        for(let i=0;i<storage.length;i++) {
            const key=storage.key(i);
            if(key?.startsWith(LOCAL_ROLL_PREFIX)) keys.push(key);
        }
        for(const key of keys) storage.removeItem(key);
        storage.removeItem("myowndex_guide_roll_history_v1");
        return true;
    } catch { return false; }
}
export function localRollText(record) {
    if (record.legacy) return `${record.label}: ${record.values.join(" + ")} · ${record.detail}`;
    const { spec } = record;
    const modifier = spec.attribute ?? spec.modifier ?? 0;
    const equation = `${record.kept.join(" + ")}${modifier ? modifier < 0 ? ` − ${Math.abs(modifier)}` : ` + ${modifier}` : ""} = ${record.total}`;
    const kind = spec.kind === "free" ? `${spec.quantity}d${spec.sides}` : spec.kind === "percent" ? "d100" : spec.mode === "normal" ? "2d6" : "3d6";
    const verdict = record.critical ? " · Crítico potencial" : record.fumble ? " · Erro crítico" : "";
    const target = spec.kind === "percent" ? ` · chance ${spec.chance}%` : spec.opposition !== null && spec.opposition !== undefined ? ` · dificuldade ${spec.opposition} (é preciso superar)` : "";
    return `${spec.label ? spec.label+" · " : ""}${kind} · ${LOCAL_ROLL_MODES[spec.mode]}\nDados: ${record.values.join(" • ")}\nCálculo: ${equation}${target}${record.success === null ? "" : record.success ? " · Sucesso" : " · Falha"}${verdict}${record.suggestion ? `\nSugestão: ${record.suggestion}` : ""}\n${new Date(record.createdAt).toISOString()} · ${record.id} · ${record.context} · Rolagem local`;
}
export function localRollEvent(record) {
    const {spec}=record;
    return { rollId:record.id, rolledAt:record.createdAt, label:spec.label || (spec.kind === "free" ? `${spec.quantity}d${spec.sides}` : spec.kind === "percent" ? "teste percentual" : "teste de atributo"), mode:spec.mode, result:record.total, ...(spec.kind === "percent" ? {rolls:record.values,chance:spec.chance} : {dice:record.values,kept:record.kept,attribute:spec.attribute ?? spec.modifier ?? 0}), success:record.success, critical:Boolean(record.critical), fumble:Boolean(record.fumble) };
}
