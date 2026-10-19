// Rótulos PT-BR de campos e caminhos do rascunho: usados em mensagens de validação ("Ir para o campo"),
// no diff entre versões e no relatório de publicação. Nunca exibir apenas "validation failed".
import type { CardDefinition } from '../cards/types.ts';

const FIELD: Record<string, string> = {
  dataVersion: 'Versão de dados', effectsDsl: 'Versão da DSL', id: 'ID funcional', version: 'Versão', baseName: 'Nome-base', name: 'Nome exibido',
  deckLimitKey: 'Chave de limite', category: 'Categoria', subtype: 'Subtipo', stage: 'Estágio', evolvesFrom: 'Evolui de', types: 'Tipos',
  baseHp: 'HP', retreatCost: 'Recuo', weakness: 'Fraqueza', ruleBox: 'Regra especial', knockoutPoints: 'Pontos por Nocaute', tags: 'Etiquetas',
  flavorText: 'Descrição temática', attacks: 'Ataques', abilities: 'Habilidades', trainerRules: 'Regras do Treinador', trainerEffects: 'Efeitos do Treinador',
  energyCost: 'Custo de Energia', baseDamage: 'Dano', damageFormula: 'Fórmula de dano', damageTarget: 'Alvo do dano', preconditions: 'Condições de uso',
  additionalCosts: 'Custos adicionais', effects: 'Efeitos', endsTurn: 'Encerra o turno', presentation: 'Apresentação', kind: 'Tipo',
  sourcePositions: 'Posições da fonte', trigger: 'Gatilho', conditions: 'Condições', costs: 'Custos', usageLimit: 'Limite de uso', optional: 'Opcional',
  timing: 'Momento', condition: 'Condição', failurePolicy: 'Falha parcial', operation: 'Operação', type: 'Tipo', target: 'Alvo', amount: 'Quantidade',
  count: 'Quantidade', outputId: 'Nome da saída', scope: 'Escopo', pick: 'Escolha', chooser: 'Quem escolhe', filter: 'Filtro', duration: 'Duração',
  playConditions: 'Condições para jogar', destinationAfterPlay: 'Destino após jogar', toolTarget: 'Alvo da Ferramenta', fieldBehavior: 'Comportamento em campo',
  hp: 'HP em campo', value: 'Valor', operation_: 'Operação', printingId: 'ID da impressão', finish: 'Acabamento', rarity: 'Raridade', language: 'Idioma',
  templateId: 'Template', setId: 'Conjunto', collectorNumber: 'Número', artist: 'Artista', artMode: 'Modo de arte', artKey: 'Arte do pacote',
  artAssetId: 'Arte importada', crop: 'Recorte', artTransform: 'Transformação da arte', finishSettings: 'Parâmetros de acabamento', variant: 'Variante',
  assetBindings: 'Assets', intensity: 'Intensidade', roughness: 'Roughness', metalness: 'Metalness', maskMode: 'Máscara', foilMaskAssetId: 'Máscara de foil',
  presetId: 'Preset', patternScale: 'Escala do padrão', patternAngleDegrees: 'Ângulo do padrão', testScenarios: 'Cenários de teste', authoring: 'Autoria',
  notes: 'Notas', target_: 'Alvo', fixture: 'Fixture', forcedCoins: 'Moedas forçadas', expect: 'Expectativas', operands: 'Operandos', reference: 'Referência',
  left: 'Lado esquerdo', right: 'Lado direito', cmp: 'Comparação', operations: 'Operações', then: 'Então', else: 'Senão', from: 'De', to: 'Para',
  energyType: 'Tipo de Energia', stat: 'Atributo', categories: 'Categorias', actions: 'Ações', zone: 'Zona', destination: 'Destino', mode: 'Modo',
  side: 'Lado', player: 'Jogador', fromHand: 'Carta da mão', appliesTo: 'Aplica-se a', attackFilter: 'Filtro de ataques', removeOn: 'Remover quando',
  at: 'Quando', event: 'Evento', scale: 'Escala', offsetX: 'Deslocamento X', offsetY: 'Deslocamento Y', rotationDegrees: 'Rotação',
  mirrorIllustration: 'Espelhar ilustração', exposure: 'Exposição', width: 'Largura', height: 'Altura', x: 'X', y: 'Y', charges: 'Cargas',
};

export function fieldLabel(key: string): string {
  return FIELD[key] ?? key;
}

/** Caminho do rascunho → rótulo legível: ["rules","attacks",1,"effects",0,"operation","amount"] → "Ataque 2 “X” · Efeito 1 · Operação · Quantidade". */
export function describePath(path: readonly (string | number)[], rules?: CardDefinition | null): string {
  const parts: string[] = [];
  let i = 0;
  if (path[0] === 'rules') i = 1;
  else if (path[0] === 'printings') {
    parts.push(`Impressão ${Number(path[1]) + 1}`);
    i = 2;
  } else if (path[0] === 'testScenarios') {
    parts.push(`Cenário ${Number(path[1]) + 1}`);
    i = 2;
  }
  for (; i < path.length; i += 1) {
    const seg = path[i]!;
    const prev = path[i - 1];
    if (typeof seg === 'number') {
      if (prev === 'attacks') {
        const name = rules?.attacks?.[seg]?.name;
        parts[parts.length - 1] = `Ataque ${seg + 1}${name ? ` “${name}”` : ''}`;
      } else if (prev === 'abilities') {
        const name = rules?.abilities?.[seg]?.name;
        parts[parts.length - 1] = `Habilidade ${seg + 1}${name ? ` “${name}”` : ''}`;
      } else if (prev === 'effects' || prev === 'trainerEffects') {
        parts[parts.length - 1] = `${prev === 'effects' ? 'Efeito' : 'Efeito do Treinador'} ${seg + 1}`;
      } else {
        parts.push(`#${seg + 1}`);
      }
      continue;
    }
    parts.push(fieldLabel(seg));
  }
  return parts.join(' · ') || 'Carta';
}

/** Valor curto para mensagens e diffs. */
export function shortValue(value: unknown): string {
  if (value === undefined) return '—';
  if (value === null) return 'nenhum';
  if (typeof value === 'string') return value.length > 48 ? `“${value.slice(0, 45)}…”` : `“${value}”`;
  if (typeof value === 'number' || typeof value === 'boolean') return typeof value === 'boolean' ? (value ? 'sim' : 'não') : String(value);
  const text = JSON.stringify(value);
  return text.length > 60 ? `${text.slice(0, 57)}…` : text;
}
