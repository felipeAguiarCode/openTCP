// Diálogos locais (PT-BR, curtos, tom acolhedor) da jornada pelos Ginásios Pokémon: briefing/vitória/derrota de cada nó,
// introdução de cada duelo (a primeira fala é a saudação curta da tela de VS), diário de capítulo e falas do professor Cheren
// no prólogo. Cada capítulo é um torneio de tipo sediado num Ginásio: os desafiantes (E01, E03, E05) são Líderes do mesmo
// tipo vindos de outras regiões e o chefe (E02, E04, E06) é o Líder anfitrião, que entrega a medalha. O final é o Torneio de
// Kanto. Os speakerIds são os npcIds (estáveis); só quem eles são mudou. Nenhum texto depende de serviço externo.
import type { Dialogue } from '../types.ts';

type Mood = NonNullable<Dialogue['lines'][number]['mood']>;
type Line = readonly [speakerId: string, text: string, mood?: Mood];

const dialogue = (dialogueId: string, lines: readonly Line[]): Dialogue => ({
  dialogueId, lines: lines.map(([speakerId, text, mood]) => ({ speakerId, text, ...(mood ? { mood } : {}) })),
});

type NodeTexts = { readonly briefing: readonly Line[]; readonly intro?: readonly Line[]; readonly victory: readonly Line[]; readonly defeat: readonly Line[] };

