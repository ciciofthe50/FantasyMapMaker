import test from 'node:test';
import assert from 'node:assert/strict';
import { buildBackup, checkEvent, collections, demoWorld, makeWorld, parseBackup, projectWorld } from './engine.js';

const get = (view, key, id) => view.entities[key].find((entry) => id === entry.id);
const snapshot = (world, year, key, id) => get(projectWorld(world, year), key, id);
const change = (collection, id, patch) => ({ collection, id, patch });
const event = (id, year, order, changes) => ({ id, year, order, title:id, description:'', category:'Test', changes });

test('blank worlds have all independent collections and never share IDs', () => {
  const first = makeWorld('  Albion  '), second = makeWorld();
  assert.equal(first.name, 'Albion');
  assert.notEqual(first.id, second.id);
  assert.deepEqual(Object.keys(first.entities), collections);
  assert.deepEqual(projectWorld(first, -50).entities, second.entities);
});

test('demonstration dates synchronize politics, armies, characters, relationships and diplomacy', () => {
  const world = demoWorld();
  const [start, defeat, retake, peace] = [100,105,110,115].map((year) => projectWorld(world, year));
  assert.deepEqual([start,defeat,retake,peace].map((w) => get(w,'territories','borderpass').ownerId), [
    'valoria','draken','valoria','valoria'
  ]);
  assert.deepEqual([start,defeat,retake].map((w) => get(w,'locations','ashgate').kingdomId), [
    'valoria','draken','valoria'
  ]);
  assert.deepEqual([start,defeat,retake,peace].map((w) => get(w,'armies','northernarmy').x), [
    305,410,476,843
  ]);
  assert.equal(get(start,'characters','cedric').kingdomId,'valoria');
  assert.equal(get(defeat,'characters','cedric').kingdomId,'draken');
  assert.equal(get(retake,'characters','arthur').class,'General');
  assert.equal(get(peace,'characters','cedric').alive,false);
  assert.equal(get(peace,'characters','cedric').age,47);
  assert.equal(snapshot(world,130,'characters','cedric').age,47);
  assert.deepEqual([start,defeat,retake].map((w) => get(w,'relationships','arthur-cedric').type), [
    'Friendship','Distrust','Enemy'
  ]);
  assert.equal(get(defeat,'relationships','elara-arthur'),undefined);
  assert.equal(get(retake,'relationships','elara-arthur').type,'Alliance');
  assert.equal(get(peace,'diplomacy','valoria-elysia').type,'Allied');
  assert.equal(snapshot(world,75,'characters','arthur'),undefined);
});

test('editing a past event recomputes future years without mutating the source', () => {
  const world = demoWorld();
  const old = projectWorld(world, 106);
  const updated = { ...world, events:world.events.map((e) => e.id === 'ashgate-falls' ? { ...e,year:107 } : e) };
  assert.equal(get(old,'territories','borderpass').ownerId,'draken');
  assert.equal(snapshot(updated,106,'territories','borderpass').ownerId,'valoria');
  assert.equal(snapshot(updated,108,'territories','borderpass').ownerId,'draken');
  assert.equal(get(old,'territories','borderpass').ownerId,'draken');
  assert.equal(world.events[1].year,105);
  assert.equal(world.entities.territories.find((e) => e.id === 'borderpass').ownerId,'valoria');
});

test('deleting an event removes its effects without rewriting other dates', () => {
  const world = demoWorld();
  const removed = { ...world, events:world.events.filter((e) => e.id !== 'turning-of-the-tide') };
  assert.equal(snapshot(world,115,'characters','cedric').alive,false);
  assert.equal(snapshot(removed,115,'characters','cedric').alive,true);
  assert.equal(snapshot(removed,115,'characters','cedric').kingdomId,'draken');
  assert.equal(snapshot(removed,115,'territories','eastwatch').ownerId,'draken');
  assert.equal(snapshot(removed,115,'diplomacy','valoria-elysia').type,'Allied');
});

test('same-day events use the declared order, then stable event IDs', () => {
  const world = demoWorld();
  world.events.push(
    event('d',120,1,[change('territories','eastwatch',{ownerId:'valoria'})]),
    event('c',120,2,[change('territories','eastwatch',{ownerId:'elysia'})]),
    event('b',120,2,[change('territories','eastwatch',{ownerId:'draken'})]),
    event('a',120,0,[change('territories','eastwatch',{ownerId:null})]),
  );
  const reversed = { ...world, events:[...world.events].reverse() };
  assert.equal(snapshot(world,120,'territories','eastwatch').ownerId,'elysia');
  assert.deepEqual(projectWorld(world,120).entities,projectWorld(reversed,120).entities);
});

