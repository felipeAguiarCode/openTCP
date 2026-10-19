import json, sys
from pathlib import Path
from jsonschema import Draft202012Validator

OUT = Path(sys.argv[1])
ID = {"type": "string", "pattern": "^[a-z0-9][a-z0-9-]{0,79}$"}
NODE = {"type": "string", "pattern": "^(P00-T0[1-6]|C0[1-6]-E0[1-6]|F00-D0[1-3])$"}
TEXT = lambda n=200: {"type": "string", "minLength": 1, "maxLength": n}
INT = lambda lo, hi: {"type": "integer", "minimum": lo, "maximum": hi}
ENERGY = ["GRASS","FIRE","WATER","LIGHTNING","PSYCHIC","FIGHTING","DARKNESS","METAL"]
CONDS = ["POISONED","BURNED","ASLEEP","PARALYZED","CONFUSED"]
DIFF = ["STORY","STANDARD","EXPERT"]
RAR = ["COMMON","UNCOMMON","RARE","ULTRA"]
def obj(props, req=(), extra=False, **kw):
    d = {"type":"object","properties":props,"required":list(req),"additionalProperties":extra}
    d.update(kw); return d
def arr(items, mx=100, mn=0, unique=False):
    d = {"type":"array","items":items,"maxItems":mx,"minItems":mn}
    if unique: d["uniqueItems"] = True
    return d
