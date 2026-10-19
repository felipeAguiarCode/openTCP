import json, sys
from pathlib import Path

OUT = Path(sys.argv[1])

TYPES = ["GRASS","FIRE","WATER","LIGHTNING","PSYCHIC","FIGHTING","DARKNESS","METAL","DRAGON","COLORLESS"]
ENERGY = ["GRASS","FIRE","WATER","LIGHTNING","PSYCHIC","FIGHTING","DARKNESS","METAL"]
CONDS = ["POISONED","BURNED","ASLEEP","PARALYZED","CONFUSED"]
ref = lambda n: {"$ref": f"#/$defs/{n}"}
s = lambda **k: dict(k)
str1 = {"type":"string","minLength":1,"maxLength":120}
idstr = {"type":"string","pattern":"^[a-z0-9][a-z0-9-]{0,79}$"}
intr = lambda lo, hi: {"type":"integer","minimum":lo,"maximum":hi}
arr = lambda items, mx=64, mn=0, unique=False: dict({"type":"array","items":items,"maxItems":mx,"minItems":mn}, **({"uniqueItems":True} if unique else {}))
enum = lambda *v: {"enum": list(v)}
obj = lambda props, req=(), extra=False: dict({"type":"object","properties":props,"required":list(req),"additionalProperties":extra})
count_or_formula = {"oneOf":[intr(0,100), ref("formula")]}
amount_or_formula = {"oneOf":[intr(0,9990), ref("formula")]}

defs = {}
defs["energyType"] = enum(*ENERGY)
defs["pokemonType"] = enum(*TYPES)
defs["condition"] = enum(*CONDS)
defs["pokemonFilter"] = obj({
  "types": arr(ref("pokemonType"),10,1,True),
  "stages": arr(enum("BASIC","STAGE_1","STAGE_2"),3,1,True),
  "ruleBoxes": arr(enum("NONE","EX","MEGA_EX"),3,1,True),
  "deckLimitKeys": arr(str1,32,1,True),
  "tags": arr(str1,16,1,True),
  "hasDamage": {"type":"boolean"},
  "hasCondition": {"oneOf":[{"type":"boolean"}, ref("condition")]},
  "hasTool": {"type":"boolean"},
  "hasEnergy": {"type":"boolean"},
  "positions": arr(enum("ACTIVE","BENCH"),2,1,True),
  "excludeSelf": {"type":"boolean"},
  "excludeFossils": {"type":"boolean"},
  "hasAbility": {"type":"boolean"},
  "abilityIds": arr(str1,8,1,True),
  "excludeAbilityIds": arr(str1,8,1,True),
  "attackIds": arr(str1,8,1,True),
  "energyTypes": arr(ref("energyType"),8,1,True),
  "evolvesFrom": arr(str1,16,1,True),
  "evolvedThisTurn": {"type":"boolean"},
  "movedToActiveThisTurn": {"type":"boolean"},
  "damagedByAttackLastOpponentTurn": {"type":"boolean"},
  "enteredPlayThisTurn": {"type":"boolean"}})
defs["cardFilter"] = obj({
  "categories": arr(enum("POKEMON","TRAINER"),2,1,True),
  "subtypes": arr(enum("ITEM","SUPPORTER","TOOL","STADIUM"),4,1,True),
  "stages": arr(enum("BASIC","STAGE_1","STAGE_2"),3,1,True),
  "types": arr(ref("pokemonType"),10,1,True),
  "ruleBoxes": arr(enum("NONE","EX","MEGA_EX"),3,1,True),
  "deckLimitKeys": arr(str1,32,1,True),
  "evolvesFromTarget": {"type":"boolean"},
  "excludeFossils": {"type":"boolean"},
  "evolvesFrom": arr(str1,16,1,True),
  "attackIds": arr(str1,8,1,True),
  "tags": arr(str1,16,1,True)})
defs["pick"] = {"oneOf":[
  obj({"mode":{"const":"ALL"}},["mode"]),
  obj({"mode":{"const":"CHOOSE"},"chooser":enum("CONTROLLER","OPPONENT"),"min":intr(0,8),"max":intr(1,8)},["mode","chooser","min","max"]),
  obj({"mode":{"const":"RANDOM"},"count":intr(1,8)},["mode","count"])]}
