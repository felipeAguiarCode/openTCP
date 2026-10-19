// Interpretador mínimo de JSON Schema 2020-12 (subconjunto usado pelos schemas da spec) para o nível
// "Estrutura" da validação do Estúdio (editor-de-cartas.md §24). Os schemas normativos vêm de
// schemas.generated.ts (cópia exata de .specs/schemas); os testes conferem paridade com o Ajv.
// Puro e determinístico: não usa eval nem compila código a partir do schema.

export type SchemaNode = boolean | { readonly [keyword: string]: unknown };

export type SchemaIssue = {
  /** JSON Pointer do valor inválido (ex.: "/attacks/0/name"). */
  readonly path: string;
  readonly keyword: string;
  readonly message: string;
};

type Result = { readonly issues: SchemaIssue[]; readonly evaluated: ReadonlySet<string> };

const EMPTY: ReadonlySet<string> = new Set();
const OK: Result = { issues: [], evaluated: EMPTY };

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b || a === null || b === null) return false;
  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false;
    return a.every((v, i) => deepEqual(v, b[i]));
  }
  if (isObject(a) && isObject(b)) {
    const ka = Object.keys(a);
    const kb = Object.keys(b);
    if (ka.length !== kb.length) return false;
    return ka.every((k) => Object.prototype.hasOwnProperty.call(b, k) && deepEqual(a[k], b[k]));
  }
  return false;
}

function typeOf(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'number') return Number.isInteger(value) ? 'integer' : 'number';
  return typeof value;
}

function matchesType(value: unknown, type: string): boolean {
  const actual = typeOf(value);
  if (type === 'number') return actual === 'number' || actual === 'integer';
  return actual === type;
}

const TYPE_LABEL: Record<string, string> = {
  string: 'texto', integer: 'inteiro', number: 'número', boolean: 'verdadeiro/falso', object: 'objeto', array: 'lista', null: 'nulo',
};

function show(value: unknown): string {
  const text = JSON.stringify(value);
  return text === undefined ? String(value) : text.length > 60 ? `${text.slice(0, 57)}...` : text;
}

const regexCache = new Map<string, RegExp>();
function regex(pattern: string): RegExp {
  let re = regexCache.get(pattern);
  if (!re) {
    re = new RegExp(pattern, 'u');
    regexCache.set(pattern, re);
  }
  return re;
}

function pointer(path: string, key: string | number): string {
  return `${path}/${String(key).replace(/~/g, '~0').replace(/\//g, '~1')}`;
}

type Context = { readonly root: Record<string, unknown>; depth: number };

function resolveRef(ctx: Context, ref: string): SchemaNode {
  if (ref === '#') return ctx.root;
  if (!ref.startsWith('#/')) throw new Error(`$ref não suportado: ${ref}`);
  let node: unknown = ctx.root;
  for (const raw of ref.slice(2).split('/')) {
    const key = raw.replace(/~1/g, '/').replace(/~0/g, '~');
    node = isObject(node) ? node[key] : undefined;
  }
  if (node === undefined) throw new Error(`$ref inexistente: ${ref}`);
  return node as SchemaNode;
}

function issue(path: string, keyword: string, message: string): SchemaIssue {
  return { path, keyword, message };
}

function validateNode(ctx: Context, schema: SchemaNode, value: unknown, path: string): Result {
  if (schema === true) return OK;
  if (schema === false) return { issues: [issue(path, 'false', 'valor não permitido')], evaluated: EMPTY };
  if (ctx.depth > 200) return { issues: [issue(path, 'depth', 'estrutura profunda demais')], evaluated: EMPTY };
  ctx.depth += 1;
  try {
    return validateObjectSchema(ctx, schema, value, path);
  } finally {
    ctx.depth -= 1;
  }
}