def schema(name, title, body, defs=None):
    s = {"$schema":"https://json-schema.org/draft/2020-12/schema","$id":f"urn:card-campaign:schema:{name}:1","title":title}
    s.update(body)
    if defs: s["$defs"] = defs
    Draft202012Validator.check_schema(s)
    (OUT / f"{name}.schema.json").write_text(json.dumps(s, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")

# ---- deck
schema("content-deck", "Deck de conteúdo (inicial, apoio ou NPC)", obj({
    "deckId": ID, "version": INT(1, 999), "name": TEXT(60),
    "kind": {"enum": ["STARTER","SUPPORT","NPC","TUTORIAL"]},
    "energyTypes": arr({"enum": ENERGY}, 3, 1, True),
    "entries": arr(obj({"printingId": ID, "count": INT(1, 2)}, ["printingId","count"]), 20, 1),
    "cosmeticPresetId": {"type": ["string","null"]},
    "strategyNote": TEXT(300)},
    ["deckId","version","name","kind","energyTypes","entries"],
    **{"$comment": "A soma de count deve ser 20 e o limite por deckLimitKey é 2 (validação semântica do build)."}))

# ---- receita de deck (campanha §3.7)
schema("deck-recipe", "Receita de deck (por tipo, meta ou comunidade)", obj({
    "recipeId": ID, "version": INT(1, 999), "name": TEXT(40),
    "category": {"enum": ["TYPE","META","COMMUNITY"]},
    "era": {"type": "string", "pattern": "^A[1-9][a-z]?$"},
    "energyTypes": arr({"enum": ENERGY}, 3, 1, True),
    "difficulty": {"enum": ["EASY","MEDIUM","HARD"]},
    "entries": arr(obj({"printingId": ID, "count": INT(1, 2)}, ["printingId","count"]), 20, 1),
    "coverPrintingId": ID,
    "summary": TEXT(300)},
    ["recipeId","version","name","category","era","energyTypes","difficulty","entries","coverPrintingId","summary"],
    **{"$comment": "A soma de count deve ser 20, o limite por deckLimitKey é 2, toda evolução tem o estágio anterior na lista e a capa é um Pokémon da lista (validação semântica do build; campanha §3.7)."}))

# ---- product
slot = obj({"position": INT(1, 10), "categoryWeights": obj({r: INT(0, 10000) for r in RAR}, RAR)}, ["position","categoryWeights"])
pool_item = obj({"printingId": ID, "weight": INT(1, 10000)}, ["printingId","weight"])
# Pacote por símbolo (taxas oficiais do Pocket, campanha §16.2): pesos em milésimos de ponto percentual (soma 100000).
SYM = ["◊","◊◊","◊◊◊","◊◊◊◊","☆","☆☆","☆☆☆","✵","✵✵","♛","PROMO"]
tier_weights = {"type": "object", "propertyNames": {"enum": SYM}, "additionalProperties": INT(1, 100000), "minProperties": 1}
tier_pools = {"type": "object", "propertyNames": {"enum": SYM}, "additionalProperties": arr(ID, 400, 1, True)}
tier_slot = obj({"position": INT(1, 10), "weights": tier_weights}, ["position","weights"])
schema("product", "Produto do Empório / pacote", obj({
    "productId": ID, "version": INT(1, 999), "name": TEXT(60),
    "kind": {"enum": ["RANDOM_PACK","FIXED_PACK","DIRECTED_CARD","COSMETIC"]},
    "price": {"oneOf": [{"type": "null"}, obj({"credits": INT(1, 100000)}, ["credits"])]},
    "availability": obj({"fromStart": {"type": "boolean"}, "afterNodeId": {"oneOf": [{"type": "null"}, NODE]}}, ["fromStart","afterNodeId"]),
    "repeatable": {"type": "boolean"},
    "cardsPerPack": INT(1, 10),
    "slots": arr(slot, 10, 1),
    "pools": obj({r: arr(pool_item, 200, 0) for r in RAR}, RAR),
    "tierSlots": arr(tier_slot, 10, 1),
    "tierPools": tier_pools,
    "bonusSlot": obj({"chance": INT(1, 100000), "weights": tier_weights, "pools": tier_pools}, ["chance","weights","pools"]),
    "rarePack": obj({"chance": INT(1, 100000), "symbols": arr({"enum": ["☆","☆☆","☆☆☆","✵","✵✵","♛"]}, 6, 1, True)}, ["chance","symbols"]),
    "fixedContents": arr(ID, 10, 1),
    "directedPrintingId": ID,
    "cosmeticId": ID,
    "coverPrintingId": {"type": ["string","null"]}},
    ["productId","version","name","kind","price","availability","repeatable"],
    allOf=[
      {"if": {"properties": {"kind": {"const": "RANDOM_PACK"}}}, "then": {"required": ["cardsPerPack"],
        "oneOf": [{"required": ["slots","pools"]}, {"required": ["tierSlots","tierPools"]}]}},
      {"if": {"anyOf": [{"required": ["bonusSlot"]}, {"required": ["rarePack"]}]}, "then": {"required": ["tierSlots"]}},
      {"if": {"properties": {"kind": {"const": "FIXED_PACK"}}}, "then": {"required": ["fixedContents"]}},
      {"if": {"properties": {"kind": {"const": "DIRECTED_CARD"}}}, "then": {"required": ["directedPrintingId"]}},
      {"if": {"properties": {"kind": {"const": "COSMETIC"}}}, "then": {"required": ["cosmeticId"], "properties": {"repeatable": {"const": False}}}}]))

# ---- objective
PRED = ["WIN","DECK_COMPOSITION","PLACED_ON_BENCH_AT_LEAST","EVOLVED_AT_LEAST","MANUAL_ENERGY_ATTACHED_AT_LEAST",
        "PLAYED_SUBTYPES","RETREATED_AT_LEAST","SWITCH_EFFECT_USED","DISTINCT_ATTACKERS_AT_LEAST",
        "DISTINCT_ATTACK_DAMAGE_SOURCES_AT_LEAST","ENERGY_ON_ONE_POKEMON_AT_LEAST","ACTIVATED_ABILITY_USED",
        "CONDITION_REMOVED_BY_CAUSE","EVOLVED_POKEMON_WITH_CONDITION","DELAYED_EFFECT_PREVENTED","TOOL_ATTACHED",
        "STADIUM_REPLACED_DIFFERENT_NAME","MODIFIER_SOURCE_REMOVED","KNOCKOUT_WITHOUT_ATTACK","KNOCKED_OUT_ROLE",
        "KNOCKED_OUT_RULEBOX","OWN_TURNS_AT_MOST","OPPONENT_POINTS_AT_MOST","WIN_IN_PREPARED_TURN"]
composition = obj({
    "minBasic": INT(0, 20), "maxRuleBoxCopies": obj({"EX": INT(0, 20), "MEGA_EX": INT(0, 20)}),
    "minRuleBoxCopies": obj({"EX": INT(0, 20), "MEGA_EX": INT(0, 20)}),
    "exactEnergyTypeCount": INT(1, 3), "minSubtypeCopies": obj({"TOOL": INT(0, 20), "STADIUM": INT(0, 20), "ITEM": INT(0, 20), "SUPPORTER": INT(0, 20)}),
    "minCardsWithOpcode": obj({"opcodes": arr({"type": "string", "pattern": "^[A-Z_]+(:[A-Z_]+)?$"}, 10, 1, True), "count": INT(1, 20)}, ["opcodes","count"]),
    "minDistinctEvolutionLines": INT(0, 10), "maxStarterPrintings": INT(0, 20), "minSetCards": obj({"setIds": arr(ID, 7, 1, True), "count": INT(1, 20)}, ["setIds","count"]),
    "minTypeCards": obj({"types": arr({"enum": ENERGY + ["DRAGON","COLORLESS"]}, 10, 1, True), "count": INT(1, 20)}, ["types","count"])})
predicate = obj({
    "type": {"enum": PRED}, "count": INT(1, 60), "controller": {"enum": ["HUMAN"]},
    "minimumDamage": INT(1, 9990), "subtypes": arr({"enum": ["ITEM","SUPPORTER","TOOL","STADIUM"]}, 4, 1, True),
    "causes": arr({"enum": ["SWITCH","RETREAT","EVOLUTION","EFFECT"]}, 4, 1, True),
    "role": TEXT(40), "ruleBoxes": arr({"enum": ["EX","MEGA_EX"]}, 2, 1, True),
    "composition": composition}, ["type"])
schema("objective", "Objetivo de encontro", obj({
    "objectiveId": {"type": "string", "pattern": "^(P00-T0[1-6]|C0[1-6]-E0[1-6]|F00-D0[1-3])-(WIN|TACTIC|DECK|PUZZLE|TUTORIAL)$"},
    "scope": {"const": "SINGLE_ATTEMPT"}, "requiresVictory": {"type": "boolean"},
    "predicates": arr(predicate, 4, 1),
    "description": TEXT(160),
    "reward": obj({"credits": INT(0, 10000)}, ["credits"]),
    "claimPolicy": {"const": "AUTOMATIC_ON_RESULT"},
    "grantKey": {"type": "string", "pattern": "^objective:[a-z0-9-]+:[A-Z0-9-]+$"}},
    ["objectiveId","scope","requiresVictory","predicates","description","reward","claimPolicy","grantKey"]))

# ---- campaign node
diffprof = obj({"aiProfileId": ID, "npcDeckId": ID}, ["aiProfileId","npcDeckId"])
schema("campaign-node", "Nó da campanha", obj({
    "nodeId": NODE, "campaignId": ID, "chapterId": {"enum": ["P00","C01","C02","C03","C04","C05","C06","F00"]},
    "contentVersion": {"type": "string", "pattern": "^[0-9]+\\.[0-9]+\\.[0-9]+$"},
    "kind": {"enum": ["TUTORIAL","DUEL","PUZZLE","DISCOVERY","ELITE","BOSS","FINAL"]},
    "title": TEXT(60), "essential": {"type": "boolean"},
    "prerequisites": obj({"allOf": arr(NODE, 6, 0, True)}, ["allOf"]),
    "npcId": ID, "arenaId": ID, "mapSceneId": ID,
    "difficultyProfiles": {"oneOf": [{"type": "null"}, obj({d: diffprof for d in DIFF}, DIFF)]},
    "fixtureId": {"type": ["string","null"]},
    "turnLimit": {"oneOf": [{"type": "null"}, obj({"ownTurns": INT(1, 30)}, ["ownTurns"])]},
    "completionObjectiveId": {"type": ["string","null"]},
    "optionalObjectiveIds": arr({"type": "string"}, 2, 0, True),
    "firstClearRewardTableId": ID, "repeatRewardTableId": {"type": ["string","null"]},
    "keyCardReward": {"oneOf": [{"type": "null"}, obj({"mode": {"enum": ["FIXED","CHOICE"]}, "printingIds": arr(ID, 3, 1, True), "copies": INT(1, 2)}, ["mode","printingIds","copies"])]},
    "discoveryOffer": {"oneOf": [{"type": "null"}, arr(ID, 3, 3, True)]},
    "supportDeckIds": arr(ID, 3, 0, True),
    "roleTags": {"type": "object", "additionalProperties": arr(TEXT(40), 4, 1, True)},
    "dialogue": obj({"briefing": ID, "intro": {"type": ["string","null"]}, "victory": ID, "defeat": ID}, ["briefing","victory","defeat"]),
    "map": obj({"x": {"type": "number"}, "z": {"type": "number"}, "icon": {"enum": ["BATTLE","PUZZLE","DISCOVERY","ELITE","BOSS","TUTORIAL","FINAL"]}}, ["x","z","icon"])},
    ["nodeId","campaignId","chapterId","contentVersion","kind","title","essential","prerequisites","npcId","arenaId","mapSceneId",
     "difficultyProfiles","fixtureId","turnLimit","completionObjectiveId","optionalObjectiveIds","firstClearRewardTableId",
     "repeatRewardTableId","keyCardReward","discoveryOffer","supportDeckIds","dialogue","map"],
    allOf=[
      {"if": {"properties": {"kind": {"const": "DISCOVERY"}}}, "then": {"properties": {"discoveryOffer": {"type": "array"}, "difficultyProfiles": {"type": "null"}, "completionObjectiveId": {"type": "null"}}}},
      {"if": {"properties": {"kind": {"enum": ["DUEL","ELITE","BOSS","FINAL"]}}}, "then": {"properties": {"difficultyProfiles": {"type": "object"}, "discoveryOffer": {"type": "null"}}}},
      {"if": {"properties": {"kind": {"enum": ["TUTORIAL","PUZZLE"]}}}, "then": {"properties": {"fixtureId": {"type": "string"}}}}]))

# ---- reward table
schema("reward-table", "Tabela de prêmio", obj({
    "rewardTableId": ID, "credits": INT(0, 100000),
    "packs": arr(obj({"productId": ID, "count": INT(1, 10)}, ["productId","count"]), 4),
    "medal": {"type": ["string","null"]}, "cosmetics": arr(ID, 4, 0, True), "unlocks": arr(TEXT(80), 8, 0, True)},
    ["rewardTableId","credits","packs","medal","cosmetics","unlocks"]))

# ---- npc + ai profile
schema("npc", "Personagem controlado por IA", obj({
    "npcId": ID, "name": TEXT(40), "title": TEXT(80), "chapterId": {"enum": ["P00","C01","C02","C03","C04","C05","C06","F00"]},
    "portraitAssetKey": {"type": ["string","null"]}, "style": TEXT(200),
    "notebook": obj({"origin": TEXT(200), "hints": arr(TEXT(200), 6, 1)}, ["origin","hints"]),
    "cosmeticPresetId": ID},
    ["npcId","name","title","chapterId","portraitAssetKey","style","notebook","cosmeticPresetId"]))
schema("ai-profile", "Perfil de IA (política + orçamento determinístico)", obj({
    "aiProfileId": ID, "policy": {"enum": DIFF},
    "budget": obj({"maxNodes": INT(1, 200000), "maxDepth": INT(1, 12), "determinizations": INT(1, 64), "watchdogMs": INT(50, 30000)}, ["maxNodes","maxDepth","determinizations","watchdogMs"]),
    "weights": obj({k: {"type": "number", "minimum": -10, "maximum": 10} for k in
        ["points","opponentPoints","damageDealt","knockoutThreat","energyDevelopment","evolution","benchDevelopment","handSize","conditions","preservePoints","aggression"]},
        ["points","opponentPoints","damageDealt","knockoutThreat","energyDevelopment","evolution","benchDevelopment","handSize","conditions","preservePoints","aggression"]),
    "tolerance": obj({"suboptimalChance": {"type": "number", "minimum": 0, "maximum": 0.5}, "candidatePoolTop": INT(1, 10)}, ["suboptimalChance","candidatePoolTop"]),
    "setupPolicy": {"enum": ["HIGHEST_HP_ACTIVE","BEST_ATTACKER_ACTIVE","PROTECT_KEY_BASIC"]},
    "targetPolicy": {"enum": ["MAX_DAMAGE","PREFER_KNOCKOUT","PREFER_HIGH_POINTS","PREFER_SUPPORT_ROLE"]},
    "promotionPolicy": {"enum": ["BEST_ATTACKER","HIGHEST_HP","LOWEST_POINTS_RISK"]}},
    ["aiProfileId","policy","budget","weights","tolerance","setupPolicy","targetPolicy","promotionPolicy"]))

# ---- fixture
pokemon_state = obj({
    "stack": arr(ID, 3, 1), "damage": INT(0, 9990), "energies": arr({"enum": ENERGY}, 12, 0),
    "toolPrintingId": {"type": ["string","null"]},
    "conditions": arr({"enum": CONDS}, 3, 0, True), "enteredPlayOnTurn": INT(0, 60)}, ["stack"])
side = obj({
    "deck": arr(ID, 20, 0), "hand": arr(ID, 10, 0), "discard": arr(ID, 20, 0),
    "active": {"oneOf": [{"type": "null"}, pokemon_state]}, "bench": arr(pokemon_state, 3, 0),
    "energyZone": obj({"types": arr({"enum": ENERGY}, 3, 1, True), "ready": {"oneOf": [{"type": "null"}, {"enum": ENERGY}]}, "next": {"enum": ENERGY}}, ["types","ready","next"]),
    "points": INT(0, 2), "usage": obj({"supporterUsed": {"type": "boolean"}, "retreatUsed": {"type": "boolean"}, "manualEnergyUsed": {"type": "boolean"}})},
    ["deck","hand","discard","active","bench","energyZone","points"])
schema("battle-fixture", "Fixture de batalha (tutorial, puzzle, laboratório)", obj({
    "fixtureId": ID, "kind": {"enum": ["TUTORIAL","PUZZLE","LAB","TEST"]},
    "label": TEXT(120), "startPhase": {"enum": ["SETUP","MAIN"]},
    "firstPlayer": {"enum": ["HUMAN","NPC"]}, "currentPlayer": {"enum": ["HUMAN","NPC"]},
    "globalTurnNumber": INT(1, 60), "ownTurns": obj({"HUMAN": INT(0, 30), "NPC": INT(0, 30)}, ["HUMAN","NPC"]),
    "stadiumPrintingId": {"type": ["string","null"]},
    "players": obj({"HUMAN": side, "NPC": side}, ["HUMAN","NPC"]),
    "scriptedRandom": obj({"coins": arr({"enum": ["HEADS","TAILS"]}, 60, 0), "label": TEXT(120)}, ["coins","label"]),
    "npcScript": arr(obj({"command": {"type": "object"}}, ["command"]), 60, 0),
    "solution": arr(obj({"actor": {"enum": ["HUMAN"]}, "command": {"type": "object"}}, ["actor","command"]), 60, 0),
    "guidance": arr(obj({"step": INT(1, 60), "text": TEXT(240), "highlight": {"type": ["string","null"]}}, ["step","text","highlight"]), 30, 0)},
    ["fixtureId","kind","label","startPhase","firstPlayer","currentPlayer","globalTurnNumber","ownTurns","stadiumPrintingId","players"]))

# ---- cosmetics
schema("cosmetic", "Cosmético (playmat, verso, moeda ou flair)", obj({
    "cosmeticId": ID, "kind": {"enum": ["PLAYMAT","SLEEVE","COIN","FLAIR"]}, "definitionVersion": INT(1, 99),
    "names": obj({"pt-BR": TEXT(60)}, ["pt-BR"]),
    "acquisition": obj({"kind": {"enum": ["FREE","EMPORIUM","GRANT"]}, "requiredCompletedNodeId": {"oneOf": [{"type": "null"}, NODE]},
                        "credits": INT(0, 100000), "grantMilestoneId": {"type": ["string","null"]}}, ["kind","requiredCompletedNodeId","credits"]),
    "visual": obj({"palette": arr({"type": "string", "pattern": "^#[0-9A-F]{6}$"}, 6, 2), "pattern": {"enum": ["NONE","LINES","LEAVES","WAVES","CIRCUITS","STARS","SYMBOLS","PAGES","CHAPTERS"]},
                   "assetKey": {"type": ["string","null"]}, "variants": arr(ID, 4, 1, True), "accentHex": {"type": "string", "pattern": "^#[0-9A-F]{6}$"}},
                  ["palette","pattern","assetKey","variants","accentHex"]),
    "flair": obj({"triggers": arr({"enum": ["PUBLIC_ENTRY","EVOLUTION","PROMOTION"]}, 3, 1, True), "particleBudget": INT(0, 200), "durationMs": INT(0, 2000), "reducedVariant": {"enum": ["FADE","NONE"]}}),
    "fallbackCosmeticId": {"type": ["string","null"]}},
    ["cosmeticId","kind","definitionVersion","names","acquisition","visual","fallbackCosmeticId"]))

# ---- dialogue
schema("dialogue", "Diálogo local", obj({
    "dialogueId": ID, "lines": arr(obj({"speakerId": ID, "text": TEXT(400), "mood": {"enum": ["NEUTRAL","HAPPY","SERIOUS","SURPRISED"]}}, ["speakerId","text"]), 20, 1)},
    ["dialogueId","lines"]))
print("ok")