defs["selector"] = obj({
  "scope": enum("SELF","OWN_ACTIVE","OPPONENT_ACTIVE","OWN_BENCH","OPPONENT_BENCH","OWN_POKEMON","OPPONENT_POKEMON","ALL_POKEMON","EVENT_SOURCE","EVENT_TARGET","OUTPUT","DEFENDING","TARGET"),
  "ref": str1,
  "filter": ref("pokemonFilter"),
  "pick": ref("pick"),
  "outputId": str1}, ["scope"])
defs["zone"] = enum("OWN_HAND","OPPONENT_HAND","OWN_DECK","OPPONENT_DECK","OWN_DISCARD","OPPONENT_DISCARD")
defs["formula"] = {"type":"object","additionalProperties":False,"required":["op"],
  "properties":{
    "op": enum("CONST","ADD","SUBTRACT","MULTIPLY","MIN","MAX","CLAMP","COUNT_HEADS","COUNT_TAILS",
               "COUNT_ATTACHED_ENERGIES","COUNT_PROVIDED_ENERGY_UNITS","COUNT_BENCH_POKEMON","COUNT_POKEMON",
               "COUNT_CARDS","DAMAGE_ON_SOURCE","DAMAGE_ON_TARGET","POINTS","OUTPUT_COUNT",
               "EXTRA_ENERGY_UNITS","DAMAGE_DEALT_BY_ATTACK","REMAINING_HP","DISTINCT_ENERGY_TYPES","RETREAT_COST",
               "OWN_TURN_NUMBER","ATTACKS_USED","TOP_CARDS_MATCHING"),
    "value": intr(-9990, 1000000),
    "operands": arr(ref("formula"),8,1),
    "reference": str1,
    "selector": ref("selector"),
    "energyType": ref("energyType"),
    "side": enum("OWN","OPPONENT","BOTH"),
    "zone": ref("zone"),
    "filter": ref("cardFilter"),
    "attackId": str1,
    "window": enum("LAST_OWN_TURN","GAME"),
    "count": intr(1,20)},
  "allOf":[
    {"if":{"properties":{"op":{"const":"CONST"}}},"then":{"required":["value"]}},
    {"if":{"properties":{"op":{"enum":["REMAINING_HP","DISTINCT_ENERGY_TYPES","RETREAT_COST"]}}},"then":{"required":["selector"]}},
    {"if":{"properties":{"op":{"const":"OWN_TURN_NUMBER"}}},"then":{"required":["side"]}},
    {"if":{"properties":{"op":{"const":"ATTACKS_USED"}}},"then":{"required":["attackId"]}},
    {"if":{"properties":{"op":{"const":"TOP_CARDS_MATCHING"}}},"then":{"required":["count"]}},
    {"if":{"properties":{"op":{"enum":["ADD","MULTIPLY","MIN","MAX"]}}},"then":{"required":["operands"]}},
    {"if":{"properties":{"op":{"const":"SUBTRACT"}}},"then":{"required":["operands"],"properties":{"operands":{"minItems":2,"maxItems":2}}}},
    {"if":{"properties":{"op":{"const":"CLAMP"}}},"then":{"required":["operands"],"properties":{"operands":{"minItems":3,"maxItems":3}}}},
    {"if":{"properties":{"op":{"enum":["COUNT_HEADS","COUNT_TAILS","OUTPUT_COUNT"]}}},"then":{"required":["reference"]}},
    {"if":{"properties":{"op":{"enum":["COUNT_ATTACHED_ENERGIES","COUNT_PROVIDED_ENERGY_UNITS","COUNT_POKEMON"]}}},"then":{"required":["selector"]}},
    {"if":{"properties":{"op":{"enum":["COUNT_BENCH_POKEMON","POINTS"]}}},"then":{"required":["side"]}},
    {"if":{"properties":{"op":{"const":"COUNT_CARDS"}}},"then":{"required":["zone"]}}]}