function validateObjectSchema(ctx: Context, s: { readonly [k: string]: unknown }, value: unknown, path: string): Result {
  const issues: SchemaIssue[] = [];
  const evaluated = new Set<string>();
  const absorb = (r: Result, collect = true) => {
    issues.push(...r.issues);
    if (collect && r.issues.length === 0) r.evaluated.forEach((k) => evaluated.add(k));
  };

  if (typeof s.$ref === 'string') absorb(validateNode(ctx, resolveRef(ctx, s.$ref), value, path));

  if (s.type !== undefined) {
    const types = Array.isArray(s.type) ? (s.type as string[]) : [s.type as string];
    if (!types.some((t) => matchesType(value, t))) {
      issues.push(issue(path, 'type', `esperado ${types.map((t) => TYPE_LABEL[t] ?? t).join(' ou ')}, recebido ${TYPE_LABEL[typeOf(value)] ?? typeOf(value)}`));
      return { issues, evaluated };
    }
  }
  if (Array.isArray(s.enum) && !s.enum.some((option) => deepEqual(option, value))) {
    issues.push(issue(path, 'enum', `valor ${show(value)} fora das opções permitidas`));
  }
  if ('const' in s && !deepEqual(s.const, value)) issues.push(issue(path, 'const', `valor deve ser ${show(s.const)}`));

  if (typeof value === 'string') {
    const length = [...value].length;
    if (typeof s.minLength === 'number' && length < s.minLength) issues.push(issue(path, 'minLength', s.minLength === 1 ? 'texto obrigatório' : `mínimo de ${s.minLength} caracteres`));
    if (typeof s.maxLength === 'number' && length > s.maxLength) issues.push(issue(path, 'maxLength', `máximo de ${s.maxLength} caracteres`));
    if (typeof s.pattern === 'string' && !regex(s.pattern).test(value)) issues.push(issue(path, 'pattern', `formato inválido (${s.pattern})`));
  }
  if (typeof value === 'number') {
    if (typeof s.minimum === 'number' && value < s.minimum) issues.push(issue(path, 'minimum', `mínimo ${s.minimum}`));
    if (typeof s.maximum === 'number' && value > s.maximum) issues.push(issue(path, 'maximum', `máximo ${s.maximum}`));
    if (typeof s.exclusiveMinimum === 'number' && value <= s.exclusiveMinimum) issues.push(issue(path, 'exclusiveMinimum', `deve ser maior que ${s.exclusiveMinimum}`));
    if (typeof s.exclusiveMaximum === 'number' && value >= s.exclusiveMaximum) issues.push(issue(path, 'exclusiveMaximum', `deve ser menor que ${s.exclusiveMaximum}`));
    if (typeof s.multipleOf === 'number') {
      const q = value / s.multipleOf;
      if (Math.abs(q - Math.round(q)) > 1e-9) issues.push(issue(path, 'multipleOf', `deve ser múltiplo de ${s.multipleOf}`));
    }
  }
  if (Array.isArray(value)) {
    if (typeof s.minItems === 'number' && value.length < s.minItems) issues.push(issue(path, 'minItems', `mínimo de ${s.minItems} item(ns)`));
    if (typeof s.maxItems === 'number' && value.length > s.maxItems) issues.push(issue(path, 'maxItems', `máximo de ${s.maxItems} item(ns)`));
    if (s.uniqueItems === true) {
      for (let i = 0; i < value.length; i += 1) {
        if (value.slice(0, i).some((v) => deepEqual(v, value[i]))) { issues.push(issue(pointer(path, i), 'uniqueItems', 'item repetido')); break; }
      }
    }
    if (s.items !== undefined && typeof s.items !== 'number') {
      value.forEach((item, i) => absorb(validateNode(ctx, s.items as SchemaNode, item, pointer(path, i)), false));
    }
  }
  if (isObject(value)) {
    const props = isObject(s.properties) ? s.properties : null;
    if (Array.isArray(s.required)) {
      for (const key of s.required as string[]) {
        if (!Object.prototype.hasOwnProperty.call(value, key)) issues.push(issue(pointer(path, key), 'required', 'campo obrigatório ausente'));
      }
    }
    if (props) {
      for (const [key, sub] of Object.entries(props)) {
        if (!Object.prototype.hasOwnProperty.call(value, key)) continue;
        evaluated.add(key);
        issues.push(...validateNode(ctx, sub as SchemaNode, value[key], pointer(path, key)).issues);
      }
    }
    if (s.additionalProperties !== undefined) {
      for (const key of Object.keys(value)) {
        if (props && Object.prototype.hasOwnProperty.call(props, key)) continue;
        evaluated.add(key);
        if (s.additionalProperties === false) issues.push(issue(pointer(path, key), 'additionalProperties', 'campo não permitido'));
        else issues.push(...validateNode(ctx, s.additionalProperties as SchemaNode, value[key], pointer(path, key)).issues);
      }
    }
  }

  if (Array.isArray(s.allOf)) for (const sub of s.allOf) absorb(validateNode(ctx, sub as SchemaNode, value, path));

  if (Array.isArray(s.anyOf)) {
    const results = (s.anyOf as SchemaNode[]).map((sub) => validateNode(ctx, sub, value, path));
    const ok = results.filter((r) => r.issues.length === 0);
    if (ok.length === 0) issues.push(...bestBranch(results, path));
    else ok.forEach((r) => r.evaluated.forEach((k) => evaluated.add(k)));
  }
  if (Array.isArray(s.oneOf)) {
    const results = (s.oneOf as SchemaNode[]).map((sub) => validateNode(ctx, sub, value, path));
    const ok = results.filter((r) => r.issues.length === 0);
    if (ok.length === 0) issues.push(...bestBranch(results, path));
    else if (ok.length > 1) issues.push(issue(path, 'oneOf', 'valor ambíguo: corresponde a mais de uma alternativa'));
    else ok[0]!.evaluated.forEach((k) => evaluated.add(k));
  }
  if (s.not !== undefined && validateNode(ctx, s.not as SchemaNode, value, path).issues.length === 0) {
    issues.push(issue(path, 'not', 'combinação de campos não permitida'));
  }
  if (s.if !== undefined) {
    const cond = validateNode(ctx, s.if as SchemaNode, value, path);
    if (cond.issues.length === 0) {
      cond.evaluated.forEach((k) => evaluated.add(k));
      if (s.then !== undefined) absorb(validateNode(ctx, s.then as SchemaNode, value, path));
    } else if (s.else !== undefined) {
      absorb(validateNode(ctx, s.else as SchemaNode, value, path));
    }
  }
  if (s.unevaluatedProperties === false && isObject(value)) {
    for (const key of Object.keys(value)) {
      if (!evaluated.has(key)) issues.push(issue(pointer(path, key), 'unevaluatedProperties', 'campo não permitido para este tipo'));
    }
  }
  return { issues, evaluated };
}

