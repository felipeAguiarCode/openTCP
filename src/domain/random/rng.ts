// rng-v1 (gameplay.md §27.3): xoshiro128** semeado por SplitMix32, aritmética uint32.
// Funções puras: toda operação recebe um estado e devolve o valor e o novo estado.

export type RngState = {
  readonly algorithm: 'rng-v1';
  readonly state: readonly [number, number, number, number];
  readonly draws: number;
};

export type Drawn<T> = { readonly value: T; readonly rng: RngState };

const U32 = 0x1_0000_0000;

function splitmix32(x: number): { x: number; z: number } {
  const nx = (x + 0x9e3779b9) >>> 0;
  let z = nx;
  z = Math.imul(z ^ (z >>> 16), 0x85ebca6b) >>> 0;
  z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35) >>> 0;
  z = (z ^ (z >>> 16)) >>> 0;
  return { x: nx, z };
}

const rotl = (v: number, k: number): number => ((v << k) | (v >>> (32 - k))) >>> 0;

export function seedRng(seed: number): RngState {
  let x = seed >>> 0;
  const words: number[] = [];
  for (let i = 0; i < 4; i += 1) {
    const step = splitmix32(x);
    x = step.x;
    words.push(step.z);
  }
  if (!words.some((w) => w !== 0)) words[0] = 1;
  return { algorithm: 'rng-v1', state: [words[0]!, words[1]!, words[2]!, words[3]!], draws: 0 };
}

export function nextU32(rng: RngState): Drawn<number> {
  let [s0, s1, s2, s3] = rng.state;
  const result = Math.imul(rotl(Math.imul(s1, 5) >>> 0, 7), 9) >>> 0;
  const t = (s1 << 9) >>> 0;
  s2 = (s2 ^ s0) >>> 0;
  s3 = (s3 ^ s1) >>> 0;
  s1 = (s1 ^ s2) >>> 0;
  s0 = (s0 ^ s3) >>> 0;
  s2 = (s2 ^ t) >>> 0;
  s3 = rotl(s3, 11);
  return { value: result, rng: { algorithm: 'rng-v1', state: [s0, s1, s2, s3], draws: rng.draws + 1 } };
}

/** Inteiro uniforme em [0, n) por rejeição; sempre consome ao menos um uint32. */
export function uniformInt(rng: RngState, n: number): Drawn<number> {
  if (!Number.isInteger(n) || n <= 0 || n > U32) throw new RangeError(`uniformInt: n inválido ${n}`);
  const limit = U32 - (U32 % n);
  let current = rng;
  for (;;) {
    const drawn = nextU32(current);
    current = drawn.rng;
    if (drawn.value < limit) return { value: drawn.value % n, rng: current };
  }
}

export type CoinFace = 'HEADS' | 'TAILS';

export function flipCoin(rng: RngState): Drawn<CoinFace> {
  const drawn = nextU32(rng);
  return { value: drawn.value < 0x8000_0000 ? 'HEADS' : 'TAILS', rng: drawn.rng };
}

export function shuffle<T>(rng: RngState, items: readonly T[]): Drawn<T[]> {
  const out = items.slice();
  let current = rng;
  for (let i = out.length - 1; i >= 1; i -= 1) {
    const drawn = uniformInt(current, i + 1);
    current = drawn.rng;
    const j = drawn.value;
    const tmp = out[i]!;
    out[i] = out[j]!;
    out[j] = tmp;
  }
  return { value: out, rng: current };
}

export function weightedPick<T>(rng: RngState, items: readonly { readonly item: T; readonly weight: number }[]): Drawn<T> {
  const total = items.reduce((sum, entry) => {
    if (!Number.isInteger(entry.weight) || entry.weight <= 0) throw new RangeError('weightedPick: peso inválido');
    return sum + entry.weight;
  }, 0);
  if (total <= 0) throw new RangeError('weightedPick: lista vazia');
  const drawn = uniformInt(rng, total);
  let acc = 0;
  for (const entry of items) {
    acc += entry.weight;
    if (acc > drawn.value) return { value: entry.item, rng: drawn.rng };
  }
  throw new Error('weightedPick: inalcançável');
}

export function pickDistinct<T>(rng: RngState, items: readonly T[], count: number): Drawn<T[]> {
  const shuffled = shuffle(rng, items);
  return { value: shuffled.value.slice(0, Math.min(count, items.length)), rng: shuffled.rng };
}

export function isRngState(value: unknown): value is RngState {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return v.algorithm === 'rng-v1' && Array.isArray(v.state) && v.state.length === 4
    && v.state.every((w) => Number.isInteger(w) && (w as number) >= 0 && (w as number) < U32)
    && Number.isInteger(v.draws);
}