defs["conditionExpr"] = {"type":"object","additionalProperties":False,"required":["op"],
  "properties":{
    "op": enum("ALL","ANY","NOT","COMPARE","EXISTS","CARDS_EXIST","SOURCE_POSITION","HAS_CONDITION","IS_TURN_OF",
               "STADIUM_IN_PLAY","SUPPORTER_PLAYED_THIS_TURN","KNOCKED_OUT_LAST_OPPONENT_TURN","OUTPUT_CARDS_MATCH"),
    "conditions": arr(ref("conditionExpr"),8,1),
    "condition": {"oneOf":[ref("conditionExpr"), ref("condition"), {"const":"ANY"}]},
    "left": ref("formula"), "right": ref("formula"),
    "cmp": enum("EQ","NE","GT","GE","LT","LE"),
    "selector": ref("selector"),
    "zone": ref("zone"), "filter": ref("cardFilter"), "count": intr(1,60),
    "position": enum("ACTIVE","BENCH"),
    "side": enum("OWN","OPPONENT"),
    "reference": str1},
  "allOf":[
    {"if":{"properties":{"op":{"enum":["ALL","ANY"]}}},"then":{"required":["conditions"]}},
    {"if":{"properties":{"op":{"const":"NOT"}}},"then":{"required":["condition"]}},
    {"if":{"properties":{"op":{"const":"COMPARE"}}},"then":{"required":["left","cmp","right"]}},
    {"if":{"properties":{"op":{"const":"EXISTS"}}},"then":{"required":["selector"]}},
    {"if":{"properties":{"op":{"const":"CARDS_EXIST"}}},"then":{"required":["zone","count"]}},
    {"if":{"properties":{"op":{"const":"SOURCE_POSITION"}}},"then":{"required":["position"]}},
    {"if":{"properties":{"op":{"const":"HAS_CONDITION"}}},"then":{"required":["selector","condition"]}},
    {"if":{"properties":{"op":{"const":"IS_TURN_OF"}}},"then":{"required":["side"]}},
    {"if":{"properties":{"op":{"const":"OUTPUT_CARDS_MATCH"}}},"then":{"required":["reference"]}}]}
defs["duration"] = obj({
  "kind": enum("INSTANT","THIS_TURN","NEXT_OPPONENT_TURN","NEXT_OWN_TURN","WHILE_SOURCE_IN_PLAY"),
  "removeOn": arr(enum("TARGET_LEAVES_ACTIVE","TARGET_EVOLVES","TARGET_LEAVES_PLAY","SOURCE_LEAVES_ACTIVE"),4,1,True)},["kind"])
defs["trigger"] = obj({
  "event": enum("TURN_STARTED","TURN_ENDING","POKEMON_ENTERED","POKEMON_EVOLVED","POKEMON_MOVED","ENERGY_ATTACHED",
                "ATTACK_DECLARED","DAMAGE_APPLIED","CONDITION_APPLIED","POKEMON_KNOCKED_OUT","TRAINER_PLAYED"),
  "filter": obj({
    "subject": enum("SELF","OWN_POKEMON","OPPONENT_POKEMON","ANY_POKEMON"),
    "subjectRole": enum("TARGET","SOURCE"),
    "turnOf": enum("OWN","OPPONENT"),
    "from": enum("HAND","DECK","DISCARD"),
    "reason": enum("RETREAT","SWITCH","PROMOTE"),
    "to": enum("ACTIVE","BENCH"),
    "energySource": enum("ENERGY_ZONE","DISCARD","EFFECT"),
    "attachmentMode": enum("MANUAL","CARD_EFFECT"),
    "energyType": ref("energyType"),
    "damageCategory": enum("ATTACK","EFFECT","CONDITION"),
    "minimum": intr(1,9990),
    "condition": ref("condition"),
    "subtype": enum("ITEM","SUPPORTER","TOOL","STADIUM"),
    "cause": {"const":"ATTACK"}})},["event"])
defs["additionalCost"] = {"oneOf":[
  obj({"type":{"const":"DISCARD_ENERGY"},"from":{"const":"SELF"},"energyType":{"oneOf":[ref("energyType"),{"const":"ANY"}]},"count":intr(1,10)},["type","from","energyType","count"]),
  obj({"type":{"const":"DISCARD_HAND_CARDS"},"count":intr(1,10),"filter":ref("cardFilter")},["type","count"])]}