export const NODE_TEXTS: Readonly<Record<string, NodeTexts>> = {
  // ---------------------------------------------------------------- Prólogo — Escola de Treinadores (Cheren = lia)
  'P00-T01': {
    briefing: [['lia', 'Bem-vindo à Escola de Treinadores! Hoje é só uma carta: escolha um Básico para ficar na frente, como Ativo.', 'HAPPY'], ['lia', 'Cenário preparado: a mão inicial foi definida para esta lição.']],
    intro: [['lia', 'Primeira aula! Respire fundo e vamos lá.', 'HAPPY'], ['lia', 'Todo Treinador começa decidindo quem fica na frente. O resto vem com a prática.']],
    victory: [['lia', 'Primeira vitória! Tudo começa com um bom Ativo. Anote isso no caderno.', 'HAPPY']],
    defeat: [['lia', 'Sem problema — vamos repetir com calma. Nenhuma carta se perde aqui.']],
  },
  'P00-T02': {
    briefing: [['lia', 'Lição dois: Energia vem da Zona, uma ligação manual por turno. O custo do ataque é pago com ela — e ela fica no Pokémon.']],
    intro: [['lia', 'Hoje a matéria é Energia. Olho na Zona!', 'HAPPY']],
    victory: [['lia', 'Isso! Ligar, conferir o custo e atacar. Simples e certo.', 'HAPPY']],
    defeat: [['lia', 'Olhe a Zona de Energia: a carta pronta é a que você pode ligar agora.']],
  },
  'P00-T03': {
    briefing: [['lia', 'Seu Ativo não vai aguentar outro golpe. Quem está no Banco para assumir?', 'SERIOUS']],
    intro: [['lia', 'Aula de planejamento. Pense um turno à frente.', 'SERIOUS']],
    victory: [['lia', 'Reserva pronta, Energia já ligada. É assim que se planeja um turno à frente.', 'HAPPY']],
    defeat: [['lia', 'Sem ninguém no Banco, perder o Ativo é perder a partida. Tente de novo.']],
  },
  'P00-T04': {
    briefing: [['lia', 'Evoluir mantém o dano, mas aumenta o HP e os ataques. Só não vale no primeiro turno próprio.']],
    intro: [['lia', 'Evolução! Uma das minhas aulas favoritas.', 'HAPPY']],
    victory: [['lia', 'Rapidash chegou na hora certa. O dano antigo continua lá — mas agora sobra fôlego.', 'HAPPY']],
    defeat: [['lia', 'Coloque a evolução sobre o Pokémon certo e confira o custo do novo ataque.']],
  },
  'P00-T05': {
    briefing: [['lia', 'Itens você joga quantos quiser; Apoiador, só um por turno. Escolha qual vale mais agora.']],
    intro: [['lia', 'Cartas de Treinador também ganham duelos.', 'HAPPY']],
    victory: [['lia', 'Item e Apoiador no momento certo. Perfeito!', 'HAPPY']],
    defeat: [['lia', 'Lembre: com um Apoiador por turno, o melhor é o que fecha a conta do dano.']],
  },
  'P00-T06': {
    briefing: [['lia', 'Agora um duelo de verdade, guiado. Recue quando precisar, troque por efeito e some três pontos.'], ['lia', 'Eu jogo com o meu deck de Fogo da Escola. Sem pressa!', 'HAPPY']],
    intro: [['lia', 'Prova final da Escola. Mostre o que aprendeu!', 'HAPPY'], ['lia', 'Mostre tudo o que praticamos. Eu não vou facilitar… muito.']],
    victory: [['lia', 'Você está pronto para os Ginásios. Leve este pacote Base para a estrada — Celadon espera por você!', 'HAPPY']],
    defeat: [['lia', 'Quase lá. Planeje o Recuo antes de ligar Energia no Pokémon errado.']],
  },
  // ---------------------------------------------------------------- C01 — Ginásio de Celadon (Planta; Erika = iris)
  'C01-E01': {
    briefing: [['caio', 'Olá! Sou o Milo, de Turffield, aqui pelo torneio de Celadon. Meu deck só tem Básicos… mas tem muitos! Vamos ver quem enche o Banco primeiro.', 'HAPPY']],
    intro: [['caio', 'Que tal um duelo tranquilo, como um dia no campo?', 'HAPPY']],
    victory: [['caio', 'Seu Banco ficou cheio rapidinho, igual plantação boa depois da chuva. Vou treinar isso!', 'SURPRISED']],
    defeat: [['caio', 'Raízes firmes! Volte quando quiser — a colheita espera.', 'HAPPY']],
  },
  'C01-E02': {
    briefing: [['iris', 'Ah… olá. Um pequeno enigma do meu jardim: o seu Ativo vai cair. Prepare quem vem depois — você tem dois turnos.']],
    intro: [['iris', 'Ah… olá. Um enigma florido para você.', 'HAPPY']],
    victory: [['iris', 'A reserva certa, no lugar certo, com a Energia certa. Gosto disso… de verdade.', 'HAPPY']],
    defeat: [['iris', 'Não se apresse… Reinicie e pense primeiro em quem fica no Banco.']],
  },
  'C01-E03': {
    briefing: [['dora', 'Oi, oi! Gardenia, de Eterna! Eu cultivo duas linhas evolutivas ao mesmo tempo. Se cortar uma, a outra cresce!']],
    intro: [['dora', 'Pronto para ver meus Pokémon de Planta brilharem?', 'HAPPY']],
    victory: [['dora', 'Você não deixou nenhuma das duas florescer! Que demais — bem pensado.', 'SURPRISED']],
    defeat: [['dora', 'Depender de uma única criatura é arriscado — eu sempre tenho outra a caminho!']],
  },
  'C01-E04': {
    briefing: [['iris', 'Bem-vindo ao Jardim de Celadon. Três cartas viradas para cima entre as flores: escolha uma para levar.', 'HAPPY']],
    victory: [['iris', 'Boa escolha… As outras ficam no Empório para quando você quiser.', 'HAPPY']],
    defeat: [['iris', 'Sem pressa. O jardim continua aqui, florido como sempre.']],
  },
  'C01-E05': {
    briefing: [['taina', 'Fique parado, vou tirar uma foto! Sou a Viola, de Santalune: duas copas, duas linhas de Estágio 1 no mesmo enquadramento. Qual você vai derrubar primeiro?', 'SERIOUS']],
    intro: [['taina', 'Sorria! Este duelo vai dar uma ótima foto.', 'HAPPY']],
    victory: [['taina', 'Você enquadrou as duas copas ao mesmo tempo. Que clique! Respeito.', 'SURPRISED']],
    defeat: [['taina', 'Quando uma linha cai, a outra já está pronta para a foto. Tente variar seus Básicos.']],
  },
  'C01-E06': {
    briefing: [['iris', 'Sou Erika, Líder do Ginásio de Celadon. Enquanto meu primeiro atacante segura, o segundo já está crescendo.']],
    intro: [['iris', 'Hum… que dia lindo para um duelo.', 'HAPPY'], ['iris', 'Mostre que você também sabe preparar o que vem depois. Eu… estou bem acordada, prometo.', 'SERIOUS']],
    victory: [['iris', 'Você não concentrou tudo num só Pokémon. Leve duas Erikas… e a Medalha Arco-Íris. Você mereceu.', 'HAPPY']],
    defeat: [['iris', 'Prepare uma reserva antes de perder o Ativo. O jardim espera… sem pressa.']],
  },
  // ---------------------------------------------------------------- C02 — Ginásio de Sootopolis (Água; Wallace = mara)
  'C02-E01': {
    briefing: [['rui', 'E aí! Marlon, de Humilau. Aqui cada Pokémon tem seu peso, que nem prancha. Recuar o Dewgong? Boa sorte, hein!', 'HAPPY']],
    intro: [['rui', 'E aí! Bora pegar essa onda juntos?', 'HAPPY']],
    victory: [['rui', 'Você recuou na hora certa, igual quem sabe sair da onda. Massa demais!', 'SURPRISED']],
    defeat: [['rui', 'Recuar custa Energia. Calcula antes de remar, beleza?']],
  },
  'C02-E02': {
    briefing: [['mara', 'O Recuo do seu Ativo é caro demais. Existe uma passagem livre — encontre-a neste turno, com elegância.']],
    intro: [['mara', 'Um enigma merece uma solução elegante.', 'SERIOUS']],
    victory: [['mara', 'Trocar por efeito não gasta o Recuo nem descarta Energia. Que movimento belíssimo.', 'HAPPY']],
    defeat: [['mara', 'Reinicie e olhe para a sua mão antes do Recuo.']],
  },
  'C02-E03': {
    briefing: [['luma', 'WAHAHA! Crasher Wake, de Pastoria, entrando no ringue! Eu curo um pouquinho a cada volta. Consegue me acompanhar?!', 'HAPPY']],
    intro: [['luma', 'WAHAHA! Suba no ringue, desafiante!', 'HAPPY']],
    victory: [['luma', 'Você trocou junto comigo e ainda fechou a conta! Que golpe bonito!', 'SURPRISED']],
    defeat: [['luma', 'A maré sempre volta! Use trocas que não desperdiçam Energia!']],
  },
  'C02-E04': {
    briefing: [['mara', 'Bem-vindo ao Aquário de Sootopolis. Três cartas brilham como joias na água: escolha uma.', 'HAPPY']],
    victory: [['mara', 'Escolha refinada! As outras ficam no Empório.', 'HAPPY']],
    defeat: [['mara', 'O aquário não vai a lugar nenhum.']],
  },
  'C02-E05': {
    briefing: [['icaro', 'Olá, querido! Sou a Melony, de Circhester. Minha correnteza gelada puxa o seu Ativo para fora — tenha um plano para quem entrar, viu?', 'SERIOUS']],
    intro: [['icaro', 'Agasalhe-se bem, querido. Vai esfriar!', 'HAPPY']],
    victory: [['icaro', 'Você tinha respostas no Banco inteiro. Estou orgulhosa de você, querido!', 'SURPRISED']],
    defeat: [['icaro', 'Quem escolhe o novo Ativo é você — prepare mais de uma opção, está bem?']],
  },
  'C02-E06': {
    briefing: [['mara', 'Sou Wallace, Líder do Ginásio de Sootopolis. Eu alterno atacantes e guardo Energias para o próximo turno. Nada se perde nas minhas correntes.']],
    intro: [['mara', 'Que nosso duelo seja uma obra de arte.', 'HAPPY'], ['mara', 'Vamos ver quem calcula melhor o custo de cada troca.', 'SERIOUS']],
    victory: [['mara', 'Você distribuiu Energia e trocou sem desperdício. Magnífico! Leve duas Mistys e a Medalha Chuva.', 'HAPPY']],
    defeat: [['mara', 'Distribua Energia e calcule o Recuo. A maré muda a cada turno.']],
  },
  // ---------------------------------------------------------------- C03 — Ginásio de Vermilion (Elétrico; Tenente Surge = teo)
  'C03-E01': {
    briefing: [['bia', 'Elesa, de Nimbasa. Meus ataques pedem Elétrico específico e um pouco de Incolor. Contou as cargas antes de entrar na passarela?', 'HAPPY']],
    intro: [['bia', 'Prepare-se para um duelo eletrizante.', 'HAPPY']],
    victory: [['bia', 'Duas Energias num só Pokémon e um golpe na hora certa. Que brilho!', 'SURPRISED']],
    defeat: [['bia', 'Confira quantas Energias cada ataque pede antes de ligar. Estilo também é preparo.']],
  },
  'C03-E02': {
    briefing: [['teo', 'Escuta aqui, garoto! Dois anexos, custo três. Impossível? Conte as unidades fornecidas, não as cartas!']],
    intro: [['teo', 'Atenção, garoto! Treino relâmpago!', 'SERIOUS']],
    victory: [['teo', 'Fornecimento não é anexo. Você entendeu o meu Ginásio, soldado!', 'HAPPY']],
    defeat: [['teo', 'Reinicie e leia com atenção o que cada Item muda. Isso é uma ordem!']],
  },
  'C03-E03': {
    briefing: [['otto', 'Clemont, de Lumiose! Meu Magneton se carrega sozinho — uma vez por turno — e a carta Tenente Surge leva tudo para a frente. A ciência é incrível!', 'HAPPY']],
    intro: [['otto', 'O futuro é agora, graças à ciência!', 'HAPPY']],
    victory: [['otto', 'Usou a sua própria Habilidade e venceu a minha. Turno encerrado! De volta à prancheta…', 'SURPRISED']],
    defeat: [['otto', 'Toda aceleração tem limite. Observe quando ela acaba — eu medi!']],
  },
  'C03-E04': {
    briefing: [['teo', 'Bem-vindo à Oficina de Vermilion, garoto! Três cartas na bancada. Escolha uma para o seu arsenal.', 'HAPPY']],
    victory: [['teo', 'Ótima carga! As demais ficam no Empório.', 'HAPPY']],
    defeat: [['teo', 'A oficina segue aberta, soldado.']],
  },
  'C03-E05': {
    briefing: [['vivi', 'Olá, Iono-amigos! Na live de hoje: fio desencapado! Uma moeda e o seu Ativo fica Paralisado!', 'SERIOUS']],
    intro: [['vivi', 'Olá, Iono-amigos! A live do duelo começou!', 'HAPPY']],
    victory: [['vivi', 'Você moveu Energia em vez de ligar. Esperto! O chat foi à loucura!', 'SURPRISED']],
    defeat: [['vivi', 'O gatilho pune a ligação manual da Zona — não o movimento de Energia. Dica da Iono, hein!']],
  },
  'C03-E06': {
    briefing: [['teo', 'Tenente Surge, Líder de Vermilion! Meu Magneton fica no Banco alimentando o atacante principal. Se a fonte cair, a carga para — mas não vai cair, garoto!']],
    intro: [['teo', 'Ha! Prepare-se para levar um choque, garoto!', 'HAPPY'], ['teo', 'Distinga Energia ligada de fornecimento. E cuidado com a carga máxima!', 'SERIOUS']],
    victory: [['teo', 'Você desligou a fonte! Leve dois Tenentes Surge — isso mesmo, eu! — e a Medalha Trovão.', 'HAPPY']],
    defeat: [['teo', 'Ataques ao Banco interrompem a aceleração. Experimente o deck de apoio, garoto!']],
  },
  // ---------------------------------------------------------------- C04 — Ginásio de Saffron (Psíquico e condições; Sabrina = nara)
  'C04-E01': {
    briefing: [['davi', 'Fwahaha! Koga, de Fuchsia. Uma bruma leve: o Veneno pesa um pouquinho a cada virada de turno.']],
    intro: [['davi', 'Fwahaha! A arte ninja do veneno começa agora.', 'SERIOUS']],
    victory: [['davi', 'Trocar ou evoluir limpou a bruma. Você enxerga através das sombras.', 'HAPPY']],
    defeat: [['davi', 'Veneno não some sozinho. Troque o Ativo ou evolua.']],
  },
  'C04-E02': {
    briefing: [['nara', 'Eu já previ este turno: seu Ativo está Adormecido. Evoluir também desperta — você sabia?']],
    intro: [['nara', 'Eu já vi como este turno termina.', 'SERIOUS']],
    victory: [['nara', 'Você saiu do caminho antes do som chegar. Isso é ler o intervalo.', 'HAPPY']],
    defeat: [['nara', 'Vencer antes do prazo não basta: o alvo precisa deixar o Ativo. Concentre-se.']],
  },
  'C04-E03': {
    briefing: [['lis', 'Sou Liza, de Mossdeep. Meu irmão Tate mandou lembranças. Sono e Confusão, em cartas diferentes: as moedas decidem — mas você decide o resto.']],
    intro: [['lis', 'O Tate e eu sentimos que você viria.']],
    victory: [['lis', 'Evoluiu um Pokémon afetado e a condição sumiu. Vou contar ao Tate.', 'SURPRISED']],
    defeat: [['lis', 'Evoluir remove condições. Guarde uma evolução para a hora certa.']],
  },
  'C04-E04': {
    briefing: [['nara', 'As Lentes de Saffron mostram três cartas. Escolha uma… eu já sei qual será.', 'HAPPY']],
    victory: [['nara', 'Bela escolha. As outras ficam no Empório.', 'HAPPY']],
    defeat: [['nara', 'As lentes esperam por você.']],
  },
  'C04-E05': {
    briefing: [['enzo', 'Morty, de Ecruteak. Vejo o que outros não veem: Veneno e uma condição de controle ao mesmo tempo. Quanto tempo você aguenta?', 'SERIOUS']],
    intro: [['enzo', 'As sombras de Ecruteak sussurram seu nome…', 'SERIOUS']],
    victory: [['enzo', 'Uma troca e lá se foram as duas condições. Os espíritos se acalmaram.', 'SURPRISED']],
    defeat: [['enzo', 'Condições coexistem; uma troca limpa todas de uma vez.']],
  },
  'C04-E06': {
    briefing: [['nara', 'Sou Sabrina, Líder de Saffron. Eu alterno condições e Habilidades: Gengar no Ativo tranca os seus Apoiadores; Gardevoir acelera os meus Pokémon.']],
    intro: [['nara', 'Eu já previ o resultado deste duelo.', 'SERIOUS'], ['nara', 'O intervalo entre dois turnos é onde eu jogo. E você?', 'SERIOUS']],
    victory: [['nara', 'Você leu o intervalo e usou a sua própria Habilidade. Isso eu não previ. Leve duas Sabrinas e a Medalha Pântano.', 'HAPPY']],
    defeat: [['nara', 'Mantenha alternativas de troca e evolução. Não espere uma cura automática.']],
  },
  // ---------------------------------------------------------------- C05 — Ginásio de Stow-on-Side (Lutador/Metal; Bea = breno)
  'C05-E01': {
    briefing: [['malu', 'HAAA! Chuck, de Cianwood! Uma camada a mais: o Apoiador Giovanni soma dano no turno certo. Já fez a conta?!', 'HAPPY']],
    intro: [['malu', 'HAAA! Músculos e cartas: vamos treinar!', 'HAPPY']],
    victory: [['malu', 'Você também jogou Apoiador! Camada contra camada. Isso é treino de verdade!', 'SURPRISED']],
    defeat: [['malu', 'Inspecione o HP máximo antes de calcular o Nocaute! Cem flexões e tente de novo!']],
  },
  'C05-E02': {
    briefing: [['breno', 'Treino de foco. A moldura pesa: Melmetal ignora parte do dano de ataques. Derrube-o sem atacar.']],
    intro: [['breno', 'Foco. Um golpe certo vale mais que dez.', 'SERIOUS']],
    victory: [['breno', 'Sem fontes de HP, o dano acumulado fala por si. Bem treinado.', 'HAPPY']],
    defeat: [['breno', 'Atacar também vence, mas o desafio é Nocautear só removendo fontes.']],
  },
  'C05-E03': {
    briefing: [['bento', 'Roark, de Oreburgh, capacete no lugar! No meu terreno de pedra, ataques de Básicos custam mais — para os dois lados. Vai mudar o terreno?']],
    intro: [['bento', 'Capacete no lugar? Vamos cavar fundo!', 'HAPPY']],
    victory: [['bento', 'Um Item no momento certo. O terreno agora é seu — até as pedras concordam.', 'SURPRISED']],
    defeat: [['bento', 'Poção e Velocidade X também são jogadas. Leve Itens no deck.']],
  },
  'C05-E04': {
    briefing: [['breno', 'Este é o Dojo de Stow-on-Side. Três cartas sobre o tatame. Escolha uma.', 'HAPPY']],
    victory: [['breno', 'Boa escolha. As outras ficam no Empório.', 'HAPPY']],
    defeat: [['breno', 'O dojo continua aberto.']],
  },
  'C05-E05': {
    briefing: [['jade', 'Ah… s-sou a Jasmine, de Olivine. Redução defensiva e espinhos de ferro… cada golpe seu volta um pouco.', 'SERIOUS']],
    intro: [['jade', 'Ah… o-olá. Vamos duelar, se não se importar…']],
    victory: [['jade', 'Você venceu cedendo quase nada… Meu Metal não resistiu. Parabéns.', 'SURPRISED']],
    defeat: [['jade', 'O Cubone corta o seu dano no turno seguinte… Pense nisso, por favor.']],
  },
  'C05-E06': {
    briefing: [['breno', 'Sou Bea, Líder de Stow-on-Side. Machamp com o Apoiador Giovanni, Melmetal blindado. Perder uma peça muda todas as minhas contas — tente.']],
    intro: [['breno', 'Sem palavras. Só o duelo.', 'SERIOUS'], ['breno', 'Inspecione cada fonte de HP e de redução. Eu não vou recuar.', 'SERIOUS']],
    victory: [['breno', 'Você carregou um Pokémon até o limite e a conta virou. Respeito. Leve dois Brocks e a Medalha de Lutador.', 'HAPPY']],
    defeat: [['breno', 'Concentre Energia num atacante pesado e conte a redução do Melmetal.']],
  },
  // ---------------------------------------------------------------- C06 — Ginásio de Viridian (ex e risco de pontos; Blue = sol)
  'C06-E01': {
    briefing: [['iago', 'Korrina, de Shalour, chegando de patins! Meus Pokémon valem um ponto cada. Três alvos, três Nocautes. Seja rápido!', 'HAPPY']],
    intro: [['iago', 'Lá vou eu, a toda velocidade!', 'HAPPY']],
    victory: [['iago', 'Rápido e sem ex! Um ponto de cada vez — você patinou melhor que eu!', 'SURPRISED']],
    defeat: [['iago', 'Quando todos valem um ponto, velocidade é tudo!']],
  },
  'C06-E02': {
    briefing: [['sol', 'Ei, novato! Conta de risco: três alvos, valores diferentes. Some três pontos neste turno — se conseguir.']],
    intro: [['sol', 'Resolve isso aí antes que eu boceje.', 'SERIOUS']],
    victory: [['sol', 'Você contou os pontos antes do dano. É assim que se doma o risco. Hunf… nada mal.', 'HAPPY']],
    defeat: [['sol', 'Nem sempre o alvo à frente é o que vale mais. Óbvio, né?']],
  },
  'C06-E03': {
    briefing: [['clara', 'Charada! O que tem duas faces, um Arcanine ex que vale dois pontos e um Vulpix de apoio que vale um? Meu deck de Fogo! Qual você vai enfrentar primeiro?']],
    intro: [['clara', 'Charada: o que queima e vale dois pontos?', 'HAPPY']],
    victory: [['clara', 'Você venceu cedendo no máximo um ponto. Resposta correta! Plano completo!', 'SURPRISED']],
    defeat: [['clara', 'Meu ex vale dois pontos — e o seu também. Cuidado ao expô-lo. Pense na charada!']],
  },
  'C06-E04': {
    briefing: [['sol', 'Esta é a Sala de Troféus de Viridian. Três cartas raras na estante: escolha uma. Mas não se acostuma, hein.', 'HAPPY']],
    victory: [['sol', 'Escolha de campeão. As outras ficam no Empório.', 'HAPPY']],
    defeat: [['sol', 'A estante continua lá.']],
  },
  'C06-E05': {
    briefing: [['nico', 'Clay, de Driftveil. Sem rodeios: meus ex valem dois pontos. Um Nocaute pesa — para qualquer lado.', 'SERIOUS']],
    intro: [['nico', 'Hmpf. Vamos ver se você é osso duro de roer.', 'SERIOUS']],
    victory: [['nico', 'Você derrubou um ex. Hmpf… tá bom, admito: você cavou fundo.', 'SURPRISED']],
    defeat: [['nico', 'Proteja seus pontos até poder derrubar um ex de uma vez.']],
  },
  'C06-E06': {
    briefing: [['sol', 'Sou Blue, Líder de Viridian. Meu deck alterna o risco entre atacantes ex e apoio de um ponto. Conte bem.']],
    intro: [['sol', 'Diga olá ao campeão! Pronto pra perder?', 'HAPPY'], ['sol', 'Escolha a linha de vitória que usa menos turnos e recursos. Se souber qual é.', 'SERIOUS']],
    victory: [['sol', 'Você atacou com mais de um e fechou a conta. Tá, você venceu. Escolha um ex para levar — e a Medalha Terra.', 'HAPPY']],
    defeat: [['sol', 'Contar pontos vale mais que maximizar dano. Tente outra linha, novato.']],
  },
  // ---------------------------------------------------------------- Final — Torneio de Kanto
  'F00-D01': {
    briefing: [['lia', 'Exame de retorno, no Torneio de Kanto! Evolução, Banco e Treinadores bem usados. Vou cobrar tudo.', 'HAPPY']],
    intro: [['lia', 'Lembra da Escola? Agora é pra valer.', 'SERIOUS'], ['lia', 'Seis medalhas não dispensam o básico. Mostre que ainda sabe a matéria.']],
    victory: [['lia', 'Você cresceu muito nos Ginásios. Estou orgulhoso! Dizem que Giovanni, da Equipe Rocket, entrou no torneio… tenha cuidado.', 'HAPPY']],
    defeat: [['lia', 'Perder aqui não apaga nada. Ajuste o deck e volte.']],
  },
  'F00-D02': {
    briefing: [['sol', 'Revanche! Dupla estratégia: dois tipos de Energia, dois ex e alternativas para cada risco. Desta vez não tem medalha — só orgulho.']],
    intro: [['sol', 'Revanche! Desta vez o campeão sou eu.', 'SERIOUS'], ['sol', 'Da última vez você contou bem. Conte de novo.', 'SERIOUS']],
    victory: [['sol', 'Dois atacantes e a conta certa… Tá bom, você é bom mesmo. Giovanni espera por você na final. Não perde pra ele, hein.', 'HAPPY']],
    defeat: [['sol', 'Variar atacantes divide o risco. Tente outra vez — eu espero.']],
  },
  'F00-D03': {
    briefing: [['aurora', 'Butterfree cura o meu campo e o Charizard ex prepara o golpe. Não preciso de truques: nenhuma regra oculta, tudo está na mesa.']],
    intro: [['aurora', 'Então você é o Treinador das seis medalhas.', 'SERIOUS'], ['aurora', 'A Equipe Rocket não perde torneios. Mostre o deck que você montou.', 'SERIOUS']],
    victory: [['aurora', 'Hmpf… O Torneio de Kanto é seu. O troféu e o tapete do campeão agora são seus — e a sua coleção continua aberta. Nós nos veremos de novo.', 'HAPPY']],
    defeat: [['aurora', 'Perder aqui não desfaz suas vitórias sobre Cheren e Blue. Revise, derrube o Butterfree e volte quando quiser. Estarei esperando.']],
  },
};

