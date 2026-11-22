/**
 * Timeline domain. Baseline entity definitions are immutable inputs; dated changes
 * patch a projection and never rewrite a baseline or an earlier event.
 * Year intervals use [from, to); character entries remain visible after death.
 */
export const collections = Object.freeze([
  'kingdoms', 'characters', 'locations', 'territories', 'armies', 'relationships', 'diplomacy',
]);

const forbiddenKeys = new Set(['__proto__', 'constructor', 'prototype']);
const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const validYear = (value) => Number.isFinite(value) && Math.abs(value) <= Number.MAX_SAFE_INTEGER;
const validOrder = Number.isSafeInteger;
const clone = (value) => structuredClone(value);
const validId = (value) => typeof value === 'string' && value.trim().length > 0;

export function uid() {
  return globalThis.crypto?.randomUUID?.() ??
    `entry-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export function makeWorld(name = 'Untitled world') {
  return {
    id: uid(),
    name: name.trim() || 'Untitled world',
    entities: Object.fromEntries(collections.map((key) => [key, []])),
    events: [],
    strokes: [],
    background: null,
  };
}

function active(entity, year) {
  return (entity.from == null || year >= entity.from) && (entity.to == null || year < entity.to);
}

function compareEvents(a, b) {
  return a.year - b.year || (a.order ?? 0) - (b.order ?? 0) ||
    (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

function applyChange(entities, change) {
  if (!isObject(change) || !collections.includes(change.collection) || !isObject(change.patch)) return;
  const entity = entities[change.collection].get(change.id);
  if (!entity) return;
  for (const [field, value] of Object.entries(change.patch)) {
    if (field === 'id' || forbiddenKeys.has(field)) continue;
    entity[field] = clone(value);
  }
}

function materialize(world, year, through = null) {
  const entities = Object.fromEntries(collections.map((key) => [
    key, new Map(world.entities[key].map((entity) => [entity.id, clone(entity)]))
  ]));
  const prior = world.events.filter((event) => event.year <= year &&
    (through === null || compareEvents(event, through) <= 0)).sort(compareEvents);
  for (const event of prior) {
    if (!Array.isArray(event.changes)) continue;
    for (const change of event.changes) applyChange(entities, change);
  }
  return entities;
}

export function projectWorld(world, year) {
  if (!validYear(year)) throw new TypeError('Choose a valid date.');
  const source = materialize(world, year);
  const entities = Object.fromEntries(collections.map((key) => [key, []]));
  for (const key of collections) {
    for (const entity of source[key].values()) {
      if (key === 'characters') {
        if (entity.from != null && year < entity.from) continue;
        const alive = entity.to == null || year < entity.to;
        const age = entity.from == null ? null : Math.max(0, (alive ? year : entity.to) - entity.from);
        entities[key].push({ ...entity, alive, age });
      } else if (active(entity, year)) {
        if (key === 'relationships') {
          const a = source.characters.get(entity.sourceId);
          const b = source.characters.get(entity.targetId);
          // Relations can survive a character's death in the historical record; the graph's
          // deceased-character filter decides whether to draw those nodes and their edges.
          if (!a || !b || year < (a.from ?? -Infinity) || year < (b.from ?? -Infinity)) continue;
        }
        if (key === 'diplomacy') {
          const a = source.kingdoms.get(entity.sourceId);
          const b = source.kingdoms.get(entity.targetId);
          if (!a || !b || !active(a, year) || !active(b, year)) continue;
        }
        entities[key].push(entity);
      }
    }
  }
  return { ...world, year, entities };
}

const references = {
  kingdoms: { rulerId:'characters', capitalId:'locations' },
  characters: { kingdomId:'kingdoms', originId:'kingdoms', birthplaceId:'locations' },
  locations: { kingdomId:'kingdoms', ownerId:'kingdoms', rulerId:'characters', governorId:'characters' },
  territories: { ownerId:'kingdoms', kingdomId:'kingdoms', governorId:'characters' },
  armies: { kingdomId:'kingdoms', commanderId:'characters', locationId:'locations', destinationId:'locations' },
  relationships: { sourceId:'characters', targetId:'characters' },
  diplomacy: { sourceId:'kingdoms', targetId:'kingdoms' },
};

export function checkEvent(world, event) {
  const warnings = [];
  if (typeof event.title !== 'string' || !event.title.trim()) warnings.push('This event needs a title.');
  if (!validYear(event.year)) warnings.push('This event needs a valid date.');
  if (event.order != null && !validOrder(event.order)) warnings.push('Event order must be a whole number.');
  if (!Array.isArray(event.changes)) return [...warnings, 'State changes must be a list.'];
  const replaces = { ...world, events: [...world.events.filter((e) => e.id !== event.id), event] };
  const state = validYear(event.year) ? materialize(replaces, event.year, event) : null;
  const seen = new Set();
  for (const change of event.changes) {
    if (!isObject(change) || !collections.includes(change.collection) || !validId(change.id) || !isObject(change.patch)) {
      warnings.push('A state change is missing its collection, target ID, or patch.');
      continue;
    }
    const key = `${change.collection}:${change.id}`;
    if (seen.has(key)) warnings.push(`More than one change targets ${change.id} in this event. Changes apply in listed order.`);
    seen.add(key);
    if (!world.entities[change.collection].some((v) => v.id === change.id)) {
      warnings.push(`No ${change.collection} record matches "${change.id}".`);
      continue;
    }
    const target = state?.[change.collection].get(change.id);
    if (target?.from != null && target?.to != null && target.to < target.from) {
      warnings.push(`${target.name} ends before it starts.`);
    }
    if (target && target.from != null && event.year < target.from) {
      warnings.push(`${target.name} does not exist yet in Year ${event.year}.`);
    }
    if ('id' in change.patch) warnings.push('A historical change cannot replace an entity ID.');
    for (const field of ['from', 'to']) {
      if (field in change.patch && change.patch[field] !== null && !validYear(change.patch[field])) {
        warnings.push(`${field} must be a valid date or blank.`);
      }
    }
    for (const [field, collection] of Object.entries(references[change.collection] ?? {})) {
      if (!(field in change.patch) || change.patch[field] == null || change.patch[field] === '') continue;
      const id = change.patch[field];
      const referenced = state?.[collection].get(id) ?? world.entities[collection].find((entry) => entry.id === id);
      if (!referenced) {
        warnings.push(`"${id}" is not a valid ${collection} reference.`);
      } else if (state && !active(referenced, event.year)) {
        warnings.push(`${referenced.name} is not active in Year ${event.year}.`);
      }
    }
  }
  return [...new Set(warnings)];
}

const backupVersion = 1;

export function buildBackup(world) {
  return JSON.stringify({ format: 'chronicle-world', version: backupVersion, world }, null, 2);
}

function scrubKeys(value) {
  if (value === null || typeof value !== 'object') return;
  for (const key of Object.keys(value)) {
    if (forbiddenKeys.has(key)) throw new Error('Unsupported property in this backup.');
    scrubKeys(value[key]);
  }
}

export function parseBackup(text) {
  let parsed;
  try { parsed = JSON.parse(text); } catch { throw new Error('This backup is not valid JSON.'); }
  if (parsed?.format !== 'chronicle-world' || parsed?.version !== backupVersion) {
    throw new Error('Choose a Chronicle world backup (version 1).');
  }
  scrubKeys(parsed);
  const world = parsed.world;
  const issues = [];
  if (!isObject(world) || !validId(world.id) || typeof world.name !== 'string' || !world.name.trim() ||
    !isObject(world.entities) || !Array.isArray(world.strokes) || !Array.isArray(world.events) ||
    (world.legacyStrokes != null && !Array.isArray(world.legacyStrokes))) {
    throw new Error('The backup does not describe a valid Chronicle world.');
  }
  for (const collection of collections) {
    const set = new Set();
    const list = world.entities[collection];
    if (!Array.isArray(list)) { issues.push(collection); continue; }
    for (const entity of list) {
      if (!isObject(entity) || !validId(entity.id) || set.has(entity.id) ||
        typeof entity.name !== 'string' ||
        (entity.from != null && !validYear(entity.from)) ||
        (entity.to != null && !validYear(entity.to))) {
        issues.push(collection); break;
      }
      set.add(entity.id);
    }
  }
  if (issues.length) throw new Error(`Invalid or duplicate records: ${issues.join(', ')}.`);
  const ids = new Set();
  for (const event of world.events) {
    if (!isObject(event) || !validId(event.id) || ids.has(event.id) || !validYear(event.year) ||
      (event.order != null && !validOrder(event.order)) || typeof event.title !== 'string' ||
      !Array.isArray(event.changes) || event.changes.some((change) =>
        !isObject(change) || !collections.includes(change.collection) ||
        !validId(change.id) || !isObject(change.patch))) {
      throw new Error('The backup contains an invalid historical event.');
    }
    ids.add(event.id);
  }
  return world;
}

const toPoints = (pairs) => pairs.map(([x,y]) => ({ x, y }));
const event = (id, year, order, category, title, description, changes = []) => (
  { id, year, order, category, title, description, changes }
);
const change = (collection, id, patch) => ({ collection, id, patch });

export function demoWorld() {
  const world = makeWorld('The Sundering of Avelorn');
  world.demo = true;
  world.mapStyle = 'demo';
  world.entities = {
    kingdoms: [
      { id:'valoria', name:'Valoria', color:'#aa5b44', from:76, rulerId:'arthur', capitalId:'highcrest', description:'The western kingdom guards the passes of the Ember Range.' },
      { id:'draken', name:'Draken', color:'#795878', from:82, capitalId:'ironhold', description:'A mountainous empire built along the basalt shores.' },
      { id:'elysia', name:'Elysia', color:'#488978', from:90, capitalId:'silverbay', description:'A coastal league known for sea trade and its ancient libraries.' },
    ],
    characters: [
      { id:'arthur', name:'Arthur', class:'Knight', from:77, kingdomId:'valoria', x:265, y:190, description:'A young Valorian knight sworn to protect the western marches.' },
      { id:'cedric', name:'Cedric', class:'General', from:68, kingdomId:'valoria', x:550, y:195, description:'A gifted commander whose loyalty gives way to ambition.' },
      { id:'elara', name:'Elara', class:'Mage', from:81, kingdomId:'elysia', x:430, y:405, description:'An Elysian mage sent to negotiate access to the mountain passes.' },
    ],
    locations: [
      { id:'highcrest', name:'Highcrest', type:'Capital', x:275, y:260, from:76, kingdomId:'valoria', description:'The hilltop seat of Valoria.' },
      { id:'ironhold', name:'Ironhold', type:'Capital', x:705, y:265, from:82, kingdomId:'draken', description:'Capital of the Draken Empire.' },
      { id:'silverbay', name:'Silverbay', type:'Port', x:510, y:468, from:90, kingdomId:'elysia', description:'The finest harbor in the southern straits.' },
      { id:'ashgate', name:'Ashgate Fortress', type:'Fortress', x:500, y:268, from:92, kingdomId:'valoria', description:'The key to the border between Valoria and Draken.' },
    ],
    territories: [
      { id:'westmarch', name:'Western Marches', ownerId:'valoria', from:76, points:toPoints([[153,215],[216,163],[342,174],[443,213],[447,315],[353,384],[248,362],[162,313]]) },
      { id:'ironreach', name:'Ironreach', ownerId:'draken', from:82, points:toPoints([[556,189],[661,163],[742,192],[827,232],[858,302],[792,357],[663,371],[554,319]]) },
      { id:'southerncoast', name:'Southern Coast', ownerId:'elysia', from:90, points:toPoints([[363,411],[488,360],[614,392],[649,468],[562,512],[461,524],[376,490]]) },
      { id:'borderpass', name:'Ashgate Pass', ownerId:'valoria', from:92, points:toPoints([[443,213],[556,189],[554,319],[492,348],[447,315]]) },
      { id:'eastwatch', name:'Eastwatch', ownerId:'draken', from:93, points:toPoints([[827,232],[897,217],[921,297],[888,339],[858,302]]) },
    ],
    armies: [
      { id:'northernarmy', name:'Northern Army', kingdomId:'valoria', commanderId:'cedric', x:305, y:315, from:99, troops:1600, status:'Garrisoned', description:'The northern shield of Valoria.' },
      { id:'ironlegion', name:'Iron Legion', kingdomId:'draken', x:744, y:312, from:100, troops:1800, status:'Mobilizing', description:'The imperial field army.' },
    ],
    relationships: [
      { id:'arthur-cedric', name:'Arthur → Cedric', sourceId:'arthur', targetId:'cedric', type:'Friendship', strength:70, from:100, description:'Comrades on the western border.' },
      { id:'elara-arthur', name:'Elara → Arthur', sourceId:'elara', targetId:'arthur', type:'Alliance', strength:66, from:110, description:'An agreement to defend the coastal pass.' },
    ],
    diplomacy: [
      { id:'valoria-draken', name:'Valoria / Draken', sourceId:'valoria', targetId:'draken', type:'Neutral', from:100 },
      { id:'valoria-elysia', name:'Valoria / Elysia', sourceId:'valoria', targetId:'elysia', type:'Neutral', from:100 },
    ],
  };
  world.events = [
    event('treaty-of-marches',100,0,'Kingdom','The Year of Three Crowns','Valoria, Draken and Elysia mark their borders. Cedric commands Valoria’s Northern Army.'),
    event('ashgate-falls',105,0,'Warfare','The Fall of Ashgate','Draken invades, Cedric defects, and the imperial army takes the border fortress.',[
      change('characters','cedric',{ kingdomId:'draken' }),
      change('locations','ashgate',{ kingdomId:'draken' }),
      change('territories','borderpass',{ ownerId:'draken' }),
      change('relationships','arthur-cedric',{ type:'Distrust', strength:-42 }),
      change('armies','northernarmy',{ x:410, y:296, commanderId:null, status:'Retreating', troops:1350 }),
      change('armies','ironlegion',{ x:519, y:303, commanderId:'cedric', status:'Occupying' }),
      change('diplomacy','valoria-draken',{ type:'At war' }),
    ]),
    event('ashgate-retaken',110,0,'Warfare','Valoria Retakes Ashgate','Arthur becomes a general and fights alongside his new ally Elara.',[
      change('characters','arthur',{ class:'General' }),
      change('locations','ashgate',{ kingdomId:'valoria' }),
      change('territories','borderpass',{ ownerId:'valoria' }),
      change('relationships','arthur-cedric',{ type:'Enemy', strength:-88 }),
      change('armies','northernarmy',{ x:476, y:303, commanderId:'arthur', status:'Occupying', troops:1500 }),
      change('armies','ironlegion',{ x:642, y:314, status:'Retreating', troops:1360 }),
    ]),
    event('turning-of-the-tide',115,0,'Warfare','The Battle of Eastwatch','Cedric falls in battle and Draken loses Eastwatch to Valoria.',[
      change('characters','cedric',{ to:115 }),
      change('armies','ironlegion',{ x:773, y:296, commanderId:null, status:'Dispersed', troops:410 }),
      change('armies','northernarmy',{ x:843, y:304, status:'Occupying', troops:1070 }),
      change('territories','eastwatch',{ ownerId:'valoria' }),
    ]),
    event('peace-of-silverbay',115,1,'Diplomacy','The Peace of Silverbay','Valoria and Elysia formalize their alliance.',[
      change('diplomacy','valoria-elysia',{ type:'Allied' }),
    ]),
  ];
  return world;
}