# ---- operations
P = {}  # opcode -> (props, required)
target = ref("selector")
P["FLIP_COINS"] = ({"count":{"oneOf":[intr(1,20), ref("formula")]},"untilTails":{"const":True},"outputId":str1},["outputId"])
P["DEAL_DAMAGE"] = ({"target":target,"amount":amount_or_formula,"category":enum("ATTACK","EFFECT"),"applyWeakness":{"type":"boolean"},"ignoreDefenderModifiers":{"type":"boolean"}},["target","amount"])
P["HEAL_DAMAGE"] = ({"target":target,"amount":{"oneOf":[intr(1,9990),ref("formula"),{"const":"ALL"}]}},["target","amount"])
P["APPLY_CONDITION"] = ({"target":target,"condition":{"oneOf":[ref("condition"),{"const":"RANDOM"}]},"poisonDamage":intr(10,100)},["target","condition"])
P["REMOVE_CONDITION"] = ({"target":target,"conditions":{"oneOf":[arr(ref("condition"),5,1,True),{"enum":["ALL","RANDOM_ONE"]}]}},["target","conditions"])
P["DRAW_CARDS"] = ({"player":enum("OWN","OPPONENT"),"count":count_or_formula},["player","count"])
P["SEARCH_DECK"] = ({"player":{"const":"OWN"},"filter":ref("cardFilter"),"count":intr(1,20),"mode":enum("CHOOSE","RANDOM"),"destination":enum("HAND","BENCH"),"reveal":{"type":"boolean"},"shuffleAfter":{"type":"boolean"}},["player","filter","count","mode","destination"])
P["ATTACH_ENERGY"] = ({"target":target,"energyType":{"oneOf":[ref("energyType"),{"enum":["READY","RANDOM","ZONE_RANDOM"]}]},"energyTypes":arr(ref("energyType"),8,1),"count":{"oneOf":[intr(1,10), ref("formula")]},"source":enum("GENERATED","ENERGY_ZONE_READY","DISCARDED_ENERGY"),"consumesManualAttachment":{"type":"boolean"},"consumesReadyEnergy":{"type":"boolean"},"distribute":{"const":True},"perTarget":{"const":True}},["target","energyType","count","source"])
P["MOVE_ENERGY"] = ({"from":target,"to":target,"energyType":{"oneOf":[ref("energyType"),{"const":"ANY"}]},"energyTypes":arr(ref("energyType"),8,1,True),"count":{"oneOf":[intr(1,10),{"const":"ALL"}]},"perTarget":{"const":True}},["from","to","count"])
P["DISCARD_ENERGY"] = ({"target":target,"energyType":{"oneOf":[ref("energyType"),{"const":"ANY"}]},"energyTypes":arr(ref("energyType"),8,1),"count":{"oneOf":[intr(1,20),ref("formula"),{"const":"ALL"}]},"chooser":enum("CONTROLLER","OPPONENT","RANDOM"),"combined":{"const":True}},["target","count"])
P["SWITCH_ACTIVE"] = ({"side":enum("OWN","OPPONENT"),"chooser":enum("CONTROLLER","OPPONENT","RANDOM"),"filter":ref("pokemonFilter"),"incoming":{"const":"SELF"}},["side","chooser"])
P["EVOLVE"] = ({"target":target,"fromHand":ref("cardFilter"),"skipStage":{"type":"boolean"},"ignoreTurnRestrictions":{"type":"boolean"},"from":{"const":"DECK"}},["target","fromHand"])
P["MODIFY"] = ({"stat":enum("MAX_HP","RETREAT_COST","ATTACK_COST","DAMAGE_DEALT","DAMAGE_TAKEN","ENERGY_PROVISION","KNOCKOUT_POINTS","POISON_DAMAGE"),
  "amount":{"oneOf":[intr(-9990,9990), ref("formula")]},"target":target,"duration":ref("duration"),"energyType":ref("energyType"),"exclusive":{"const":True},
  "appliesTo":obj({"opponentActiveOnly":{"type":"boolean"},"damageCategory":enum("ATTACK","EFFECT","ANY"),"attackIds":arr(str1,4,1,True),
    "attackerFilter":ref("pokemonFilter"),"targetFilter":ref("pokemonFilter")})},["stat","amount","target","duration"])
