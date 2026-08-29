import React, { useState, useEffect, useMemo } from 'react';
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
            if (!nextSpecies) throw new Error("Esta forma ainda não está disponível.");
            const profile = nextSpecies.species?.url
                ? await fetchCached(nextSpecies.species.url)
                : speciesProfile;
            const profileRate = finiteNumberOrNull(profile?.gender_rate);
            const nextRate = profileRate == null
                ? currentGenderRate
                : integerInRange(profileRate, -1, 8, currentGenderRate);
            const oldPrimaryType = pk.species?.types?.[0]?.type?.name || "";
            const nextPrimaryType = nextSpecies.types?.[0]?.type?.name || "";
            const forcedGender = nextRate === -1 ? "N" : nextRate === 0 ? "M" : nextRate === 8 ? "F" : pk.gender;
            updatePk({
                ...pk,
                species: { ...nextSpecies, gender_rate: nextRate },
                genderRate: nextRate,
                gender: forcedGender,
                ability: pk.ability || nextSpecies.abilities?.[0]?.ability?.name || "",
                teraType: !pk.teraType || pk.teraType === oldPrimaryType ? nextPrimaryType : pk.teraType,
                canGMax: nextSpecies.name?.includes("-gmax") ? true : pk.canGMax,
            });
            setSpeciesProfile(profile || null);
        } catch {
            setFormError("A Pokédex não conseguiu abrir essa forma agora, mas sua ficha continua intacta.");
        } finally {
            setSwitchingForm(false);
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
        <div className="game-panel pokemon-editor p-4 sm:p-6 lg:p-8 mt-6 animate-fade-in relative">
            <datalist id="eItems">{validItems.map(v => <option key={"item-" + v} value={v}></option>)}</datalist>
            <datalist id="eAbs">{validAbs.map(a => { const v = typeof a === "string" ? a : (a?.name || ""); return v ? <option key={"ab-" + v} value={v}></option> : null; })}</datalist>
            <datalist id="eMvs">{validMoves.map(m => { const v = typeof m === "string" ? m : (m?.name || ""); return v ? <option key={"mv-" + v} value={v}></option> : null; })}</datalist>
            
            <div className="flex flex-col xl:flex-row justify-between gap-4 sm:gap-6 mb-6 sm:mb-8 border-b-2 border-slate-200 pb-5 sm:pb-6">
                <div className="flex flex-col sm:flex-row gap-4 sm:gap-5 items-start sm:items-center w-full min-w-0">
                    <div className="w-20 h-20 sm:w-28 sm:h-28 bg-slate-50 rounded-2xl border-4 border-slate-200 flex justify-center items-center flex-shrink-0 relative shadow-inner">
                        {pk.canGMax && <div className="absolute inset-0 bg-red-500/10 rounded-xl animate-pulse"></div>}
                        <PokemonSprite
                            src={sprite}
                            pokemonId={pk.species?.id}
                            shiny={pk.shiny}
                            alt={`${formatName(pk.species?.name)}${pk.shiny ? " shiny" : ""}`}
                            className="w-full h-full p-2 object-contain drop-shadow-md relative z-10"
                            fallbackClassName="pokemon-sprite-fallback relative z-10"
                        />
                    </div>
                    
                    <div className="flex flex-col gap-2 sm:gap-3 w-full min-w-0">
                        <div className="flex flex-col w-full min-w-0">
                            <input 
                                type="text" 
                                value={pk.nickname !== undefined ? pk.nickname : formatName(pk.species?.name || "")} 
                                onKeyDown={handleEnter}
                                onChange={e => updatePk({...pk, nickname: e.target.value})} 
                                className="bg-transparent text-2xl sm:text-3xl font-black text-slate-800 focus:outline-none w-full min-w-0 tracking-tight border-b-2 border-transparent hover:border-slate-200 focus:border-blue-400 transition-colors pb-0.5 capitalize placeholder-slate-300"
                                placeholder={formatName(pk.species?.name || "")}
                                title="Editar apelido"
                            />
                            <div className="mt-1 flex min-w-0 flex-wrap items-center gap-2">
                                <span className="editor-species-name text-[9px] font-bold uppercase tracking-widest text-slate-400 sm:text-[10px]">
                                    {formatName(pk.species?.name || "")}
                                </span>
                                {forms.length > 1 && (
                                    <label className="form-switch">
                                        <span className="sr-only">Forma do Pokémon</span>
                                        <select
                                            value={forms.find(entry => entry.pokemon?.name === pk.species?.name)?.pokemon?.url || ""}
                                            disabled={switchingForm}
                                            onChange={event => void changeForm(event.target.value)}
                                        >
                                            {forms.map(entry => (
                                                <option key={entry.pokemon?.name} value={entry.pokemon?.url}>
                                                    {formatName(entry.pokemon?.name)}{entry.is_default ? " • padrão" : ""}
                                                </option>
                                            ))}
                                        </select>
                                    </label>
                                )}
                                {switchingForm && <span className="text-[8px] font-black uppercase tracking-widest text-blue-500">Abrindo esta forma…</span>}
                                {formError && <span role="alert" className="text-[8px] font-black text-red-500">{formError}</span>}
                            </div>
                        </div>

                        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                            <div className="flex items-center gap-2 bg-slate-50 px-2 sm:px-3 py-1.5 rounded-xl border-2 border-slate-200 shadow-sm">
                                <label className="text-[9px] sm:text-[10px] font-black text-slate-500 uppercase tracking-widest">Nível</label>
                                <input type="number" min="1" max={isHackmon?200:100} value={pk.level===""? "":pk.level} onKeyDown={handleEnter} onChange={e => updatePk({...pk, level: e.target.value === "" ? "" : integerInRange(e.target.value, 1, isHackmon ? 200 : 100, 1)})} className="w-10 sm:w-12 bg-transparent text-slate-800 text-xs sm:text-sm font-black focus:outline-none text-center" />
                            </div>
                            <div className="flex items-center gap-2 bg-slate-50 px-2 sm:px-3 py-1.5 rounded-xl border-2 border-slate-200 shadow-sm">
                                <label className="text-[9px] sm:text-[10px] font-black text-slate-500 uppercase tracking-widest">Amizade</label>
                                <input type="number" min="0" max="255" value={pk.friendship===""? "":pk.friendship} onKeyDown={handleEnter} onChange={e => updatePk({...pk, friendship: e.target.value === "" ? "" : integerInRange(e.target.value, 0, 255, 0)})} className="w-10 sm:w-12 bg-transparent text-slate-800 text-xs sm:text-sm font-black focus:outline-none text-center" />
                                {isTTRPG && <span className="text-[10px] sm:text-xs font-black text-red-500 border-l-2 border-slate-200 pl-2 sm:pl-3 ml-0.5 sm:ml-1">{convertToTTRPG(pk.friendship || 0)}</span>}
                            </div>
                            <label className={"flex items-center gap-2 bg-slate-50 px-2 sm:px-3 py-1.5 rounded-xl border-2 border-slate-200 transition-colors shadow-sm " + (isNativeGMax ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:border-red-400")}>
                                <div className={"w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-md border-2 flex items-center justify-center " + (pk.canGMax ? "bg-red-500 border-red-500" : "bg-white border-slate-300")}>{pk.canGMax && <svg className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7"></path></svg>}</div>
                                <span className={"text-[9px] sm:text-[10px] font-black uppercase tracking-widest " + (pk.canGMax ? "text-red-500" : "text-slate-500")}>Gigantamax</span>
                                <input type="checkbox" className="hidden" checked={pk.canGMax||false} disabled={isNativeGMax} onChange={e => { dismissKeyboard(); updatePk({...pk, canGMax: e.target.checked}); }} />
                            </label>
                            <label className="flex cursor-pointer items-center gap-2 rounded-xl border-2 border-slate-200 bg-slate-50 px-2 py-1.5 shadow-sm transition-colors hover:border-amber-300">
                                <input type="checkbox" checked={pk.shiny || false} onChange={event => updatePk({ ...pk, shiny: event.target.checked })} className="accent-amber-500" />
                                <span className={"text-[9px] sm:text-[10px] font-black uppercase tracking-widest " + (pk.shiny ? "text-amber-600" : "text-slate-500")}>Shiny</span>
                            </label>
                            <label className="flex items-center gap-2 rounded-xl border-2 border-slate-200 bg-slate-50 px-2 py-1.5 shadow-sm">
                                <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-slate-500">Nível Dynamax</span>
                                <input type="number" min="0" max="10" value={pk.dynamaxLevel ?? 0} onChange={event => updatePk({ ...pk, dynamaxLevel: integerInRange(event.target.value, 0, 10, 0) })} className="w-9 bg-transparent text-center text-xs font-black text-slate-800 outline-none" />
                            </label>
                            {isHackmon && (
                                <div className="flex gap-1.5 ml-1">
                                    {[0, 1].map(idx => <select key={idx} value={customT[idx] || ""} onChange={e => { dismissKeyboard(); const nT = [...customT]; nT[idx] = e.target.value; updatePk({...pk, customTypes: nT.filter(Boolean)}); }} className="bg-purple-50 border-2 border-purple-200 rounded-lg text-[10px] text-purple-600 uppercase font-black px-2 py-1 outline-none shadow-sm"><option value=""></option>{TYPES.map(t => <option key={t} value={t}>{formatType(t)}</option>)}</select>)}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <button onClick={() => { dismissKeyboard(); onRemove(); }} className="pokemon-remove-button w-full xl:w-auto flex items-center justify-center gap-2 self-stretch xl:self-start px-4 py-3 xl:py-2.5 mt-2 xl:mt-0 border-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-sm outline-none shrink-0">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                    Remover parceiro
                </button>
            </div>

            <div className="rotom-automation-bar" role="status">
                <strong><span aria-hidden="true">●</span> Assistente Rotom</strong>
                <span>Atributos e HP acompanham cada mudança</span>
                <span>Forma, habilidade e tipo Tera combinam entre si</span>
                <span>PP e progresso ficam sempre em dia</span>
                <em className={exceptionCount ? "has-exceptions" : ""}>
                    {exceptionCount
                        ? `${exceptionCount} ${exceptionCount === 1 ? "escolha livre mantida" : "escolhas livres mantidas"}`
                        : "Tudo pronto"}
                </em>
            </div>

            <div className="pokemon-editor-grid grid grid-cols-1 xl:grid-cols-2 gap-6 xl:gap-10">
                <div className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div><label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 pl-1">Item segurado</label><input list="eItems" value={pk.item||""} onKeyDown={handleEnter} onChange={e=>updatePk({...pk, item:(e.target.value||"").toLowerCase()})} className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3 text-slate-800 text-sm font-black focus-within:border-blue-400 outline-none capitalize shadow-inner" /></div>
                        <div>
                            <label className="block text-[10px] font-black text-blue-500 uppercase tracking-widest mb-2 pl-1">Tipo Tera</label>
                            <select value={pk.teraType || ""} onChange={event => updatePk({ ...pk, teraType: event.target.value })} className="w-full bg-blue-50 border-2 border-blue-200 rounded-xl px-4 py-3 text-blue-800 text-sm font-black focus:border-blue-500 outline-none shadow-inner">
                                {!pk.teraType && <option value="">Usar o tipo principal</option>}
                                {teraException && <option value={pk.teraType}>{formatName(pk.teraType)} • escolha livre</option>}
                                {TYPES.map(type => <option key={type} value={type}>{formatType(type)}</option>)}
                            </select>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="relative">
                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 pl-1">Habilidade</label>
                            <input list="eAbs" value={pk.ability||""} onKeyDown={handleEnter} onChange={e=>updatePk({...pk, ability:(e.target.value||"").toLowerCase()})} className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3 pr-10 text-slate-800 text-sm font-black focus:border-blue-400 outline-none capitalize shadow-inner" />
                            <button type="button" aria-label="Sortear habilidade" title="Sortear habilidade" onClick={()=>randomize("ability")} className="absolute right-4 top-[36px] text-slate-400 hover:text-blue-500 text-lg outline-none">🎲</button>
                            {abilityException && <span className="mt-1 block text-[8px] font-black uppercase tracking-wider text-amber-600">Escolha livre mantida</span>}
                        </div>
                        <div className="relative">
                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 pl-1">Natureza</label>
                            <select value={pk.nature||"hardy"} onChange={e=> { dismissKeyboard(); updatePk({...pk, nature:e.target.value}); }} className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3 pr-10 text-slate-800 text-sm font-black focus:border-blue-400 outline-none capitalize appearance-none shadow-inner">
                                {Object.keys(NATURES).map(n => <option key={n} value={n}>{n} {NATURES[n].up ? "(+" + STAT_MAP[NATURES[n].up] + ", -" + STAT_MAP[NATURES[n].down] + ")" : ""}</option>)}
                            </select>
                            <button type="button" aria-label="Sortear natureza" title="Sortear natureza" onClick={()=>randomize("nature")} className="absolute right-4 top-[36px] text-slate-400 hover:text-blue-500 text-lg outline-none">🎲</button>
                        </div>
                    </div>
                    {(pk.ability || pk.item) && (
                        <div className="editor-trait-reference" aria-label="Como habilidade e item entram na aventura">
                            <div className="editor-trait-reference-heading">
                                <span>Conexões de batalha</span>
                                <strong>O que esta escolha fará na cena</strong>
                            </div>
                            <div>
                                {[
                                    pk.ability ? { kind: "ability", id: pk.ability, detail: traitDetails.ability } : null,
                                    pk.item ? { kind: "item", id: pk.item, detail: traitDetails.item } : null,
                                ].filter(Boolean).map(trait => ({ ...trait, explanation: describeTrait(trait.kind, trait.id, trait.detail) })).map(trait => (
                                    <article key={`${trait.kind}-${trait.id}`} className={`is-${trait.kind}`}>
                                        <header><small>{trait.kind === "ability" ? "Habilidade" : "Item"}</small><b>{trait.explanation.handling}</b></header>
                                        <strong>{formatName(trait.id)}</strong>
                                        <p>{trait.explanation.summary}</p>
                                        <small>{trait.explanation.trigger}</small>
                                        {trait.explanation.catalog.text ? (
                                            <details><summary>{trait.explanation.catalog.label}</summary><p lang={trait.explanation.catalog.code}>{trait.explanation.catalog.text}</p></details>
                                        ) : (
                                            <p className="catalog-description-missing">O catálogo não trouxe outro texto. A regra acima continua à vista e nenhuma exceção será inventada.</p>
                                        )}
                                    </article>
                                ))}
                            </div>
                        </div>
                    )}
                    
                    <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 pl-1">Gênero</label>
                        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border-2 border-slate-200 bg-slate-50 p-2 shadow-inner">
                            <div className="flex flex-wrap gap-2">
                                <button type="button" onClick={() => { dismissKeyboard(); updatePk({...pk, gender: "M", genderRate: currentGenderRate, genderLocked: true}); }} disabled={!canUseMale} className={"flex items-center gap-1.5 sm:gap-2 rounded-xl px-2 sm:px-3 py-2 text-[10px] sm:text-xs font-black transition-all " + (pk.gender === "M" ? "bg-blue-500 text-white shadow-[0_3px_0_#0EA5E9]" : "text-slate-600 disabled:opacity-30 hover:bg-blue-100")}>
                                    <span className="text-sm sm:text-base">♂</span><span>Macho</span>
                                </button>
                                <button type="button" onClick={() => { dismissKeyboard(); updatePk({...pk, gender: "F", genderRate: currentGenderRate, genderLocked: true}); }} disabled={!canUseFemale} className={"flex items-center gap-1.5 sm:gap-2 rounded-xl px-2 sm:px-3 py-2 text-[10px] sm:text-xs font-black transition-all " + (pk.gender === "F" ? "bg-pink-500 text-white shadow-[0_3px_0_#7F1D1D]" : "text-slate-600 disabled:opacity-30 hover:bg-pink-100")}>
                                    <span className="text-sm sm:text-base">♀</span><span>Fêmea</span>
                                </button>
                                <button type="button" onClick={() => { dismissKeyboard(); updatePk({...pk, gender: "N", genderRate: currentGenderRate, genderLocked: true}); }} disabled={!canUseNeutral} className={"flex items-center gap-1.5 sm:gap-2 rounded-xl px-2 sm:px-3 py-2 text-[10px] sm:text-xs font-black transition-all " + (pk.gender === "N" ? "bg-slate-500 text-white shadow-[0_3px_0_#075985]" : "text-slate-600 disabled:opacity-30 hover:bg-slate-200")}>
                                    <span className="text-sm sm:text-base">⚲</span><span>Sem gênero</span>
                                </button>
                            </div>
                            <div className="flex items-center gap-1">
                                <button type="button" onClick={() => updatePk({ ...pk, genderLocked: !pk.genderLocked })} className={"rounded-xl px-2 py-2 text-xs font-black transition-all outline-none " + (pk.genderLocked ? "bg-slate-700 text-white" : "text-slate-500 hover:bg-slate-200")} aria-label={pk.genderLocked ? "Permitir novo sorteio de gênero" : "Manter o gênero escolhido"} title={pk.genderLocked ? "Permitir novo sorteio" : "Manter esta escolha"}>{pk.genderLocked ? "🔒" : "🔓"}</button>
                                <button type="button" disabled={pk.genderLocked || currentGenderRate === -1} onClick={() => randomize("gender")} className="rounded-xl px-3 py-2 text-sm font-black text-slate-500 transition-all hover:bg-blue-100 hover:text-blue-600 outline-none disabled:cursor-not-allowed disabled:opacity-30" aria-label="Sortear gênero pela proporção da espécie" title="Sortear pela proporção da espécie">🎲</button>
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 pl-1 flex justify-between"><span>Movimentos</span><span className="bg-slate-200 px-2 py-0.5 rounded text-slate-600">{pk.moves?.filter(Boolean).length||0}/4</span></label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {[0,1,2,3].map(index => {
                                const moveName = pk.moves?.[index] || "";
                                const normalizedName = moveName.trim().toLowerCase().replace(/\s+/g, "-");
                                const detail = moveDetails[normalizedName];
                                const moveExplanation = detail ? describeMove(detail, { isTTRPG }) : null;
                                const isException = Boolean(moveName) && !isHackmon && !validMoveNames.has(normalizedName);
                                const currentPp = rpg.pp?.[index];
                                return (
                                    <div key={index} className={`rounded-xl border-2 p-2 shadow-inner ${isException ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-slate-50"}`}>
                                        <input
                                            list="eMvs"
                                            value={moveName}
                                            aria-label={`Movimento ${index + 1}`}
                                            onKeyDown={handleEnter}
                                            onChange={event => {
                                                const moves = [...(pk.moves || [])];
                                                moves[index] = (event.target.value || "").toLowerCase();
                                                const pp = [...(rpg.pp || [null, null, null, null])];
                                                pp[index] = null;
                                                updatePk({ ...pk, moves, rpg: { ...rpg, pp } });
                                            }}
                                            className="w-full bg-transparent px-2 py-1.5 text-sm font-black capitalize text-slate-800 outline-none"
                                        />
                                        {(moveName || detail) && (
                                            <div className="mt-1 flex flex-wrap items-center gap-1 border-t border-slate-200/80 px-2 pt-2">
                                                {detail?.power != null && <span className="move-chip">Poder {isTTRPG ? convertToTTRPG(detail.power) : detail.power}</span>}
                                                <span className="move-chip">Precisão {detail?.accuracy == null ? "sem teste próprio" : `${detail.accuracy}%`}</span>
                                                <span className="move-chip">PP {currentPp ?? detail?.pp ?? "a confirmar"}/{detail?.pp ?? "regra própria"}</span>
                                                {detail?.priority !== 0 && detail?.priority != null && <span className="move-chip">Prioridade {detail.priority > 0 ? "+" : ""}{detail.priority}</span>}
                                                {isException && <span className="rounded-full bg-amber-200 px-2 py-0.5 text-[8px] font-black uppercase text-amber-800">{experienceMode === "game" ? "Não disponível neste jogo" : "Escolha livre"}</span>}
                                                {isTTRPG && moveName && (
                                                    <label className="editor-pp-label ml-auto flex items-center gap-2 text-[8px] font-black uppercase text-slate-400">
                                                        PP atual
                                                        <input
                                                            type="number"
                                                            aria-label={`PP atual de ${formatName(moveName)}`}
                                                            min="0"
                                                            max={detail?.pp || 99}
                                                            value={currentPp ?? ""}
                                                            placeholder={String(detail?.pp ?? "")}
                                                            onChange={event => {
                                                                const pp = [...(rpg.pp || [null, null, null, null])];
                                                                pp[index] = event.target.value === "" ? null : integerInRange(event.target.value, 0, integerInRange(detail?.pp, 0, 99, 99), 0);
                                                                updateRpg({ pp });
                                                            }}
                                                            className="editor-pp-control rounded-md border border-slate-200 bg-white p-1 text-center text-[9px] text-slate-700 outline-none"
                                                        />
                                                    </label>
                                                )}
                                            </div>
                                        )}
                                        {moveExplanation && (
                                            <details className="editor-move-description">
                                                <summary>Entender este movimento</summary>
                                                <p>{moveExplanation.summary}</p>
                                                <ul>{moveExplanation.facts.map((fact, factIndex) => <li key={`${normalizedName}-${factIndex}`}>{fact}</li>)}</ul>
                                                {moveExplanation.catalog.text && <p lang={moveExplanation.catalog.code}><strong>{moveExplanation.catalog.label}:</strong> {moveExplanation.catalog.text}</p>}
                                            </details>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                        <p className="mt-2 text-[9px] font-bold text-slate-400">{isHackmon ? "Na Criação livre, todas as opções estão à sua disposição." : "A Pokédex sugere os movimentos disponíveis neste jogo. Você também pode escrever uma escolha própria."}</p>
                    </div>

                    <details className="rpg-journey-panel rounded-2xl border-2">
                        <summary className="cursor-pointer list-none p-4">
                            <span className="flex items-center justify-between gap-3">
                                <span className="rpg-journey-summary-copy">
                                    <strong className="block text-[10px] font-black uppercase tracking-widest">Progresso da jornada</strong>
                                    <small className="mt-1 block text-[9px] font-bold text-slate-500">Acompanhe HP, XP, condição e tudo o que torna este Pokémon único.</small>
                                </span>
                                <span className="rpg-journey-hp shrink-0 rounded-full px-3 py-1 text-[9px] font-black shadow-sm">
                                    HP {rpg.currentHp ?? "—"}/{displayedMaxHp}
                                </span>
                            </span>
                        </summary>
                        <div className="rpg-journey-body grid gap-4 border-t-2 p-4 sm:grid-cols-2">
                            <label>
                                <span className="editor-label">HP atual</span>
                                <span className="flex gap-2">
                                    <input type="number" min="0" max={displayedMaxHp} value={rpg.currentHp ?? ""} placeholder={String(displayedMaxHp)} onChange={event => updateRpg({ currentHp: event.target.value === "" ? null : integerInRange(event.target.value, 0, displayedMaxHp, 0) })} className="editor-input" />
                                    <button type="button" onClick={() => updateRpg({ currentHp: displayedMaxHp })} className="rpg-recover-button rounded-xl border-2 px-3 text-[9px] font-black uppercase">Recuperar tudo</button>
                                </span>
                            </label>
                            <label>
                                <span className="editor-label">XP atual</span>
                                <span className="block">
                                    <span className="relative block">
                                        <input type="number" min="0" step="0.5" value={rpg.xp ?? 0} onChange={event => updateRpg({ xp: quantizeStepDown(event.target.value, 0.5, { minimum: 0, maximum: 999999, fallback: rpg.xp }) })} onBlur={() => applyXpProgression()} className="editor-input pr-24" />
                                        <small className="absolute right-3 top-3 text-[9px] font-black text-slate-400">de {formatNumberPtBr(nextLevelXp)} até o nível {Math.min(isHackmon ? 200 : 100, integerInRange(pk.level, 1, isHackmon ? 200 : 100, 1) + 1)}</small>
                                    </span>
                                    <span className="editor-xp-actions">
                                        <button type="button" onClick={() => awardXp(0.5)}>+0,5</button>
                                        <button type="button" onClick={() => awardXp(1)}>+1 XP</button>
                                        <small>Ao completar a meta, o próximo nível chega na hora.</small>
                                    </span>
                                </span>
                            </label>
                            <label>
                                <span className="editor-label">Condição</span>
                                <select value={rpg.status || ""} onChange={event => updateRpg({ status: event.target.value })} className="editor-input">
                                    {RPG_STATUSES.map(status => <option key={status || "none"} value={status}>{RPG_STATUS_LABELS[status]}</option>)}
                                </select>
                            </label>
                            <label>
                                <span className="editor-label">Poké Ball da captura</span>
                                <input type="text" value={rpg.caughtWith || ""} onChange={event => updateRpg({ caughtWith: event.target.value })} placeholder="Ex.: Luxury Ball" className="editor-input" />
                            </label>
                            <label className="sm:col-span-2">
                                <span className="editor-label">Treinador original</span>
                                <input type="text" value={rpg.originalTrainer || ""} onChange={event => updateRpg({ originalTrainer: event.target.value })} placeholder="Nome do treinador" className="editor-input" />
                            </label>
                            <label className="sm:col-span-2">
                                <span className="editor-label">Notas da jornada</span>
                                <textarea value={rpg.notes || ""} onChange={event => updateRpg({ notes: event.target.value })} placeholder="Personalidade, vínculos, evolução, conquistas…" rows="3" className="editor-input resize-y" />
                            </label>
                            <label className="sm:col-span-2">
                                <span className="editor-label text-purple-600">Possibilidades da aventura</span>
                                <textarea value={rpg.animeNotes || ""} onChange={event => updateRpg({ animeNotes: event.target.value })} placeholder="Técnicas próprias, combinações criativas e descobertas especiais…" rows="3" className="editor-input resize-y border-purple-200 bg-purple-50/60 focus:border-purple-400" />
                            </label>
                        </div>
                    </details>
                </div>

                <div className="pokemon-training-panel bg-slate-50 p-4 sm:p-6 rounded-2xl border-2 border-slate-200 shadow-sm mt-2 sm:mt-0">
                    <div className="flex justify-between items-center mb-4 sm:mb-6 pb-3 sm:pb-4 border-b-2 border-slate-200">
                        <div className="flex items-center gap-3">
                            <h3 className="text-[10px] sm:text-[11px] font-black text-slate-500 uppercase tracking-widest">Treinamento</h3>
                            <button onClick={() => randomize("ivs")} className="sm:hidden flex items-center gap-1 text-[9px] font-black text-slate-500 hover:text-blue-500 transition-colors outline-none bg-white px-2 py-1 rounded-md border-2 border-slate-200 shadow-sm active:translate-y-px">
                                IVs 🎲
                            </button>
                        </div>
                        <div className={`pokemon-ev-budget text-[9px] sm:text-[10px] font-black text-slate-500 uppercase tracking-widest bg-white px-3 py-1.5 rounded-lg border-2 border-slate-200 shadow-sm ${evTotal > 508 ? "is-over-limit" : ""}`} aria-live="polite">
                            EVs restantes: <span>{510 - evTotal}</span>/510
                        </div>
                    </div>
                    
                    <div className="w-full">
                        <div className="pokemon-stat-heading hidden sm:flex items-center gap-2 mb-3 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center px-2">
                            <div className="w-12 text-left">Atributo</div>
                            <div className="w-10">Base</div>
                            <div className="flex-1 text-left">Esforço (EVs)</div>
                            <div className="w-12 cursor-pointer hover:text-blue-500 flex items-center justify-center gap-1 transition-colors" onClick={() => randomize("ivs")}>IVs 🎲</div>
                            <div className={"w-12 text-right " + (isTTRPG ? "text-red-500" : "text-slate-800")}>Total</div>
                        </div>
                        
                        <div className="flex flex-col gap-2.5">
                            {pk.species?.stats?.map(s => {
                                const sN = s.stat?.name;
                                if (!sN) return null;
                                const base = isHackmon && pk.customStats?.[sN] !== undefined ? pk.customStats[sN] : (s.base_stat || 0);
                                const ev = pk.evs?.[sN] ?? 0; const iv = pk.ivs?.[sN] ?? 31; const multi = getMulti(sN);
                                const rawVal = calculateStat(base, ev, iv, pk.level, multi, sN === "hp", pk.species?.name);
                                const finalVal = isTTRPG ? convertToTTRPG(rawVal, sN === "hp") : rawVal;
                                
                                let cCol = "text-slate-800";
                                if (isTTRPG) cCol = "text-red-600";
                                else if (multi > 1) cCol = "text-emerald-600";
                                else if (multi < 1) cCol = "text-red-500";
                                
                                return (
                                    <div key={sN} className="pokemon-stat-row flex flex-col sm:flex-row items-center gap-2 sm:gap-3 bg-white p-3 sm:p-2.5 rounded-xl border-2 border-slate-200 shadow-sm hover:border-blue-300 transition-colors">
                                        <div className="flex justify-between items-center w-full sm:w-12 shrink-0">
                                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{STAT_MAP[sN] || sN}</span>
                                            <div className={"sm:hidden text-sm font-black flex items-center gap-1 " + cCol}>
                                                {!isTTRPG && multi > 1 && <span className="text-emerald-500">↑</span>}
                                                {!isTTRPG && multi < 1 && <span className="text-red-500">↓</span>}
                                                {finalVal}
                                            </div>
                                        </div>
                                        <div className="pokemon-stat-controls flex items-center justify-between gap-2 w-full sm:flex-1">
                                            <div className="w-10 flex justify-center shrink-0">
                                                {isHackmon ? (
                                                    <input type="number" min="1" max="255" value={base === "" ? "" : base} onKeyDown={handleEnter} onChange={e => updatePk({...pk, customStats: {...(pk.customStats || {}), [sN]: e.target.value === "" ? "" : integerInRange(e.target.value, 1, 255, 1)}})} className="w-full bg-purple-50 border-2 border-purple-200 rounded p-1 text-purple-700 text-[10px] font-black text-center outline-none focus:border-purple-500" />
                                                ) : (
                                                    <div className="text-[11px] font-black text-slate-700">{base}</div>
                                                )}
                                            </div>
                                            <div className="pokemon-stat-ev flex-1 flex items-center gap-2 min-w-0">
                                                <input type="range" min="0" max="252" step="4" value={ev === "" ? 0 : ev} onChange={e => handleChange("evs", sN, e.target.value)} className="w-full min-w-0 accent-red-500" />
                                                <input type="number" min="0" max="252" value={ev === "" ? "" : ev} onKeyDown={handleEnter} onChange={e => handleChange("evs", sN, e.target.value)} className="w-11 shrink-0 bg-slate-50 border-2 border-slate-200 rounded-lg p-1 text-slate-800 text-[10px] text-center outline-none font-black focus:border-blue-400" />
                                            </div>
                                            <div className="w-10 sm:w-12 flex justify-center shrink-0">
                                                <input type="number" min="0" max="31" value={iv === "" ? "" : iv} onKeyDown={handleEnter} onChange={e => handleChange("ivs", sN, e.target.value)} className="w-full bg-slate-50 border-2 border-slate-200 rounded-lg p-1 text-slate-800 text-[10px] text-center outline-none font-black focus:border-blue-400" />
                                            </div>
                                        </div>
                                        <div className={"hidden sm:flex w-12 justify-end items-center gap-1 text-sm font-black shrink-0 " + cCol}>
                                            {!isTTRPG && multi > 1 && <span className="text-emerald-500">↑</span>}
                                            {!isTTRPG && multi < 1 && <span className="text-red-500">↓</span>}
                                            {finalVal}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
