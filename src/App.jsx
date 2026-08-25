import React, { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import { formatPokemonCount } from "./core/copy.js";
import { dedupeByNameLatest, extractId, fetchCached, filterMovesByLatestVersion, formatName } from "./core/mechanics.js";
import { createTeam, hydrateTeams, loadTeams, mergeHydratedTeams, normalizePokemon, saveTeams, touchTeam } from "./core/team.js";
import { EXPERIENCE_MODES } from "./core/rpgRules.js";
import { randomChance } from "./core/random.js";
import { readStorage, writeStorage } from "./core/storage.js";
import TrainerGuide from "./components/Guide/TrainerGuide.jsx";
import PokemonModal from "./components/Pokedex/PokemonModal.jsx";
import Teambuilder from "./components/Teambuilder/Teambuilder.jsx";
import RpgRoom from "./components/Room/RpgRoom.jsx";
import AppearanceControl from "./components/Shared/AppearanceControl.jsx";
import InstallMyOwnDex from "./components/Shared/InstallMyOwnDex.jsx";
import GameStyleControl from "./components/Shared/GameStyleControl.jsx";
import PokemonSprite from "./components/Shared/PokemonSprite.jsx";

const PokemonCard = React.memo(function PokemonCard({ species, id, onSelect }) {
    return (
        <button
            type="button"
            onClick={onSelect}
            className="game-card p-4 flex flex-col items-center cursor-pointer group relative text-left focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-300"
            aria-label={`Consultar ${formatName(species.name)} na Pokédex`}
        >
            <span className="absolute top-2 left-3 text-[9px] font-black text-slate-400 uppercase tracking-widest group-hover:text-red-500 transition-colors">
                No. {id.padStart(4, "0")}
            </span>
                                        <span className="pokemon-card-sprite-frame w-full h-20 mt-4 flex justify-center items-center rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 border border-slate-200">
                <PokemonSprite
                    pokemonId={id}
                    alt=""
                    className="w-20 h-20 pixelated drop-shadow-md group-hover:scale-110 transition-transform duration-200"
                />
            </span>
            <span className="pokemon-card-name text-[11px] font-black text-slate-700 mt-3 capitalize w-full text-center group-hover:text-red-600 transition-colors">
                {formatName(species.name)}
            </span>
        </button>
    );
});

const StatusNotice = ({ tone = "blue", children, onClose, actionLabel, onAction }) => {
    const tones = {
        blue: "is-info",
        amber: "is-reversible",
        red: "is-caution"
    };
    return (
        <div className={`status-notice mb-5 ${tones[tone] || tones.blue}`}>
            <span role="status" aria-live="polite" aria-atomic="true" className="status-notice-message">{children}</span>
            <span className="status-notice-actions">
                {actionLabel && onAction && <button type="button" onClick={onAction} className="status-notice-action">{actionLabel}</button>}
                {onClose && <button type="button" onClick={onClose} className="status-notice-close" aria-label="Dispensar aviso">×</button>}
            </span>
        </div>
    );
};

export default function App() {
    const [species, setSpecies] = useState([]);
    const [dexLoading, setDexLoading] = useState(true);
    const [dexError, setDexError] = useState("");
    const [dexAttempt, setDexAttempt] = useState(0);
    const [searchInput, setSearchInput] = useState("");
    const [searchTerm, setSearchTerm] = useState("");
    const [experienceMode, setExperienceMode] = useState("rpg");
    const [modeBooted, setModeBooted] = useState(false);
    const [limit, setLimit] = useState(60);
    const [selectedUrl, setSelectedUrl] = useState(null);
    const [view, setView] = useState("room");
    const [online, setOnline] = useState(true);
    const [notice, setNotice] = useState(null);
    const deferredSearchTerm = useDeferredValue(searchTerm);

    const [teams, setTeams] = useState([]);
    const [teamsBooted, setTeamsBooted] = useState(false);
    const [activeTeamId, setActiveTeamId] = useState(null);
    const [storageError, setStorageError] = useState(false);
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
        const launchView = {
            aventura: "room",
            pokedex: "pokedex",
            pc: "teambuilder",
            guia: "guide",
        }[new URLSearchParams(window.location.search).get("abrir")];
        if (launchView) {
            setView(launchView);
            const cleanUrl = new URL(window.location.href);
            cleanUrl.searchParams.delete("abrir");
            window.history.replaceState({}, "", `${cleanUrl.pathname}${cleanUrl.search}${cleanUrl.hash}`);
        }
        else if (["room", "pokedex", "teambuilder", "guide"].includes(preferences?.view)) setView(preferences.view);
        setModeBooted(true);
    }, []);

    useEffect(() => {
        if (!modeBooted) return;
        writeStorage("myowndex_preferences_v1", { experienceMode, view });
    }, [experienceMode, modeBooted, view]);

    useEffect(() => {
        if (!teamsBooted) return;
        setStorageError(!saveTeams(teams));
    }, [teams, teamsBooted]);

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
        if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return undefined;
        let refreshing = false;
        let offeredWorker = null;
        let updateTimer = 0;
        const offerUpdate = worker => {
            if (!worker || offeredWorker === worker) return;
            offeredWorker = worker;
            setNotice({
                tone: "blue",
                text: "Uma nova versão do MyOwnDex está pronta para a sua aventura.",
                actionLabel: "Atualizar agora",
                onAction: () => worker.postMessage({ type: "SKIP_WAITING" }),
            });
        };
        const watchRegistration = current => {
            if (current.waiting && navigator.serviceWorker.controller) offerUpdate(current.waiting);
            current.addEventListener("updatefound", () => {
                const installing = current.installing;
                installing?.addEventListener("statechange", () => {
                    if (installing.state === "installed" && navigator.serviceWorker.controller) offerUpdate(installing);
                });
            });
            updateTimer = window.setInterval(() => current.update().catch(() => {}), 60 * 60 * 1000);
        };
        const register = () => navigator.serviceWorker.register("/sw.js").then(watchRegistration).catch(() => {});
        const onControllerChange = () => {
            if (refreshing) return;
            refreshing = true;
            window.location.reload();
        };
        navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
        window.addEventListener("load", register, { once: true });
        return () => {
            window.removeEventListener("load", register);
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
        setDexLoading(true);
        setDexError("");
        fetchCached("https://pokeapi.co/api/v2/pokemon-species?limit=1500", {
            maxAgeMs: 24 * 60 * 60 * 1000,
            forceRefresh: dexAttempt > 0
        }).then(result => {
            if (!mounted) return;
            if (!result?.results?.length) {
                setDexError("A Pokédex não conseguiu se conectar ao Centro Pokémon. Vamos tentar de novo?");
                return;
            }
            setSpecies(result.results);
        }).finally(() => {
            if (mounted) setDexLoading(false);
        });
        return () => { mounted = false; };
    }, [dexAttempt]);

    useEffect(() => {
        if (view !== "pokedex" || !species.length) return;
        let cancelled = false;
        const prefetch = () => {
            if (cancelled) return;
            species.slice(0, 12).forEach(entry => {
                const image = new Image();
                image.src = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${extractId(entry.url)}.png`;
            });
        };
        const task = window.requestIdleCallback ? window.requestIdleCallback(prefetch) : window.setTimeout(prefetch, 500);
        return () => {
            cancelled = true;
            if (window.cancelIdleCallback) window.cancelIdleCallback(task);
            else window.clearTimeout(task);
        };
    }, [species, view]);

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
                setEnvError("Algumas opções ainda não chegaram, mas sua Box continua salva neste aparelho.");
            }
            setEnvLoaded(true);
        }).finally(() => {
            if (mounted) setEnvLoading(false);
        });
        return () => { mounted = false; };
    }, [view, envLoaded]);

    const filteredSpecies = useMemo(() => {
        if (!deferredSearchTerm) return species;
        const query = deferredSearchTerm.toLowerCase();
        return species.filter(entry => {
            const name = entry?.name || "";
            const id = extractId(entry?.url);
            return name.includes(query) || formatName(name).toLowerCase().includes(query) || id === query;
        });
    }, [species, deferredSearchTerm]);

    const visible = useMemo(() => filteredSpecies.slice(0, limit), [filteredSpecies, limit]);

    const handleOpenPokedex = useCallback(() => setView("pokedex"), []);
    const handleOpenTeambuilder = useCallback(() => setView("teambuilder"), []);
    const handleOpenGuide = useCallback(() => setView("guide"), []);
    const handleOpenRoom = useCallback(() => setView("room"), []);
    const handleSearchInputChange = useCallback(event => {
        setSearchInput(event.target.value);
        setLimit(60);
    }, []);

    const integrateTeam = useCallback((formData, genderRate) => {
        const resolvedRate = Number.isFinite(Number(genderRate)) ? Number(genderRate) : -1;
        const targetTeam = teams.find(team => team.id === activeTeamId) || teams[0] || null;
        const legalMoves = filterMovesByLatestVersion(
            formData.moves || [],
            targetTeam?.versionGroup || "auto",
        );
        const levelMoves = legalMoves.filter(entry =>
            entry.latest_detail?.move_learn_method?.name === "level-up"
            && Number(entry.latest_detail?.level_learned_at || 0) <= 5
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
    }, [activeTeamId, teams]);

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
        <div className={`app-root view-${view} min-h-[100dvh] flex flex-col`}>
            <header className="app-header shrink-0 px-2.5 sm:px-4 md:px-5 pt-2.5 sm:pt-4 pb-2 z-40">
                <div className="max-w-[1900px] mx-auto game-shell app-header-shell p-2.5 sm:p-3.5">
                    <div className="app-header-row flex flex-col xl:flex-row justify-between items-stretch xl:items-center gap-3">
                        <div className="app-header-primary flex items-center justify-between gap-4 w-full lg:w-auto">
                            <div className="app-brand-cluster flex items-center gap-4">
                                <button type="button" aria-label="Abrir a Central da Aventura" onClick={handleOpenRoom} className="app-brand-icon relative shrink-0 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-300">
                                    <img src="/icons/myowndex-icon-v91.svg" alt="" />
                                </button>
                                <div className="app-brand flex flex-col">
                                    <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Pokémon</span>
                                    <h1 className="text-xl sm:text-2xl font-black text-slate-800">MyOwnDex</h1>
                                </div>
                            </div>
                            <nav aria-label="Navegação principal" className="app-nav">
                                <button type="button" title="Abrir a Central da Aventura para criar, entrar ou continuar uma jornada" aria-label="Abrir a Central da Aventura" aria-current={view === "room" ? "page" : undefined} onClick={handleOpenRoom} className={`nav-capsule ${view === "room" ? "is-active" : ""}`}><span aria-hidden="true">◆</span>Aventura</button>
                                <button type="button" title="Consultar espécies, formas, habilidades e movimentos" aria-label="Abrir a Pokédex" aria-current={view === "pokedex" ? "page" : undefined} onClick={handleOpenPokedex} className={`nav-capsule ${view === "pokedex" ? "is-active" : ""}`}><span aria-hidden="true">◉</span>Pokédex</button>
                                <button type="button" title="Organizar Boxes, equipes e fichas de Pokémon" aria-label="Abrir o PC do Bill" aria-current={view === "teambuilder" ? "page" : undefined} onClick={handleOpenTeambuilder} className={`nav-capsule ${view === "teambuilder" ? "is-active" : ""}`}><span aria-hidden="true">▦</span>PC</button>
                                <button type="button" title="Consultar todas as regras usadas pelo MyOwnDex" aria-label="Abrir o Guia do Treinador" aria-current={view === "guide" ? "page" : undefined} onClick={handleOpenGuide} className={`nav-capsule ${view === "guide" ? "is-active" : ""}`}><span aria-hidden="true">≡</span>Guia</button>
                            </nav>
                            <AppearanceControl />
                            <InstallMyOwnDex />
                        </div>

                        <div className="app-actions flex gap-2.5 w-full xl:w-auto items-center justify-end flex-wrap sm:flex-nowrap">
                            {view === "pokedex" && (
                                <div className="relative flex-grow w-full sm:w-80">
                                    <label htmlFor="pokemon-search" className="sr-only">Buscar Pokémon por nome ou número</label>
                                    <input id="pokemon-search" type="search" value={searchInput} placeholder="Nome ou número…" className="w-full pl-11 pr-4 py-3 bg-slate-900 border-2 border-blue-700 rounded-full text-xs text-white font-bold outline-none focus:border-cyan-300 transition-colors shadow-inner" onChange={handleSearchInputChange} />
                                    <svg aria-hidden="true" className="w-4 h-4 absolute left-4 top-4 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                                </div>
                            )}
                            <GameStyleControl value={experienceMode} onChange={setExperienceMode} />
                        </div>
                    </div>
                </div>
            </header>

            <main className="flex-1 app-scroll-area px-2.5 sm:px-4 md:px-5 pt-1.5 pb-3 sm:pb-5 relative z-10">
                <div className="max-w-[1900px] mx-auto game-shell app-main-shell p-3 sm:p-5 md:p-6 min-h-[70vh]">
                    {!online && <StatusNotice tone="amber">Você está sem internet, mas tudo o que já consultou na Pokédex continua disponível.</StatusNotice>}
                    {storageError && <StatusNotice tone="red">Não conseguimos salvar esta Box neste aparelho. Libere espaço ou permita o armazenamento do site e tente novamente.</StatusNotice>}
                    {notice && <StatusNotice tone={notice.tone} actionLabel={notice.actionLabel} onAction={notice.onAction} onClose={() => setNotice(null)}>{notice.text}</StatusNotice>}

                    {view === "room" ? (
                        <RpgRoom
                            teams={teams}
                            setTeams={setTeams}
                            onOpenGuide={handleOpenGuide}
                            setNotice={setNotice}
                        />
                    ) : view === "pokedex" ? (
                        dexLoading ? (
                            <div aria-label="Abrindo a Pokédex" className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-3 sm:gap-5 w-full">
                                {[...Array(40)].map((_, index) => <div key={index} className="bg-slate-200 border-2 border-slate-300 rounded-2xl h-36 skeleton" />)}
                            </div>
                        ) : dexError && !species.length ? (
                            <div className="min-h-[55vh] flex flex-col items-center justify-center text-center">
                                <div className="text-5xl mb-4" aria-hidden="true">📡</div>
                                <h2 className="text-xl font-black text-slate-800">A Pokédex precisa de mais um instante</h2>
                                <p className="mt-2 text-sm text-slate-500">{dexError}</p>
                                <button type="button" onClick={() => setDexAttempt(value => value + 1)} className="mt-5 rounded-2xl bg-red-500 px-5 py-3 text-xs font-black uppercase tracking-widest text-white shadow-[0_4px_0_#991B1B]">Buscar novamente</button>
                            </div>
                        ) : (
                            <>
                                <div className="bg-slate-900 border-4 border-slate-800 rounded-2xl p-5 mb-8 shadow-xl relative overflow-hidden">
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className={`w-3 h-3 rounded-full shadow-[0_0_8px_currentColor] ${online ? "bg-emerald-400 text-emerald-400 animate-pulse" : "bg-amber-400 text-amber-400"}`} />
                                        <span className={`text-[10px] font-mono font-bold tracking-widest uppercase ${online ? "text-emerald-400" : "text-amber-400"}`}>{online ? "Pokédex conectada" : "Consulta offline"}</span>
                                    </div>
                                    <h2 className="text-2xl sm:text-3xl font-black text-white font-mono tracking-tight uppercase">
                                        Pokédex Nacional<br />
                                        <span className="text-slate-400 text-sm font-bold">&gt; {formatPokemonCount(filteredSpecies.length)}</span>
                                    </h2>
                                </div>
                                {visible.length ? (
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 2xl:grid-cols-10 gap-3 sm:gap-5">
                                        {visible.map(entry => <PokemonCard key={entry.name} species={entry} id={extractId(entry.url)} onSelect={() => setSelectedUrl(entry.url)} />)}
                                    </div>
                                ) : (
                                    <div className="py-16 text-center text-sm font-bold text-slate-500">Nenhum Pokémon apareceu para “{deferredSearchTerm}”. Tente outro nome ou número.</div>
                                )}
                                {limit < filteredSpecies.length && (
                                    <button type="button" onClick={() => setLimit(value => value + 60)} className="mt-8 sm:mt-10 w-full py-4 bg-slate-300 border-2 border-slate-400 hover:bg-red-500 hover:border-red-700 text-slate-600 hover:text-white text-xs font-black uppercase tracking-widest rounded-xl transition-all shadow-md outline-none">
                                        Mostrar mais Pokémon
                                    </button>
                                )}
                            </>
                        )
                    ) : view === "teambuilder" ? <Teambuilder envProps={teamBuilderProps} /> : <TrainerGuide experienceMode={experienceMode} onModeChange={setExperienceMode} />}
                </div>
            </main>
            {selectedUrl && <PokemonModal speciesUrl={selectedUrl} onClose={() => setSelectedUrl(null)} isTTRPG={isTTRPG} onAddToTeam={integrateTeam} />}
        </div>
    );
}