P["PREVENT_DAMAGE"] = ({"target":target,"categories":arr(enum("ATTACK","EFFECT","CONDITION"),3,1,True),"amount":{"oneOf":[intr(1,9990),{"const":"ALL"}]},"duration":ref("duration"),"charges":intr(1,10),"attackerFilter":ref("pokemonFilter"),"coinFlip":{"const":True}},["target","categories","amount","duration"])
P["PREVENT_EFFECTS"] = ({"target":target,"fromSide":{"const":"OPPONENT"},"duration":ref("duration")},["target","fromSide","duration"])
P["RESTRICT_ACTION"] = ({"target":target,"actions":arr(enum("ATTACK","RETREAT","PLAY_ITEM","PLAY_SUPPORTER","USE_ABILITY","MANUAL_ENERGY","EVOLVE","RECEIVE_ZONE_ENERGY"),8,1,True),"duration":ref("duration"),"attackIds":arr(str1,4,1,True)},["target","actions","duration"])
P["SUPPRESS_ABILITIES"] = ({"target":target,"duration":ref("duration")},["target","duration"])
P["DISCARD_CARDS"] = ({"zone":enum("OWN_HAND","OPPONENT_HAND","OWN_DECK_TOP","OPPONENT_DECK_TOP"),"count":count_or_formula,"chooser":enum("CONTROLLER","OPPONENT","RANDOM"),"filter":ref("cardFilter"),"upTo":{"const":True},"outputId":str1},["zone","count","chooser"])
P["RETURN_TO_HAND"] = ({"target":target},["target"])
P["SHUFFLE_INTO_DECK"] = ({"target":target},["target"])
P["DISCARD_POKEMON"] = ({"target":target},["target"])
P["KNOCK_OUT"] = ({"target":target},["target"])
P["PUT_ON_BENCH"] = ({"from":enum("HAND","DECK","DISCARD"),"filter":ref("cardFilter"),"count":intr(1,3),"mode":enum("CHOOSE","RANDOM"),"side":enum("OWN","OPPONENT"),"chooser":{"const":"CONTROLLER"}},["from","count","mode","side"])
P["RECOVER_FROM_DISCARD"] = ({"filter":ref("cardFilter"),"count":{"oneOf":[intr(1,10), ref("formula")]},"mode":enum("CHOOSE","RANDOM"),"destination":enum("HAND","DECK")},["count","mode","destination"])
P["LOOK_AT_TOP"] = ({"player":enum("OWN","OPPONENT","CHOOSE"),"count":{"oneOf":[intr(1,10), ref("formula")]},"reorder":{"type":"boolean"}},["player","count"])
P["SHUFFLE_DECK"] = ({"player":enum("OWN","OPPONENT")},["player"])
P["REVEAL_HAND"] = ({"player":enum("OWN","OPPONENT")},["player"])
P["SCHEDULE_DELAYED"] = ({"target":target,"at":enum("END_OF_OPPONENT_NEXT_TURN","START_OF_OWN_NEXT_TURN","END_OF_THIS_TURN"),"operations":arr(ref("operation"),8,1),"removeOn":arr(enum("TARGET_LEAVES_ACTIVE","TARGET_EVOLVES","TARGET_LEAVES_PLAY","SOURCE_LEAVES_ACTIVE"),4,0,True),"bindTo":{"const":"SPOT"}},["target","at","operations"])
P["COPY_ATTACK"] = ({"from":target,"attackFilter":obj({"maxEnergyCost":intr(0,20),"attackIds":arr(str1,4,1,True)}),"requireEnergy":{"type":"boolean"}},["from","requireEnergy"])
P["CONDITIONAL"] = ({"condition":ref("conditionExpr"),"then":arr(ref("operation"),8,1),"else":arr(ref("operation"),8,0)},["condition","then"])
P["REMOVE_TOOL"] = ({"target":target,"destination":enum("DISCARD","HAND")},["target","destination"])
P["END_TURN"] = ({},[])
P["ATTACK_FAILS"] = ({},[])
P["SHUFFLE_HAND_INTO_DECK"] = ({"player":enum("OWN","OPPONENT"),"outputId":str1},["player"])
P["MOVE_DAMAGE"] = ({"from":target,"to":target,"amount":{"oneOf":[intr(10,9990),{"const":"ALL"}]}},["from","to","amount"])
P["SET_REMAINING_HP"] = ({"target":target,"mode":enum("HALF_DOWN","VALUE"),"value":intr(10,9990)},["target","mode"])
P["DEVOLVE"] = ({"target":target},["target"])
P["RETURN_CARDS_TO_DECK"] = ({"zone":{"const":"OPPONENT_HAND"},"count":count_or_formula,"chooser":enum("RANDOM","CONTROLLER"),"filter":ref("cardFilter")},["zone","count","chooser"])
P["CHANGE_ENERGY_TYPE"] = ({"target":target},["target"])
P["SET_NEXT_ENERGY"] = ({"player":enum("OWN","OPPONENT")},["player"])
P["REVEAL_TOP_TAKE"] = ({"count":intr(1,10),"filter":ref("cardFilter"),"rest":enum("BOTTOM","SHUFFLE")},["count","filter","rest"])
P["REVEAL_CARDS"] = ({"zone":enum("OPPONENT_DECK","OPPONENT_HAND"),"filter":ref("cardFilter")},["zone"])
P["SWAP_HAND_WITH_DECK"] = ({},[])
P["CHOOSE_ONE"] = ({"options":arr(arr(ref("operation"),8,1),4,2)},["options"])
P["FORCE_COIN"] = ({},[])
P["COPY_TRAINER"] = ({"excludeKeys":arr(str1,8,0,True)},["excludeKeys"])
P["MOVE_ENERGY_FREELY"] = ({},[])
P["PREVENT_CONDITIONS"] = ({"target":target,"duration":ref("duration"),"conditions":arr(ref("condition"),5,1,True)},["target","duration"])
P["PREVENT_HEALING"] = ({"target":target,"duration":ref("duration")},["target","duration"])
P["ATTACK_COIN_GATE"] = ({"target":target,"duration":ref("duration")},["target","duration"])
P["COUNTER_DAMAGE"] = ({"target":target,"duration":ref("duration"),"amount":intr(10,9990)},["target","duration","amount"])
P["GRANT_RULE"] = ({"target":target,"duration":ref("duration"),"rule":enum("EVOLVE_ANY_TURN","PREVIOUS_EVOLUTION_ATTACKS","EVOLVES_AS"),"evolvesAs":arr(str1,8,1,True)},["target","duration","rule"])
P["SURVIVE_KNOCKOUT"] = ({"target":target,"duration":ref("duration"),"remainingHp":intr(10,9990)},["target","duration","remainingHp"])
P["REROLL_COINS"] = ({"target":target,"duration":ref("duration")},["target","duration"])

