import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import speciesCatalogue from '../../data/dex-entries.json';
import { formatName, formatPokemonIdentity, formatType, NATURES, STAT_MAP, TYPE_COLORS, TYPE_TEXT_COLORS, TYPES, VERSION_GROUPS, VERSION_LABELS } from '../../core/mechanics.js';
import { generatePokemon, GENERATOR_DRAFT_KEY, getGeneratedHp, normalizeGeneratorOptions } from '../../core/pokemonGenerator.js';
import { getStorageScope, readDurableStorage, readStorage, writeDurableStorage } from '../../core/storage.js';
import { compactPokemon, createTeam, normalizePokemon } from '../../core/team.js';
import { encodePokemonBundle, encodeTeam } from '../../core/teamShare.js';
import RoomSelect from '../Shared/RoomSelect.jsx';
import PokemonSprite from '../Shared/PokemonSprite.jsx';
import PokemonCompanion from '../Shared/PokemonCompanion.jsx';
import ConfirmDialog from '../Shared/ConfirmDialog.jsx';

const normalizeDraft = input => {
    const draft = input || {};
    return (Array.isArray(draft.results) ? draft.results : []).slice(0, 6)
        .filter(entry => entry?.pokemon?.species?.name && typeof entry.versionGroup === 'string')
        .map(entry => ({ ...entry, pokemon: normalizePokemon(entry.pokemon), saved: Boolean(entry.saved), exported: Boolean(entry.exported) }));
};
const readDraft = scope => normalizeDraft(readStorage(GENERATOR_DRAFT_KEY, {}, { scope }));
const serializeDraft = results => ({ schema: 1, results: results.map(entry => ({ ...entry, pokemon: compactPokemon(entry.pokemon) })) });
const draftFingerprint = results => JSON.stringify(serializeDraft(results));
const downloadText = (text, filename) => {
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};
const FOCUSABLE = 'button:not(:disabled), input:not(:disabled), select:not(:disabled), summary, [tabindex="0"]';

