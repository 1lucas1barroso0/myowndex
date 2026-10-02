import React, { useState, useEffect, useId, useMemo, useRef } from 'react';
import { RPG_STATUS_LABELS } from '../../core/copy.js';
import { describeMove, describeTrait } from '../../core/descriptions.js';
import { fetchCached, calculateStat, formatName, formatNumberPtBr, formatType, convertToTTRPG, NATURES, STAT_MAP, TYPES, filterMovesByLatestVersion } from '../../core/mechanics.js';
import { getNextLevelXp } from '../../core/rpgRules.js';
import { finiteNumber, finiteNumberOrNull, integerInRange, quantizeStepDown } from '../../core/math.js';
import { randomChance, randomChoice, randomInt } from '../../core/random.js';
import { RPG_STATUSES } from '../../core/team.js';
import PokemonSprite from '../Shared/PokemonSprite.jsx';

const POKEMONDB_ITEMS = [
    "potion", "super-potion", "hyper-potion", "max-potion", "full-restore", "revive", "max-revive", 
    "full-heal", "antidote", "paralyze-heal", "burn-heal", "ice-heal", "awakening", "ether", 
    "max-ether", "elixir", "max-elixir", "rare-candy", "hp-up", "protein", "iron", "carbos", 
    "calcium", "zinc", "pp-up", "pp-max", "ability-capsule", "ability-patch",
    "x-attack", "x-defense", "x-speed", "x-sp-atk", "x-sp-def", "x-accuracy", "dire-hit", "guard-spec",
    "cheri-berry", "chesto-berry", "pecha-berry", "rawst-berry", "aspear-berry", "leppa-berry", 
    "oran-berry", "persim-berry", "lum-berry", "sitrus-berry", "figy-berry", "wiki-berry", "mago-berry", 
    "aguav-berry", "iapapa-berry", "occa-berry", "passho-berry", "wacan-berry", "rindo-berry", 
    "yache-berry", "chople-berry", "kebia-berry", "shuca-berry", "coba-berry", "payapa-berry", 
    "tanga-berry", "charti-berry", "kasib-berry", "haban-berry", "colbur-berry", "babiri-berry", 
    "chilan-berry", "roseli-berry", "liechi-berry", "ganlon-berry", "salac-berry", "petaya-berry", 
    "apicot-berry", "lansat-berry", "starf-berry", "enigma-berry", "micle-berry", "custap-berry", 
    "jaboca-berry", "rowap-berry", "kee-berry", "maranga-berry",
    "leftovers", "choice-band", "choice-specs", "choice-scarf", "life-orb", "focus-sash", "focus-band", 
    "assault-vest", "eviolite", "rocky-helmet", "heavy-duty-boots", "expert-belt", "black-sludge", 
    "toxic-orb", "flame-orb", "white-herb", "mental-herb", "power-herb", "air-balloon", "destiny-knot", 
    "eject-button", "eject-pack", "red-card", "room-service", "shed-shell", "shell-bell", "throat-spray", 
    "weakness-policy", "blunder-policy", "light-clay", "damp-rock", "heat-rock", "icy-rock", "smooth-rock", 
    "terrain-extender", "protective-pads", "safety-goggles", "clear-amulet", "covert-cloak", "loaded-dice", 
    "punching-glove", "ability-shield", "mirror-herb", "booster-energy", "muscle-band", "wise-glasses",
    "scope-lens", "wide-lens", "zoom-lens", "bright-powder", "quick-claw", "kings-rock", "razor-claw",
    "razor-fang", "big-root", "binding-band", "black-belt", "black-glasses", "charcoal", "dragon-fang", 
    "hard-stone", "magnet", "metal-coat", "miracle-seed", "mystic-water", "never-melt-ice", "poison-barb", 
    "sharp-beak", "silk-scarf", "silver-powder", "soft-sand", "spell-tag", "twisted-spoon", "fairy-feather",
    "fist-plate", "sky-plate", "toxic-plate", "earth-plate", "stone-plate", "insect-plate", "spooky-plate", 
    "iron-plate", "flame-plate", "splash-plate", "meadow-plate", "zap-plate", "mind-plate", "icicle-plate",
    "draco-plate", "dread-plate", "pixie-plate", "blank-plate", "douse-drive", "shock-drive", "burn-drive", 
    "chill-drive", "fire-memory", "water-memory", "electric-memory", "grass-memory", "ice-memory", 
    "fighting-memory", "poison-memory", "ground-memory", "flying-memory", "psychic-memory", "bug-memory", 
    "rock-memory", "ghost-memory", "dragon-memory", "dark-memory", "steel-memory", "fairy-memory",
    "fire-stone", "water-stone", "thunder-stone", "leaf-stone", "moon-stone", "sun-stone", "shiny-stone", 
    "dusk-stone", "dawn-stone", "ice-stone", "oval-stone", "everstone", "dragon-scale", "up-grade", 
    "dubious-disc", "protector", "electirizer", "magmarizer", "reaper-cloth", "prism-scale", "whipped-dream", 
    "sachet", "tart-apple", "sweet-apple", "cracked-pot", "chipped-pot", "galarica-twig", "galarica-cuff", 
    "galarica-wreath", "black-augurite", "peat-block", "auspicious-armor", "malicious-armor", "leaders-crest", 
    "gimmighoul-coin", "syrupy-apple", "unremarkable-teacup", "masterpiece-teacup", "metal-alloy",
    "abomasite", "absolite", "aerodactylite", "aggronite", "alakazite", "altarianite", "ampharosite", 
    "audinite", "banettite", "beedrillite", "blastoisinite", "blazikenite", "cameruptite", "charizardite-x", 
    "charizardite-y", "diancite", "galladite", "garchompite", "gardevoirite", "gengarite", "glalitite", 
    "gyaradosite", "heracrossite", "houndoominite", "kangaskhanite", "latiasite", "latiosite", "lopunnite", 
    "lucarionite", "manectite", "mawilite", "medichamite", "metagrossite", "mewtwonite-x", "mewtwonite-y", 
    "pidgeotite", "pinsirite", "sablenite", "salamencite", "sceptilite", "scizorite", "sharpedonite", 
    "slowbronite", "steelixite", "swampertite", "tyranitarite", "venusaurite",
    "normalium-z", "fightinium-z", "flyinium-z", "poisonium-z", "groundium-z", "rockium-z", "buginium-z", 
    "ghostium-z", "steelium-z", "firium-z", "waterium-z", "grassium-z", "electrium-z", "psychium-z", 
    "icium-z", "draconium-z", "darkinium-z", "fairium-z", "aloraichium-z", "decidium-z", "eevium-z", 
    "incinium-z", "kommonium-z", "lunalium-z", "lycanium-z", "marshadium-z", "mewnium-z", "mimikium-z", 
    "pikanium-z", "pikashunium-z", "primarium-z", "snorlium-z", "solganium-z", "tapunium-z", "ultranecrozium-z"
].sort();

