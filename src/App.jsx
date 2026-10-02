import React, { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import bundledSpecies from "./data/species.json";
import { formatPokemonCount } from "./core/copy.js";
import { integerInRange } from "./core/math.js";
import { dedupeByNameLatest, extractId, fetchCached, filterMovesByLatestVersion, formatName } from "./core/mechanics.js";
import { createTeam, hydrateTeams, loadTeams, mergeHydratedTeams, normalizePokemon, saveTeams, touchTeam } from "./core/team.js";
import { EXPERIENCE_MODES } from "./core/rpgRules.js";
import { randomChance } from "./core/random.js";
import { readStorage, writeStorage } from "./core/storage.js";
import { createScheduledSave } from "./core/scheduledSave.js";
import AppearanceControl from "./components/Shared/AppearanceControl.jsx";
import GameStyleControl from "./components/Shared/GameStyleControl.jsx";
import PokemonSprite from "./components/Shared/PokemonSprite.jsx";
import GameIcon from "./components/Shared/GameIcon.jsx";
import { DEX_GENERATIONS, debutGeneration, selectDexSpecies, urlForView, viewFromUrl } from "./core/dexCollection.js";

function OpeningScreen() { return <div className="screen-opening" role="status">Carregando…</div>; }
const TrainerGuide = dynamic(() => import("./components/Guide/TrainerGuide.jsx"), { loading: OpeningScreen });
const PokemonModal = dynamic(() => import("./components/Pokedex/PokemonModal.jsx"), { loading: OpeningScreen });
const Teambuilder = dynamic(() => import("./components/Teambuilder/Teambuilder.jsx"), { loading: OpeningScreen });
const RpgRoom = dynamic(() => import("./components/Room/RpgRoom.jsx"), { loading: OpeningScreen });

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
    const [species, setSpecies] = useState(bundledSpecies);
    const [dexError, setDexError] = useState("");
    const [dexAttempt, setDexAttempt] = useState(0);
    const [searchInput, setSearchInput] = useState("");
    const [searchTerm, setSearchTerm] = useState("");
    const [experienceMode, setExperienceMode] = useState("rpg");
    const [modeBooted, setModeBooted] = useState(false);
    const [limit, setLimit] = useState(60);
    const [selectedUrl, setSelectedUrl] = useState(null);
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
    const [teamsBooted, setTeamsBooted] = useState(false);
    const [activeTeamId, setActiveTeamId] = useState(null);
    const [storageError, setStorageError] = useState(false);
    const teamSave = useMemo(() => createScheduledSave({
        save: saveTeams,
        onResult: saved => setStorageError(!saved),
        delayMs: 300,
        maxWaitMs: 900,
    }), []);
    const [env, setEnv] = useState({ items: [], moves: [], abilities: [] });
    const [envLoading, setEnvLoading] = useState(false);
    const [envLoaded, setEnvLoaded] = useState(false);
    const [envError, setEnvError] = useState("");
    const currentMode = EXPERIENCE_MODES[experienceMode] || EXPERIENCE_MODES.rpg;
    const isTTRPG = currentMode.isTTRPG;
    const isHackmon = currentMode.isFreeform;

    useEffect(() => {
        const stored = loadTeams();
        setTeams(stored);
        setActiveTeamId(stored[0]?.id || null);
        setTeamsBooted(true);
        let active = true;
        if (stored.length) {
            hydrateTeams(stored).then(hydrated => {
                if (active) setTeams(current => mergeHydratedTeams(current, hydrated));
            });
        }
        return () => { active = false; };
    }, []);

    useEffect(() => {
        const preferences = readStorage("myowndex_preferences_v1", {});
        const savedMode = preferences?.experienceMode;
        if (EXPERIENCE_MODES[savedMode]) setExperienceMode(savedMode);
        const initialView = viewFromUrl(window.location.href) || (new URL(window.location.href).searchParams.has("room") ? "room" : (["room", "pokedex", "teambuilder", "guide"].includes(preferences?.view) ? preferences.view : "pokedex"));
        setViewState(initialView);
        window.history.replaceState({}, "", urlForView(window.location.href, initialView));
        const storedFavorites = readStorage("myowndex_dex_favorites_v1", []);
        setFavorites(Array.isArray(storedFavorites) ? storedFavorites.filter(id => typeof id === "string" && /^\d+$/.test(id)) : []);
        const onPop = () => setViewState(viewFromUrl(window.location.href) || "pokedex");
        window.addEventListener("popstate", onPop);
        setModeBooted(true);
        return () => window.removeEventListener("popstate", onPop);
    }, []);

    useEffect(() => {
        document.title = `${{ room: "Aventura", pokedex: "Pokédex", teambuilder: "PC do Bill", guide: "Guia do Treinador" }[view]} · MyOwnDex`;
    }, [view]);

    const toggleFavorite = id => {
        const next = favorites.includes(id) ? favorites.filter(value => value !== id) : [...favorites, id];
        setFavorites(next);
        if (!writeStorage("myowndex_dex_favorites_v1", next)) setNotice({ tone: "amber", text: "Seus favoritos estão disponíveis nesta sessão, mas o dispositivo não permitiu salvá-los." });
    };

    useEffect(() => {
        if (!modeBooted) return;
        writeStorage("myowndex_preferences_v1", { experienceMode, view });
    }, [experienceMode, modeBooted, view]);

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
                        />
                    ) : view === "pokedex" ? (
                            <>
                                <header className="dex-heading">
                                    <div className="dex-title"><h2>Pokédex Nacional</h2></div>
                                    <div className="dex-companion" aria-hidden="true"><PokemonSprite pokemonId={25} alt="" loading="eager" className="pixelated" /></div>
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
                                    <div className="dex-empty"><PokemonSprite pokemonId={54} alt="" className="pixelated" /><p>{onlyFavorites && !favorites.length ? "Você ainda não tem favoritos. Toque na estrela de um Pokémon para adicioná-lo." : "Nenhum Pokémon corresponde aos filtros."}</p><button type="button" className="room-secondary-button" onClick={() => { setSearchInput(""); setSearchTerm(""); setOnlyFavorites(false); setDexGeneration("all"); setLimit(60); }}>Limpar filtros</button></div>
                                )}
                                {limit < filteredSpecies.length && (
                                    <button type="button" onClick={() => setLimit(value => value + 60)} className="dex-load-more room-secondary-button">
                                        Mostrar mais Pokémon
                                    </button>
                                )}
                            </>
                    ) : view === "teambuilder" ? <Teambuilder envProps={teamBuilderProps} /> : <TrainerGuide experienceMode={experienceMode} />}
                </div>
            </main>
            <footer className="device-footer"><span>MyOwnDex <b>11.2.0</b></span><span>Projeto de fãs · Dados <a href="https://pokeapi.co/about" target="_blank" rel="noreferrer">PokéAPI</a></span></footer>
            {selectedUrl && <PokemonModal speciesUrl={selectedUrl} onClose={() => setSelectedUrl(null)} isTTRPG={isTTRPG} onAddToTeam={integrateTeam} />}
        </div>
    );
}
