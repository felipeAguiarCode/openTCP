// Fontes injetáveis de tempo, identidade e entropia. Em produção vêm de `crypto`/`Date`; nos testes são
// determinísticas. O domínio nunca as usa diretamente.
export type Platform = {
  readonly newId: (prefix: string) => string;
  readonly now: () => string;
  /** Semente uint32 de alta entropia, usada apenas para criar `seedRng`/`economyRng` de um perfil novo. */
  readonly randomSeed: () => number;
};

export function deterministicPlatform(start = 1, clock = '2026-10-14T00:00:00.000Z'): Platform {
  let counter = start;
  let seed = 0x1234_5678;
  return {
    newId: (prefix) => `${prefix}-${(counter++).toString(36).padStart(6, '0')}`,
    now: () => clock,
    randomSeed: () => {
      seed = (Math.imul(seed ^ (seed >>> 15), 0x2c1b3c6d) + 0x9e3779b9) >>> 0;
      return seed;
    },
  };
}