export default function PokemonEditor({ pk, updatePk, envProps }) {
    const { allItems, allMoves, allAbilities, selectedVersionGroup, experienceMode, onRemove, isTTRPG, isHackmon } = envProps;
    const [baseForm, setBaseForm] = useState(null);
    const [speciesProfile, setSpeciesProfile] = useState(null);
    const [moveDetails, setMoveDetails] = useState({});
    const [switchingForm, setSwitchingForm] = useState(false);
    const [formError, setFormError] = useState("");
    const [traitDetails, setTraitDetails] = useState({ ability: null, item: null });
    const fieldId = useId();
    const itemListId = `${fieldId}-items`;
    const abilityListId = `${fieldId}-abilities`;
    const moveListId = `${fieldId}-moves`;
    const mountedRef = useRef(false);
    const partnerRef = useRef(pk);

    useEffect(() => {
        mountedRef.current = true;
        return () => { mountedRef.current = false; };
    }, []);

    useEffect(() => { partnerRef.current = pk; }, [pk]);

    const dismissKeyboard = () => {
        if (document.activeElement && document.activeElement.blur) {
            document.activeElement.blur();
        }
    };

    const handleEnter = (e) => {
        if (e.key === "Enter") {
            e.target.blur();
        }
    };

    const isNativeGMax = Boolean(pk.species?.name?.includes("-gmax"));

    // The form identity is the trigger; updatePk is intentionally excluded because
    // the parent creates a slot-scoped callback on each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => { if (isNativeGMax && !pk.canGMax) updatePk({ ...pk, canGMax: true }); }, [pk.species?.name, pk.canGMax, isNativeGMax]);

    useEffect(() => {
        let mounted = true;
        const checkBase = async () => {
            if(!pk.species?.species?.url) {
                setSpeciesProfile(null);
                return;
            }
            const sp = await fetchCached(pk.species.species.url);
            if(!sp || !mounted) return;
            setSpeciesProfile(sp);
            const defVar = sp.varieties?.find(v => v.is_default);
            if(defVar && defVar.pokemon?.name !== pk.species.name) {
                const bData = await fetchCached(defVar.pokemon.url);
                if(mounted) setBaseForm(bData);
            } else setBaseForm(null);
        }; checkBase();
        return () => { mounted = false; };
    // The form name is the stable identity for the species URL in PokéAPI.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pk.species?.name]);

    const validMoves = useMemo(() => {
        if (isHackmon) return allMoves;
        const processed = filterMovesByLatestVersion(pk.species?.moves || [], selectedVersionGroup || "auto");
        return processed.map(m => m.move);
    }, [isHackmon, allMoves, pk.species?.moves, selectedVersionGroup]);
    const validMoveNames = useMemo(() => new Set(validMoves.map(move => typeof move === "string" ? move : move?.name).filter(Boolean)), [validMoves]);

    useEffect(() => {
        let mounted = true;
        const names = [...new Set((pk.moves || []).filter(Boolean).map(name => name.trim().toLowerCase().replace(/\s+/g, "-")))];
        if (!names.length) {
            setMoveDetails({});
            return () => { mounted = false; };
        }
        Promise.all(names.map(async name => [name, await fetchCached(`https://pokeapi.co/api/v2/move/${encodeURIComponent(name)}`)]))
            .then(entries => {
                if (mounted) setMoveDetails(Object.fromEntries(entries.filter(([, data]) => data)));
            });
        return () => { mounted = false; };
    }, [pk.moves]);

    useEffect(() => {
        let mounted = true;
        const ability = String(pk.ability || "").trim().toLowerCase();
        const item = String(pk.item || "").trim().toLowerCase();
        Promise.all([
            ability ? fetchCached(`https://pokeapi.co/api/v2/ability/${encodeURIComponent(ability)}`, { maxAgeMs: 24 * 60 * 60 * 1000 }) : null,
            item ? fetchCached(`https://pokeapi.co/api/v2/item/${encodeURIComponent(item)}`, { maxAgeMs: 24 * 60 * 60 * 1000 }) : null,
        ]).then(([abilityDetail, itemDetail]) => {
            if (mounted) setTraitDetails({ ability: abilityDetail || null, item: itemDetail || null });
        }).catch(() => {
            if (mounted) setTraitDetails({ ability: null, item: null });
        });
        return () => { mounted = false; };
    }, [pk.ability, pk.item]);

    const validItems = useMemo(() => {
        const names = [
            ...POKEMONDB_ITEMS,
            ...(Array.isArray(allItems) ? allItems.map(item => typeof item === "string" ? item : item?.name) : []),
            pk.item
        ].filter(Boolean);
        return [...new Set(names)].sort((a, b) => a.localeCompare(b));
    }, [allItems, pk.item]);

    const validAbs = useMemo(() => {
        if (isHackmon) return allAbilities;
        const map = new Map();
        pk.species?.abilities?.forEach(a => { if (a?.ability?.name) map.set(a.ability.name, a.ability) });
        if (map.size === 0 && baseForm?.abilities) baseForm.abilities.forEach(a => { if (a?.ability?.name) map.set(a.ability.name, a.ability) });
        return Array.from(map.values()).sort((a,b) => (a.name || "").localeCompare(b.name || ""));
    }, [isHackmon, allAbilities, pk.species?.abilities, baseForm]);
    const validAbilityNames = useMemo(
        () => new Set(validAbs.map(ability => typeof ability === "string" ? ability : ability?.name).filter(Boolean)),
        [validAbs],
    );
    const forms = useMemo(() => speciesProfile?.varieties || [], [speciesProfile]);

    useEffect(() => {
        const defaultAbility = pk.species?.abilities?.[0]?.ability?.name || "";
        const defaultTera = pk.species?.types?.[0]?.type?.name || "";
        if ((!pk.ability && defaultAbility) || (!pk.teraType && defaultTera)) {
            updatePk({
                ...pk,
                ability: pk.ability || defaultAbility,
                teraType: pk.teraType || defaultTera,
            });
        }
    // Defaults only fill empty dependent fields; manual exceptions stay untouched.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pk.species?.name, pk.ability, pk.teraType]);

    const changeForm = async formUrl => {
        if (!formUrl || switchingForm) return;
        const current = forms.find(entry => entry.pokemon?.name === pk.species?.name);
        if (current?.pokemon?.url === formUrl) return;
        setSwitchingForm(true);
        setFormError("");
        try {
            const nextSpecies = await fetchCached(formUrl);
            if (!mountedRef.current) return;
            if (!nextSpecies) throw new Error("Esta forma ainda não está disponível.");
            const profile = nextSpecies.species?.url
                ? await fetchCached(nextSpecies.species.url)
                : speciesProfile;
            if (!mountedRef.current) return;
            const currentPartner = partnerRef.current;
            const fallbackRate = integerInRange(currentPartner.genderRate ?? currentPartner.species?.gender_rate, -1, 8, -1);
            const profileRate = finiteNumberOrNull(profile?.gender_rate);
            const nextRate = profileRate == null
                ? fallbackRate
                : integerInRange(profileRate, -1, 8, fallbackRate);
            const oldPrimaryType = currentPartner.species?.types?.[0]?.type?.name || "";
            const nextPrimaryType = nextSpecies.types?.[0]?.type?.name || "";
            const forcedGender = nextRate === -1 ? "N" : nextRate === 0 ? "M" : nextRate === 8 ? "F" : currentPartner.gender;
            updatePk({
                ...currentPartner,
                species: { ...nextSpecies, gender_rate: nextRate },
                genderRate: nextRate,
                gender: forcedGender,
                ability: currentPartner.ability || nextSpecies.abilities?.[0]?.ability?.name || "",
                teraType: !currentPartner.teraType || currentPartner.teraType === oldPrimaryType ? nextPrimaryType : currentPartner.teraType,
                canGMax: nextSpecies.name?.includes("-gmax") ? true : currentPartner.canGMax,
            });
            setSpeciesProfile(profile || null);
        } catch {
            if (mountedRef.current) setFormError("A Pokédex não conseguiu abrir essa forma agora, mas sua ficha continua intacta.");
        } finally {
            if (mountedRef.current) setSwitchingForm(false);
        }
    };

    const handleChange = (cat, stat, val) => {
        if (val === "") { updatePk({ ...pk, [cat]: { ...(pk[cat] || {}), [stat]: "" } }); return; }
        let v = integerInRange(val, 0, cat === "evs" ? 252 : 31, 0);
        if (cat === "evs") {
            const rem = Object.entries(pk.evs || {}).reduce(
                (sum, [key, ev]) => key !== stat ? sum + integerInRange(ev, 0, 252, 0) : sum,
                0,
            );
            if (rem + v > 510) v = 510 - rem;
        }
        updatePk({ ...pk, [cat]: { ...(pk[cat] || {}), [stat]: v } });
    };

    const currentGenderRate = integerInRange(pk.genderRate ?? pk.species?.gender_rate, -1, 8, -1);
    const canUseMale = currentGenderRate !== -1 && currentGenderRate !== 8;
    const canUseFemale = currentGenderRate !== -1 && currentGenderRate !== 0;
    const canUseNeutral = currentGenderRate === -1;

    useEffect(() => {
        const forcedGender = currentGenderRate === -1 ? "N" : currentGenderRate === 0 ? "M" : currentGenderRate === 8 ? "F" : null;
        if (forcedGender && pk.gender !== forcedGender) {
            updatePk({ ...pk, gender: forcedGender, genderRate: currentGenderRate });
        }
    // Only a ratio or selected-gender change can require normalization.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentGenderRate, pk.gender]);

    const randomize = (t) => {
        dismissKeyboard();
        if (t === "ivs") {
            updatePk({ ...pk, ivs: { hp: randomInt(32), attack: randomInt(32), defense: randomInt(32), "special-attack": randomInt(32), "special-defense": randomInt(32), speed: randomInt(32) } });
        }
        else if (t === "nature") {
            updatePk({ ...pk, nature: randomChoice(Object.keys(NATURES)) });
        }
        else if (t === "ability") {
            if (validAbs.length > 0) {
                const randomAb = randomChoice(validAbs);
                const abName = typeof randomAb === "string" ? randomAb : (randomAb?.name || "");
                if (abName) updatePk({ ...pk, ability: abName });
            }
        }
        else if (t === "gender") {
            if (pk.genderLocked) return;
            if (currentGenderRate === -1) return;
            if (currentGenderRate === 0) { updatePk({ ...pk, gender: "M", genderRate: 0 }); return; }
            if (currentGenderRate === 8) { updatePk({ ...pk, gender: "F", genderRate: 8 }); return; }
            const result = randomChance(currentGenderRate, 8) ? "F" : "M";
            updatePk({ ...pk, gender: result, genderRate: currentGenderRate });
        }
    };

    const getMulti = (sN) => { const n = NATURES[pk.nature || "hardy"]; return !n ? 1 : n.up === sN ? 1.1 : n.down === sN ? 0.9 : 1; };

    const evTotal = Object.values(pk.evs || {}).reduce((sum, value) => sum + integerInRange(value, 0, 252, 0), 0);
    const artwork = pk.species?.sprites?.other?.["official-artwork"];
    const sprite = pk.shiny
        ? (artwork?.front_shiny || pk.species?.sprites?.front_shiny)
        : (artwork?.front_default || pk.species?.sprites?.front_default);
    const customT = isHackmon && pk.customTypes ? pk.customTypes : (pk.species?.types?.map(t => t.type?.name) || []);
    const hpStat = pk.species?.stats?.find(entry => entry.stat?.name === "hp");
    const hpBase = isHackmon && pk.customStats?.hp !== undefined ? pk.customStats.hp : (hpStat?.base_stat || 1);
    const rawMaxHp = calculateStat(hpBase, pk.evs?.hp ?? 0, pk.ivs?.hp ?? 31, pk.level, 1, true, pk.species?.name);
    const displayedMaxHp = isTTRPG ? convertToTTRPG(rawMaxHp, true) : rawMaxHp;
    const rpg = pk.rpg || {};
    const nextLevelXp = getNextLevelXp(pk.level);
    const updateRpg = patch => updatePk({ ...pk, rpg: { ...rpg, ...patch } });
    const abilityException = Boolean(pk.ability) && !isHackmon && !validAbilityNames.has(pk.ability);
    const teraException = Boolean(pk.teraType) && !TYPES.includes(pk.teraType);
    const moveExceptionCount = (pk.moves || []).filter(move => {
        const normalized = move.trim().toLowerCase().replace(/\s+/g, "-");
        return normalized && !isHackmon && !validMoveNames.has(normalized);
    }).length;
    const exceptionCount = moveExceptionCount + (abilityException ? 1 : 0) + (teraException ? 1 : 0);

    useEffect(() => {
        if (rpg.currentHp == null || rpg.currentHp <= displayedMaxHp) return;
        updatePk({ ...pk, rpg: { ...rpg, currentHp: displayedMaxHp } });
    // Max HP is the only dependency that can make an existing value invalid.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [displayedMaxHp, rpg.currentHp]);

    const applyXpProgression = (xpValue = rpg.xp) => {
        const xp = quantizeStepDown(xpValue, 0.5, { minimum: 0, maximum: 999999, fallback: rpg.xp });
        const levelCap = isHackmon ? 200 : 100;
        const currentLevel = integerInRange(pk.level, 1, levelCap, 1);
        const currentXp = quantizeStepDown(rpg.xp, 0.5, { minimum: 0, maximum: 999999, fallback: 0 });
        if (xp < nextLevelXp || currentLevel >= levelCap) {
            if (xp !== currentXp) updateRpg({ xp });
            return;
        }
        const nextLevel = Math.min(levelCap, currentLevel + 1);
        const nextRawMaxHp = calculateStat(
            hpBase,
            pk.evs?.hp ?? 0,
            pk.ivs?.hp ?? 31,
            nextLevel,
            1,
            true,
            pk.species?.name,
        );
        const nextMaxHp = isTTRPG ? convertToTTRPG(nextRawMaxHp, true) : nextRawMaxHp;
        const hpGrowth = Math.max(0, nextMaxHp - displayedMaxHp);
        updatePk({
            ...pk,
            level: nextLevel,
            rpg: {
                ...rpg,
                xp: 0,
                currentHp: rpg.currentHp == null
                    ? null
                    : Math.min(nextMaxHp, integerInRange(rpg.currentHp, 0, displayedMaxHp, displayedMaxHp) + hpGrowth),
            },
        });
    };

    const awardXp = amount => applyXpProgression(finiteNumber(rpg.xp, 0) + finiteNumber(amount, 0));
    return (
        <section className="pokemon-editor animate-fade-in" aria-label={`Editar ${pk.nickname || formatName(pk.species?.name)}`}>
            <datalist id={itemListId}>{validItems.map(value => <option key={value} value={value} />)}</datalist>
            <datalist id={abilityListId}>{validAbs.map(ability => { const value = typeof ability === "string" ? ability : ability?.name; return value ? <option key={value} value={value} /> : null; })}</datalist>
            <datalist id={moveListId}>{validMoves.map(move => { const value = typeof move === "string" ? move : move?.name; return value ? <option key={value} value={value} /> : null; })}</datalist>

            <header className="editor-header">
                <PokemonSprite src={sprite} pokemonId={pk.species?.id} shiny={pk.shiny} alt={`${formatName(pk.species?.name)}${pk.shiny ? " shiny" : ""}`} className="editor-portrait" />
                <div className="editor-identity">
                    <label className="editor-field">
                        <span className="editor-label">Apelido</span>
                        <input type="text" value={pk.nickname !== undefined ? pk.nickname : formatName(pk.species?.name || "")} onKeyDown={handleEnter} onChange={event => updatePk({ ...pk, nickname: event.target.value })} className="editor-input editor-nickname" />
                    </label>
                    <span className="editor-species-name">{formatName(pk.species?.name || "")}</span>
                    {forms.length > 1 && <label className="editor-field form-switch">
                        <span className="editor-label">Forma</span>
                        <select className="editor-input" value={forms.find(entry => entry.pokemon?.name === pk.species?.name)?.pokemon?.url || ""} disabled={switchingForm} onChange={event => void changeForm(event.target.value)}>
                            {forms.map(entry => <option key={entry.pokemon?.name} value={entry.pokemon?.url}>{formatName(entry.pokemon?.name)}{entry.is_default ? " · padrão" : ""}</option>)}
                        </select>
                    </label>}
                    {switchingForm && <span role="status">Consultando forma…</span>}
                    {formError && <span role="alert" className="editor-error">{formError}</span>}
                </div>
                <label className="editor-field editor-level">
                    <span className="editor-label">Nível</span>
                    <input type="number" min="1" max={isHackmon ? 200 : 100} value={pk.level === "" ? "" : pk.level} onKeyDown={handleEnter} onChange={event => updatePk({ ...pk, level: event.target.value === "" ? "" : integerInRange(event.target.value, 1, isHackmon ? 200 : 100, 1) })} className="editor-input" />
                </label>
            </header>
            {exceptionCount > 0 && <p className="editor-exception-note" role="status">{`${exceptionCount} ${exceptionCount === 1 ? "escolha fora do jogo de referência" : "escolhas fora do jogo de referência"}.`}</p>}

            <div className="editor-basics-grid">
                <label className="editor-field"><span className="editor-label">Item segurado</span><input list={itemListId} value={pk.item || ""} onKeyDown={handleEnter} onChange={event => updatePk({ ...pk, item: (event.target.value || "").toLowerCase() })} className="editor-input" /></label>
                <div className="editor-field">
                    <label htmlFor={`${fieldId}-ability`} className="editor-label">Habilidade</label>
                    <div className="editor-choice-control">
                        <input id={`${fieldId}-ability`} list={abilityListId} value={pk.ability || ""} onKeyDown={handleEnter} onChange={event => updatePk({ ...pk, ability: (event.target.value || "").toLowerCase() })} className="editor-input" />
                        <button type="button" aria-label="Sortear habilidade" title="Sortear habilidade" onClick={() => randomize("ability")} className="editor-random-button">⚄</button>
                    </div>
                    {abilityException && <span className="editor-field-note">Escolha livre mantida</span>}
                </div>
                <div className="editor-field">
                    <label htmlFor={`${fieldId}-nature`} className="editor-label">Natureza</label>
                    <div className="editor-choice-control">
                        <select id={`${fieldId}-nature`} value={pk.nature || "hardy"} onChange={event => { dismissKeyboard(); updatePk({ ...pk, nature: event.target.value }); }} className="editor-input">
                            {Object.keys(NATURES).map(nature => <option key={nature} value={nature}>{formatName(nature)} {NATURES[nature].up ? `(+${STAT_MAP[NATURES[nature].up]}, −${STAT_MAP[NATURES[nature].down]})` : ""}</option>)}
                        </select>
                        <button type="button" aria-label="Sortear natureza" title="Sortear natureza" onClick={() => randomize("nature")} className="editor-random-button">⚄</button>
                    </div>
                </div>
                <div className="editor-field">
                    <span className="editor-label" id={`${fieldId}-gender-label`}>Gênero</span>
                    <div className="editor-gender-controls" role="group" aria-labelledby={`${fieldId}-gender-label`}>
                        {[
                            { value: "M", label: "Macho", symbol: "♂", enabled: canUseMale },
                            { value: "F", label: "Fêmea", symbol: "♀", enabled: canUseFemale },
                            { value: "N", label: "Sem gênero", symbol: "⚲", enabled: canUseNeutral },
                        ].filter(choice => choice.enabled).map(choice => <button key={choice.value} type="button" aria-pressed={pk.gender === choice.value} onClick={() => { dismissKeyboard(); updatePk({ ...pk, gender: choice.value, genderRate: currentGenderRate, genderLocked: true }); }}>{choice.symbol} {choice.label}</button>)}
                        <button type="button" onClick={() => updatePk({ ...pk, genderLocked: !pk.genderLocked })} aria-pressed={Boolean(pk.genderLocked)} aria-label={pk.genderLocked ? "Permitir novo sorteio de gênero" : "Manter o gênero escolhido"} title={pk.genderLocked ? "Permitir novo sorteio" : "Manter esta escolha"}>{pk.genderLocked ? "🔒" : "🔓"}</button>
                        <button type="button" disabled={pk.genderLocked || currentGenderRate === -1} onClick={() => randomize("gender")} aria-label="Sortear gênero pela proporção da espécie" title="Sortear gênero">⚄</button>
                    </div>
                </div>
            </div>

            {(pk.ability || pk.item) && <details className="editor-disclosure editor-trait-reference">
                <summary>Consultar habilidade e item</summary>
                <div className="editor-disclosure-body">
                    {[
                        pk.ability ? { kind: "ability", id: pk.ability, detail: traitDetails.ability } : null,
                        pk.item ? { kind: "item", id: pk.item, detail: traitDetails.item } : null,
                    ].filter(Boolean).map(trait => ({ ...trait, explanation: describeTrait(trait.kind, trait.id, trait.detail) })).map(trait => <article key={`${trait.kind}-${trait.id}`}>
                        <h4>{formatName(trait.id)}</h4>
                        {trait.explanation.catalog.text && <p lang={trait.explanation.catalog.code}>{trait.explanation.catalog.text}</p>}
                        <p>{trait.explanation.summary}</p><p>{trait.explanation.trigger}</p><p>{trait.explanation.handling}</p>
                    </article>)}
                </div>
            </details>}

            <section className="editor-moves" aria-labelledby={`${fieldId}-moves-heading`}>
                <header className="editor-section-heading"><h3 id={`${fieldId}-moves-heading`}>Movimentos</h3><span>{pk.moves?.filter(Boolean).length || 0} de 4</span></header>
                <div className="editor-moves-grid">
                    {[0, 1, 2, 3].map(index => {
                        const moveName = pk.moves?.[index] || "";
                        const normalizedName = moveName.trim().toLowerCase().replace(/\s+/g, "-");
                        const detail = moveDetails[normalizedName];
                        const moveExplanation = detail ? describeMove(detail, { isTTRPG }) : null;
                        const isException = Boolean(moveName) && !isHackmon && !validMoveNames.has(normalizedName);
                        const currentPp = rpg.pp?.[index];
                        return <div key={index} className={`editor-move-field ${isException ? "is-exception" : ""}`}>
                            <label className="editor-field"><span className="editor-label">Movimento {index + 1}</span><input list={moveListId} value={moveName} onKeyDown={handleEnter} onChange={event => {
                                const moves = [...(pk.moves || [])]; moves[index] = (event.target.value || "").toLowerCase();
                                const pp = [...(rpg.pp || [null, null, null, null])]; pp[index] = null;
                                updatePk({ ...pk, moves, rpg: { ...rpg, pp } });
                            }} className="editor-input" /></label>
                            {isException && <span className="editor-field-note">{experienceMode === "game" ? "Não disponível neste jogo" : "Escolha livre"}</span>}
                            {isTTRPG && moveName && <label className="editor-pp-label">PP atual<input type="number" min="0" max={detail?.pp || 99} value={currentPp ?? detail?.pp ?? ""} onChange={event => { const pp = [...(rpg.pp || [null, null, null, null])]; pp[index] = event.target.value === "" ? null : integerInRange(event.target.value, 0, integerInRange(detail?.pp, 0, 99, 99), 0); updateRpg({ pp }); }} className="editor-input editor-pp-control" /></label>}
                            {moveExplanation && <details className="editor-move-description">
                                <summary>Detalhes do movimento</summary>
                                <dl className="editor-move-facts"><div><dt>Poder</dt><dd>{detail.power == null ? "—" : isTTRPG ? convertToTTRPG(detail.power) : detail.power}</dd></div><div><dt>Precisão</dt><dd>{detail.accuracy == null ? "Sem teste próprio" : `${detail.accuracy}%`}</dd></div><div><dt>PP máximo</dt><dd>{detail.pp ?? "—"}</dd></div>{Boolean(detail.priority) && <div><dt>Prioridade</dt><dd>{detail.priority > 0 ? "+" : ""}{detail.priority}</dd></div>}</dl>
                                {moveExplanation.catalog.text && <p lang={moveExplanation.catalog.code}>{moveExplanation.catalog.text}</p>}
                                <p>{moveExplanation.summary}</p><ul>{moveExplanation.facts.map((fact, factIndex) => <li key={`${normalizedName}-${factIndex}`}>{fact}</li>)}</ul>
                            </details>}
                        </div>;
                    })}
                </div>
            </section>

            <details className="editor-disclosure rpg-journey-panel">
                <summary><span>Progresso da jornada</span><span className="rpg-journey-hp">HP {rpg.currentHp ?? displayedMaxHp} de {displayedMaxHp}</span></summary>
                <div className="editor-disclosure-body rpg-journey-body">
                    <div className="editor-field"><label htmlFor={`${fieldId}-hp`} className="editor-label">HP atual</label><div className="editor-choice-control"><input id={`${fieldId}-hp`} type="number" min="0" max={displayedMaxHp} value={rpg.currentHp ?? displayedMaxHp} onChange={event => updateRpg({ currentHp: event.target.value === "" ? null : integerInRange(event.target.value, 0, displayedMaxHp, 0) })} className="editor-input" /><button type="button" onClick={() => updateRpg({ currentHp: displayedMaxHp })} className="rpg-recover-button">Recuperar</button></div></div>
                    <div className="editor-field"><label htmlFor={`${fieldId}-xp`} className="editor-label">XP atual</label><input id={`${fieldId}-xp`} type="number" min="0" step="0.5" value={rpg.xp ?? 0} onChange={event => updateRpg({ xp: quantizeStepDown(event.target.value, 0.5, { minimum: 0, maximum: 999999, fallback: rpg.xp }) })} onBlur={() => applyXpProgression()} className="editor-input" /><small className="editor-progress-goal">Meta: {formatNumberPtBr(nextLevelXp)} XP · nível {Math.min(isHackmon ? 200 : 100, integerInRange(pk.level, 1, isHackmon ? 200 : 100, 1) + 1)}</small><div className="editor-xp-actions"><button type="button" onClick={() => awardXp(0.5)}>+0,5</button><button type="button" onClick={() => awardXp(1)}>+1 XP</button></div></div>
                    <label className="editor-field"><span className="editor-label">Condição</span><select value={rpg.status || ""} onChange={event => updateRpg({ status: event.target.value })} className="editor-input">{RPG_STATUSES.map(status => <option key={status || "none"} value={status}>{RPG_STATUS_LABELS[status]}</option>)}</select></label>
                    <label className="editor-field"><span className="editor-label">Poké Ball da captura</span><input type="text" value={rpg.caughtWith || ""} onChange={event => updateRpg({ caughtWith: event.target.value })} className="editor-input" /></label>
                    <label className="editor-field editor-wide-field"><span className="editor-label">Treinador original</span><input type="text" value={rpg.originalTrainer || ""} onChange={event => updateRpg({ originalTrainer: event.target.value })} className="editor-input" /></label>
                    <label className="editor-field editor-wide-field"><span className="editor-label">Notas da jornada</span><textarea value={rpg.notes || ""} onChange={event => updateRpg({ notes: event.target.value })} rows={3} className="editor-input" /></label>
                    <label className="editor-field editor-wide-field"><span className="editor-label">Possibilidades da aventura</span><textarea value={rpg.animeNotes || ""} onChange={event => updateRpg({ animeNotes: event.target.value })} rows={3} className="editor-input" /></label>
                </div>
            </details>

            <details className="editor-disclosure editor-characteristics">
                <summary>Características e transformações</summary>
                <div className="editor-disclosure-body editor-basics-grid">
                    <label className="editor-field"><span className="editor-label">Amizade</span><input type="number" min="0" max="255" value={pk.friendship === "" ? "" : pk.friendship} onKeyDown={handleEnter} onChange={event => updatePk({ ...pk, friendship: event.target.value === "" ? "" : integerInRange(event.target.value, 0, 255, 0) })} className="editor-input" />{isTTRPG && <small>RPG: {convertToTTRPG(pk.friendship || 0)}</small>}</label>
                    <label className="editor-field"><span className="editor-label">Tipo Tera</span><select value={pk.teraType || ""} onChange={event => updatePk({ ...pk, teraType: event.target.value })} className="editor-input">{!pk.teraType && <option value="">Usar o tipo principal</option>}{teraException && <option value={pk.teraType}>{formatName(pk.teraType)} · escolha livre</option>}{TYPES.map(type => <option key={type} value={type}>{formatType(type)}</option>)}</select></label>
                    <label className="editor-field"><span className="editor-label">Nível Dynamax</span><input type="number" min="0" max="10" value={pk.dynamaxLevel ?? 0} onChange={event => updatePk({ ...pk, dynamaxLevel: integerInRange(event.target.value, 0, 10, 0) })} className="editor-input" /></label>
                    <div className="editor-checkboxes"><label><input type="checkbox" checked={pk.canGMax || false} disabled={isNativeGMax} onChange={event => { dismissKeyboard(); updatePk({ ...pk, canGMax: event.target.checked }); }} />Gigantamax</label><label><input type="checkbox" checked={pk.shiny || false} onChange={event => updatePk({ ...pk, shiny: event.target.checked })} />Shiny</label></div>
                    {isHackmon && [0, 1].map(index => <label key={index} className="editor-field"><span className="editor-label">Tipo personalizado {index + 1}</span><select value={customT[index] || ""} onChange={event => { dismissKeyboard(); const types = [...customT]; types[index] = event.target.value; updatePk({ ...pk, customTypes: types.filter(Boolean) }); }} className="editor-input"><option value="">Sem tipo</option>{TYPES.map(type => <option key={type} value={type}>{formatType(type)}</option>)}</select></label>)}
                </div>
            </details>

            <section className="editor-stat-summary" aria-labelledby={`${fieldId}-stats-heading`}>
                <h3 id={`${fieldId}-stats-heading`}>{isTTRPG ? "Atributos do RPG" : "Atributos"}</h3>
                <dl>{pk.species?.stats?.map(stat => {
                    const name = stat.stat?.name; if (!name) return null;
                    const base = isHackmon && pk.customStats?.[name] !== undefined ? pk.customStats[name] : stat.base_stat || 0;
                    const value = calculateStat(base, pk.evs?.[name] ?? 0, pk.ivs?.[name] ?? 31, pk.level, getMulti(name), name === "hp", pk.species?.name);
                    return <div key={name}><dt>{STAT_MAP[name] || name}</dt><dd>{isTTRPG ? convertToTTRPG(value, name === "hp") : value}</dd></div>;
                })}</dl>
            </section>
            <details className="editor-disclosure pokemon-training-panel">
                <summary>
                    <span className="pokemon-training-heading"><strong>Treinamento</strong><small>IVs e EVs</small></span>
                    <span className={`pokemon-ev-budget ${evTotal > 508 ? "is-over-limit" : ""}`}><strong>{evTotal} EVs</strong><small>Limite: 510</small></span>
                </summary>
                <div className="editor-disclosure-body">
                    <div className="pokemon-training-toolbar">
                        <p>IVs de 0 a 31 · EVs até 252 por atributo</p>
                        <button type="button" onClick={() => randomize("ivs")} className="editor-training-random">⚄ Sortear IVs</button>
                    </div>
                    <div className="pokemon-stat-list">{pk.species?.stats?.map(stat => {
                        const name = stat.stat?.name; if (!name) return null;
                        const base = isHackmon && pk.customStats?.[name] !== undefined ? pk.customStats[name] : stat.base_stat || 0;
                        const ev = pk.evs?.[name] ?? 0; const iv = pk.ivs?.[name] ?? 31;
                        return <div key={name} className="pokemon-stat-row">
                            <h4>{STAT_MAP[name] || name}</h4>
                            <div className="pokemon-stat-controls">
                                <label><span>Base</span>{isHackmon ? <input type="number" aria-label={`Base de ${STAT_MAP[name] || name}`} min="1" max="255" value={base} onKeyDown={handleEnter} onChange={event => updatePk({ ...pk, customStats: { ...(pk.customStats || {}), [name]: event.target.value === "" ? "" : integerInRange(event.target.value, 1, 255, 1) } })} className="editor-input" /> : <output aria-label={`Base de ${STAT_MAP[name] || name}`}>{base}</output>}</label>
                                <label><span>IVs</span><input type="number" aria-label={`IVs de ${STAT_MAP[name] || name}`} min="0" max="31" value={iv} onKeyDown={handleEnter} onChange={event => handleChange("ivs", name, event.target.value)} className="editor-input" /></label>
                                <div className="pokemon-stat-ev"><span>EVs</span><div><input type="range" aria-label={`Ajustar EVs de ${STAT_MAP[name] || name}`} min="0" max="252" step="4" value={ev === "" ? 0 : ev} onChange={event => handleChange("evs", name, event.target.value)} /><input type="number" aria-label={`EVs de ${STAT_MAP[name] || name}`} min="0" max="252" value={ev} onKeyDown={handleEnter} onChange={event => handleChange("evs", name, event.target.value)} className="editor-input" /></div></div>
                            </div>
                        </div>;
                    })}</div>
                </div>
            </details>
            <footer className="editor-footer"><button type="button" onClick={() => { dismissKeyboard(); onRemove(); }} className="pokemon-remove-button">Remover Pokémon da Box</button></footer>
        </section>
    );
}