const JOURNAL: readonly (readonly [chapterId: string, intro: string, outro: string])[] = [
  ['p00', 'Hoje cheguei à Escola de Treinadores. O professor Cheren disse que cada carta é uma decisão, não um número.', 'Terminei o prólogo. Tenho oito decks, um pacote Base e seis Ginásios pela frente.'],
  ['c01', 'Ginásio de Celadon: no torneio de Planta da Erika, ninguém joga com um Pokémon só. Preciso preparar o Banco.', 'Ganhei a Medalha Arco-Íris! Erika me ensinou a preparar o segundo atacante antes de perder o primeiro.'],
  ['c02', 'Ginásio de Sootopolis: cada Recuo custa Energia. Wallace diz que troca boa não desperdiça nada.', 'Medalha Chuva conquistada. Aprendi a distribuir Energia e a trocar sem perder recursos.'],
  ['c03', 'Ginásio de Vermilion: Energia ligada e Energia fornecida não são a mesma coisa. E o Tenente Surge fala muito alto!', 'Medalha Trovão! O Tenente Surge mostrou que uma fonte no Banco pode alimentar tudo — e que dá para desligá-la.'],
  ['c04', 'Ginásio de Saffron: condições especiais e Habilidades. Todas as durações estão na mesa.', 'Medalha Pântano. Sabrina me ensinou a ler o intervalo entre dois turnos.'],
  ['c05', 'Ginásio de Stow-on-Side: Apoiadores e modificadores de dano. Inspecionar antes de calcular.', 'Medalha de Lutador! Bea provou que dano de Habilidade ignora a blindagem de ataques.'],
  ['c06', 'Ginásio de Viridian: ex e muitos alvos. Contar pontos antes de maximizar dano — e aguentar o Blue se gabando.', 'Medalha Terra! Blue me deixou escolher um ex. Com seis medalhas, o Torneio de Kanto me espera.'],
  ['f00', 'Torneio de Kanto: três duelos, sem pressa e sem perder o que já conquistei.', 'Venci o Torneio de Kanto e levei o troféu! A coleção continua — e o pós-jogo também.'],
];

