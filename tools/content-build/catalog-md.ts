// Gera .specs/catalogo-conteudo.md (PT-BR) e, por conjunto, .specs/catalogo/cartas-<set>.md a partir do pacote
// validado. Determinístico: mesmos dados, mesmo texto.
import type { BuiltBundle, ContentDeck, Product, RarityCategory } from '../../src/content/types.ts';
import type { CardDefinition, CardPrinting, CostType } from '../../src/domain/cards/types.ts';
import { definitionKey, isPokemon } from '../../src/domain/cards/types.ts';
import { abilityText, attackText, CONDITION_LABEL, STAGE_LABEL, SUBTYPE_LABEL, trainerText, TYPE_LABEL } from '../../src/domain/cards/text.ts';
import { raritySymbol } from '../../src/domain/cards/rarity.ts';
import { packRateTable } from '../../src/domain/economy/packs.ts';
import type { ContentFixture, ScriptCommand, SelectRef } from '../../src/content/source/script.ts';
import type { BuildReport } from './validate.ts';

const esc = (s: string) => s.replace(/\|/g, '\\|').replace(/\n/g, ' ');
const pct = (x: number) => `${(x * 100).toFixed(2).replace('.', ',')}%`;
/** Porcentagem com 3 casas (taxas oficiais do Pocket, campanha §16.2). */
const pct3 = (x: number) => `${(x * 100).toFixed(3).replace('.', ',')}%`;
const RARITY: Record<string, string> = { COMMON: 'Comum', UNCOMMON: 'Incomum', RARE: 'Rara', ULTRA: 'Ultra', PROMO: 'Promo' };
const FINISH: Record<string, string> = { NORMAL: 'Normal', HOLOGRAPHIC: 'Holográfica', FOIL: 'Foil', CHROME: 'Cromada' };
const KIND: Record<string, string> = { TUTORIAL: 'Tutorial', DUEL: 'Duelo', PUZZLE: 'Puzzle', DISCOVERY: 'Descoberta', ELITE: 'Elite', BOSS: 'Chefe', FINAL: 'Final' };
const DIFF: Record<string, string> = { STORY: 'História', STANDARD: 'Padrão', EXPERT: 'Especialista' };
const RECIPE_CATEGORY: Record<string, string> = { META: 'Meta', TYPE: 'Por tipo', COMMUNITY: 'Comunidade' };
const RECIPE_DIFFICULTY: Record<string, string> = { EASY: 'Iniciante', MEDIUM: 'Intermediária', HARD: 'Avançada' };
const CAT_ORDER: readonly RarityCategory[] = ['COMMON', 'UNCOMMON', 'RARE', 'ULTRA'];

function costText(cost: Partial<Record<CostType, number>>): string {
  const order: CostType[] = ['GRASS', 'FIRE', 'WATER', 'LIGHTNING', 'PSYCHIC', 'FIGHTING', 'DARKNESS', 'METAL', 'COLORLESS'];
  const parts = order.filter((t) => (cost[t] ?? 0) > 0).map((t) => `${cost[t]} ${TYPE_LABEL[t]}`);
  return parts.length ? parts.join(' + ') : 'sem custo';
}

function cardRules(card: CardDefinition, nameOf?: (key: string) => string | null): string {
  const opts = { nameOf };
  const parts: string[] = [];
  for (const a of card.abilities) parts.push(`**Habilidade — ${a.name}:** ${abilityText(a, opts)}`);
  for (const a of card.attacks) {
    const dmg = a.damageFormula ? '(fórmula)' : a.baseDamage ? String(a.baseDamage) : '—';
    const text = attackText(a, opts);
    parts.push(`**${a.name}** [${costText(a.energyCost)}] ${dmg}${text ? ` — ${text}` : ''}`);
  }
  if (card.category === 'TRAINER') parts.push(trainerText(card, opts));
  if (card.ruleBox === 'EX') parts.push('_Regra ex: Nocaute concede 2 pontos._');
  if (card.ruleBox === 'MEGA_EX') parts.push('_Regra Mega ex: Nocaute concede 3 pontos._');
  return esc(parts.join('<br>'));
}