all_props = {"type": enum(*P.keys())}
branches = []
for op,(props,req) in P.items():
    branches.append({"if":{"properties":{"type":{"const":op}},"required":["type"]},
                     "then":{"properties":props,"required":["type",*req]}})
defs["operation"] = {"type":"object","required":["type"],"properties":all_props,"allOf":branches,"unevaluatedProperties":False}
defs["effectBlock"] = obj({
  "id": idstr,
  "timing": enum("PRE_DAMAGE","POST_DAMAGE","ON_PLAY","ON_ACTIVATE","ON_TRIGGER","CONTINUOUS","REPLACEMENT"),
  "condition": {"oneOf":[{"type":"null"}, ref("conditionExpr")]},
  "optional": {"type":"boolean"},
  "failurePolicy": enum("REQUIRE_ANY","REQUIRE_ALL","BEST_EFFORT"),
  "operation": ref("operation")}, ["id","timing","operation"])
energy_cost = {"type":"object","additionalProperties":False,"properties":{t:intr(0,10) for t in ENERGY+["COLORLESS"]}}
defs["attack"] = {"type":"object","additionalProperties":False,
  "required":["id","name","energyCost","baseDamage","damageFormula","damageTarget","preconditions","additionalCosts","effects","endsTurn"],
  "properties":{
    "id": idstr, "name": {"type":"string","minLength":1,"maxLength":40},
    "energyCost": energy_cost,
    "baseDamage": {"type":["integer","null"],"minimum":0,"maximum":9990},
    "damageFormula": {"oneOf":[{"type":"null"}, ref("formula")]},
    "damageTarget": {"oneOf":[{"type":"null"}, ref("selector")]},
    "preconditions": arr(ref("conditionExpr"),16),
    "additionalCosts": arr(ref("additionalCost"),4),
    "effects": arr(ref("effectBlock"),16),
    "endsTurn": {"type":"boolean"},
    "alternativeCost": obj({"condition":ref("conditionExpr"),"energyCost":energy_cost},["condition","energyCost"]),
    "ignoreDefenderEffects": {"const":True},
    "presentation": obj({"presetId":enum("ATTACK_STANDARD","ATTACK_SPECIAL"),"vfxProfile":str1,"soundCue":{"type":["string","null"]}})},
  "oneOf":[
    {"properties":{"baseDamage":{"type":"integer"},"damageFormula":{"type":"null"}}},
    {"properties":{"baseDamage":{"type":"null"},"damageFormula":ref("formula")}}]}