const PROLOGUE: readonly Dialogue[] = [
  dialogue('dlg-prologue-welcome', [
    ['lia', 'Olá! Eu sou o Cheren, professor da Escola de Treinadores.', 'HAPPY'],
    ['lia', 'Aqui você aprende o básico dos duelos de cartas. Depois, vai desafiar seis Ginásios — cada Líder ensina uma estratégia diferente — e, com as seis medalhas, disputar o Torneio de Kanto.'],
  ]),
  dialogue('dlg-prologue-decks', [['lia', 'Escolha um deck favorito entre os oito iniciais, um para cada tipo de Energia.'], ['lia', 'Não se preocupe: todos ficam com você. A escolha só destaca um deles.', 'HAPPY']]),
  dialogue('dlg-prologue-tutorial-pack', [['lia', 'Este pacote tutorial é conteúdo guiado: cinco cartas Base que ampliam as suas opções desde já.']]),
  dialogue('dlg-prologue-map', [['lia', 'O mapa é só um seletor de encontros. Toque num nó disponível para ver briefing, objetivos e prêmios.']]),
];

export const DIALOGUES: readonly Dialogue[] = [
  ...Object.entries(NODE_TEXTS).flatMap(([nodeId, t]) => {
    const id = nodeId.toLowerCase();
    return [
      dialogue(`dlg-${id}-briefing`, t.briefing),
      ...(t.intro ? [dialogue(`dlg-${id}-intro`, t.intro)] : []),
      dialogue(`dlg-${id}-victory`, t.victory),
      dialogue(`dlg-${id}-defeat`, t.defeat),
    ];
  }),
  ...JOURNAL.flatMap(([chapter, intro, outro]) => [
    dialogue(`dlg-journal-${chapter}-intro`, [['diario', intro]]),
    dialogue(`dlg-journal-${chapter}-outro`, [['diario', outro]]),
  ]),
  ...PROLOGUE,
];