/** Pacotes por símbolo (sets depois do A1): chance de cada símbolo por posição, por carta, 6ª carta e pacote raro. */
function tierProbabilities(product: Product): string[] {
  const t = packRateTable(product);
  if (!t) return [];
  const lines = [
    `| Símbolo | Cartas no pool | ${t.columns.map((c) => c.label).join(' | ')} | ${t.columns.map((c) => `Por carta (${c.label})`).join(' | ')} |`,
    `|---|---:|${t.columns.map(() => '---:').join('|')}|${t.columns.map(() => '---:').join('|')}|`,
  ];
  for (const r of t.rows) lines.push(`| ${r.symbol} | ${r.poolSize} | ${r.total.map(pct3).join(' | ')} | ${r.perCard.map(pct3).join(' | ')} |`);
  if (t.bonus) {
    lines.push('', `6ª carta: sai em ${pct3(t.bonus.chance)} dos pacotes normais, de um pool próprio (bebês).`, '', '| Símbolo | Cartas | Chance do símbolo | Por carta |', '|---|---:|---:|---:|');
    for (const r of t.bonus.rows) lines.push(`| ${r.symbol} | ${r.poolSize} | ${pct3(r.total)} | ${pct3(r.perCard)} |`);
  }
  if (t.rare) lines.push('', `Pacote raro: ${pct3(t.rare.chance)} dos pacotes; todas as cartas saem uniformes entre as ${t.rare.poolSize} impressões ☆ ou acima do pool (${pct3(t.rare.perCard)} cada).`);
  return lines;
}

/** Em que pacotes cada impressão pode sair (pool principal, 6ª carta ou pacote promocional). */
function packMembership(bundle: BuiltBundle): Map<string, string[]> {
  const out = new Map<string, string[]>();
  const add = (id: string, label: string) => out.set(id, [...(out.get(id) ?? []), label]);
  for (const p of bundle.products.filter((x) => x.kind === 'RANDOM_PACK')) {
    for (const pool of Object.values(p.pools ?? {})) for (const e of pool) add(e.printingId, p.name);
    for (const ids of Object.values(p.tierPools ?? {})) for (const id of ids ?? []) add(id, p.name);
    for (const ids of Object.values(p.bonusSlot?.pools ?? {})) for (const id of ids ?? []) add(id, `${p.name} (6ª carta)`);
  }
  return out;
}

/** Cartas de um conjunto (.specs/catalogo/cartas-<set>.md): uma linha por impressão; regras na primeira impressão de cada carta. */
export function renderSetCatalog(bundle: BuiltBundle, setId: string): string {
  const set = bundle.sets.find((s) => s.setId === setId)!;
  const defs = new Map(bundle.cards.map((c) => [definitionKey(c.id, c.version), c]));
  const byKey = new Map<string, string>();
  for (const c of bundle.cards) if (!byKey.has(c.deckLimitKey)) byKey.set(c.deckLimitKey, c.name);
  const membership = packMembership(bundle);
  const firstSeen = new Map<string, string>();
  const ps = bundle.printings.filter((p) => p.setId === setId);
  const out = [
    `# 🃏 ${set.name} (\`${setId}\`) — cartas`, '',
    `> **Gerado por** \`npm run content:build\` (conteúdo ${bundle.version}) — não editar à mão. Índice em [catalogo-conteudo.md](../catalogo-conteudo.md).`, '',
    `${ps.length} impressões de ${new Set(ps.map((p) => p.cardDefinitionId)).size} cartas de jogo. Todas em Impressão completa (\`artKey\` \`art:${setId}:NNN\`). Reimpressões de outros sets usam a mesma carta de jogo (mesmo id).`, '',
    '| Nº | Carta | Símbolo | Categoria | Tipo / Estágio | PS | Recuo | Fraqueza | Regras | Sai em |', '|---|---|---|---|---|---:|---:|---|---|---|',
  ];
  for (const p of ps) {
    const c = defs.get(definitionKey(p.cardDefinitionId, p.cardDefinitionVersion))!;
    const cat = isPokemon(c) ? 'Pokémon' : `Treinador · ${c.trainerRules.fieldBehavior ? 'Item · Fóssil' : SUBTYPE_LABEL[c.subtype]}`;
    const typeStage = isPokemon(c) ? `${TYPE_LABEL[c.types[0]!]} · ${STAGE_LABEL[c.stage]}${c.evolvesFrom.length ? ` (de ${c.evolvesFrom.map((k) => byKey.get(k) ?? k).join(', ')})` : ''}` : '—';
    const hp = isPokemon(c) ? String(c.baseHp) : c.category === 'TRAINER' && c.trainerRules.fieldBehavior ? String(c.trainerRules.fieldBehavior.hp) : '—';
    const seen = firstSeen.get(c.id);
    if (!seen) firstSeen.set(c.id, `${p.setId.toUpperCase()} ${p.collectorNumber}`);
    const rules = seen ? `ver ${seen}` : cardRules(c, (key) => byKey.get(key) ?? null);
    const where = p.rarity === 'PROMO' ? (membership.get(p.printingId)?.join(', ') ?? 'coleção inicial') : membership.get(p.printingId)?.join(', ') ?? 'carta dirigida';
    out.push(`| ${p.collectorNumber} | **${esc(c.name)}** \`${c.id}\` | ${raritySymbol(p)} | ${cat} | ${typeStage} | ${hp} | ${isPokemon(c) ? c.retreatCost : '—'} | ${isPokemon(c) && c.weakness ? `${TYPE_LABEL[c.weakness.type]} +${c.weakness.value}` : '—'} | ${rules} | ${esc(where)} |`);
  }
  return `${out.join('\n')}\n`;
}