test('dissolution ends kingdom and diplomatic display at its effective date', () => {
  const world = demoWorld();
  world.events.push(event('dissolution',118,0,[change('kingdoms','draken',{to:118})]));
  assert.ok(snapshot(world,117,'kingdoms','draken'));
  assert.ok(snapshot(world,117,'diplomacy','valoria-draken'));
  assert.equal(snapshot(world,118,'kingdoms','draken'),undefined);
  assert.equal(snapshot(world,118,'diplomacy','valoria-draken'),undefined);
  assert.equal(snapshot(world,117,'kingdoms','draken').to,undefined);
});

test('event checks warn about unborn commanders, invalid references and repeated changes', () => {
  const world = demoWorld();
  world.entities.characters.push({ id:'heir', name:'Heir', from:140 });
  const proposed = event('proposed',120,0,[
    change('armies','northernarmy',{ commanderId:'heir' }),
    change('armies','northernarmy',{ kingdomId:'missing' }),
    change('characters','arthur',{ id:'new', to:20 })
  ]);
  assert.match(checkEvent(world,proposed).join(' '),/Heir is not active/);
  assert.match(checkEvent(world,proposed).join(' '),/not a valid kingdoms reference/);
  assert.match(checkEvent(world,proposed).join(' '),/listed order/);
  assert.match(checkEvent(world,proposed).join(' '),/ends before it starts/);
  assert.match(checkEvent(world,proposed).join(' '),/cannot replace an entity ID/);
  assert.equal(checkEvent(world,{ ...proposed,changes:[null] }).length,1);
});

test('an export reimports with exactly the same data and historical states', () => {
  const world = demoWorld();
  world.strokes.push({ id:'sample',terrain:'Forest',size:3,points:[[30,40],[42,50]],year:109 });
  const restored = parseBackup(buildBackup(world));
  assert.deepEqual(restored,world);
  for (const year of [100,105,110,115]) {
    assert.deepEqual(projectWorld(restored,year),projectWorld(world,year));
  }
});

test('backup parsing rejects invalid JSON, wrong versions, unsafe keys, duplicates and malformed events', () => {
  const world = demoWorld();
  assert.throws(() => parseBackup('malformed'),/valid JSON/);
  assert.throws(() => parseBackup(JSON.stringify(world)),/version 1/);
  assert.throws(() => parseBackup(buildBackup(world).replace('"demo": true','"__proto__": { "test": 0 }')),/Unsupported property/);
  world.entities.locations.push({ ...world.entities.locations[0] });
  assert.throws(() => parseBackup(buildBackup(world)),/duplicate records/);
  world.entities.locations.pop();
  world.events[0].changes.push(null);
  assert.throws(() => parseBackup(buildBackup(world)),/invalid historical event/);
});

test('decimal chapter dates remain ordered through projections and backups', () => {
  const world = demoWorld();
  world.legacyStrokes = [{ d:'M 0 0 L 1 1', layer:'land' }];
  world.events.push(event('between',105.25,0,[change('characters','cedric',{ class:'Exile' })]));
  const roundtripped = parseBackup(buildBackup(world));
  assert.deepEqual(roundtripped.legacyStrokes, world.legacyStrokes);
  assert.equal(snapshot(roundtripped,105.24,'characters','cedric').class,'General');
  assert.equal(snapshot(roundtripped,105.25,'characters','cedric').class,'Exile');
  assert.equal(snapshot(roundtripped,105.26,'characters','cedric').class,'Exile');
  assert.deepEqual(checkEvent(world,world.events.at(-1)), []);
});

test('event checks do not use later same-day state to validate an earlier event', () => {
  const world = demoWorld();
  world.entities.characters.push({ id:'heir', name:'Heir', from:140 });
  world.events.push(event('early-arrival',120,1,[change('characters','heir',{ from:120 })]));
  const candidate = event('command',120,0,[change('armies','northernarmy',{ commanderId:'heir' })]);
  assert.match(checkEvent(world,candidate).join(' '),/Heir is not active/);
  assert.deepEqual(checkEvent(world,{ ...candidate,order:2 }), []);
});
