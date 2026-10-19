import { getReferenceBattleMechanics } from "../../core/referenceGames.js";
import { gmaxEligible, megaFormFor } from "../../core/battleGimmicks.js";
import zaForms from "../../data/mega-za-forms.json" with { type: "json" };
import React, { useState, useEffect, useId, useMemo, useRef } from 'react';
import { formatCanonicalItemName, RPG_STATUS_LABELS } from '../../core/copy.js';
import { describeMove } from '../../core/descriptions.js';
import { getCatalogText, getFallbackMoveText, loadCatalogText } from '../../core/catalogText.js';
import { fetchCached, calculateStat, formatName, formatNumberPtBr, formatType, convertToTTRPG, NATURES, STAT_MAP, TYPES, TYPE_COLORS, TYPE_TEXT_COLORS, filterMovesByLatestVersion } from '../../core/mechanics.js';
import { getNextLevelXp } from '../../core/rpgRules.js';
import { applyPokemonExperienceAward } from '../../core/experience.js';
import { finiteNumberOrNull, integerInRange } from '../../core/math.js';
import { randomChance, randomChoice, randomInt } from '../../core/random.js';
import { getPokemonConsumedItem, replacePokemonHeldItem, RPG_STATUSES } from '../../core/team.js';
import { getPokemonGenderRate } from '../../core/pokemonGender.js';
import { getSamePokemonForms, isSharedBattleForm } from '../../core/pokemonFormChoices.js';
import { getMoveReferenceForMode, resolveLearnsetGame } from '../../core/referenceGames.js';
import PokemonSprite from '../Shared/PokemonSprite.jsx';
import RoomSelect from '../Shared/RoomSelect.jsx';
import ReferenceText from '../Shared/ReferenceText.jsx';
import AbilityCard from '../Pokedex/AbilityCard.jsx';
import ItemCard from '../Pokedex/ItemCard.jsx';
import ExperienceAward from '../Shared/ExperienceAward.jsx';
import EvTraining from '../Shared/EvTraining.jsx';
import FriendshipControl from '../Shared/FriendshipControl.jsx';
import CatalogInput from '../Shared/CatalogInput.jsx';

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
    const { allItems, allMoves, allAbilities, selectedVersionGroup, experienceMode, isTTRPG, isHackmon } = envProps;
    const [baseForm, setBaseForm] = useState(null);
    const [speciesProfile, setSpeciesProfile] = useState(null);
    const [moveDetails, setMoveDetails] = useState({});
    const [moveCatalogReady, setMoveCatalogReady] = useState(false);
    const [activeMoveSlot, setActiveMoveSlot] = useState(null);
    const [switchingForm, setSwitchingForm] = useState(false);
    const [formError, setFormError] = useState("");
    const [traitDetails, setTraitDetails] = useState({ ability: null, item: null });
    const fieldId = useId();
    const mountedRef = useRef(false);
    const partnerRef = useRef(pk);
    const consumedItem = getPokemonConsumedItem(pk);

    useEffect(() => {
        mountedRef.current = true;
        return () => { mountedRef.current = false; };
    }, []);

    useEffect(() => { partnerRef.current = pk; }, [pk]);

    useEffect(() => {
        let active = true;
        loadCatalogText('move').then(() => { if (active) setMoveCatalogReady(true); }).catch(() => { if (active) setMoveCatalogReady(true); });
        return () => { active = false; };
    }, []);

    const dismissKeyboard = () => {
        const control = document.activeElement;
        if (control?.matches('textarea, input:not([type="checkbox"]):not([type="radio"]):not([type="range"])')) control.blur();
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
            const defVar = getSamePokemonForms(sp.varieties, { name: pk.species?.name, speciesId: sp.id }).find(v => v.is_default);
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
    // A chosen game applies to the whole sheet, including PP and move effects.
    // Auto keeps current RPG/Livre rules and resolves the latest game in Jogos.
    const referenceVersion = selectedVersionGroup && selectedVersionGroup !== 'auto'
        ? selectedVersionGroup
        : experienceMode === 'game' ? resolveLearnsetGame(pk.species?.moves || [], 'auto') || 'champions'
            : 'champions';

    useEffect(() => {
        let mounted = true;
        const names = [...new Set((pk.moves || []).filter(Boolean)
            .map(name => name.trim().toLowerCase().replace(/\s+/g, "-"))
            .filter(name => validMoveNames.has(name)))];
        if (!names.length) {
            setMoveDetails({});
            return () => { mounted = false; };
        }
        Promise.all(names.map(async name => [name, await fetchCached(`https://pokeapi.co/api/v2/move/${encodeURIComponent(name)}`)]))
            .then(entries => {
                if (mounted) setMoveDetails(Object.fromEntries(entries.filter(([, data]) => data)));
            });
        return () => { mounted = false; };
    }, [pk.moves, validMoveNames]);

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
            ...zaForms.entries.map(form=>form.item),
            ...(Array.isArray(allItems) ? allItems.map(item => typeof item === "string" ? item : item?.name) : []),
        ].filter(Boolean);
        return [...new Set(names)].sort((a, b) => a.localeCompare(b));
    }, [allItems]);

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
    const forms = useMemo(() => getSamePokemonForms(speciesProfile?.varieties, {
        name: pk.species?.name,
        speciesId: speciesProfile?.id,
    }), [speciesProfile, pk.species?.name]);

    const mechanics = getReferenceBattleMechanics(referenceVersion, experienceMode);
    const battleForms = forms.filter(entry => isSharedBattleForm(entry.pokemon?.name) && (entry.pokemon.name === pk.species?.name || (entry.pokemon.name.includes("-mega") ? mechanics.mega : mechanics.dynamax)));
    const individualForms = forms.filter(entry => !isSharedBattleForm(entry.pokemon?.name));
    const inBattleForm = isSharedBattleForm(pk.species?.name);
    const megaItems = validItems.filter(item => megaFormFor({ speciesName: pk.species?.name, speciesId: speciesProfile?.id || pk.species?.id, formName: pk.formKey, item, moves: pk.moves }));
    const zItems = validItems.filter(item => item.endsWith("-z") && item !== "ultranecrozium-z");
    const battleFormLabel = [battleForms.some(entry => entry.pokemon.name.includes("-mega")) && "Mega Evolução", battleForms.some(entry => entry.pokemon.name.endsWith("-gmax")) && "Gigantamax"].filter(Boolean).join(" / ");
    const showGigantamax = isHackmon || pk.canGMax || gmaxEligible({ speciesName: pk.species?.name });

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
        const selected = forms.find(entry => entry.pokemon?.url === formUrl);
        if (!selected) return;
        const originalPartner = partnerRef.current;
        const current = forms.find(entry => entry.pokemon?.name === pk.species?.name);
        if (current?.pokemon?.url === formUrl) return;
        setSwitchingForm(true);
        setFormError("");
        try {
            const nextSpecies = await fetchCached(formUrl);
            if (!mountedRef.current) return;
            if (!nextSpecies || nextSpecies.name !== selected.pokemon.name) throw new Error("Esta forma ainda não está disponível.");
            const profile = nextSpecies.species?.url
                ? await fetchCached(nextSpecies.species.url)
                : speciesProfile;
            if (!mountedRef.current) return;
            const currentPartner = partnerRef.current;
            if (currentPartner.id !== originalPartner.id || currentPartner.species?.name !== originalPartner.species?.name
                || currentPartner.formKey !== originalPartner.formKey) return;
            const fallbackRate = integerInRange(currentPartner.genderRate ?? currentPartner.species?.gender_rate, -1, 8, -1);
            const profileRate = finiteNumberOrNull(profile?.gender_rate);
            const nextRate = getPokemonGenderRate(nextSpecies, profileRate ?? fallbackRate);
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
                formKey: "",
                formId: null,
            });
            setSpeciesProfile(profile || null);
        } catch {
            if (mountedRef.current) setFormError("Não foi possível abrir esta forma. Escolha outra ou tente novamente.");
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

    const currentGenderRate = getPokemonGenderRate(pk);
    const canUseMale = currentGenderRate !== -1 && currentGenderRate !== 8;
    const canUseFemale = currentGenderRate !== -1 && currentGenderRate !== 0;
    const canUseNeutral = currentGenderRate === -1;

    useEffect(() => {
        const forcedGender = currentGenderRate === -1 ? "N" : currentGenderRate === 0 ? "M" : currentGenderRate === 8 ? "F" : null;
        if (forcedGender && (pk.gender !== forcedGender || pk.genderRate !== currentGenderRate)) {
            updatePk({ ...pk, gender: forcedGender, genderRate: currentGenderRate });
        }
    // Only a ratio or selected-gender change can require normalization.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentGenderRate, pk.gender, pk.genderRate]);

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
    const xpLevelCap = isHackmon ? 200 : 100;
    const atXpLevelCap = integerInRange(pk.level, 1, xpLevelCap, 1) >= xpLevelCap;
    const nextLevelXp = getNextLevelXp(pk.level);
    const updateRpg = patch => updatePk({ ...pk, rpg: { ...rpg, ...patch } });
    const setMove = (index, value) => {
        const moves = [...(pk.moves || [])];
        moves[index] = String(value || '').toLowerCase();
        const pp = [...(rpg.pp || [null, null, null, null])];
        if (moves[index] !== (pk.moves?.[index] || '')) pp[index] = null;
        updatePk({ ...pk, moves, rpg: { ...rpg, pp } });
    };
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
        const xp = integerInRange(xpValue, 0, 999999, rpg.xp ?? 0);
        const levelCap = isHackmon ? 200 : 100;
        const currentLevel = integerInRange(pk.level, 1, levelCap, 1);
        const currentXp = integerInRange(rpg.xp, 0, 999999, 0);
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
                    : rpg.currentHp <= 0 ? 0
                    : Math.min(nextMaxHp, integerInRange(rpg.currentHp, 0, displayedMaxHp, displayedMaxHp) + hpGrowth),
            },
        });
    };

    const receiveExperience = reward => {
        const next = applyPokemonExperienceAward(partnerRef.current, {
            xp: reward.xp,
            awardId: reward.awardId,
            isTTRPG,
            levelCap: xpLevelCap,
        });
        partnerRef.current = next;
        updatePk(next);
    };
    return (
        <section className="pokemon-editor animate-fade-in" aria-label={`Editar ${pk.nickname || formatName(pk.formKey || pk.species?.name)}`}>

            <header className="editor-header" style={{ "--summary-type": TYPE_COLORS[pk.species?.types?.[0]?.type?.name] || "var(--ui-blue)" }}>
                <div className="editor-portrait-stage"><span className="editor-summary-caption">Resumo</span><PokemonSprite src={sprite} pokemonId={pk.species?.id} shiny={pk.shiny} alt={`${formatName(pk.formKey || pk.species?.name)}${pk.shiny ? " shiny" : ""}`} className="editor-portrait" /></div>
                <div className="editor-identity">
                    <label className="editor-field">
                        <span className="editor-label">Apelido</span>
                        <input type="text" value={pk.nickname !== undefined ? pk.nickname : formatName(pk.species?.name || "")} onKeyDown={handleEnter} onChange={event => updatePk({ ...pk, nickname: event.target.value })} className="editor-input editor-nickname" />
                    </label>
                    <label className="editor-shiny"><input aria-label="Shiny" type="checkbox" checked={pk.shiny || false} onChange={event => updatePk({ ...pk, shiny: event.target.checked })} /> ✦ Shiny</label>
                    <span className="editor-species-name">{formatName(pk.formKey || pk.species?.name || "")}</span>
                    <div className="editor-summary-types" aria-label="Tipos deste Pokémon">{(isHackmon && customT.length ? customT : (pk.species?.types || []).map(entry => entry.type?.name)).filter(Boolean).map(type => <span key={type} style={{ backgroundColor: TYPE_COLORS[type], color: TYPE_TEXT_COLORS[type] }}>{formatType(type)}</span>)}</div>
                    <div className="editor-summary-health"><strong>HP {rpg.currentHp ?? displayedMaxHp} / {displayedMaxHp}</strong><span>{RPG_STATUS_LABELS[rpg.status || ""] || "Sem condição"}</span></div>
                </div>
                <label className="editor-field editor-level">
                    <span className="editor-label">Nível</span>
                    <input type="number" inputMode="numeric" min="1" max={isHackmon ? 200 : 100} value={pk.level === "" ? "" : pk.level} onKeyDown={handleEnter} onChange={event => updatePk({ ...pk, level: event.target.value === "" ? "" : integerInRange(event.target.value, 1, isHackmon ? 200 : 100, 1) })} className="editor-input" />
                </label>
            </header>
            {exceptionCount > 0 && <p className="editor-exception-note" role="status">{`${exceptionCount} ${exceptionCount === 1 ? "escolha fora do jogo de referência" : "escolhas fora do jogo de referência"}.`}</p>}

            <div className="editor-basics-grid">
                <div className="editor-field">
                    <label htmlFor={`${fieldId}-item`} className="editor-label">Item segurado</label>
                    <CatalogInput id={`${fieldId}-item`} value={pk.item || ""} options={validItems.map(value => ({ value, label: formatCanonicalItemName(value) }))} suggestionsLabel="Itens correspondentes" onKeyDown={handleEnter} onChange={value => updatePk(replacePokemonHeldItem(pk, value))} className="editor-input" />
                    {consumedItem && <>
                        <span className="editor-field-note">Já foi usado ou perdido.</span>
                        <button type="button" className="room-secondary-button" onClick={() => updatePk(replacePokemonHeldItem(pk, pk.item))} aria-label={`Repor ${formatCanonicalItemName(consumedItem)}`}>Repor item</button>
                    </>}
                </div>
                <div className="editor-field">
                    <label htmlFor={`${fieldId}-ability`} className="editor-label">Habilidade</label>
                    <div className="editor-choice-control">
                        <CatalogInput id={`${fieldId}-ability`} value={pk.ability || ""} options={validAbs.map(ability => typeof ability === "string" ? ability : ability?.name).filter(Boolean).map(value => ({ value, label: formatName(value) }))} suggestionsLabel="Habilidades correspondentes" onKeyDown={handleEnter} onChange={value => updatePk({ ...pk, ability: value.toLowerCase() })} className="editor-input" />
                        {validAbs.length > 1 && <button type="button" aria-label="Sortear habilidade" title="Sortear habilidade" onClick={() => randomize("ability")} className="editor-random-button">⚄</button>}
                    </div>
                    {abilityException && <span className="editor-field-note">Escolha livre mantida</span>}
                </div>
                <div className="editor-field">
                    <label htmlFor={`${fieldId}-nature`} className="editor-label">Natureza</label>
                    <div className="editor-choice-control">
                        <RoomSelect id={`${fieldId}-nature`} value={pk.nature || "hardy"} onChange={event => { dismissKeyboard(); updatePk({ ...pk, nature: event.target.value }); }} className="editor-input">
                            {Object.keys(NATURES).map(nature => <option key={nature} value={nature}>{formatName(nature)} {NATURES[nature].up ? `(+${STAT_MAP[NATURES[nature].up]}, −${STAT_MAP[NATURES[nature].down]})` : ""}</option>)}
                        </RoomSelect>
                        <button type="button" aria-label="Sortear natureza" title="Sortear natureza" onClick={() => randomize("nature")} className="editor-random-button">⚄</button>
                    </div>
                </div>
                <div className="editor-field">
                    <span className="editor-label" id={`${fieldId}-gender-label`}>Gênero</span>
                    <div className="editor-gender-controls" role="group" aria-labelledby={`${fieldId}-gender-label`}>
                        <div className="editor-gender-selection">
                        {[
                            { value: "M", label: "Macho", symbol: "♂", enabled: canUseMale },
                            { value: "F", label: "Fêmea", symbol: "♀", enabled: canUseFemale },
                            { value: "N", label: "Sem gênero", symbol: "⚲", enabled: canUseNeutral },
                        ].filter(choice => choice.enabled).map(choice => <button key={choice.value} type="button" aria-pressed={pk.gender === choice.value} onClick={() => { dismissKeyboard(); updatePk({ ...pk, gender: choice.value, genderRate: currentGenderRate, genderLocked: true }); }}>{choice.symbol} {choice.label}</button>)}
                        </div>
                        {canUseMale && canUseFemale && <div className="editor-gender-tools">
                            <button type="button" onClick={() => updatePk({ ...pk, genderLocked: !pk.genderLocked })} aria-pressed={Boolean(pk.genderLocked)} aria-label={pk.genderLocked ? "Permitir novo sorteio de gênero" : "Manter o gênero escolhido"} title={pk.genderLocked ? "Permitir novo sorteio" : "Manter esta escolha"}><span aria-hidden="true">{pk.genderLocked ? "🔒" : "🔓"}</span> Manter escolha</button>
                            <button type="button" disabled={pk.genderLocked} onClick={() => randomize("gender")} aria-label="Sortear gênero pela proporção da espécie" title="Sortear gênero"><span aria-hidden="true">⚄</span> Sortear</button>
                        </div>}
                    </div>
                </div>
            </div>

            <section className="editor-friendship" aria-label="Amizade">
                <FriendshipControl pokemon={pk} onChange={updatePk} isTTRPG={isTTRPG} />
            </section>
            {isHackmon && <div className="editor-basics-grid">{[0, 1].map(index => <label key={index} className="editor-field"><span className="editor-label">Tipo personalizado {index + 1}</span><RoomSelect aria-label={`Tipo personalizado ${index + 1}`} value={customT[index] || ""} onChange={event => { const types = [...customT]; types[index] = event.target.value; updatePk({ ...pk, customTypes: types.filter(Boolean) }); }} className="editor-input"><option value="">Sem tipo</option>{TYPES.map(type => <option key={type} value={type}>{formatType(type)}</option>)}</RoomSelect></label>)}</div>}
            {switchingForm && <span role="status" className="sr-only">Consultando forma…</span>}
            {formError && <p role="alert" className="editor-error">{formError}</p>}
            {!inBattleForm && individualForms.length > 1 && <details className="editor-disclosure editor-forms">
                <summary>Formas do Pokémon</summary>
                <div className="editor-disclosure-body editor-basics-grid">
                    {individualForms.length > 1 && <label className="editor-field form-switch">
                        <span className="editor-label">Forma</span>
                        <RoomSelect aria-label="Forma" className="editor-input" value={forms.find(entry => entry.pokemon?.name === pk.species?.name)?.pokemon?.url || ""} disabled={switchingForm} onChange={event => void changeForm(event.target.value)}>
                            {individualForms.map(entry => <option key={entry.pokemon?.name} value={entry.pokemon?.url}>{formatName(entry.pokemon?.name)}{entry.is_default ? " · padrão" : ""}</option>)}
                        </RoomSelect>
                    </label>}
                </div>
            </details>}
            {(Object.values(mechanics).some(Boolean) || inBattleForm) && <details className="editor-disclosure editor-battle-mechanics">
                <summary>Mega, Z-Move, Dynamax e Tera</summary>
                <div className="editor-disclosure-body editor-basics-grid">
                    {mechanics.mega && megaItems.length > 0 && <label className="editor-field"><span className="editor-label">Mega Stone</span><RoomSelect aria-label="Mega Stone" value={megaItems.includes(pk.item) ? pk.item : ""} onChange={event => updatePk({ ...pk, item: event.target.value })} className="editor-input"><option value="">Sem Mega Stone</option>{megaItems.map(item => <option key={item} value={item}>{formatCanonicalItemName(item)}</option>)}</RoomSelect></label>}
                    {mechanics.z && <label className="editor-field"><span className="editor-label">Z-Crystal</span><RoomSelect aria-label="Z-Crystal" value={zItems.includes(pk.item) ? pk.item : ""} onChange={event => updatePk({ ...pk, item: event.target.value })} className="editor-input"><option value="">Sem Z-Crystal</option>{zItems.map(item => <option key={item} value={item}>{formatCanonicalItemName(item)}</option>)}</RoomSelect></label>}
                    {battleForms.length > 0 && <label className="editor-field"><span className="editor-label">{battleFormLabel}</span><RoomSelect aria-label={battleFormLabel} value={forms.find(entry => entry.pokemon?.name === pk.species?.name)?.pokemon?.url || ""} disabled={switchingForm} onChange={event => void changeForm(event.target.value)} className="editor-input">{[individualForms.find(entry => entry.pokemon?.name === pk.species?.name) || individualForms.find(entry => entry.is_default) || individualForms[0], ...battleForms].filter(Boolean).map(entry => <option key={entry.pokemon?.name} value={entry.pokemon?.url}>{formatName(entry.pokemon?.name)}</option>)}</RoomSelect></label>}
                    {(mechanics.mega || mechanics.z) && <p className="editor-field-note">Mega Stones e Z-Crystals usam o espaço do item segurado. Na Aventura, ative a técnica durante a batalha.</p>}
                    {mechanics.tera && <label className="editor-field"><span className="editor-label">Tipo Tera</span><RoomSelect aria-label="Tipo Tera" value={pk.teraType || ""} onChange={event => updatePk({ ...pk, teraType: event.target.value })} className="editor-input">{!pk.teraType && <option value="">Usar o tipo principal</option>}{teraException && <option value={pk.teraType}>{formatName(pk.teraType)} · escolha livre</option>}{TYPES.map(type => <option key={type} value={type}>{formatType(type)}</option>)}</RoomSelect></label>}
                    {mechanics.dynamax && <label className="editor-field"><span className="editor-label">Nível Dynamax</span><input type="number" inputMode="numeric" min="0" max="10" value={pk.dynamaxLevel ?? 0} onChange={event => updatePk({ ...pk, dynamaxLevel: integerInRange(event.target.value, 0, 10, 0) })} className="editor-input" /></label>}
                    {mechanics.dynamax && showGigantamax && <div className="editor-checkboxes"><label><input type="checkbox" checked={pk.canGMax || false} disabled={isNativeGMax} onChange={event => { dismissKeyboard(); updatePk({ ...pk, canGMax: event.target.checked }); }} />Gigantamax</label></div>}
                </div>
            </details>}

            {(pk.ability || pk.item) && <details className="editor-disclosure editor-trait-reference">
                <summary>Consultar habilidade e item</summary>
                <div className="editor-disclosure-body">
                    {pk.ability && <AbilityCard name={pk.ability} detail={traitDetails.ability} versionGroup={referenceVersion} compact />}
                    {pk.item && <ItemCard name={pk.item} detail={traitDetails.item} versionGroup={referenceVersion} compact />}
                </div>
            </details>}

            <section className="editor-stat-summary" aria-labelledby={`${fieldId}-stats-heading`}>
                <h3 id={`${fieldId}-stats-heading`}>{isTTRPG ? "Atributos do RPG" : "Atributos"}</h3>
                <dl>{pk.species?.stats?.map(stat => {
                    const name = stat.stat?.name; if (!name) return null;
                    const base = isHackmon && pk.customStats?.[name] !== undefined ? pk.customStats[name] : stat.base_stat || 0;
                    const value = calculateStat(base, pk.evs?.[name] ?? 0, pk.ivs?.[name] ?? 31, pk.level, getMulti(name), name === "hp", pk.species?.name);
                    return <div key={name}><dt>{STAT_MAP[name] || name}</dt><dd>{isTTRPG ? convertToTTRPG(value, name === "hp") : value}</dd></div>;
                })}</dl>
                <details className="editor-move-description editor-stat-help">
                    <summary>Entender os atributos</summary>
                    <ul>
                        <li><strong>HP:</strong> energia do Pokémon. Com zero HP, ele fica fora de combate.</li>
                        <li><strong>Ataque e Defesa:</strong> força e proteção contra movimentos físicos.</li>
                        <li><strong>Ataque Especial e Defesa Especial:</strong> força e proteção contra movimentos especiais.</li>
                        <li><strong>Velocidade:</strong> ajuda a definir a ordem dos turnos.</li>
                    </ul>
                </details>
            </section>
            <details className="editor-disclosure pokemon-training-panel">
                <summary>
                    <span className="pokemon-training-heading"><strong>Treinamento</strong><small>IVs e EVs</small></span>
                    <span className={`pokemon-ev-budget ${evTotal > 510 ? "is-over-limit" : ""}`}><strong>{evTotal} EVs</strong><small>{rpg.pendingEvs > 0 ? `${rpg.pendingEvs} para treinar` : "Limite: 510"}</small></span>
                </summary>
                <div className="editor-disclosure-body">
                    <EvTraining pokemon={pk} onChange={updatePk} />
                    <div className="pokemon-training-toolbar">
                        <p>IVs de 0 a 31 · EVs até 252 por atributo</p>
                        <button type="button" onClick={() => randomize("ivs")} className="editor-training-random">⚄ Sortear IVs</button>
                    </div>
                    <details className="editor-move-description editor-training-help">
                        <summary>O que são IVs e EVs?</summary>
                        <p><strong>IVs</strong> são as características naturais do Pokémon. <strong>EVs</strong> são pontos ganhos com treinamento. Ambos influenciam seus atributos.</p>
                    </details>
                    <div className="pokemon-stat-list">{pk.species?.stats?.map(stat => {
                        const name = stat.stat?.name; if (!name) return null;
                        const base = isHackmon && pk.customStats?.[name] !== undefined ? pk.customStats[name] : stat.base_stat || 0;
                        const ev = pk.evs?.[name] ?? 0; const iv = pk.ivs?.[name] ?? 31;
                        return <div key={name} className="pokemon-stat-row">
                            <h4>{STAT_MAP[name] || name}</h4>
                            <div className="pokemon-stat-controls">
                                <label><span>Base</span>{isHackmon ? <input type="number" aria-label={`Base de ${STAT_MAP[name] || name}`} min="1" max="255" value={base} onKeyDown={handleEnter} onChange={event => updatePk({ ...pk, customStats: { ...(pk.customStats || {}), [name]: event.target.value === "" ? "" : integerInRange(event.target.value, 1, 255, 1) } })} className="editor-input" /> : <output aria-label={`Base de ${STAT_MAP[name] || name}`}>{base}</output>}</label>
                                <label><span>IVs</span><input type="number" inputMode="numeric" step="1" onWheel={event => event.currentTarget.blur()} aria-label={`IVs de ${STAT_MAP[name] || name}`} min="0" max="31" value={iv} onKeyDown={handleEnter} onChange={event => handleChange("ivs", name, event.target.value)} className="editor-input" /></label>
                                <label className="pokemon-stat-ev"><span>EVs</span><input type="number" inputMode="numeric" step="1" aria-label={`EVs de ${STAT_MAP[name] || name}`} min="0" max="252" value={ev} onWheel={event => event.currentTarget.blur()} onKeyDown={handleEnter} onChange={event => handleChange("evs", name, event.target.value)} className="editor-input" /></label>
                            </div>
                        </div>;
                    })}</div>
                </div>
            </details>

            <section className="editor-moves" aria-labelledby={`${fieldId}-moves-heading`}>
                <header className="editor-section-heading"><h3 id={`${fieldId}-moves-heading`}>Movimentos</h3><span>{pk.moves?.filter(Boolean).length || 0} de 4</span></header>
                <div className="editor-moves-grid">
                    {[0, 1, 2, 3].map(index => {
                        const moveName = pk.moves?.[index] || "";
                        const normalizedName = moveName.trim().toLowerCase().replace(/\s+/g, "-");
                        const rawDetail = moveDetails[normalizedName];
                        const detail = rawDetail ? getMoveReferenceForMode(rawDetail, referenceVersion, experienceMode) : null;
                        const historical = detail?.reference_generation < 9 || detail?.reference_metadata_verified === false;
                        const moveExplanation = detail ? describeMove(detail, { isTTRPG, historical }) : null;
                        const moveReference = normalizedName && moveCatalogReady ? getCatalogText('move', normalizedName, detail, { versionGroup: referenceVersion }) : null;
                        const isException = Boolean(moveName) && !isHackmon && !validMoveNames.has(normalizedName);
                        const currentPp = rpg.pp?.[index];
                        const maxPp = integerInRange(detail?.pp, 0, 99, 0);
                        const fallbackText = getFallbackMoveText(detail, { historical });
                        const shownText = moveReference?.original || moveReference?.portuguese ? moveReference : fallbackText.original ? fallbackText : null;
                        const suggestions = activeMoveSlot === index && normalizedName.length >= 2 && !validMoveNames.has(normalizedName)
                            ? validMoves.map(move => typeof move === 'string' ? move : move?.name)
                                .filter(name => name && name.includes(normalizedName)).slice(0, 5) : [];
                        return <div key={index} className={`editor-move-field ${isException ? "is-exception" : ""}`} style={{ "--editor-move-type": TYPE_COLORS[detail?.type?.name] || "var(--ui-line)" }}>
                            <div className="editor-field">
                                <div className="editor-move-label"><label htmlFor={`${fieldId}-move-${index}`} className="editor-label">Movimento {index + 1}</label>{detail?.type?.name && <span className="editor-move-type" style={{ backgroundColor: TYPE_COLORS[detail.type.name], color: TYPE_TEXT_COLORS[detail.type.name] }}>{formatType(detail.type.name)}</span>}</div>
                                <input id={`${fieldId}-move-${index}`} value={moveName} autoComplete="off" autoCorrect="off" spellCheck={false} onFocus={() => setActiveMoveSlot(index)} onBlur={() => setActiveMoveSlot(null)} onKeyDown={handleEnter} onChange={event => setMove(index, event.target.value)} className="editor-input" />
                                {suggestions.length > 0 && <div className="editor-move-suggestions" role="group" aria-label={`Movimentos correspondentes ao campo ${index + 1}`}>
                                    {suggestions.map(name => <button type="button" key={name} onPointerDown={event => event.preventDefault()} onClick={() => { setMove(index, name); setActiveMoveSlot(null); }} className="editor-move-suggestion">{formatName(name)}</button>)}
                                </div>}
                            </div>
                            {isException && <span className="editor-field-note">{experienceMode === "game" ? "Não disponível neste jogo" : "Escolha livre"}</span>}
                            {moveName && maxPp > 0 && <label className="editor-pp-label">PP atual
                                <input type="number" inputMode="numeric" min="0" max={maxPp} aria-label="PP atual" aria-describedby={`${fieldId}-move-${index}-pp-help`} value={Math.min(currentPp ?? maxPp, maxPp)} onChange={event => { const pp = [...(rpg.pp || [null, null, null, null])]; pp[index] = event.target.value === "" ? null : integerInRange(event.target.value, 0, maxPp, 0); updateRpg({ pp }); }} className="editor-input editor-pp-control" />
                                <span className="editor-pp-total">/ {maxPp}</span>
                                <span className="sr-only" id={`${fieldId}-move-${index}-pp-help`}>Usos restantes de {formatName(moveName)} no jogo de referência.</span>
                            </label>}
                            {moveName && (detail || shownText) && <details className="editor-move-description">
                                <summary>Detalhes do movimento</summary>
                                {detail && <dl className="editor-move-facts"><div><dt>Poder</dt><dd>{detail.power == null ? "Variável ou sem dano" : isTTRPG ? convertToTTRPG(detail.power) : detail.power}</dd></div><div><dt>Precisão</dt><dd>{detail.accuracy == null ? "Sem teste próprio" : `${detail.accuracy}%`}</dd></div><div><dt>PP máximo</dt><dd>{detail.pp ?? "Sem valor comum"}</dd></div>{Boolean(detail.priority) && <div><dt>Prioridade</dt><dd>{detail.priority > 0 ? "+" : ""}{detail.priority}</dd></div>}</dl>}
                                {shownText && <ReferenceText {...shownText} label="Efeito do movimento" defaultLanguage="pt-BR" />}
                                {moveExplanation && !historical && <details className="editor-move-rules"><summary>Na batalha</summary><ul>{moveExplanation.facts.map((fact, factIndex) => <li key={`${normalizedName}-${factIndex}`}>{fact}</li>)}</ul></details>}
                            </details>}
                        </div>;
                    })}
                </div>
            </section>

            <details className="editor-disclosure rpg-journey-panel">
                <summary><span>Progresso da jornada</span><span className="rpg-journey-hp">HP {rpg.currentHp ?? displayedMaxHp} de {displayedMaxHp}</span></summary>
                <div className="editor-disclosure-body rpg-journey-body">
                    <div className="editor-field"><label htmlFor={`${fieldId}-hp`} className="editor-label">HP atual</label><div className="editor-choice-control"><input id={`${fieldId}-hp`} type="number" inputMode="numeric" min="0" max={displayedMaxHp} aria-describedby={`${fieldId}-hp-help`} value={rpg.currentHp ?? displayedMaxHp} onChange={event => updateRpg({ currentHp: event.target.value === "" ? null : integerInRange(event.target.value, 0, displayedMaxHp, 0) })} className="editor-input" /><button type="button" aria-label="Recuperar HP ao máximo" onClick={() => updateRpg({ currentHp: displayedMaxHp })} className="rpg-recover-button">Recuperar</button></div><span className="sr-only" id={`${fieldId}-hp-help`}>Energia do Pokémon. Zero HP significa que ele está fora de combate.</span></div>
                    <div className="editor-field"><label htmlFor={`${fieldId}-xp`} className="editor-label">XP atual</label><input id={`${fieldId}-xp`} type="number" inputMode="numeric" min="0" step="1" max="999999" value={rpg.xp ?? 0} onChange={event => updateRpg({ xp: integerInRange(event.target.value, 0, 999999, rpg.xp ?? 0) })} onBlur={() => applyXpProgression()} className="editor-input" /><small className="editor-progress-goal">{atXpLevelCap ? `Nível máximo · ${xpLevelCap}` : `Até o próximo nível: ${formatNumberPtBr(Math.max(0, nextLevelXp - (Number(rpg.xp) || 0)))} XP`}</small></div>
                    <label className="editor-field"><span className="editor-label">Condição</span><RoomSelect aria-label="Condição" value={rpg.status || ""} onChange={event => updateRpg({ status: event.target.value })} className="editor-input">{RPG_STATUSES.map(status => <option key={status || "none"} value={status}>{RPG_STATUS_LABELS[status]}</option>)}</RoomSelect></label>
                    <div className="editor-wide-field"><ExperienceAward onAward={receiveExperience} disabled={atXpLevelCap} winnerLevel={pk.level} /></div>
                    <label className="editor-field"><span className="editor-label">Poké Ball da captura</span><input type="text" value={rpg.caughtWith || ""} onChange={event => updateRpg({ caughtWith: event.target.value })} className="editor-input" /></label>
                    <label className="editor-field editor-wide-field"><span className="editor-label">Treinador original</span><input type="text" value={rpg.originalTrainer || ""} onChange={event => updateRpg({ originalTrainer: event.target.value })} className="editor-input" /></label>
                    <div className="editor-field editor-wide-field"><label htmlFor={`${fieldId}-journey-notes`} className="editor-label">Notas da jornada</label><textarea id={`${fieldId}-journey-notes`} value={rpg.notes || ""} onChange={event => updateRpg({ notes: event.target.value })} rows={3} className="editor-input" /></div>
                    <div className="editor-field editor-wide-field"><label htmlFor={`${fieldId}-adventure-ideas`} className="editor-label">Ideias para a aventura</label><textarea id={`${fieldId}-adventure-ideas`} value={rpg.animeNotes || ""} onChange={event => updateRpg({ animeNotes: event.target.value })} rows={3} className="editor-input" /></div>
                </div>
            </details>

        </section>
    );
}