function deckLine(deck: Pick<ContentDeck, 'entries'>, nameOf: (pid: string) => string): string {
  return deck.entries.map((e) => `${e.count}× ${nameOf(e.printingId)}`).join(', ');
}

function packProbabilities(product: Product, printingName: (pid: string) => string): string[] {
  const lines: string[] = [];
  const slots = product.slots ?? [];
  lines.push('| Posição | Comum | Incomum | Rara | Ultra |', '|---:|---:|---:|---:|---:|');
  for (const s of slots) lines.push(`| ${s.position} | ${s.categoryWeights.COMMON}% | ${s.categoryWeights.UNCOMMON}% | ${s.categoryWeights.RARE}% | ${s.categoryWeights.ULTRA}% |`);
  lines.push('', '| Impressão | Raridade | Peso | P(posição 1–3) cada | P(posição 4) | P(posição 5) | P(≥1 no pacote) |', '|---|---|---:|---:|---:|---:|---:|');
  for (const category of CAT_ORDER) {
    const pool = product.pools?.[category] ?? [];
    const total = pool.reduce((s, e) => s + e.weight, 0);
    for (const entry of pool) {
      const share = total ? entry.weight / total : 0;
      const per = slots.map((s) => (s.categoryWeights[category] / 100) * share);
      const atLeastOne = 1 - per.reduce((acc, p) => acc * (1 - p), 1);
      lines.push(`| ${esc(printingName(entry.printingId))} (\`${entry.printingId}\`) | ${RARITY[category]} | ${entry.weight} | ${pct(per[0] ?? 0)} | ${pct(per[3] ?? 0)} | ${pct(per[4] ?? 0)} | ${pct(atLeastOne)} |`);
    }
  }
  return lines;
}

function refText(ref: SelectRef): string {
  if (typeof ref === 'string') return ref;
  if ('energyOn' in ref) return `Energia ${TYPE_LABEL[ref.type]} de ${ref.energyOn}`;
  return `${ref.zone.toLowerCase()}:${ref.printingId}`;
}

function commandText(c: ScriptCommand): string {
  switch (c.type) {
    case 'PLAY_BASIC': return `Jogar ${c.card.printingId} no Banco ${c.benchIndex}`;
    case 'EVOLVE': return `Evoluir ${c.target} com ${c.card.printingId}`;
    case 'ATTACH_ENERGY': return `Ligar Energia da Zona a ${c.target}`;
    case 'PLAY_TRAINER': return `Jogar ${c.card.printingId}${c.target ? ` em ${c.target}` : ''}`;
    case 'USE_ABILITY': return `Usar ${c.abilityId} de ${c.source}`;
    case 'RETREAT': return `Recuar para o Banco ${c.benchIndex} pagando ${c.energyTypes.map((t) => TYPE_LABEL[t]).join(', ') || 'nada'}`;
    case 'ATTACK': return `Atacar com ${c.attackId}`;
    case 'END_TURN': return 'Encerrar o turno';
    case 'RESOLVE_DECISION': return `Escolher ${c.select.map(refText).join(', ')}`;
    default: return '';
  }
}