export default function GeneratorModal({ onClose, teams = [], experienceMode = 'rpg', onAddPokemon, onAddBox }) {
    const [scope] = useState(getStorageScope);
    const [results, setResults] = useState(() => readDraft(scope));
    const [draftReady, setDraftReady] = useState(false);
    const [options, setOptions] = useState(() => normalizeGeneratorOptions({ experienceMode }));
    const [selected, setSelected] = useState(() => new Set(readDraft(scope).map(entry => entry.pokemon.id)));
    const [target, setTarget] = useState('new');
    const [boxName, setBoxName] = useState('Novo encontro');
    const [busy, setBusy] = useState(false);
    const [saving, setSaving] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [progress, setProgress] = useState({ completed: 0, total: 1 });
    const [notice, setNotice] = useState('');
    const [error, setError] = useState('');
    const [replaceConfirm, setReplaceConfirm] = useState(false);
    const [pendingRemoval, setPendingRemoval] = useState(null);
    const [remoteDraft, setRemoteDraft] = useState(null);
    const dialogRef = useRef(null);
    const closeRef = useRef(null);
    const generateRef = useRef(null);
    const customizationRef = useRef(null);
    const resultsRef = useRef(null);
    const requestRef = useRef(null);
    const sequenceRef = useRef(0);
    const mountedRef = useRef(true);
    const draftRef = useRef(results);
    const draftReadyRef = useRef(false);
    const savedDraftRef = useRef(null);
    const draftTimerRef = useRef(null);
    const activityRef = useRef({ busy: false, saving: false, exporting: false });
    const closeCallback = useRef(onClose);
    const titleId = useId();
    const working = busy || saving || exporting;
    const selectedResults = useMemo(() => results.filter(entry => selected.has(entry.pokemon.id) && !entry.saved), [results, selected]);
    const exportSelection = useMemo(() => results.filter(entry => selected.has(entry.pokemon.id)), [results, selected]);
    const targetBox = teams.find(team => team.id === target);
    const freeSlots = target === 'new' ? 6 : Math.max(0, 6 - (targetBox?.pokemon?.length || 0));
    const updateOption = (key, value) => setOptions(current => ({ ...current, [key]: value }));

    useEffect(() => { closeCallback.current = onClose; }, [onClose]);
    useEffect(() => { draftRef.current = results; }, [results]);
    useEffect(() => {
        let active = true;
        readDurableStorage(GENERATOR_DRAFT_KEY, {}, { scope }).then(value => {
            if (!active) return;
            const restored = normalizeDraft(value);
            draftRef.current = restored;
            draftReadyRef.current = true;
            savedDraftRef.current = draftFingerprint(restored);
            setResults(restored);
            setSelected(new Set(restored.map(entry => entry.pokemon.id)));
            setDraftReady(true);
        });
        return () => { active = false; };
    }, [scope]);
    useEffect(() => {
        const receive = event => {
            if (event.detail?.scope !== scope || getStorageScope() !== scope || !event.detail?.document || !draftReadyRef.current) return;
            const incoming = normalizeDraft(event.detail.document.localTools?.generatorDraft);
            const current = draftFingerprint(draftRef.current);
            if (draftFingerprint(incoming) === current) return;
            if (activityRef.current.busy || activityRef.current.saving || activityRef.current.exporting || current !== savedDraftRef.current) {
                setRemoteDraft(incoming);
                return;
            }
            // The account merge has already preserved a competing saved draft
            // in its recoveries. Keep open controls and focus in this modal.
            draftRef.current = incoming;
            savedDraftRef.current = draftFingerprint(incoming);
            setResults(incoming);
            setSelected(new Set(incoming.map(entry => entry.pokemon.id)));
            setRemoteDraft(null);
            setNotice('Sua prévia foi atualizada.');
        };
        window.addEventListener('myowndex:account-document', receive);
        return () => window.removeEventListener('myowndex:account-document', receive);
    }, [scope]);
    useEffect(() => {
        mountedRef.current = true;
        const previousFocus = document.activeElement;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        const inert = [...document.body.children].filter(element => element instanceof HTMLElement && !element.contains(dialogRef.current) && !['SCRIPT', 'STYLE', 'LINK'].includes(element.tagName)).map(element => [element, element.inert]);
        for (const [element] of inert) element.inert = true;
        closeRef.current?.focus({ preventScroll: true });
        const onKeyDown = event => {
            if (document.querySelector('.confirm-dialog-overlay')) return;
            if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); closeCallback.current(); return; }
            if (event.key !== 'Tab') return;
            const choices = [...dialogRef.current.querySelectorAll(FOCUSABLE)].filter(element => element.getClientRects().length && (!element.closest('details:not([open])') || element.tagName === 'SUMMARY'));
            const first = choices[0];
            const last = choices[choices.length - 1];
            if (!first) { event.preventDefault(); dialogRef.current.focus(); }
            else if (event.shiftKey && (document.activeElement === first || !dialogRef.current.contains(document.activeElement))) { event.preventDefault(); last?.focus(); }
            else if (!event.shiftKey && (document.activeElement === last || !dialogRef.current.contains(document.activeElement))) { event.preventDefault(); first?.focus(); }
        };
        document.addEventListener('keydown', onKeyDown);
        return () => {
            mountedRef.current = false;
            if (draftReadyRef.current && draftFingerprint(draftRef.current) !== savedDraftRef.current) void writeDurableStorage(GENERATOR_DRAFT_KEY, serializeDraft(draftRef.current), { scope });
            sequenceRef.current += 1;
            requestRef.current?.abort();
            document.removeEventListener('keydown', onKeyDown);
            document.body.style.overflow = previousOverflow;
            for (const [element, original] of inert) element.inert = original;
            if (previousFocus?.isConnected) previousFocus.focus?.({ preventScroll: true });
        };
    }, [scope]);

    useEffect(() => {
        if (!draftReady || draftFingerprint(results) === savedDraftRef.current) return undefined;
        const timer = window.setTimeout(() => {
            const draft = serializeDraft(results);
            void writeDurableStorage(GENERATOR_DRAFT_KEY, draft, { scope }).then(saved => {
                if (saved) savedDraftRef.current = JSON.stringify(draft);
                if (!saved && mountedRef.current) setError('O armazenamento deste dispositivo não conseguiu guardar a prévia. Exporte os Pokémon ou salve em uma Box antes de fechar.');
            });
        }, 100);
        draftTimerRef.current = timer;
        return () => window.clearTimeout(timer);
    }, [draftReady, results, scope]);

    const removePreview = async () => {
        if (pendingRemoval === null || activityRef.current.busy || activityRef.current.saving || activityRef.current.exporting || getStorageScope() !== scope) return;
        const removal = pendingRemoval;
        const previous = draftRef.current;
        const next = removal === 'all' ? [] : previous.filter(entry => entry.pokemon.id !== removal);
        setPendingRemoval(null);
        activityRef.current.saving = true;
        setSaving(true);
        setError('');
        window.clearTimeout(draftTimerRef.current);
        // Persist an explicit empty draft rather than removing its key: cloud
        // clocks must distinguish a deliberate clear from a missing mirror.
        draftRef.current = next;
        try {
            if (!await writeDurableStorage(GENERATOR_DRAFT_KEY, serializeDraft(next), { scope })) {
                draftRef.current = previous;
                if (mountedRef.current) setError('Não foi possível limpar a prévia. Os Pokémon continuam aqui.');
                return;
            }
            savedDraftRef.current = draftFingerprint(next);
            if (mountedRef.current) {
                setResults(next);
                setSelected(current => new Set([...current].filter(id => next.some(entry => entry.pokemon.id === id))));
                setRemoteDraft(null);
                setNotice(next.length ? 'Pokémon removido da prévia.' : 'Prévia limpa. Os Pokémon guardados continuam no PC.');
                window.requestAnimationFrame(() => (next.length ? resultsRef.current : generateRef.current)?.focus());
            }
        } finally {
            activityRef.current.saving = false;
            if (mountedRef.current) setSaving(false);
        }
    };

    const runGeneration = async () => {
        if (activityRef.current.busy || activityRef.current.saving || activityRef.current.exporting || getStorageScope() !== scope) return;
        setReplaceConfirm(false);
        requestRef.current?.abort();
        const controller = new AbortController();
        requestRef.current = controller;
        const sequence = ++sequenceRef.current;
        activityRef.current.busy = true;
        setBusy(true);
        setError('');
        setNotice('');
        setProgress({ completed: 0, total: Number(options.count) });
        try {
            const generated = await generatePokemon(speciesCatalogue, { ...options, experienceMode }, {
                signal: controller.signal,
                onProgress: value => { if (sequenceRef.current === sequence) setProgress(value); },
            });
            if (sequenceRef.current !== sequence) return;
            setResults(generated);
            setSelected(new Set(generated.map(entry => entry.pokemon.id)));
            if (customizationRef.current) customizationRef.current.open = false;
            window.requestAnimationFrame(() => {
                if (sequenceRef.current !== sequence) return;
                resultsRef.current?.focus({ preventScroll: true });
                resultsRef.current?.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
            });
            setNotice(generated.length < Number(options.count) ? `${generated.length} Pokémon encontrado${generated.length === 1 ? '' : 's'}. Amplie os filtros para gerar mais.` : '');
        } catch (cause) {
            if (sequenceRef.current === sequence && cause.name !== 'AbortError') setError(cause.message || 'Não foi possível gerar agora. Tente novamente.');
        } finally {
            if (sequenceRef.current === sequence) { activityRef.current.busy = false; setBusy(false); }
        }
    };
    const requestGeneration = event => {
        event.preventDefault();
        if (activityRef.current.busy || activityRef.current.saving || activityRef.current.exporting) return;
        if (results.some(entry => !entry.saved && !entry.exported)) setReplaceConfirm(true);
        else void runGeneration();
    };
    const updateNickname = (id, nickname) => setResults(current => current.map(entry => entry.pokemon.id === id ? { ...entry, exported: false, pokemon: { ...entry.pokemon, nickname } } : entry));
    const toggleSelected = id => setSelected(current => {
        const next = new Set(current);
        if (next.has(id)) next.delete(id); else next.add(id);
        return next;
    });
    const saveSelected = async () => {
        if (!selectedResults.length || selectedResults.length > freeSlots || activityRef.current.busy || activityRef.current.saving || activityRef.current.exporting || getStorageScope() !== scope) return;
        activityRef.current.saving = true;
        setSaving(true);
        setError('');
        const savedIds = new Set();
        try {
            if (target === 'new') {
                const versions = new Set(selectedResults.map(entry => entry.versionGroup));
                if (await onAddBox?.({ name: boxName.trim() || 'Novo encontro', versionGroup: versions.size === 1 ? selectedResults[0].versionGroup : 'auto', pokemon: selectedResults.map(entry => entry.pokemon) })) selectedResults.forEach(entry => savedIds.add(entry.pokemon.id));
            } else {
                for (const entry of selectedResults) {
                    if (!await onAddPokemon?.(entry.pokemon, target)) break;
                    savedIds.add(entry.pokemon.id);
                }
            }
            if (mountedRef.current) {
                if (savedIds.size) setNotice(`${savedIds.size} Pokémon guardado${savedIds.size === 1 ? '' : 's'} no PC.`);
                if (savedIds.size !== selectedResults.length) setError('Alguns Pokémon continuam na prévia. Confira o espaço da Box e tente novamente.');
            }
        } catch (cause) { if (mountedRef.current) setError(cause.message || 'Não foi possível guardar agora. A prévia continua aqui.'); }
        finally { activityRef.current.saving = false; if (mountedRef.current) { setResults(current => current.map(entry => savedIds.has(entry.pokemon.id) ? { ...entry, saved: true } : entry)); setSaving(false); } }
    };
    const exportResults = async (entries, asBox = false) => {
        if (!entries.length || activityRef.current.busy || activityRef.current.saving || activityRef.current.exporting) return false;
        activityRef.current.exporting = true;
        setExporting(true);
        setError('');
        try {
            const pokemon = entries.map(entry => entry.pokemon);
            const versionGroup = new Set(entries.map(entry => entry.versionGroup)).size === 1 ? entries[0].versionGroup : 'auto';
            const team = { ...createTeam(boxName.trim() || 'Novo encontro'), versionGroup, pokemon };
            const text = asBox ? await encodeTeam(team) : await encodePokemonBundle(pokemon, { name: team.name, versionGroup });
            downloadText(text, asBox ? 'myowndex-box-gerada.txt' : `myowndex-${pokemon.length === 1 ? pokemon[0].species.name : 'pokemon'}.txt`);
            if (mountedRef.current) {
                const ids = new Set(pokemon.map(partner => partner.id));
                setResults(current => current.map(entry => ids.has(entry.pokemon.id) ? { ...entry, exported: true } : entry));
                setNotice('Arquivo exportado.');
            }
            return true;
        } catch (cause) { if (mountedRef.current) setError(cause.message || 'Não foi possível exportar agora.'); return false; }
        finally { activityRef.current.exporting = false; if (mountedRef.current) setExporting(false); }
    };
    const chooseRemoteDraft = async () => {
        if (!remoteDraft || activityRef.current.busy || activityRef.current.saving || activityRef.current.exporting) return;
        // A newer preview never silently replaces typing or an unfinished
        // encounter. The explicit action exports unguarded partners first.
        if (results.some(entry => !entry.saved && !entry.exported) && !await exportResults(results)) return;
        if (getStorageScope() !== scope || !mountedRef.current) return;
        activityRef.current.saving = true;
        setSaving(true);
        try {
            if (!await writeDurableStorage(GENERATOR_DRAFT_KEY, serializeDraft(remoteDraft), { scope })) {
                if (mountedRef.current) setError('Não foi possível abrir a outra prévia. As duas continuam disponíveis.');
                return;
            }
            draftRef.current = remoteDraft;
            savedDraftRef.current = draftFingerprint(remoteDraft);
            if (mountedRef.current) {
                setResults(remoteDraft);
                setSelected(new Set(remoteDraft.map(entry => entry.pokemon.id)));
                setRemoteDraft(null);
                setNotice('Outra prévia aberta.');
            }
        } finally {
            activityRef.current.saving = false;
            if (mountedRef.current) setSaving(false);
        }
    };
    const keepCurrentDraft = async () => {
        if (activityRef.current.busy || activityRef.current.saving || activityRef.current.exporting || getStorageScope() !== scope) return;
        activityRef.current.saving = true;
        setSaving(true);
        try {
            if (!await writeDurableStorage(GENERATOR_DRAFT_KEY, serializeDraft(draftRef.current), { scope })) {
                if (mountedRef.current) setError('Não foi possível guardar a prévia atual. Exporte os Pokémon para preservá-los.');
                return;
            }
            savedDraftRef.current = draftFingerprint(draftRef.current);
            if (mountedRef.current) {
                setRemoteDraft(null);
                setNotice('Esta prévia foi mantida.');
            }
        } finally {
            activityRef.current.saving = false;
            if (mountedRef.current) setSaving(false);
        }
    };

    if (typeof document === 'undefined') return null;
    return createPortal(<div className="generator-overlay" onMouseDown={event => event.target === event.currentTarget && onClose()}>
        <section className={`generator-dialog${results.length ? ' has-results' : ' is-preparing'}`} ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} inert={replaceConfirm || pendingRemoval !== null || undefined}>
            <header className="generator-heading">
                <div><h2 id={titleId}>Gerar Pokémon</h2></div>
                <PokemonCompanion place="generator" className="companion-compact" eager />
                <button type="button" ref={closeRef} className="generator-close" onClick={onClose} aria-label="Fechar gerador">×</button>
            </header>
            {!draftReady ? <p role="status" className="generator-notice">Abrindo sua prévia…</p> : <div className="generator-content">
                <form className={`generator-options${results.length ? '' : ' generator-empty'}`} onSubmit={requestGeneration} aria-busy={busy}>
                    <div className="generator-basic-fields">
                        <label>Quantidade<RoomSelect disabled={working} value={options.count} onChange={event => updateOption('count', Number(event.target.value))} aria-label="Quantidade de Pokémon">{[1, 2, 3, 4, 5, 6].map(count => <option key={count} value={count}>{count} Pokémon</option>)}</RoomSelect></label>
                        <label>Nível<input type="number" min="1" max={experienceMode === 'game' ? 100 : 200} step="1" value={options.level} onChange={event => updateOption('level', event.target.value)} required disabled={working} /></label>
                    </div>
                    <label>Jogo<RoomSelect disabled={working} value={options.versionGroup} onChange={event => updateOption('versionGroup', event.target.value)} aria-label="Jogo dos Pokémon gerados">{VERSION_GROUPS.map(group => <option key={group.value} value={group.value}>{group.label}</option>)}</RoomSelect></label>
                    <details className="generator-customize" ref={customizationRef}><summary>Personalizar o encontro</summary>
                        <label>Pokémon<RoomSelect disabled={working} value={options.catalogKey} onChange={event => updateOption('catalogKey', event.target.value)} aria-label="Pokémon ou forma a gerar"><option value="">Surpreenda-me</option>{speciesCatalogue.map(entry => <option key={entry.catalogFormKey} value={entry.catalogFormKey}>{Number(entry.formCount) > 1 && entry.form ? `${formatName(entry.speciesName)} · ${formatName(entry.form)}` : formatName(entry.speciesName || entry.pokemonName)}</option>)}</RoomSelect></label>
                        <div className="generator-basic-fields">
                            <label>Tipo<RoomSelect disabled={working} value={options.type} onChange={event => updateOption('type', event.target.value)} aria-label="Tipo para o encontro"><option value="">Qualquer tipo</option>{TYPES.filter(type => type !== 'stellar').map(type => <option key={type} value={type}>{formatType(type)}</option>)}</RoomSelect></label>
                            <label>Geração<RoomSelect disabled={working} value={options.generation} onChange={event => updateOption('generation', Number(event.target.value))} aria-label="Geração dos Pokémon"><option value="0">Todas</option>{[1, 2, 3, 4, 5, 6, 7, 8, 9].map(generation => <option key={generation} value={generation}>{generation}ª geração</option>)}</RoomSelect></label>
                        </div>
                        <label>Pokémon lendários e míticos<RoomSelect disabled={working} value={options.legendary} onChange={event => updateOption('legendary', event.target.value)} aria-label="Pokémon lendários e míticos"><option value="all">Podem aparecer</option><option value="exclude">Não incluir</option><option value="only">Somente eles</option></RoomSelect></label>
                        <label>Natureza<RoomSelect disabled={working} value={options.nature} onChange={event => updateOption('nature', event.target.value)} aria-label="Natureza a gerar"><option value="random">Aleatória</option>{Object.keys(NATURES).map(nature => <option key={nature} value={nature}>{formatName(nature)}</option>)}</RoomSelect></label>
                        <label className="generator-checkbox"><input type="checkbox" checked={options.shiny} onChange={event => updateOption('shiny', event.target.checked)} disabled={working} />Shiny</label>
                        <label className="generator-checkbox"><input type="checkbox" checked={options.hiddenAbility} onChange={event => updateOption('hiddenAbility', event.target.checked)} disabled={working} />Permitir Hidden Ability</label>
                    </details>
                    <button ref={generateRef} type="submit" className="generator-primary" disabled={working}>{busy ? <span role="status">Gerando {progress.completed} de {progress.total}…</span> : results.length ? 'Gerar outros Pokémon' : 'Gerar Pokémon'}</button>
                    {busy && <button type="button" onClick={() => { requestRef.current?.abort(); sequenceRef.current += 1; activityRef.current.busy = false; setBusy(false); window.requestAnimationFrame(() => generateRef.current?.focus({ preventScroll: true })); }}>Cancelar geração</button>}
                    <details className="generator-customize"><summary>O que vem na ficha</summary><small>Até quatro movimentos aprendidos por nível no jogo escolhido. IVs sorteados; EVs e XP começam em zero.</small>{experienceMode !== 'game' && options.versionGroup !== 'auto' && <small>O jogo escolhido define os movimentos. Os cálculos seguem as regras atuais.</small>}</details>
                </form>
                <div className="generator-results" ref={resultsRef} tabIndex={-1} role="region" aria-label="Pokémon gerados" aria-busy={saving || exporting}>
                    {error && <p className="generator-error" role="alert">{error}</p>}
                    {notice && <p className="generator-notice" role="status">{notice}</p>}
                    {remoteDraft && <div className="generator-notice generator-sync-choice" role="status"><p>Há outra prévia na sua conta. Esta continua aqui.</p><div className="generator-save-actions"><button type="button" disabled={working} onClick={() => void chooseRemoteDraft()}>{results.some(entry => !entry.saved && !entry.exported) ? 'Exportar esta e abrir outra' : 'Ver outra prévia'}</button><button type="button" disabled={working} onClick={() => void keepCurrentDraft()}>Manter esta prévia</button></div></div>}
                    {results.length > 0 && <>
                        <div className="generator-result-heading"><h3>Encontro <span>{results.length} Pokémon</span></h3><button type="button" className="generator-clear-preview" disabled={working} onClick={() => setPendingRemoval('all')}>Limpar prévia</button></div>
                        <div className="generator-partners">{results.map(entry => {
                            const partner = entry.pokemon;
                            return <article key={partner.id} className={`generator-partner${entry.saved ? ' is-saved' : ''}`}>
                                <div className="generator-partner-heading"><label className="generator-partner-choice"><input type="checkbox" checked={selected.has(partner.id)} onChange={() => toggleSelected(partner.id)} aria-label={`Selecionar ${formatPokemonIdentity(partner)}`} disabled={working} /><PokemonSprite pokemonId={partner.species.id} src={partner.shiny ? partner.species.sprites?.front_shiny : partner.species.sprites?.front_default} shiny={partner.shiny} alt="" loading="eager" /><span><strong>{formatPokemonIdentity(partner)}</strong><small>Nv. {partner.level}{partner.shiny ? ' · Shiny' : ''}{entry.saved ? ' · Guardado' : ''}</small></span></label><button type="button" disabled={working} onClick={() => void exportResults([entry])} aria-label={`Exportar ${formatPokemonIdentity(partner)}`}>Exportar</button></div>
                                <div className="generator-types">{partner.species.types?.map(type => <span key={type.type.name} style={{ background: TYPE_COLORS[type.type.name], color: TYPE_TEXT_COLORS[type.type.name] }}>{formatType(type.type.name)}</span>)}</div>
                                <dl className="generator-partner-facts"><div><dt>Natureza</dt><dd>{formatName(partner.nature)}</dd></div><div><dt>Habilidade</dt><dd>{formatName(partner.ability) || 'Sem habilidade'}</dd></div></dl>
                                <ul className="generator-moves" aria-label={`Movimentos de ${formatPokemonIdentity(partner)}`}>{partner.moves.filter(Boolean).map(move => <li key={move}>{formatName(move)}</li>)}</ul>
                                {!partner.moves.some(Boolean) && <p className="generator-small">Neste jogo, ainda não aprende movimentos por nível.</p>}
                                <details className="generator-partner-details"><summary>Ficha do Pokémon</summary><label>Apelido<input type="text" maxLength="80" value={partner.nickname} readOnly={entry.saved} disabled={working} onChange={event => updateNickname(partner.id, event.target.value)} /></label><dl className="generator-partner-facts"><div><dt>HP</dt><dd>{getGeneratedHp(partner, experienceMode)}</dd></div><div><dt>Jogo</dt><dd>{VERSION_LABELS[entry.versionGroup] || entry.versionGroup}</dd></div></dl><dl className="generator-ivs">{Object.entries(partner.ivs).map(([stat, value]) => <div key={stat}><dt>{STAT_MAP[stat]} · IV</dt><dd>{value}</dd></div>)}</dl><button type="button" className="generator-remove-partner" disabled={working} onClick={() => setPendingRemoval(partner.id)} aria-label={`Remover ${formatPokemonIdentity(partner)} da prévia`}>Remover da prévia</button></details>
                            </article>;
                        })}</div>
                        <section className="generator-save" aria-label="Guardar os Pokémon selecionados"><h3>Guardar no PC</h3><label>Destino<RoomSelect disabled={working} value={target} onChange={event => setTarget(event.target.value)} aria-label="Box de destino dos Pokémon gerados"><option value="new">Criar uma nova Box</option>{teams.map(team => <option key={team.id} value={team.id} disabled={team.pokemon.length >= 6}>{team.name} · {6 - team.pokemon.length} vaga{team.pokemon.length === 5 ? '' : 's'}</option>)}</RoomSelect></label>{target === 'new' && <label>Nome da Box<input type="text" maxLength="80" value={boxName} onChange={event => setBoxName(event.target.value)} disabled={working} /></label>}<div className="generator-save-actions"><button type="button" className="generator-primary" disabled={!selectedResults.length || selectedResults.length > freeSlots || working} onClick={() => void saveSelected()}>{saving ? 'Guardando…' : selectedResults.length ? `Guardar ${selectedResults.length} no PC` : 'Guardar no PC'}</button><button type="button" disabled={!exportSelection.length || working} onClick={() => void exportResults(exportSelection, true)}>Exportar Box</button></div>{selectedResults.length > freeSlots && <p className="generator-small">Esta Box tem {freeSlots} vaga{freeSlots === 1 ? '' : 's'}. Selecione menos Pokémon ou crie outra Box.</p>}</section>
                    </>}
                </div>
            </div>}
        </section>
        <ConfirmDialog open={replaceConfirm} title="Gerar outros Pokémon?" description="Ainda há Pokémon que você não guardou nem exportou. A nova geração substitui esta prévia." confirmLabel="Gerar novos" cancelLabel="Voltar à prévia" onConfirm={() => void runGeneration()} onCancel={() => setReplaceConfirm(false)} />
        <ConfirmDialog open={pendingRemoval !== null} title={pendingRemoval === 'all' ? 'Limpar esta prévia?' : 'Remover este Pokémon da prévia?'} description="Os Pokémon escolhidos saem da prévia. Suas Boxes e os arquivos exportados continuam como estão." confirmLabel={pendingRemoval === 'all' ? 'Limpar prévia' : 'Remover da prévia'} cancelLabel="Voltar à prévia" onConfirm={() => void removePreview()} onCancel={() => setPendingRemoval(null)} />
    </div>, document.body);
}
