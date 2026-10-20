// Nomes PT-BR de Pokémon. Como no Genetic Apex, o nome do Pokémon fica como no jogo (igual no Brasil); só as formas
// regionais, as formas especiais e os Pokémon da Equipe Rocket seguem o nome oficial brasileiro ("Raichu de Alola",
// "Dialga Forma Origem", "Wobbuffet da Equipe Rocket"). O nome traduzido é o que vira deckLimitKey e chave de evolução.

const REGION: Readonly<Record<string, string>> = { Alolan: 'Alola', Galarian: 'Galar', Paldean: 'Paldea', Hisuian: 'Hisui' };

/** Nomes inteiros com tradução oficial própria. */
const SPECIAL: Readonly<Record<string, string>> = {
  'Origin Forme Dialga': 'Dialga Forma Origem',
  'Origin Forme Palkia': 'Palkia Forma Origem',
  'Heat Rotom': 'Rotom Calor',
  'Wash Rotom': 'Rotom Lavagem',
  'Frost Rotom': 'Rotom Congelante',
  'Fan Rotom': 'Rotom Ventilador',
  'Mow Rotom': 'Rotom Corte',
  'Dawn Wings Necrozma': 'Necrozma Asas da Alvorada',
  'Dusk Mane Necrozma': 'Necrozma Juba do Crepúsculo',
  'Ultra Necrozma': 'Ultra Necrozma',
  'Castform Sunny Form': 'Castform Forma Ensolarada',
  'Type: Null': 'Tipo: Nulo',
};

/** Nome-base PT-BR (sem "ex"/"Mega … ex") a partir do nome-base em inglês do Limitless. */
export function pokemonName(englishBase: string): string {
  const special = SPECIAL[englishBase];
  if (special) return special;
  const region = /^(Alolan|Galarian|Paldean|Hisuian) (.+)$/.exec(englishBase);
  if (region) return `${region[2]} de ${REGION[region[1]!]}`;
  const rocket = /^Team Rocket's (.+)$/.exec(englishBase);
  if (rocket) return `${rocket[1]} da Equipe Rocket`;
  return englishBase;
}
