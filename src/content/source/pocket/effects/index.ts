// Tabelas de efeito (texto em inglês → DSL) e de nomes PT-BR de todos os sets, reunidas: as do Genetic Apex
// (a1/effects.ts, a1/pt-br.ts) e as de cada set seguinte (um módulo por set, com os textos que estreiam nele).
// Chave repetida entre módulos é erro (efeito) ou precisa ter a mesma tradução (nome).
import type { EffectTables, NameTables } from '../build.ts';
import * as A1 from '../../a1/effects.ts';
import * as A1N from '../../a1/pt-br.ts';
import { SET_TABLES } from './sets.ts';

export type SetTables = {
  readonly attacks?: EffectTables['attacks'];
  readonly abilities?: EffectTables['abilities'];
  readonly trainers?: EffectTables['trainers'];
  readonly attackNames?: NameTables['attacks'];
  readonly abilityNames?: NameTables['abilities'];
  readonly trainerNames?: NameTables['trainers'];
};

function mergeEffects<T>(label: string, parts: readonly (Readonly<Record<string, T>> | undefined)[]): Readonly<Record<string, T>> {
  const out: Record<string, T> = {};
  for (const part of parts) {
    for (const [k, v] of Object.entries(part ?? {})) {
      if (k in out) throw new Error(`${label} repetido nas tabelas: "${k}"`);
      out[k] = v;
    }
  }
  return out;
}

function mergeNames(label: string, parts: readonly (Readonly<Record<string, string>> | undefined)[]): Readonly<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const part of parts) {
    for (const [k, v] of Object.entries(part ?? {})) {
      if (k in out && out[k] !== v) throw new Error(`${label} "${k}" com duas traduções: "${out[k]}" e "${v}"`);
      out[k] = v;
    }
  }
  return out;
}

const all: readonly SetTables[] = [
  { attacks: A1.ATTACK_EFFECTS, abilities: A1.ABILITY_EFFECTS, trainers: A1.TRAINER_EFFECTS, attackNames: A1N.ATTACK_NAMES, abilityNames: A1N.ABILITY_NAMES, trainerNames: A1N.TRAINER_NAMES },
  ...SET_TABLES,
];

export const EFFECTS: EffectTables = {
  attacks: mergeEffects('efeito de ataque', all.map((t) => t.attacks)),
  abilities: mergeEffects('Habilidade', all.map((t) => t.abilities)),
  trainers: mergeEffects('Treinador', all.map((t) => t.trainers)),
};

export const NAMES: NameTables = {
  attacks: mergeNames('nome de ataque', all.map((t) => t.attackNames)),
  abilities: mergeNames('nome de Habilidade', all.map((t) => t.abilityNames)),
  trainers: mergeNames('nome de Treinador', all.map((t) => t.trainerNames)),
};
