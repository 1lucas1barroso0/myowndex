import { clampFinite } from "./math.js";

let audioContext = null;

const getContext = () => {
    if (typeof window === "undefined") return null;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return null;
    if (!audioContext || audioContext.state === "closed") audioContext = new AudioContext();
    return audioContext;
};

const resumeContext = async context => {
    if (!context) return false;
    if (context.state !== "running") {
        try {
            await context.resume();
        } catch {
            return false;
        }
    }
    return context.state === "running";
};

const primeOutput = context => {
    try {
        const buffer = context.createBuffer(1, 1, context.sampleRate || 44100);
        const source = context.createBufferSource();
        const gain = context.createGain();
        gain.gain.value = 0;
        source.buffer = buffer;
        source.connect(gain).connect(context.destination);
        source.start();
    } catch {
        // Alguns WebViews não precisam ou não aceitam a etapa de desbloqueio silenciosa.
    }
};

const tone = (context, {
    start,
    duration,
    frequency,
    endFrequency = frequency,
    type = "square",
    volume = 0.12,
}) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), start + duration);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume), start + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
};

export const SOUND_EFFECTS = [
    { id: "encounter", label: "Encontro" },
    { id: "hit", label: "Impacto" },
    { id: "critical", label: "Crítico" },
    { id: "heal", label: "Cura" },
    { id: "capture", label: "Captura" },
    { id: "alert", label: "Alerta" },
];

export const activateAudio = async () => {
    const context = getContext();
    if (!await resumeContext(context)) return false;
    primeOutput(context);
    return true;
};

export const playSoundEffect = async (effectId, masterVolume = 0.8) => {
    const context = getContext();
    if (!await resumeContext(context)) return false;
    const normalizedVolume = clampFinite(masterVolume, 0, 1, 0);
    if (normalizedVolume <= 0) return true;
    const now = context.currentTime + 0.01;
    const volume = normalizedVolume * 0.18;
    const notes = {
        encounter: [
            { start: now, duration: 0.12, frequency: 196, endFrequency: 392 },
            { start: now + 0.13, duration: 0.12, frequency: 261, endFrequency: 523 },
            { start: now + 0.27, duration: 0.2, frequency: 392, endFrequency: 784 },
        ],
        hit: [
            { start: now, duration: 0.09, frequency: 120, endFrequency: 48, type: "sawtooth" },
            { start: now + 0.04, duration: 0.07, frequency: 86, endFrequency: 34, type: "square" },
        ],
        critical: [
            { start: now, duration: 0.09, frequency: 523, endFrequency: 659 },
            { start: now + 0.1, duration: 0.09, frequency: 659, endFrequency: 784 },
            { start: now + 0.2, duration: 0.24, frequency: 784, endFrequency: 1046, type: "triangle" },
        ],
        heal: [
            { start: now, duration: 0.15, frequency: 392, endFrequency: 523, type: "sine" },
            { start: now + 0.12, duration: 0.15, frequency: 523, endFrequency: 659, type: "sine" },
            { start: now + 0.24, duration: 0.22, frequency: 659, endFrequency: 784, type: "sine" },
        ],
        capture: [
            { start: now, duration: 0.08, frequency: 784, endFrequency: 523 },
            { start: now + 0.13, duration: 0.08, frequency: 784, endFrequency: 523 },
            { start: now + 0.26, duration: 0.2, frequency: 1046, endFrequency: 659, type: "triangle" },
        ],
        alert: [
            { start: now, duration: 0.12, frequency: 880, endFrequency: 880 },
            { start: now + 0.18, duration: 0.12, frequency: 880, endFrequency: 880 },
        ],
    };
    try {
        (notes[effectId] || notes.alert).forEach(note => tone(context, { ...note, volume }));
        return true;
    } catch {
        return false;
    }
};