defs["ability"] = {"type":"object","additionalProperties":False,
  "required":["id","name","kind","sourcePositions","conditions","costs","effects","endsTurn"],
  "properties":{
    "id": idstr, "name": {"type":"string","minLength":1,"maxLength":40},
    "kind": enum("ACTIVATED","CONTINUOUS","TRIGGERED","REPLACEMENT"),
    "sourcePositions": arr(enum("ACTIVE","BENCH"),2,1,True),
    "trigger": ref("trigger"),
    "conditions": arr(ref("conditionExpr"),8),
    "costs": arr(ref("additionalCost"),4),
    "usageLimit": {"oneOf":[{"type":"null"}, obj({"scope":enum("INSTANCE_TURN","NAME_TURN","PLAYER_TURN","INSTANCE_MATCH","PLAYER_MATCH","UNLIMITED"),"count":intr(1,10)},["scope","count"])]},
    "optional": {"type":"boolean"},
    "endsTurn": {"type":"boolean"},
    "effects": arr(ref("effectBlock"),16,1)},
  "allOf":[
    {"if":{"properties":{"kind":{"const":"TRIGGERED"}}},"then":{"required":["trigger"]},"else":{"not":{"required":["trigger"]}}},
    {"if":{"properties":{"kind":{"const":"ACTIVATED"}}},"then":{"required":["usageLimit"],"properties":{"usageLimit":{"type":"object"}}},
     "else":{"properties":{"endsTurn":{"const":False}}}}]}
defs["fieldBehavior"] = obj({
  "kind":{"const":"PLAY_AS_POKEMON"},"hp":intr(10,9990),"types":arr(ref("pokemonType"),2,0,True),
  "retreatAllowed":{"const":False},"knockoutPoints":{"const":1},"canAttack":{"const":False},
  "ownerMayDiscardDuringMainPhase":{"type":"boolean"}},["kind","hp","types","retreatAllowed","knockoutPoints","canAttack"])
defs["trainerRules"] = obj({
  "playConditions": arr(ref("conditionExpr"),8),
  "destinationAfterPlay": enum("DISCARD","ATTACHED_TOOL","STADIUM_SLOT","BENCH_AS_POKEMON"),
  "toolTarget": ref("pokemonFilter"),
  "fieldBehavior": ref("fieldBehavior"),
  "toolTrigger": ref("trigger"),
  "onKnockedOut": {"const":"RETURN_TO_HAND"}},["playConditions","destinationAfterPlay"])