/** Sem alternativa válida: reporta a alternativa “mais próxima” (menos problemas), que costuma ser a pretendida. */
function bestBranch(results: readonly Result[], path: string): SchemaIssue[] {
  let best: Result | null = null;
  for (const r of results) {
    const typeMismatch = r.issues.some((i) => i.path === path && (i.keyword === 'type' || i.keyword === 'const'));
    const score = r.issues.length + (typeMismatch ? 1000 : 0);
    const bestScore = best ? best.issues.length + (best.issues.some((i) => i.path === path && (i.keyword === 'type' || i.keyword === 'const')) ? 1000 : 0) : Infinity;
    if (score < bestScore) best = r;
  }
  return best && best.issues.length ? best.issues : [issue(path, 'oneOf', 'valor não corresponde a nenhuma alternativa')];
}

/** Valida `value` contra o schema raiz. Lista vazia = válido. */
export function validateAgainstSchema(root: SchemaNode, value: unknown): SchemaIssue[] {
  if (typeof root === 'boolean') return root ? [] : [issue('', 'false', 'valor não permitido')];
  const ctx: Context = { root: root as Record<string, unknown>, depth: 0 };
  const seen = new Set<string>();
  // Remove duplicatas (mesmo caminho e palavra-chave) vindas de ramos alternativos.
  return validateNode(ctx, root, value, '').issues.filter((i) => {
    const key = `${i.path}\u0000${i.keyword}\u0000${i.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** "/attacks/0/name" → ["attacks", 0, "name"]. */
export function pointerSegments(path: string): (string | number)[] {
  if (!path) return [];
  return path.slice(1).split('/').map((raw) => {
    const key = raw.replace(/~1/g, '/').replace(/~0/g, '~');
    return /^\d+$/.test(key) ? Number(key) : key;
  });
}
