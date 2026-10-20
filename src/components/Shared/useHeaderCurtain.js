import { useCallback, useEffect, useRef, useState } from "react";

const KEY = "myowndex_header_curtain_v1";
const LABELS = ["Marca", "Navegação", "Ferramentas", "Tudo"];
const MARGIN = 36;
const clamp = (v, min, max) => Math.max(min, Math.min(v, max));

export default function useHeaderCurtain() {
    const headerRef = useRef(null), brandRef = useRef(null), navRef = useRef(null);
    const toolsRef = useRef(null), prefsRef = useRef(null), stopsRef = useRef([]);
    const pointerRef = useRef(null), ignoreClick = useRef(false);
    const [mobile, setMobile] = useState(false), [level, setLevel] = useState(3);
    const [dragHeight, setDragHeight] = useState(null), [stops, setStops] = useState([]);
    const choose = useCallback(value => {
        const next = clamp(value, 0, 3);
        setLevel(next); setDragHeight(null);
        try { localStorage.setItem(KEY, String(next)); } catch { /* Optional UI preference. */ }
    }, []);
    useEffect(() => {
        try { const saved = localStorage.getItem(KEY); if (/^[0-3]$/.test(saved || "")) setLevel(Number(saved)); } catch { /* Fine without storage. */ }
    }, []);
    useEffect(() => {
        const measure = () => {
            const narrow = matchMedia("(max-width:700px)").matches;
            setMobile(narrow);
            if (!narrow || !headerRef.current) return;
            const top = headerRef.current.getBoundingClientRect().top;
            const refs = [brandRef, navRef, toolsRef, prefsRef];
            const marks = refs.map(ref => ref.current
                ? Math.ceil(ref.current.getBoundingClientRect().bottom - top + MARGIN) : 0);
            for(let i=1;i<marks.length;i++) marks[i] = Math.max(marks[i], marks[i-1]+1);
            stopsRef.current = marks;
            setStops(old => old.length===4 && old.every((value,i)=>value===marks[i]) ? old : marks);
        };
        measure();
        const observer = typeof ResizeObserver==="undefined" ? null : new ResizeObserver(measure);
        [headerRef,brandRef,navRef,toolsRef,prefsRef].forEach(ref=>{if(ref.current)observer?.observe(ref.current);});
        window.addEventListener("resize",measure);
        window.addEventListener("orientationchange",measure);
        return ()=>{observer?.disconnect();window.removeEventListener("resize",measure);window.removeEventListener("orientationchange",measure);};
    }, []);
    const down = useCallback(e => {
        if(!mobile || !e.isPrimary || (e.pointerType==="mouse" && e.button!==0) || stopsRef.current.length!==4)return;
        pointerRef.current={id:e.pointerId,y:e.clientY,h:stopsRef.current[level],level,delta:0,moved:false};
        ignoreClick.current=false;
        e.currentTarget.setPointerCapture(e.pointerId);
    },[mobile,level]);
    const move = useCallback(e => {
        const p=pointerRef.current;
        if(!p||p.id!==e.pointerId)return;
        p.delta=e.clientY-p.y;
        if(!p.moved&&Math.abs(p.delta)<9)return;
        p.moved=true;e.preventDefault();
        const s=stopsRef.current;setDragHeight(clamp(p.h+p.delta,s[0],s[3]));
    },[]);
    const finish = useCallback((e,cancel=false) => {
        const p=pointerRef.current;
        if(!p||p.id!==e.pointerId)return;
        pointerRef.current=null;
        if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);
        if(cancel||!p.moved){setDragHeight(null);return;}
        ignoreClick.current=true;
        const s=stopsRef.current,pos=clamp(p.h+p.delta,s[0],s[3]);
        let nearest=s.reduce((best,n,i)=>Math.abs(n-pos)<Math.abs(s[best]-pos)?i:best,0);
        if(nearest===p.level&&Math.abs(p.delta)>=28)nearest=clamp(p.level+(p.delta>0?1:-1),0,3);
        choose(nearest);
    },[choose]);
    const click=useCallback(()=>{
        if(ignoreClick.current){ignoreClick.current=false;return;}
        choose(level===3?0:level+1);
    },[level,choose]);
    const keyDown=useCallback(e=>{
        const keys={ArrowUp:Math.max(0,level-1),ArrowDown:Math.min(3,level+1),Home:0,End:3};
        if(Object.hasOwn(keys,e.key)){e.preventDefault();choose(keys[e.key]);}
    },[level,choose]);
    return {headerRef,brandRef,navRef,toolsRef,prefsRef,mobile,level,
        dragging:dragHeight!==null,height:mobile?(dragHeight??stops[level]):undefined,
        label:`Ajustar cortina do topo: ${LABELS[level]}. Arraste ou use as setas.`,
        down,move,finish,click,keyDown};
}
