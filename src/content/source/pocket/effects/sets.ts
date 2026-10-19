// Tabelas de efeito e nome dos sets do Pocket depois do A1: efeitos por família (ataques, Habilidades, Treinadores),
// nomes PT-BR por set de estreia (pocket/names/<setId>.ts). Chave repetida entre módulos é erro (index.ts).
import type { SetTables } from './index.ts';
import { ATTACKS_1 } from './attacks-1.ts';
import { ATTACKS_2 } from './attacks-2.ts';
import { ABILITIES } from './abilities.ts';
import { TRAINERS } from './trainers.ts';
import * as PA from '../names/pa.ts';
import * as A1A from '../names/a1a.ts';
import * as A2 from '../names/a2.ts';
import * as A2A from '../names/a2a.ts';
import * as A3 from '../names/a3.ts';
import * as A3A from '../names/a3a.ts';
import * as A3B from '../names/a3b.ts';
import * as A4 from '../names/a4.ts';
import * as A4A from '../names/a4a.ts';
import * as A4B from '../names/a4b.ts';
import * as PB from '../names/pb.ts';

const names = (m: { ATTACK_NAMES: SetTables['attackNames']; ABILITY_NAMES: SetTables['abilityNames']; TRAINER_NAMES: SetTables['trainerNames'] }): SetTables =>
  ({ attackNames: m.ATTACK_NAMES, abilityNames: m.ABILITY_NAMES, trainerNames: m.TRAINER_NAMES });

export const SET_TABLES: readonly SetTables[] = [
  { attacks: ATTACKS_1 }, { attacks: ATTACKS_2 }, { abilities: ABILITIES }, { trainers: TRAINERS },
  ...[PA, A1A, A2, A2A, A3, A3A, A3B, A4, A4A, A4B, PB].map(names),
];
