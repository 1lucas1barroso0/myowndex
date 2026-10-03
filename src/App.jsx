import React, { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import bundledSpecies from "./data/species.json";
import { formatPokemonCount } from "./core/copy.js";
import { integerInRange } from "./core/math.js";
import { dedupeByNameLatest, extractId, fetchCached, filterMovesByLatestVersion, formatName } from "./core/mechanics.js";
import { compactSpecies, createTeam, hydrateTeam, loadTeamsDurable, mergeHydratedTeams, normalizePokemon, saveTeamsDurable, touchTeam } from "./core/team.js";
import { EXPERIENCE_MODES } from "./core/rpgRules.js";
import { randomChance } from "./core/random.js";
import { readDurableStorage, writeStorage } from "./core/storage.js";
import { createScheduledSave } from "./core/scheduledSave.js";
import { rebaseLiveAccountDocument } from "./core/accountDocument.js";
import AppearanceControl from "./components/Shared/AppearanceControl.jsx";
import GameStyleControl from "./components/Shared/GameStyleControl.jsx";
import PokemonSprite from "./components/Shared/PokemonSprite.jsx";
import PokemonCompanion from "./components/Shared/PokemonCompanion.jsx";
import GameIcon from "./components/Shared/GameIcon.jsx";
import { DEX_GENERATIONS, debutGeneration, selectDexSpecies, urlForView, viewFromUrl } from "./core/dexCollection.js";
import useAccountSync from "./components/Account/useAccountSync.js";
import AccountButton from "./components/Account/AccountButton.jsx";

const APP_VERSION = "11.4.0";
function OpeningScreen() { return <div className="account-opening" role="status"><img src="/icons/myowndex-icon-v91.svg" alt="" /><strong>MyOwnDex</strong><span>Abrindo sua jornada…</span><small>{APP_VERSION}</small></div>; }
const TrainerGuide = dynamic(() => import("./components/Guide/TrainerGuide.jsx"), { loading: OpeningScreen });
const PokemonModal = dynamic(() => import("./components/Pokedex/PokemonModal.jsx"), { loading: () => null });
const Teambuilder = dynamic(() => import("./components/Teambuilder/Teambuilder.jsx"), { loading: OpeningScreen });
const RpgRoom = dynamic(() => import("./components/Room/RpgRoom.jsx"), { loading: OpeningScreen });
const AccountModal = dynamic(() => import("./components/Account/AccountModal.jsx"), { loading: () => null });
const LocalDiceDialog = dynamic(() => import("./components/Shared/LocalDiceDialog.jsx"), { loading: () => null });
const GeneratorModal = dynamic(() => import("./components/Generator/GeneratorModal.jsx"), { loading: () => null });

const PokemonCard = React.memo(function PokemonCard({ species, id, onSelect, favorite, onFavorite }) {
    return (
        <article className={`dex-entry ${favorite ? "is-favorite" : ""}`} data-generation={debutGeneration(id)?.id}>
            <button type="button" onClick={onSelect} className="game-card dex-entry-main" aria-label={`Consultar ${formatName(species.name)} na Pokédex`}>
                <span className="dex-number">No. {id.padStart(4, "0")}</span>
                <span className="pokemon-card-sprite-frame"><PokemonSprite pokemonId={id} alt="" className="pixelated" /></span>
                <span className="pokemon-card-name">{formatName(species.name)}</span>
                <span className="dex-generation-mark">{debutGeneration(id) ? `Geração ${debutGeneration(id).label}` : "Nacional"}</span>
            </button>
            <button type="button" className="dex-favorite" aria-label={`${favorite ? "Remover" : "Adicionar"} ${formatName(species.name)} ${favorite ? "dos" : "aos"} favoritos`} aria-pressed={favorite} onClick={onFavorite}><GameIcon name="star" /></button>
        </article>
    );
});

const StatusNotice = ({ tone = "blue", children, onClose, actionLabel, onAction }) => {
    const tones = {
        blue: "is-info",
        amber: "is-reversible",
        red: "is-caution"
    };
    return (
        <div className={`status-notice ${tones[tone] || tones.blue}`}>
            <span role={tone === "red" ? "alert" : "status"} aria-live={tone === "red" ? "assertive" : "polite"} aria-atomic="true" className="status-notice-message">{children}</span>
            <span className="status-notice-actions">
                {actionLabel && onAction && <button type="button" onClick={onAction} className="status-notice-action">{actionLabel}</button>}
                {onClose && <button type="button" onClick={onClose} className="status-notice-close" aria-label="Dispensar aviso">×</button>}
            </span>
        </div>
    );
};

export default function App() {
    const [accountOpen, setAccountOpen] = useState(false);
    const [receivedDocument, setReceivedDocument] = useState(null);
    const flushRef = useRef(null);
    const [navigation, setNavigation] = useState({ scope: null, view: null });
    const beforeSwitch = useCallback(async () => {
        if (flushRef.current && await flushRef.current() === false) {
            throw new Error("Não foi possível salvar a última edição neste dispositivo. Exporte sua Box antes de trocar de conta.");
        }
    }, []);
    const receiveDocument = useCallback((document, { scope, reason, previousDocument }) => {
        setNavigation(current => current.scope === scope ? current : { scope, view: null });
        setReceivedDocument({ scope, document, reason, previousDocument });
        window.dispatchEvent(new CustomEvent("myowndex:account-document", { detail: { scope, document, previousDocument } }));
    }, []);
    const client = useAccountSync({ onBeforeSwitch: beforeSwitch, onDocument: receiveDocument });
    const registerFlush = useCallback(callback => {
        flushRef.current = callback;
        return () => { if (flushRef.current === callback) flushRef.current = null; };
    }, []);
    const rememberNavigation = useCallback((scope, view) => {
        setNavigation(current => current.scope === scope && current.view === view ? current : { scope, view });
    }, []);

    return <>
        {client.ready ? <AppExperience
            key={client.scope || "guest"}
            client={client}
            onAccountOpen={() => setAccountOpen(true)}
            onFlushReady={registerFlush}
            initialView={navigation.scope === client.scope ? navigation.view : null}
            onNavigation={rememberNavigation}
            receivedDocument={receivedDocument}
        /> : <OpeningScreen />}
        {accountOpen && <AccountModal open={accountOpen} onClose={() => setAccountOpen(false)} client={client} />}
    </>;
}

function AppExperience({ client, onAccountOpen, onFlushReady, initialView, onNavigation, receivedDocument }) {
    const scope = client.scope;
    const initialViewRef = useRef(initialView);
    const [species, setSpecies] = useState(bundledSpecies);
    const [dexError, setDexError] = useState("");
    const [dexAttempt, setDexAttempt] = useState(0);
    const [searchInput, setSearchInput] = useState("");
    const [searchTerm, setSearchTerm] = useState("");
    const [experienceMode, setExperienceMode] = useState("rpg");
    const [modeBooted, setModeBooted] = useState(false);
    const [limit, setLimit] = useState(60);
    const [selectedUrl, setSelectedUrl] = useState(null);
    const [diceOpen, setDiceOpen] = useState(false);
    const [diceRoomContext, setDiceRoomContext] = useState(null);
    const receiveDiceContext = useCallback(context => setDiceRoomContext(current => current?.snapshot === context?.snapshot && current?.role === context?.role && current?.playerId === context?.playerId && current?.remote === context?.remote ? current : context), []);
    const [generatorOpen, setGeneratorOpen] = useState(false);
    const [view, setViewState] = useState("pokedex");
    const [favorites, setFavorites] = useState([]);
    const [onlyFavorites, setOnlyFavorites] = useState(false);
    const [dexOrder, setDexOrder] = useState("number");
    const [dexGeneration, setDexGeneration] = useState("all");
    const setView = useCallback(next => {
        setViewState(next);
        if (viewFromUrl(window.location.href) !== next) window.history.pushState({}, "", urlForView(window.location.href, next));
        window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "instant" }));
    }, []);
    const [online, setOnline] = useState(true);
    const [notice, setNotice] = useState(null);
    const deferredSearchTerm = useDeferredValue(searchTerm);

    const [teams, setTeams] = useState([]);
    const resourceEpoch = useRef(0);
    const teamsRef = useRef([]);
    useEffect(() => { teamsRef.current = teams; }, [teams]);
    const [teamsBooted, setTeamsBooted] = useState(false);
    const [activeTeamId, setActiveTeamId] = useState(null);
    const [storageError, setStorageError] = useState(false);
    const teamSave = useMemo(() => createScheduledSave({
        save: value => saveTeamsDurable(value, { scope }),
        onResult: saved => setStorageError(!saved),
        delayMs: 300,
        maxWaitMs: 900,
    }), [scope]);
    const [env, setEnv] = useState({ items: [], moves: [], abilities: [] });
    const [envLoading, setEnvLoading] = useState(false);
    const [envLoaded, setEnvLoaded] = useState(false);
    const [envError, setEnvError] = useState("");
    const currentMode = EXPERIENCE_MODES[experienceMode] || EXPERIENCE_MODES.rpg;
    const isTTRPG = currentMode.isTTRPG;
    const isHackmon = currentMode.isFreeform;

    useEffect(() => {
        let active = true;
        const epoch = resourceEpoch.current;
        loadTeamsDurable({ scope }).then(stored => {
            if (!active || epoch !== resourceEpoch.current) return;
            setTeams(stored);
            setActiveTeamId(stored[0]?.id || null);
            setTeamsBooted(true);
        });
        return () => { active = false; };
    }, [scope]);

    const activeTeam = teams.find(team => team.id === activeTeamId);
    const hydrationIdentity = activeTeam ? `${activeTeam.id}:${activeTeam.versionGroup}:${activeTeam.pokemon.map(partner => `${partner.id}:${partner.species?.name}`).join("|")}` : "";
    const activeTeamRef = useRef(activeTeam);
    useEffect(() => { activeTeamRef.current = activeTeam; }, [activeTeam]);
    useEffect(() => {
        if (!teamsBooted || !activeTeamRef.current || view !== "teambuilder") return;
        let active = true;
        const controller = new AbortController();
        const selected = activeTeamRef.current;
        // Only the open Box needs full learnsets and artwork metadata in memory.
        setTeams(current => current.map(team => team.id === selected.id || !team.pokemon.some(partner => Array.isArray(partner.species?.moves)) ? team : {
            ...team, pokemon: team.pokemon.map(partner => ({ ...partner, species: compactSpecies(partner.species) })),
        }));
        hydrateTeam(selected, { signal: controller.signal, experienceMode }).then(hydrated => {
            if (active) setTeams(current => mergeHydratedTeams(current, [hydrated]));
        }).catch(() => {});
        return () => { active = false; controller.abort(); };
    }, [experienceMode, hydrationIdentity, receivedDocument, teamsBooted, view]);

    useEffect(() => {
        let active = true;
        const epoch = resourceEpoch.current;
        Promise.all([
            readDurableStorage("myowndex_preferences_v1", {}, { scope }),
            readDurableStorage("myowndex_dex_favorites_v1", [], { scope }),
        ]).then(([preferences, storedFavorites]) => {
            if (!active || epoch !== resourceEpoch.current) return;
            const savedMode = preferences?.experienceMode;
            if (EXPERIENCE_MODES[savedMode]) setExperienceMode(savedMode);
            const nextView = initialViewRef.current || viewFromUrl(window.location.href) || (new URL(window.location.href).searchParams.has("room") ? "room" : (["room", "pokedex", "teambuilder", "guide"].includes(preferences?.view) ? preferences.view : "pokedex"));
            setViewState(nextView);
            window.history.replaceState({}, "", urlForView(window.location.href, nextView));
            setFavorites(Array.isArray(storedFavorites) ? storedFavorites.filter(id => typeof id === "string" && /^\d+$/.test(id)) : []);
            setModeBooted(true);
        });
        const onPop = () => setViewState(viewFromUrl(window.location.href) || "pokedex");
        window.addEventListener("popstate", onPop);
        return () => { active = false; window.removeEventListener("popstate", onPop); };
    }, [scope]);

    useEffect(() => {
        const incoming = receivedDocument?.document;
        if (!incoming || receivedDocument.scope !== scope) return;
        // Keep the current screen, open dialogs and selections while replacing
        // only the data that the account merge has durably confirmed.
        if (resourceEpoch.current === 0 && receivedDocument.reason === "account") {
            const nextView = initialViewRef.current || viewFromUrl(window.location.href) || incoming.preferences.view;
            setViewState(nextView);
            window.history.replaceState({}, "", urlForView(window.location.href, nextView));
        }
        resourceEpoch.current += 1;
        setTeams(current => rebaseLiveAccountDocument({ boxes: current }, incoming, receivedDocument.previousDocument).boxes);
        setActiveTeamId(current => incoming.boxes.some(team => team.id === current) ? current : incoming.boxes[0]?.id || null);
        setFavorites(current => rebaseLiveAccountDocument({ dex: { favorites: current } }, incoming, receivedDocument.previousDocument).dex.favorites);
        setExperienceMode(current => rebaseLiveAccountDocument({ preferences: { experienceMode: current } }, incoming, receivedDocument.previousDocument).preferences.experienceMode);
        setTeamsBooted(true);
        setModeBooted(true);
    }, [receivedDocument, scope]);

    useEffect(() => onFlushReady(() => teamSave.flush()), [onFlushReady, teamSave]);

    useEffect(() => {
        if (modeBooted) onNavigation(scope, view);
    }, [modeBooted, onNavigation, scope, view]);

    useEffect(() => {
        document.title = `${{ room: "Aventura", pokedex: "Pokédex", teambuilder: "PC do Bill", guide: "Guia do Treinador" }[view]} · MyOwnDex`;
    }, [view]);

    const toggleFavorite = id => {
        const next = favorites.includes(id) ? favorites.filter(value => value !== id) : [...favorites, id];
        setFavorites(next);
        if (!writeStorage("myowndex_dex_favorites_v1", next, { scope })) setNotice({ tone: "amber", text: "Seus favoritos continuam nesta sessão. A cópia persistente será tentada novamente." });
    };

    useEffect(() => {
        if (!modeBooted) return;
        writeStorage("myowndex_preferences_v1", { experienceMode, view }, { scope });
    }, [experienceMode, modeBooted, scope, view]);

    useEffect(() => {
        if (modeBooted) writeStorage("myowndex_dex_favorites_v1", favorites, { scope });
    }, [favorites, modeBooted, scope]);

    useEffect(() => {
        if (!teamsBooted) return;
        teamSave.schedule(teams);
    }, [teamSave, teams, teamsBooted]);

    useEffect(() => {
        const flush = () => teamSave.flush();
        const onVisibilityChange = () => {
            if (document.visibilityState === "hidden") flush();
        };
        window.addEventListener("pagehide", flush);
        document.addEventListener("visibilitychange", onVisibilityChange);
        return () => {
            flush();
            teamSave.cancel();
            window.removeEventListener("pagehide", flush);
            document.removeEventListener("visibilitychange", onVisibilityChange);
        };
    }, [teamSave]);

    useEffect(() => {
        setOnline(navigator.onLine);
        const onOnline = () => setOnline(true);
        const onOffline = () => setOnline(false);
        window.addEventListener("online", onOnline);
        window.addEventListener("offline", onOffline);
        return () => {
            window.removeEventListener("online", onOnline);
            window.removeEventListener("offline", onOffline);
        };
    }, []);

    useEffect(() => {
        if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return undefined;
        let refreshing = false;
        let offeredWorker = null;
        let registration = null;
        let updateTimer = 0;
        const offerUpdate = worker => {
            if (!worker || offeredWorker === worker) return;
            offeredWorker = worker;
            setNotice({
                tone: "blue",
                text: "Uma nova versão do MyOwnDex está pronta.",
                actionLabel: "Atualizar agora",
                onAction: () => worker.postMessage({ type: "SKIP_WAITING" }),
            });
        };
        const watchRegistration = current => {
            registration = current;
            if (current.waiting && navigator.serviceWorker.controller) offerUpdate(current.waiting);
            current.addEventListener("updatefound", () => {
                const installing = current.installing;
                installing?.addEventListener("statechange", () => {
                    if (installing.state === "installed" && navigator.serviceWorker.controller) offerUpdate(installing);
                });
            });
            current.update().catch(() => {});
            updateTimer = window.setInterval(() => current.update().catch(() => {}), 60 * 60 * 1000);
        };
        const register = () => navigator.serviceWorker
            .register("/sw.js", { updateViaCache: "none" })
            .then(watchRegistration)
            .catch(() => {});
        const checkForUpdate = () => registration?.update().catch(() => {});
        const onVisible = () => {
            if (document.visibilityState === "visible") checkForUpdate();
        };
        const onControllerChange = () => {
            if (refreshing) return;
            refreshing = true;
            window.location.reload();
        };
        navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
        document.addEventListener("visibilitychange", onVisible);
        window.addEventListener("online", checkForUpdate);
        if (document.readyState === "complete") register();
        else window.addEventListener("load", register, { once: true });
        return () => {
            window.removeEventListener("load", register);
            window.removeEventListener("online", checkForUpdate);
            document.removeEventListener("visibilitychange", onVisible);
            navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
            window.clearInterval(updateTimer);
        };
    }, []);

    useEffect(() => {
        const timer = window.setTimeout(() => setSearchTerm(searchInput.trim()), 140);
        return () => window.clearTimeout(timer);
    }, [searchInput]);

    useEffect(() => {
        let mounted = true;
        setDexError("");
        fetchCached("https://pokeapi.co/api/v2/pokemon-species?limit=1500", {
            maxAgeMs: 24 * 60 * 60 * 1000,
            forceRefresh: dexAttempt > 0
        }).then(result => {
            if (!mounted) return;
            if (!result?.results?.length) {
                setDexError("O catálogo incluído no MyOwnDex está disponível. Os detalhes serão consultados quando a conexão voltar.");
                return;
            }
            setSpecies(result.results);
        });
        return () => { mounted = false; };
    }, [dexAttempt]);

    useEffect(() => {
        if (view !== "teambuilder" || envLoaded) return;
        let mounted = true;
        setEnvLoading(true);
        setEnvError("");
        Promise.all([
            fetchCached("https://pokeapi.co/api/v2/item?limit=2500", { maxAgeMs: 24 * 60 * 60 * 1000 }),
            fetchCached("https://pokeapi.co/api/v2/move?limit=2000", { maxAgeMs: 24 * 60 * 60 * 1000 }),
            fetchCached("https://pokeapi.co/api/v2/ability?limit=1000", { maxAgeMs: 24 * 60 * 60 * 1000 })
        ]).then(([items, moves, abilities]) => {
            if (!mounted) return;
            setEnv({
                items: dedupeByNameLatest(items?.results),
                moves: dedupeByNameLatest(moves?.results),
                abilities: dedupeByNameLatest(abilities?.results)
            });
            if (!items?.results || !moves?.results || !abilities?.results) {
                setEnvError("Algumas opções não carregaram. Sua Box continua salva neste dispositivo.");
            }
            setEnvLoaded(true);
        }).finally(() => {
            if (mounted) setEnvLoading(false);
        });
        return () => { mounted = false; };
    }, [view, envLoaded]);

    const filteredSpecies = useMemo(() => selectDexSpecies(species, { query: deferredSearchTerm, favorites, onlyFavorites, order: dexOrder, generation: dexGeneration }), [species, deferredSearchTerm, favorites, onlyFavorites, dexOrder, dexGeneration]);

    const visible = useMemo(() => filteredSpecies.slice(0, limit), [filteredSpecies, limit]);

    const handleOpenPokedex = useCallback(() => setView("pokedex"), [setView]);
    const handleOpenTeambuilder = useCallback(() => setView("teambuilder"), [setView]);
    const handleOpenGuide = useCallback(() => setView("guide"), [setView]);
    const handleOpenRoom = useCallback(() => setView("room"), [setView]);
    const handleSearchInputChange = useCallback(event => {
        setSearchInput(event.target.value);
        setLimit(60);
    }, []);

    const integrateTeam = useCallback((formData, genderRate) => {
        const resolvedRate = integerInRange(genderRate, -1, 8, -1);
        const targetTeam = teams.find(team => team.id === activeTeamId) || teams[0] || null;
        const legalMoves = filterMovesByLatestVersion(
            formData.moves || [],
            targetTeam?.versionGroup || "auto",
        );
        const levelMoves = legalMoves.filter(entry =>
            entry.latest_detail?.move_learn_method?.name === "level-up"
            && integerInRange(entry.latest_detail?.level_learned_at, 0, 200, 0) <= 5
        );
        const initialMoves = levelMoves.slice(-4).map(entry => entry.move?.name).filter(Boolean);
        let gender = "N";
        if (resolvedRate === 0) gender = "M";
        else if (resolvedRate === 8) gender = "F";
        else if (resolvedRate > 0) gender = randomChance(resolvedRate, 8) ? "F" : "M";

        const partner = normalizePokemon({
            species: { ...formData, gender_rate: resolvedRate },
            level: 5,
            friendship: 70,
            ability: formData.abilities?.[0]?.ability?.name || "",
            teraType: formData.types?.[0]?.type?.name || "",
            nature: "hardy",
            moves: initialMoves,
            gender,
            genderRate: resolvedRate,
            genderLocked: false
        });

        let targetId = activeTeamId;
        if (!teams.length) {
            const first = createTeam("Box 1");
            targetId = first.id;
            setTeams([{ ...first, pokemon: [partner] }]);
            setActiveTeamId(first.id);
            setNotice({ tone: "blue", text: `${formatName(formData.name)} foi para a Box 1.` });
        } else {
            const target = targetTeam;
            targetId = target.id;
            if ((target.pokemon?.length || 0) >= 6) {
                setNotice({ tone: "amber", text: `${target.name} já tem seis parceiros. Escolha outra Box ou crie uma nova.` });
                setView("teambuilder");
                return;
            }
            setTeams(current => current.map(team => team.id === targetId
                ? touchTeam({ ...team, pokemon: [...(team.pokemon || []), partner] })
                : team
            ));
            setActiveTeamId(targetId);
            setNotice({ tone: "blue", text: `${formatName(formData.name)} agora faz parte de ${target.name}.` });
        }
        setView("teambuilder");
    }, [activeTeamId, teams, setView]);

    const teamBuilderProps = useMemo(() => ({
        teams,
        setTeams,
        allItems: env.items,
        allMoves: env.moves,
        allAbilities: env.abilities,
        activeTeamId,
        setActiveTeamId,
        isTTRPG,
        isHackmon,
        experienceMode,
        envLoading,
        envError,
        setNotice,
        onSearchClick: handleOpenPokedex
    }), [teams, env, activeTeamId, isTTRPG, isHackmon, experienceMode, envLoading, envError, handleOpenPokedex]);

    const commitGeneratedTeams = useCallback(async (next, teamId) => {
        teamsRef.current = next;
        setTeams(next);
        setActiveTeamId(teamId);
        teamSave.schedule(next);
        if (await teamSave.flush() === false) throw new Error("Os parceiros continuam no PC nesta sessão. Exporte uma cópia antes de fechar e tente salvar novamente.");
        return true;
    }, [teamSave]);
    const addGeneratedPokemon = useCallback(async (pokemon, teamId) => {
        const current = teamsRef.current;
        const target = current.find(team => team.id === teamId);
        if (!target || (target.pokemon.length >= 6 && !target.pokemon.some(partner => partner.id === pokemon.id))) return false;
        const next = current.map(team => team.id !== teamId || team.pokemon.some(partner => partner.id === pokemon.id) ? team : touchTeam({ ...team, pokemon: [...team.pokemon, normalizePokemon(pokemon)] }));
        return commitGeneratedTeams(next, teamId);
    }, [commitGeneratedTeams]);
    const addGeneratedBox = useCallback(async ({ name, versionGroup, pokemon }) => {
        if (!Array.isArray(pokemon) || !pokemon.length || pokemon.length > 6) return false;
        const current = teamsRef.current;
        const existing = current.find(team => pokemon.every(partner => team.pokemon.some(saved => saved.id === partner.id)));
        if (existing) return commitGeneratedTeams(current, existing.id);
        const box = touchTeam({ ...createTeam(name), versionGroup, pokemon: pokemon.map(normalizePokemon) });
        return commitGeneratedTeams([...current, box], box.id);
    }, [commitGeneratedTeams]);

    if (!teamsBooted || !modeBooted) return <OpeningScreen />;

    return (
        <div className={`app-root game-edition handheld-edition view-${view}`}>
            <a className="skip-to-content" href="#main-content">Ir para o conteúdo</a>
            <header className="app-header">
                <div className="game-shell app-header-shell">
                    <div className="app-header-row">
                        <div className="app-header-primary">
                            <div className="app-brand-cluster">
                                <img className="app-brand-icon" src="/icons/myowndex-icon-v91.svg" alt="" />
                                <div className="app-brand">
                                    <h1>MyOwnDex</h1>
                                </div>
                            </div>
                            <nav aria-label="Navegação principal" className="app-nav">
                                <button type="button" title="Abrir a Central da Aventura para criar, entrar ou continuar uma jornada" aria-label="Abrir a Central da Aventura" aria-current={view === "room" ? "page" : undefined} onClick={handleOpenRoom} className={`nav-capsule ${view === "room" ? "is-active" : ""}`}><GameIcon name="adventure" />Aventura</button>
                                <button type="button" title="Consultar espécies, formas, habilidades e movimentos" aria-label="Abrir a Pokédex" aria-current={view === "pokedex" ? "page" : undefined} onClick={handleOpenPokedex} className={`nav-capsule ${view === "pokedex" ? "is-active" : ""}`}><GameIcon name="dex" />Pokédex</button>
                                <button type="button" title="Organizar Boxes, equipes e fichas de Pokémon" aria-label="Abrir o PC do Bill" aria-current={view === "teambuilder" ? "page" : undefined} onClick={handleOpenTeambuilder} className={`nav-capsule ${view === "teambuilder" ? "is-active" : ""}`}><GameIcon name="pc" />PC</button>
                                <button type="button" title="Consultar todas as regras usadas pelo MyOwnDex" aria-label="Abrir o Guia do Treinador" aria-current={view === "guide" ? "page" : undefined} onClick={handleOpenGuide} className={`nav-capsule ${view === "guide" ? "is-active" : ""}`}><GameIcon name="guide" />Guia</button>
                            </nav>
                        </div>

                        <div className="app-actions">
                            <GameStyleControl value={experienceMode} onChange={setExperienceMode} />
                            <AppearanceControl />
                            <button type="button" className="global-generator-button" aria-label="Gerar Pokémon" onClick={() => setGeneratorOpen(true)}><GameIcon name="generator" />Gerar</button>
                            <button type="button" className="global-dice-button" aria-label="Abrir dados locais" onClick={() => setDiceOpen(true)}><GameIcon name="dice" />Dados</button>
                            <AccountButton client={client} onClick={onAccountOpen} />
                        </div>
                    </div>
                </div>
            </header>

            <main id="main-content" tabIndex={-1} className="app-scroll-area">
                <div className="game-shell app-main-shell">
                    {!online && <StatusNotice tone="amber">Você está sem internet, mas tudo o que já consultou na Pokédex continua disponível.</StatusNotice>}
                    {storageError && <StatusNotice tone="red">Não foi possível salvar esta Box neste dispositivo. Libere espaço ou permita o armazenamento do site e tente novamente.</StatusNotice>}
                    {notice && <StatusNotice tone={notice.tone} actionLabel={notice.actionLabel} onAction={notice.onAction} onClose={() => setNotice(null)}>{notice.text}</StatusNotice>}

                    {view === "room" ? (
                        <RpgRoom
                            teams={teams}
                            setTeams={setTeams}
                            onOpenGuide={handleOpenGuide}
                            setNotice={setNotice}
                            account={client.account}
                            onDiceContext={receiveDiceContext}
                        />
                    ) : view === "pokedex" ? (
                            <>
                                <header className="dex-heading">
                                    <div className="dex-title"><h2>Pokédex Nacional</h2></div>
                                    <PokemonCompanion place="pokedex" className="dex-companion" eager />
                                    <span className="dex-count" role="status">{formatPokemonCount(filteredSpecies.length)}</span>
                                </header>
                                <div className="dex-toolbar">
                                    <label className="dex-search"><span className="dex-search-label">Nome ou número</span><GameIcon name="dex" /><input id="pokemon-search" type="search" value={searchInput} onChange={handleSearchInputChange} /></label>
                                    <button type="button" className={`dex-filter ${onlyFavorites ? "is-active" : ""}`} aria-pressed={onlyFavorites} onClick={() => { setOnlyFavorites(value => !value); setLimit(60); }}><GameIcon name="star" />Favoritos <span>{favorites.length}</span></button>
                                    <label className="dex-sort"><span className="sr-only">Ordenar Pokémon</span><select value={dexOrder} onChange={event => { setDexOrder(event.target.value); setLimit(60); }}><option value="number">Número crescente</option><option value="reverse">Número decrescente</option><option value="name">Nome de A a Z</option></select></label>
                                </div>
                                <div className="dex-generations" role="group" aria-label="Filtrar por geração de estreia">
                                    <span>Geração</span>
                                    {DEX_GENERATIONS.map(gen => <button key={gen.id} type="button" aria-pressed={dexGeneration === gen.id} aria-label={gen.id === "all" ? "Todas as gerações" : `Geração ${gen.label}`} onClick={() => { setDexGeneration(gen.id); setLimit(60); }}>{gen.label}</button>)}
                                </div>
                                {dexError && <StatusNotice tone="amber" actionLabel="Tentar novamente" onAction={() => setDexAttempt(value => value + 1)}>{dexError}</StatusNotice>}
                                {visible.length ? (
                                    <div className="dex-grid">
                                        {visible.map(entry => <PokemonCard key={entry.name} species={entry} id={extractId(entry.url)} onSelect={() => setSelectedUrl(entry.url)} favorite={favorites.includes(extractId(entry.url))} onFavorite={() => toggleFavorite(extractId(entry.url))} />)}
                                    </div>
                                ) : (
                                    <div className="dex-empty"><PokemonCompanion place="pokedex-empty" /><p>{onlyFavorites && !favorites.length ? "Você ainda não tem favoritos. Toque na estrela de um Pokémon para adicioná-lo." : "Nenhum Pokémon corresponde aos filtros."}</p><button type="button" className="room-secondary-button" onClick={() => { setSearchInput(""); setSearchTerm(""); setOnlyFavorites(false); setDexGeneration("all"); setLimit(60); }}>Limpar filtros</button></div>
                                )}
                                {limit < filteredSpecies.length && (
                                    <button type="button" onClick={() => setLimit(value => value + 60)} className="dex-load-more room-secondary-button">
                                        Mostrar mais Pokémon
                                    </button>
                                )}
                            </>
                    ) : view === "teambuilder" ? <Teambuilder envProps={teamBuilderProps} /> : <TrainerGuide experienceMode={experienceMode} teams={teams} setTeams={setTeams} />}
                </div>
            </main>
            <footer className="device-footer"><span>MyOwnDex <b>{APP_VERSION}</b></span><span>Projeto de fãs · Dados <a href="https://pokeapi.co/about" target="_blank" rel="noreferrer">PokéAPI</a></span></footer>
            {selectedUrl && <PokemonModal speciesUrl={selectedUrl} onClose={() => setSelectedUrl(null)} isTTRPG={isTTRPG} onAddToTeam={integrateTeam} />}
            {diceOpen && <LocalDiceDialog open onClose={() => setDiceOpen(false)} teams={teams} setTeams={setTeams} experienceMode={experienceMode} {...(diceRoomContext || {})} />}
            {generatorOpen && <GeneratorModal onClose={() => setGeneratorOpen(false)} teams={teams} experienceMode={experienceMode} onAddPokemon={addGeneratedPokemon} onAddBox={addGeneratedBox} />}
        </div>
    );
}
