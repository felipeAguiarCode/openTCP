// Nomes PT-BR do Genetic Apex (A1). Os Pokémon mantêm o nome do jogo (iguais no Brasil); ataques, Habilidades e
// Treinadores são traduzidos aqui, pelo nome em inglês do `.inspo`. O texto de regras não passa por aqui: é gerado
// do DSL. Falta de tradução faz a1/cards.ts falhar ao carregar.

export const TRAINER_NAMES: Readonly<Record<string, string>> = {
  'Helix Fossil': 'Fóssil Hélix', 'Dome Fossil': 'Fóssil Domo', 'Old Amber': 'Âmbar Antigo',
  Erika: 'Erika', Misty: 'Misty', Blaine: 'Blaine', Koga: 'Koga', Giovanni: 'Giovanni', Brock: 'Brock', Sabrina: 'Sabrina',
  'Lt. Surge': 'Tenente Surge',
};

export const ABILITY_NAMES: Readonly<Record<string, string>> = {
  Counterattack: 'Contra-ataque', 'Data Scan': 'Escaneamento de Dados', 'Drive Off': 'Afugentar', 'Fragrance Trap': 'Armadilha Aromática',
  'Gas Leak': 'Vazamento de Gás', 'Hard Coat': 'Revestimento Rígido', 'Powder Heal': 'Pó Curativo', 'Psy Shadow': 'Sombra Psíquica',
  'Shadowy Spellbind': 'Feitiço Sombrio', 'Shell Armor': 'Armadura de Concha', 'Sleep Pendulum': 'Pêndulo do Sono', 'Volt Charge': 'Carga Volt',
  'Water Shuriken': "Shuriken d'Água",
};

