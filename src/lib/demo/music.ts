/**
 * Musique d'ambiance de la démonstration : une boucle douce GÉNÉRÉE dans le navigateur (Web Audio).
 * Aucun fichier audio, aucun droit d'auteur, rien à télécharger. Accords lents en do majeur + quelques notes de « boîte à musique ».
 */

export const midiToHz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

export type Chord = { name: string; pad: number[] };

/** Do maj9 · La m9 · Fa maj7 · Sol 6 : une progression tendre, sans tension. */
export const PROGRESSION: readonly Chord[] = [
  { name: "Cmaj9", pad: [48, 55, 59, 62, 64] },
  { name: "Am9", pad: [45, 52, 55, 59, 62] },
  { name: "Fmaj7", pad: [41, 48, 52, 57, 60] },
  { name: "G6", pad: [43, 50, 55, 59, 64] },
];

export const BAR_SECONDS = 8;
/** Gamme pentatonique de do : toutes les notes vont avec tous les accords. */
export const MELODY = [72, 74, 76, 79, 81, 84] as const;

export function chordAt(bar: number): Chord {
  const n = PROGRESSION.length;
  return PROGRESSION[((bar % n) + n) % n];
}

/** Note suivante : de proche en proche (1 ou 2 degrés), jamais deux fois la même. */
export function nextMelody(previous: number | null, rand: () => number): number {
  const last = previous === null ? -1 : MELODY.indexOf(previous as (typeof MELODY)[number]);
  if (last < 0) return MELODY[Math.floor(rand() * MELODY.length)];
  const steps = [-2, -1, 1, 2].filter((d) => last + d >= 0 && last + d < MELODY.length);
  return MELODY[last + steps[Math.floor(rand() * steps.length)]];
}

/** Silence entre deux notes : 1,6 à 4 secondes. */
export const gapSeconds = (rand: () => number) => 1.6 + rand() * 2.4;

const PAD_GAIN = 0.03;
const BELL_GAIN = 0.06;

export class CalmMusic {
  private readonly master: GainNode;
  private readonly padBus: GainNode;
  private readonly bellBus: GainNode;
  private origin = 0;
  private bar = 0;
  private nextNoteAt = 0;
  private lastNote: number | null = null;
  private timer: ReturnType<typeof setInterval> | undefined;

  constructor(
    readonly ctx: BaseAudioContext,
    private readonly rand: () => number = Math.random,
    private readonly level = 0.55,
  ) {
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -20;
    this.master.connect(limiter).connect(ctx.destination);

    // Pad : adouci par un filtre passe-bas.
    this.padBus = ctx.createGain();
    const soften = ctx.createBiquadFilter();
    soften.type = "lowpass";
    soften.frequency.value = 1100;
    this.padBus.connect(soften).connect(this.master);

    // Notes : un peu de « salle » grâce à un écho doux.
    this.bellBus = ctx.createGain();
    const echo = ctx.createDelay(1);
    echo.delayTime.value = 0.46;
    const feedback = ctx.createGain();
    feedback.gain.value = 0.36;
    const damp = ctx.createBiquadFilter();
    damp.type = "lowpass";
    damp.frequency.value = 2200;
    const wet = ctx.createGain();
    wet.gain.value = 0.55;
    this.bellBus.connect(this.master);
    this.bellBus.connect(echo);
    echo.connect(damp).connect(feedback).connect(echo);
    damp.connect(wet).connect(this.master);
  }

  /** Planifie tout ce qui commence avant `until` (en secondes du contexte audio). */
  scheduleUntil(until: number) {
    while (this.origin + this.bar * BAR_SECONDS < until) {
      this.playChord(chordAt(this.bar), this.origin + this.bar * BAR_SECONDS);
      this.bar += 1;
    }
    while (this.nextNoteAt < until) {
      this.lastNote = nextMelody(this.lastNote, this.rand);
      this.playBell(this.lastNote, this.nextNoteAt);
      this.nextNoteAt += gapSeconds(this.rand);
    }
  }

  private playChord(chord: Chord, at: number) {
    for (const midi of chord.pad) {
      const voice = this.ctx.createGain();
      voice.gain.setValueAtTime(0, at);
      voice.gain.linearRampToValueAtTime(PAD_GAIN, at + 2.5);
      voice.gain.linearRampToValueAtTime(PAD_GAIN, at + BAR_SECONDS - 0.5);
      voice.gain.linearRampToValueAtTime(0, at + BAR_SECONDS + 3);
      voice.connect(this.padBus);
      for (const [type, cents] of [["sine", -5], ["triangle", 5]] as const) {
        const osc = this.ctx.createOscillator();
        osc.type = type;
        osc.frequency.value = midiToHz(midi);
        osc.detune.value = cents;
        osc.connect(voice);
        osc.start(at);
        osc.stop(at + BAR_SECONDS + 3.1);
      }
    }
  }

  private playBell(midi: number, at: number) {
    for (const [mult, gain, decay] of [[1, BELL_GAIN, 3], [2, BELL_GAIN / 4, 1.6]] as const) {
      const env = this.ctx.createGain();
      env.gain.setValueAtTime(0.0001, at);
      env.gain.linearRampToValueAtTime(gain, at + 0.015);
      env.gain.exponentialRampToValueAtTime(0.0001, at + decay);
      env.connect(this.bellBus);
      const osc = this.ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = midiToHz(midi) * mult;
      osc.connect(env);
      osc.start(at);
      osc.stop(at + decay + 0.1);
    }
  }

  /** Démarre en fondu et planifie en continu, quelques secondes à l'avance. */
  start() {
    const now = this.ctx.currentTime;
    this.origin = now + 0.2;
    this.nextNoteAt = this.origin + 3;
    void (this.ctx as AudioContext).resume?.();
    this.master.gain.setTargetAtTime(this.level, now, 0.9);
    this.scheduleUntil(now + 4);
    this.timer = setInterval(() => this.scheduleUntil(this.ctx.currentTime + 4), 500);
  }

  /** Pose le point de départ sans horloge (rendu hors ligne, tests). */
  beginAt(time: number) {
    this.origin = time;
    this.nextNoteAt = time + 3;
    this.master.gain.value = this.level;
  }

  setPaused(paused: boolean) {
    const ctx = this.ctx as AudioContext;
    if (paused) void ctx.suspend?.();
    else void ctx.resume?.();
  }

  /** Fondu de sortie puis libération du contexte audio. */
  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
    this.master.gain.setTargetAtTime(0, this.ctx.currentTime, 0.3);
    const ctx = this.ctx as AudioContext;
    setTimeout(() => void ctx.close?.(), 1600);
  }
}
