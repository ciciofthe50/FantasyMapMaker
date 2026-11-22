import {test} from 'node:test'
import assert from 'node:assert/strict'
import 'fake-indexeddb/auto'
import {migrateLegacy,openBackup,readWorkspace,writeWorkspace} from './persistence.js'
import {buildBackup,projectWorld} from './engine.js'
const original={
  people:[{id:'ada',name:'Ada',fantasy:'Adelwyn',kingdom:'Valoria',role:'Knight',likes:'Horses'},{id:'sam',name:'Sam',kingdom:'Elysia'}],
  links:[{id:'rel',name:'Rivalry',a:'ada',b:'sam'}], places:[{id:'keep',name:'Keep',kingdom:'Valoria',x:100,y:680}],
  strokes:[{id:'land',kind:'land',path:'M 0 0 L 100 5 L 99 9 Z'}],
  events:[{id:'defect',name:'Defects',chapter:2.5,notes:'A turning point',people:['ada'],places:['keep'],allegiance:'ada',kingdom:'Elysia'}],
}
test('legacy Atlas backup preserves chapter decimals, named records, relationships, strokes and dated allegiances',()=>{
  const w=openBackup(JSON.stringify(original))
  const v=w.entities.kingdoms.find(k=>k.name==='Valoria').id
  const e=w.entities.kingdoms.find(k=>k.name==='Elysia').id
  assert.equal(projectWorld(w,2).entities.characters[0].kingdomId,v)
  assert.equal(projectWorld(w,2.5).entities.characters[0].kingdomId,e)
  assert.equal(w.entities.characters[0].fantasy,'Adelwyn')
  assert.equal(w.entities.relationships[0].targetId,'sam')
  assert.equal(w.entities.locations[0].y,620)
  assert.equal(w.legacyStrokes[0].path,original.strokes[0].path)
  assert.deepEqual(w.events[0].relatedLocations,['keep'])
  assert.deepEqual(openBackup(buildBackup(w)),w)
})
test('IndexedDB saves multiple projects and the selected date across independent reads',async()=>{
  const w=migrateLegacy(original), second=migrateLegacy({...original,name:'Other world'})
  const saved={worlds:[w,second],active:w.id,year:2.5}
  await writeWorkspace(saved)
  assert.deepEqual(await readWorkspace(),saved)
  const result=await readWorkspace()
  result.worlds[0].name='Unsaved edit'
  assert.equal((await readWorkspace()).worlds[0].name,w.name)
})