export function renderCatalog(bundle: BuiltBundle, report: BuildReport): string {
  const defs = new Map(bundle.cards.map((c) => [definitionKey(c.id, c.version), c]));
  const printings = new Map(bundle.printings.map((p) => [p.printingId, p]));
  const defOf = (p: CardPrinting) => defs.get(definitionKey(p.cardDefinitionId, p.cardDefinitionVersion))!;
  const nameOf = (pid: string) => { const p = printings.get(pid); if (!p) return pid; const f = p.finish !== 'NORMAL' ? ` (${FINISH[p.finish]})` : p.rarity === 'PROMO' ? ' (Promo)' : ''; return `${defOf(p).name}${f}`; };
  const out: string[] = [];
  const push = (...lines: string[]) => out.push(...lines);
  const e = report.economy;

  push(
    `# 📚 Catálogo de conteúdo — base ${bundle.version}`,
    '',
    `> **Versão da spec:** 3.2.0 · **Pacote:** \`${bundle.packageId}\` ${bundle.version} · **Campanha:** \`${bundle.campaignId}\` · **Ruleset:** \`${bundle.rulesetId}\``,
    `> **contentHash (JCS/SHA-256):** \`${bundle.contentHash}\``,
    '> **Gerado por** `npm run content:build` a partir de `src/content/` — não editar à mão; alterações entram como nova versão do conteúdo.',
    '',
    'Catálogo da jornada de Ginásios sobre os sets reais do Pokémon TCG Pocket — **Genetic Apex (A1)** até **Deluxe Pack ex (A4b)**, mais **Promo-A** e **Promo-B** — com nomes de ataques/Habilidades/Treinadores traduzidos e regras reescritas em effects-dsl. Dados de terceiros (The Pokémon Company): uso local; revisar antes de qualquer distribuição. Os pacotes do A1 usam as probabilidades do projeto; os dos outros sets, as taxas oficiais do Pocket (campanha §16.2). Toda impressão usa a imagem da carta impressa (`artMode: FULL_PRINTING`, `artKey` `art:<set>:NNN`, arquivos em `src/presentation/assets/cards/<set>/`): a face mostra só a imagem, em inglês, e as regras continuam vindo dos dados. As cartas de cada set ficam em `.specs/catalogo/cartas-<set>.md`.',
    '',
  );

  // 1. Resumo
  const byRarity = (r: string) => bundle.printings.filter((p) => p.rarity === r).length;
  push('## 📊 1. Resumo', '', '| Item | Quantidade |', '|---|---:|',
    `| Definições de carta | ${bundle.cards.length} |`, `| Impressões | ${bundle.printings.length} |`,
    `| Impressões por raridade (C/I/R/U/P) | ${byRarity('COMMON')}/${byRarity('UNCOMMON')}/${byRarity('RARE')}/${byRarity('ULTRA')}/${byRarity('PROMO')} |`,
    `| Decks (iniciais/apoio/NPC) | ${bundle.decks.filter((d) => d.kind === 'STARTER').length}/${bundle.decks.filter((d) => d.kind === 'SUPPORT').length}/${bundle.decks.filter((d) => d.kind === 'NPC').length} |`,
    `| Receitas de deck (meta/por tipo/comunidade) | ${['META', 'TYPE', 'COMMUNITY'].map((c) => bundle.deckRecipes.filter((r) => r.category === c).length).join('/')} |`,
    `| Produtos (pacotes/dirigidos/cosméticos) | ${bundle.products.filter((p) => p.kind.endsWith('PACK')).length}/${bundle.products.filter((p) => p.kind === 'DIRECTED_CARD').length}/${bundle.products.filter((p) => p.kind === 'COSMETIC').length} |`,
    `| Nós / objetivos / tabelas de prêmio | ${bundle.nodes.length} / ${bundle.objectives.length} / ${bundle.rewardTables.length} |`,
    `| NPCs / perfis de IA / diálogos | ${bundle.npcs.length} / ${bundle.aiProfiles.length} / ${bundle.dialogues.length} |`,
    `| Fixtures (tutoriais + puzzles) | ${bundle.fixtures.length} |`,
    `| Cosméticos / presets | ${bundle.cosmetics.length} / ${bundle.cosmeticPresets.length} |`, '');

  // 2. Conjuntos
  push('## 🗂️ 2. Conjuntos', '', '| Conjunto | Nome | Liberado após | Definições | Impressões | Comum | Incomum | Rara | Ultra | Promo |', '|---|---|---|---:|---:|---:|---:|---:|---:|---:|');
  for (const s of bundle.sets) {
    const ps = bundle.printings.filter((p) => p.setId === s.setId);
    const n = (r: string) => ps.filter((p) => p.rarity === r).length;
    push(`| \`${s.setId}\` | ${s.name} | ${s.unlockAfterNodeId ?? 'início'} | ${new Set(ps.map((p) => p.cardDefinitionId)).size} | ${ps.length} | ${n('COMMON')} | ${n('UNCOMMON')} | ${n('RARE')} | ${n('ULTRA')} | ${n('PROMO')} |`);
  }
  push('', 'Fraqueza: +20, um tipo por carta, como impressa no set. Raridade exibida com os símbolos do Pocket: ◊ Comum · ◊◊ Incomum · ◊◊◊ Rara · ◊◊◊◊ Ultra (ex) · ☆/☆☆ Ultra de arte alternativa · ☆☆☆ imersiva · ✵/✵✵ brilhantes · ♛ coroa · PROMO.', '');

  // 3. Cartas (um arquivo por conjunto)
  push('## 🃏 3. Cartas', '', 'Uma tabela por conjunto, com todas as impressões, as regras em PT-BR e os pacotes em que cada uma sai.', '', '| Conjunto | Arquivo |', '|---|---|');
  for (const s of bundle.sets) push(`| ${s.name} (\`${s.setId}\`) | [catalogo/cartas-${s.setId}.md](catalogo/cartas-${s.setId}.md) |`);
  push('');

  // 4. Acabamentos e pacote tutorial
  push('## ✨ 4. Acabamentos e PROMO', '', '| Conjunto | Normal | Holográfica | Foil | Cromada | Imersiva (☆☆☆) | Brilhante (✵/✵✵) | PROMO |', '|---|---:|---:|---:|---:|---:|---:|---:|');
  for (const s of bundle.sets) {
    const ps = bundle.printings.filter((p) => p.setId === s.setId);
    const f = (finish: string) => ps.filter((p) => p.finish === finish && p.rarity !== 'PROMO').length;
    push(`| \`${s.setId}\` | ${f('NORMAL')} | ${f('HOLOGRAPHIC')} | ${f('FOIL')} | ${f('CHROME')} | ${ps.filter((p) => p.variant.immersiveSceneId).length} | ${ps.filter((p) => p.variant.shiny).length} | ${ps.filter((p) => p.rarity === 'PROMO').length} |`);
  }
  const tutorial = bundle.products.find((p) => p.productId === 'pack-tutorial-v1');
  push('', '### 4.1. Pacote tutorial (`pack-tutorial-v1`)', '', 'Conteúdo guiado (não aleatório, não vendido): cinco cartas ◊ do Genetic Apex fora da coleção inicial, uma cópia de cada, impressões normais.', '');
  for (const id of tutorial?.fixedContents ?? []) push(`- ${nameOf(id)} — \`${id}\``);
  push('');

  // 5. Produtos e pools
  push('## 📦 5. Produtos e pools', '', 'Pacotes do Genetic Apex: 5 cartas, 100 Créditos, tabela por categoria de campanha §16.2 (probabilidade de uma impressão numa posição = chance da categoria × peso ÷ soma dos pesos da categoria). Pacotes dos outros sets: taxas oficiais do Pocket por símbolo, uniformes dentro do símbolo, com 6ª carta (A4/A4a) e pacote raro; pacotes promocionais: 5 cartas PROMO uniformes. Repetidas são permitidas; PROMO só entra nos pacotes promocionais.', '');
  const packs = bundle.products.filter((p) => p.kind === 'RANDOM_PACK');
  packs.forEach((pack, i) => {
    push(`### 5.${i + 1}. ${pack.name} (\`${pack.productId}\`)`, '', `Disponível: ${pack.availability.fromStart ? 'desde o início' : `após ${pack.availability.afterNodeId}`} · Preço: ${pack.price?.credits ?? '—'} Créditos · ${pack.cardsPerPack} cartas.`, '');
    push(...(pack.tierSlots ? tierProbabilities(pack) : packProbabilities(pack, nameOf)), '');
  });
  const directed = bundle.products.filter((p) => p.kind === 'DIRECTED_CARD');
  push(`### 5.${packs.length + 1}. Cartas dirigidas`, '', 'Uma oferta por impressão não PROMO: Comum 80, Incomum 160, Rara 300, Ultra 600 Créditos por cópia (brilhantes, ☆ e ♛ são Ultra). No Genetic Apex, não Ultra conforme o pacote de origem (Pikachu desde o início, Charizard após C01-E01, Mewtwo após C04-E01) e Ultra só após o chefe que fecha o pacote (Pikachu C03-E06, Charizard C05-E06, Mewtwo C06-E06; sem pacote F00-D03). Nos outros sets, tudo à venda desde o início.', '',
    '| Conjunto | Comum | Incomum | Rara | Ultra | Disponível |', '|---|---:|---:|---:|---:|---|');
  for (const s of bundle.sets) {
    const of = directed.filter((p) => printings.get(p.directedPrintingId!)!.setId === s.setId);
    if (!of.length) continue;
    const n = (r: string) => of.filter((p) => printings.get(p.directedPrintingId!)!.rarity === r).length;
    const gates = [...new Set(of.map((p) => (p.availability.fromStart ? 'início' : p.availability.afterNodeId)))].join(', ');
    push(`| \`${s.setId}\` | ${n('COMMON')} | ${n('UNCOMMON')} | ${n('RARE')} | ${n('ULTRA')} | ${gates} |`);
  }
  push('', `### 5.${packs.length + 2}. Cosméticos à venda`, '', '| Produto | Cosmético | Preço | Disponível |', '|---|---|---:|---|');
  for (const p of bundle.products.filter((x) => x.kind === 'COSMETIC')) push(`| \`${p.productId}\` | ${esc(p.name)} | ${p.price?.credits} | após ${p.availability.afterNodeId} |`);
  push('');

  // 6. Decks
  push('## 🧰 6. Decks iniciais e de apoio', '', '| Deck | Tipo | Energia | Lista | Nota |', '|---|---|---|---|---|');
  for (const d of bundle.decks.filter((x) => x.kind !== 'NPC')) push(`| **${esc(d.name)}** \`${d.deckId}\` | ${d.kind === 'STARTER' ? 'Inicial' : 'Apoio'} | ${d.energyTypes.map((t) => TYPE_LABEL[t]).join(', ')} | ${esc(deckLine(d, nameOf))} | ${esc(d.strategyNote ?? '')} |`);
  push('', '### 6.1. Receitas de deck', '',
    'Listas prontas para montar um deck (campanha §3.7): por tipo, do meta e conhecidas na comunidade do Pocket, adaptadas às cartas deste pacote. Todas são decks jogáveis de 20 cartas; montar uma receita nunca concede cartas.', '',
    '| Receita | Categoria | Era | Energia | Dificuldade | Capa | Lista | Estratégia |', '|---|---|---|---|---|---|---|---|');
  for (const r of bundle.deckRecipes) {
    push(`| **${esc(r.name)}** \`${r.recipeId}\` | ${RECIPE_CATEGORY[r.category]} | ${r.era} | ${r.energyTypes.map((t) => TYPE_LABEL[t]).join(', ')} | ${RECIPE_DIFFICULTY[r.difficulty]} | ${esc(nameOf(r.coverPrintingId))} | ${esc(deckLine(r, nameOf))} | ${esc(r.summary)} |`);
  }
  push('', '## 🤖 7. Decks de NPC por nó e dificuldade', '', 'STANDARD é a lista autoral; STORY reduz em uma cópia cada peça de sinergia (Estágio 2, ex, Apoiadores) e completa com Básicos e cartas simples; EXPERT aplica trocas autorais de consistência.', '',
    '| Nó | Dificuldade | Deck | Energia | Básicos | ex/Mega | Lista |', '|---|---|---|---|---:|---:|---|');
  for (const node of bundle.nodes.filter((n) => n.difficultyProfiles)) {
    for (const [d, prof] of Object.entries(node.difficultyProfiles!)) {
      const deck = bundle.decks.find((x) => x.deckId === prof.npcDeckId)!;
      const m = report.deckMetrics[deck.deckId];
      push(`| ${node.nodeId} | ${DIFF[d]} | \`${deck.deckId}\` | ${deck.energyTypes.map((t) => TYPE_LABEL[t]).join(', ')} | ${m?.basicCopies ?? '?'} | ${(m?.ruleBoxCopies.EX ?? 0) + (m?.ruleBoxCopies.MEGA_EX ?? 0)} | ${esc(deckLine(deck, nameOf))} |`);
    }
  }
  push('');

  // 8. Campanha
  push('## 🗺️ 8. Campanha', '', '| Nó | Tipo | Título | Exige | NPC | Arena | Prêmio inicial | Repetível | Carta-chave / Descoberta |', '|---|---|---|---|---|---|---|---|---|');
  const tables = new Map(bundle.rewardTables.map((t) => [t.rewardTableId, t]));
  for (const n of bundle.nodes) {
    const t = tables.get(n.firstClearRewardTableId);
    const prize = t ? [`${t.credits} Cr`, ...t.packs.map((p) => `${p.count}× ${p.productId}`), ...(t.medal ? [t.medal] : []), ...t.cosmetics].join(' + ') : '—';
    const rep = n.repeatRewardTableId ? `${tables.get(n.repeatRewardTableId)?.credits} Cr` : '—';
    const key = n.keyCardReward ? `${n.keyCardReward.mode === 'CHOICE' ? 'Escolha: ' : ''}${n.keyCardReward.printingIds.map(nameOf).join(' / ')} ×${n.keyCardReward.copies}` : n.discoveryOffer ? `Escolha 1: ${n.discoveryOffer.map(nameOf).join(' / ')}` : '—';
    push(`| ${n.nodeId}${n.essential ? ' ★' : ''} | ${KIND[n.kind]} | ${esc(n.title)} | ${n.prerequisites.allOf.join(', ') || '—'} | ${n.npcId} | ${n.arenaId} | ${esc(prize)} | ${rep} | ${esc(key)} |`);
  }
  push('', '★ = vitória obrigatória (27). Estrutura: 45 nós, 39 batalhas/puzzles, 6 Descobertas.', '');

  // 9. Objetivos
  push('## 🎯 9. Objetivos', '', '| Objetivo | Créditos | Descrição | Predicados |', '|---|---:|---|---|');
  for (const o of bundle.objectives) push(`| \`${o.objectiveId}\` | ${o.reward.credits} | ${esc(o.description)} | ${esc(o.predicates.map((p) => p.type + (p.count !== undefined ? ` ${p.count}` : '') + (p.composition ? ` ${JSON.stringify(p.composition)}` : '')).join('; '))} |`);
  push('', 'Composição (`DECK_COMPOSITION`): `minBasic` conta Pokémon Básicos distintos; `minCardsWithOpcode` conta cópias de cartas cujo efeito estruturado usa o opcode (`MODIFY:<stat>` incluído); `minSetCards` usa o conjunto da impressão do snapshot. Nenhum objetivo `-DECK` é cumprido pelos três decks iniciais:', '');
  for (const c of report.starterCompositionChecks) push(`- \`${c.objectiveId}\`: ${c.satisfiedBy.length ? `cumprido por ${c.satisfiedBy.join(', ')}` : 'nenhum deck inicial cumpre'}`);
  push('');

  // 10. Recompensas
  push('## 🎁 10. Tabelas de prêmio', '', '| Tabela | Créditos | Pacotes | Medalha | Cosméticos | Desbloqueios |', '|---|---:|---|---|---|---|');
  for (const t of bundle.rewardTables) push(`| \`${t.rewardTableId}\` | ${t.credits} | ${t.packs.map((p) => `${p.count}× ${p.productId}`).join(', ') || '—'} | ${t.medal ?? '—'} | ${t.cosmetics.join(', ') || '—'} | ${t.unlocks.join(', ') || '—'} |`);
  push('', `Onboarding: ${bundle.onboarding.credits} Créditos, decks ${bundle.onboarding.starterDeckIds.join(', ')}, inventário de ${bundle.onboarding.inventory.reduce((s, i) => s + i.count, 0)} cartas (${bundle.onboarding.inventory.length} × 2), pacotes ${bundle.onboarding.packs.map((p) => `${p.count}× ${p.productId}`).join(' + ')}, cosméticos ${bundle.onboarding.cosmeticIds.join(', ')}; primeiro nó ${bundle.onboarding.firstNodeId}.`, '');

  // 11. Economia
  push('## 💰 11. Auditoria econômica', '', 'Recalculada a partir dos dados pelo build (falha se divergir de campanha §15.4).', '',
    '| Parcela | Créditos |', '|---|---:|',
    `| Perfil novo | ${e.onboarding} |`, `| Prólogo (T01–T06) | ${e.prologue} |`, `| Capítulos (E01 + E03 + E06) × 6 | ${e.chapters} |`, `| Final (D01–D03) | ${e.finals} |`,
    `| **Rota obrigatória** | **${e.mandatory}** |`, `| Puzzles E02 | ${e.puzzles} |`, `| Elites E05 | ${e.elites} |`, `| Objetivos extras (${e.objectiveCount} × 40) | ${e.objectives} |`,
    `| Total opcional | ${e.optional} |`, `| **Máximo único** | **${e.maxOneTime}** |`, '',
    `Pacotes da rota obrigatória (inclui onboarding): ${Object.entries(e.packsMandatory).map(([k, v]) => `${v}× ${k}`).join(', ')}. Pacotes opcionais: ${Object.entries(e.packsOptional).map(([k, v]) => `${v}× ${k}`).join(', ') || '—'}.`, '',
    '| Repetível | Créditos | Vitórias para Comum/Incomum/Rara/Ultra/Pacote/Verso/Moeda/Tapete |', '|---|---:|---|');
  for (const r of e.repeatIndicators) push(`| \`${r.rewardTableId}\` | ${r.credits} | ${['COMMON', 'UNCOMMON', 'RARE', 'ULTRA', 'PACK', 'SLEEVE', 'COIN', 'PLAYMAT'].map((k) => r.winsFor[k]).join(' / ')} |`);
  push('');

  // 12. Fixtures
  push('## 🧩 12. Tutoriais e puzzles', '', 'Cenários preparados e identificados como tal. As soluções abaixo são comandos simbólicos (`src/content/source/script.ts`) executados pelo motor real em várias sementes pelo build; o NPC dos tutoriais e puzzles segue `npcScript`.', '');
  for (const fx of bundle.fixtures as readonly ContentFixture[]) {
    const node = bundle.nodes.find((n) => n.fixtureId === fx.fixtureId);
    const check = report.puzzles.find((p) => p.fixtureId === fx.fixtureId);
    push(`### ${fx.fixtureId} — ${node?.nodeId ?? ''} ${esc(node?.title ?? '')}`, '', `${esc(fx.label)} Início: ${fx.startPhase === 'SETUP' ? 'preparação' : 'fase principal'}, turno global ${fx.globalTurnNumber}, joga ${fx.currentPlayer === 'HUMAN' ? 'o humano' : 'o NPC'}${fx.stadiumPrintingId ? `, Estádio ${nameOf(fx.stadiumPrintingId)}` : ''}.${check ? ` Verificação: ${check.solved ? 'resolvida' : 'FALHOU'} (${check.ownTurnsUsed ?? '?'} turno(s) próprio(s)${check.turnLimit ? `, limite ${check.turnLimit}` : ''}).` : ' Duelo guiado completo; NPC pela IA de Cheren.'}`, '');
    if (fx.npcScript?.length) push(`- Roteiro do NPC: ${fx.npcScript.map((s) => commandText(s.command)).join(' → ')}`);
    for (const [i, step] of (fx.solution ?? []).entries()) push(`${i + 1}. ${esc(commandText(step.command))}${step.command.note ? ` — ${esc(step.command.note)}` : ''}`);
    push('');
  }

  // 13. Cosméticos
  push('## 🎨 13. Cosméticos', '', '| Cosmético | Tipo | Nome | Aquisição | Padrão | Paleta |', '|---|---|---|---|---|---|');
  for (const c of bundle.cosmetics) {
    const a = c.acquisition;
    const acq = a.kind === 'FREE' ? 'Gratuito' : a.kind === 'EMPORIUM' ? `Empório ${a.credits} Cr após ${a.requiredCompletedNodeId}` : `Concessão (${a.grantMilestoneId ?? '—'}) após ${a.requiredCompletedNodeId}`;
    push(`| \`${c.cosmeticId}\` | ${c.kind} | ${esc(c.names['pt-BR'])} | ${acq} | ${c.visual.pattern} | ${c.visual.palette.join(' ')} |`);
  }
  push('', '| Preset | Playmat | Verso | Moeda | Flair |', '|---|---|---|---|---|');
  for (const p of bundle.cosmeticPresets) push(`| \`${p.presetId}\` | ${p.playmatId} | ${p.sleeveId} | ${p.coinId} | ${p.defaultEntryFlairId} |`);
  push('');

  // 14. NPCs
  push('## 🧑‍🤝‍🧑 14. NPCs e perfis de IA', '', 'Todos os adversários são personagens locais controlados por IA. STORY: orçamento pequeno e 25% de chance de escolha subótima; STANDARD: orçamento médio; EXPERT: busca ampla.', '',
    '| NPC | Título | Capítulo | Estilo | Dicas do caderno |', '|---|---|---|---|---|');
  for (const n of bundle.npcs) push(`| **${esc(n.name)}** \`${n.npcId}\` | ${esc(n.title)} | ${n.chapterId} | ${esc(n.style)} | ${esc(n.notebook.hints.join(' / '))} |`);
  push('', '| Perfil | Política | Orçamento (nós/profundidade/determinizações) | Subótimo | Alvo | Pesos (pontos, dano, energia, evolução, Banco, condições) |', '|---|---|---|---:|---|---|');
  for (const a of bundle.aiProfiles) push(`| \`${a.aiProfileId}\` | ${DIFF[a.policy]} | ${a.budget.maxNodes}/${a.budget.maxDepth}/${a.budget.determinizations} | ${a.tolerance.suboptimalChance} | ${a.targetPolicy} | ${[a.weights.points, a.weights.damageDealt, a.weights.energyDevelopment, a.weights.evolution, a.weights.benchDevelopment, a.weights.conditions].join(' / ')} |`);
  push('');

  // 15. Notas
  push('## 📝 15. Decisões de conteúdo', '',
    '- Cada capítulo usa um dos três pacotes do Genetic Apex pela temática de tipos (P00, C02, C03 → Pikachu; C01, C05 → Charizard; C04, C06 → Mewtwo; F00 → os três). Pool de cada pacote = impressões daquele pacote + as que não pertencem a nenhum; peso por símbolo (◊–◊◊◊◊ 10, ☆ 4, ☆☆ 3, ☆☆☆ 1, ♛ 1).',
    '- Ultra dirigida só após o chefe que fecha o pacote de origem; Mew ☆☆☆ e as coroas ♛ (sem pacote) só após F00-D03. Objetivos de composição por tipo (`minTypeCards`) usam cartas à venda antes do encontro.',
    '- Reimpressões do set (artes alternativas e o Eevee repetido) são impressões da mesma carta de jogo: o limite de 2 cópias vale para todas juntas.',
    '- P00-T06 usa fixture TUTORIAL em preparação, com mãos e ordem de baralho fixas (Maré Serena × Chama da Escola); a dificuldade só troca o perfil de IA de Cheren — o deck do NPC é único (`npc-p00-t06-v1`) e idêntico ao lado NPC da fixture.',
    '- Tutoriais T01–T05 e puzzles usam `npcScript`; se um comando roteirizado do NPC deixar de ser legal porque o humano jogou diferente, a aplicação deve substituí-lo por encerrar o turno (o roteiro nunca joga a favor do NPC).',
    `- Condição especial nos rótulos: ${Object.values(CONDITION_LABEL).join(', ')}.`,
    '- `minBasic` em composição conta Pokémon Básicos distintos (C01-E05: “dois Básicos diferentes”).',
    '',
    '### 15.1. Limitações conhecidas do motor e do gerador de texto',
    '',
    '- A estatística `knockoutsWithoutAttack` do motor também conta Nocautes por ataque (o quadro do ataque é removido antes do KO_CHECK); por isso o Ativo do puzzle C05-E02 não consegue Nocautear atacando (Revestimento Rígido zera o Chute Baixo).',
    '- Fixtures declaram condições especiais iniciais: C04-E02 começa no turno do jogador com o Ativo Adormecido.',
    '- Dragonite (Meteoro Dracônico) é codificado como quatro blocos de dano em 1 alvo aleatório cada — o mesmo Pokémon pode ser escolhido mais de uma vez, como no texto do set.',
    '');
  return `${out.join('\n')}\n`;
}