export const ATTACK_NAMES: Readonly<Record<string, string>> = {
  Absorb: 'Absorver', Amass: 'Acumular', 'Ancient Whirlpool': 'Redemoinho Ancestral', 'Aqua Edge': 'Gume Aquático', Attach: 'Grudar',
  'Barrier Attack': 'Ataque Barreira', Bite: 'Mordida', Blizzard: 'Nevasca', Blot: 'Borrão', 'Bone Beatdown': 'Surra de Osso',
  Bonemerang: 'Ossomerangue', Bother: 'Importunar', 'Bubble Drain': 'Dreno de Bolhas', 'Bug Bite': 'Picada', 'Call for Family': 'Chamar a Família',
  'Circle Circuit': 'Circuito Circular', Combustion: 'Combustão', 'Continuous Lick': 'Lambida Contínua', 'Copy Anything': 'Copiar Qualquer Coisa',
  Corner: 'Encurralar', 'Crimson Storm': 'Tempestade Carmesim', Crunch: 'Triturar', Dig: 'Cavar', 'Dizzy Punch': 'Soco Tonteante',
  'Do the Wave': 'Fazer a Ola', 'Double Horn': 'Chifre Duplo', 'Double Lariat': 'Laço Duplo', 'Double-Edge': 'Faca de Dois Gumes',
  'Draco Meteor': 'Meteoro Dracônico', 'Drill Peck': 'Bicada Broca', 'Drill Run': 'Perfuração', Drool: 'Babar', 'Electro Ball': 'Eletrobola',
  Ember: 'Brasa', 'Fight Back': 'Revidar', 'Find a Friend': 'Encontrar um Amigo', 'Fire Blast': 'Rajada de Fogo', 'Fire Claws': 'Garras de Fogo',
  'Fire Mane': 'Juba de Fogo', 'Fire Spin': 'Giro de Fogo', Flamethrower: 'Lança-Chamas', Flap: 'Bater Asas', Flare: 'Labareda', Flop: 'Desabar',
  'Gentle Slap': 'Tapinha', 'Giant Bloom': 'Florada Gigante', Glide: 'Planar', Gnaw: 'Roer', Growl: 'Rosnado', Gust: 'Lufada',
  'Head Bolt': 'Cabeçada Elétrica', Headache: 'Dor de Cabeça', Headbutt: 'Cabeçada', 'Heart Stamp': 'Carimbo do Coração', 'Heat Blast': 'Explosão de Calor',
  'Heat Tackle': 'Investida Ardente', 'Heavy Impact': 'Impacto Pesado', 'Horn Attack': 'Ataque de Chifre', 'Horn Drill': 'Chifre Broca',
  'Horn Hazard': 'Chifre Perigoso', 'Hydro Bazooka': 'Hidrobazuca', 'Hydro Pump': 'Hidrobomba', 'Hydro Splash': 'Hidrorrespingo', 'Hyper Beam': 'Hiper-Raio',
  'Hyper Voice': 'Hipervoz', 'Ice Beam': 'Raio de Gelo', 'Ice Wing': 'Asa de Gelo', 'Inferno Dance': 'Dança Infernal', 'Inferno Onrush': 'Ímpeto Infernal',
  Jab: 'Jab', 'KO Crab': 'Caranguejo Nocaute', 'Knock Back': 'Repelir', 'Knuckle Punch': 'Soco Fechado', 'Land Crush': 'Esmagamento Terrestre',
  'Leaf Supply': 'Suprimento de Folhas', 'Leech Life': 'Sanguessuga', 'Leek Slap': 'Tapa de Alho-Poró', 'Lightning Ball': 'Bola Relâmpago',
  Lovestrike: 'Golpe de Amor', 'Low Kick': 'Chute Baixo', 'Magical Shot': 'Tiro Mágico', 'Magma Punch': 'Soco de Magma', 'Mega Drain': 'Megadreno',
  'Mega Punch': 'Megassoco', 'Metal Claw': 'Garra de Metal', 'Mist Slash': 'Corte de Névoa', 'Mud-Slap': 'Tapa de Lama', Mumble: 'Resmungar',
  'Pay Day': 'Dia de Pagamento', Peck: 'Bicada', Pierce: 'Perfurar', 'Pin Missile': 'Míssil de Agulhas', 'Poison Gas': 'Gás Venenoso',
  'Poison Horn': 'Chifre Venenoso', 'Poison Powder': 'Pó Venenoso', 'Poison Tentacles': 'Tentáculos Venenosos', Pound: 'Pancada', 'Powder Snow': 'Neve em Pó',
  'Power Blast': 'Explosão de Poder', 'Primal Wingbeat': 'Bater de Asas Primal', 'Psy Report': 'Relatório Psíquico', Psychic: 'Psíquico',
  'Psychic Sphere': 'Esfera Psíquica', Psydrive: 'Psicoimpulso', Psypunch: 'Psicossoco', Psyshot: 'Psicotiro', 'Quick Attack': 'Ataque Rápido',
  'Raging Thunder': 'Trovão Furioso', 'Rain Splash': 'Respingo de Chuva', Ram: 'Arremeter', 'Razor Fin': 'Barbatana Navalha', 'Razor Leaf': 'Folha Navalha',
  'Rolling Tackle': 'Investida Rolante', Rollout: 'Rolagem', Scratch: 'Arranhão', 'Second Strike': 'Segundo Golpe', 'Seed Bomb': 'Bomba de Sementes',
  'Seismic Toss': 'Movimento Sísmico', 'Shadow Claw': 'Garra Sombria', 'Sharp Scythe': 'Foice Afiada', 'Sharp Sting': 'Ferrão Afiado', Sharpen: 'Afiar',
  'Shell Attack': 'Ataque de Concha', 'Sky Attack': 'Ataque do Céu', Slap: 'Tapa', Slash: 'Talho', 'Sleepy Song': 'Canção de Ninar', Smack: 'Golpear',
  'Soothing Scent': 'Aroma Calmante', 'Spinning Attack': 'Ataque Giratório', 'Spiral Kick': 'Chute Espiral', Splash: 'Borrifar', 'Spooky Shot': 'Tiro Assombrado',
  Sting: 'Ferroada', Stomp: 'Pisotear', Strength: 'Força', 'Stretch Kick': 'Chute Esticado', 'Suffocating Gas': 'Gás Sufocante',
  'Super Psy Bolt': 'Super Psicorraio', Surf: 'Surfar', 'Surprise Attack': 'Ataque Surpresa', Tackle: 'Investida', 'Tail Smack': 'Pancada de Cauda',
  'Tail Whap': 'Rabada', 'Tail Whip': 'Abanar a Cauda', Teleport: 'Teletransporte', 'Thunder Fang': 'Presa Elétrica', 'Thunder Punch': 'Soco Trovão',
  'Thunder Shock': 'Choque do Trovão', 'Thunder Spear': 'Lança Trovejante', Thunderbolt: 'Relâmpago', 'Thundering Hurricane': 'Furacão Trovejante',
  'Tiny Charge': 'Pequena Carga', 'Tongue Slap': 'Tapa de Língua', 'Tropical Swing': 'Balanço Tropical', Venoshock: 'Choque Venenoso',
  'Vine Whip': 'Chicote de Vinha', 'Vise Grip': 'Agarrão', 'Water Arrow': "Flecha d'Água", 'Water Drip': 'Gotejar', 'Water Gun': "Revólver d'Água",
  'Wave Splash': 'Respingo de Onda', 'Will-O-Wisp': 'Fogo-Fátuo', 'Wing Attack': 'Ataque de Asa', 'Zap Kick': 'Chute Elétrico',
};