schema = {
 "$schema":"https://json-schema.org/draft/2020-12/schema",
 "$id":"urn:card-campaign:schema:card-definition:2",
 "title":"Card definition dataVersion 2 + effects-dsl-v1 (contrato estrutural)",
 "type":"object","additionalProperties":False,
 "required":["dataVersion","id","version","baseName","name","deckLimitKey","category","ruleBox","knockoutPoints","baseHp","attacks","abilities","tags"],
 "properties":{
  "dataVersion":{"const":2},
  "effectsDsl":{"const":1},
  "id":{"type":"string","pattern":"^[a-z0-9][a-z0-9-]{0,79}$"},
  "version":{"type":"integer","minimum":1},
  "baseName":{"type":"string","minLength":1,"maxLength":50},
  "name":{"type":"string","minLength":1,"maxLength":60},
  "deckLimitKey":{"type":"string","pattern":"^[a-z0-9]+(-[a-z0-9]+)*$","maxLength":100},
  "category":enum("POKEMON","TRAINER"),
  "subtype":enum("ITEM","SUPPORTER","TOOL","STADIUM"),
  "stage":enum("BASIC","STAGE_1","STAGE_2"),
  "evolvesFrom":arr({"type":"string","pattern":"^[a-z0-9]+(-[a-z0-9]+)*$"},16,0,True),
  "types":arr(ref("pokemonType"),2,1,True),
  "baseHp":{"type":["integer","null"],"minimum":10,"maximum":9990,"multipleOf":10},
  "retreatCost":intr(0,10),
  "weakness":{"oneOf":[{"type":"null"}, obj({"type":ref("pokemonType"),"operation":enum("ADD","MULTIPLY"),"value":intr(0,100)},["type","operation","value"])]},
  "ruleBox":enum("NONE","EX","MEGA_EX"),
  "knockoutPoints":{"type":["integer","null"],"minimum":1,"maximum":3},
  "tags":arr({"type":"string","minLength":1,"maxLength":40},32,0,True),
  "flavorText":{"type":"string","maxLength":240},
  "attacks":arr(ref("attack"),4),
  "abilities":arr(ref("ability"),4),
  "trainerRules":ref("trainerRules"),
  "trainerEffects":arr(ref("effectBlock"),16)},
 "allOf":[
  {"if":{"properties":{"category":{"const":"POKEMON"}}},
   "then":{"required":["stage","evolvesFrom","types","retreatCost","weakness"],
           "properties":{"baseHp":{"type":"integer"},"knockoutPoints":{"type":"integer"}},
           "not":{"anyOf":[{"required":["subtype"]},{"required":["trainerRules"]},{"required":["trainerEffects"]}]}},
   "else":{"required":["subtype","trainerRules","trainerEffects"],
           "properties":{"baseHp":{"type":"null"},"knockoutPoints":{"type":"null"},"ruleBox":{"const":"NONE"},"attacks":{"maxItems":0},"abilities":{"maxItems":0}},
           "not":{"anyOf":[{"required":["stage"]},{"required":["types"]},{"required":["retreatCost"]},{"required":["weakness"]},{"required":["evolvesFrom"]}]}}},
  {"if":{"properties":{"stage":{"const":"BASIC"}},"required":["stage"]},"then":{"properties":{"evolvesFrom":{"maxItems":0}}}},
  {"if":{"properties":{"stage":{"enum":["STAGE_1","STAGE_2"]}},"required":["stage"]},"then":{"properties":{"evolvesFrom":{"minItems":1}}}},
  {"if":{"properties":{"category":{"const":"POKEMON"},"ruleBox":{"const":"NONE"}}},"then":{"properties":{"knockoutPoints":{"const":1}}}},
  {"if":{"properties":{"ruleBox":{"const":"EX"}}},"then":{"properties":{"category":{"const":"POKEMON"},"knockoutPoints":{"const":2}}}},
  {"if":{"properties":{"ruleBox":{"const":"MEGA_EX"}}},"then":{"properties":{"category":{"const":"POKEMON"},"knockoutPoints":{"const":3}}}},
  {"if":{"properties":{"subtype":{"const":"TOOL"}},"required":["subtype"]},"then":{"properties":{"trainerRules":{"properties":{"destinationAfterPlay":{"const":"ATTACHED_TOOL"}}}}}},
  {"if":{"properties":{"subtype":{"const":"STADIUM"}},"required":["subtype"]},"then":{"properties":{"trainerRules":{"properties":{"destinationAfterPlay":{"const":"STADIUM_SLOT"}}}}}},
  {"if":{"properties":{"subtype":{"const":"SUPPORTER"}},"required":["subtype"]},"then":{"properties":{"trainerRules":{"properties":{"destinationAfterPlay":{"const":"DISCARD"}}}}}}],
 "$defs":defs,
 "$comment":"Semântica normativa em efeitos-dsl.md. A aplicação ainda valida: nome derivado de baseName+ruleBox, deckLimitKey pelo algoritmo deck-limit-key-v2 (v1 com pré-normalização “♀” → \" f\" e “♂” → \" m\": Nidoran♀ → nidoran-f), outputId antes do uso, seletor DEFENDING e opcode ATTACK_FAILS só em efeitos de ataque, timings por contexto, profundidade de fórmulas, fieldBehavior apenas em ITEM com destino BENCH_AS_POKEMON."}
OUT.write_text(json.dumps(schema, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")
print("ops", len(P))
