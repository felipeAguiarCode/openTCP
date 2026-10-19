// Perfis de referência da IA local (gameplay §25.3, campanha §14). O conteúdo publica perfis próprios
// (`aiProfiles` do pacote); estes valores servem de base calibrada e para os testes de força.
import type { AiProfile } from '../../content/types.ts';

type Weights = AiProfile['weights'];

/** Pesos neutros: cada termo da avaliação já é escalado em “centésimos de ponto” (ver evaluate.ts). */
export const NEUTRAL_WEIGHTS: Weights = {
  points: 1,
  opponentPoints: 1,
  damageDealt: 1,
  knockoutThreat: 1,
  energyDevelopment: 1,
  evolution: 1,
  benchDevelopment: 1,
  handSize: 1,
  conditions: 1,
  preservePoints: 1,
  aggression: 1,
};

export const STORY_PROFILE: AiProfile = {
  aiProfileId: 'reference-story-v1',
  policy: 'STORY',
  budget: { maxNodes: 120, maxDepth: 1, determinizations: 1, watchdogMs: 1500 },
  weights: { ...NEUTRAL_WEIGHTS, knockoutThreat: 0.6, preservePoints: 0.5, handSize: 0.8 },
  tolerance: { suboptimalChance: 0.25, candidatePoolTop: 3 },
  setupPolicy: 'HIGHEST_HP_ACTIVE',
  targetPolicy: 'MAX_DAMAGE',
  promotionPolicy: 'HIGHEST_HP',
};

/** Padrão: turno inteiro em feixe; como no conteúdo publicado, aceita raras escolhas subótimas (8% entre as 2 melhores). */
export const STANDARD_PROFILE: AiProfile = {
  aiProfileId: 'reference-standard-v1',
  policy: 'STANDARD',
  budget: { maxNodes: 900, maxDepth: 6, determinizations: 2, watchdogMs: 3000 },
  weights: { ...NEUTRAL_WEIGHTS },
  tolerance: { suboptimalChance: 0.08, candidatePoolTop: 2 },
  setupPolicy: 'BEST_ATTACKER_ACTIVE',
  targetPolicy: 'PREFER_KNOCKOUT',
  promotionPolicy: 'BEST_ATTACKER',
};

/** Especialista: mais determinizações e orçamento, checagem da resposta imediata do adversário, sem tolerância. */
export const EXPERT_PROFILE: AiProfile = {
  aiProfileId: 'reference-expert-v1',
  policy: 'EXPERT',
  budget: { maxNodes: 3600, maxDepth: 8, determinizations: 4, watchdogMs: 6000 },
  weights: { ...NEUTRAL_WEIGHTS, preservePoints: 1.3, knockoutThreat: 1.2 },
  tolerance: { suboptimalChance: 0, candidatePoolTop: 1 },
  setupPolicy: 'PROTECT_KEY_BASIC',
  targetPolicy: 'PREFER_HIGH_POINTS',
  promotionPolicy: 'LOWEST_POINTS_RISK',
};

export const DEFAULT_AI_PROFILES: Readonly<Record<AiProfile['policy'], AiProfile>> = {
  STORY: STORY_PROFILE,
  STANDARD: STANDARD_PROFILE,
  EXPERT: EXPERT_PROFILE,
};

/** Modelo do adversário dentro das simulações: decisões dele seguem uma política neutra e competente. */
export const OPPONENT_MODEL: AiProfile = { ...STANDARD_PROFILE, aiProfileId: 'opponent-model', tolerance: { suboptimalChance: 0, candidatePoolTop: 1 } };
