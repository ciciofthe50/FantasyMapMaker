import { buildBackup, demoWorld, makeWorld, parseBackup, uid } from './engine.js'
const DB = 'chronicle-worlds-v1'
const LEGACY = 'fantasy-map-maker-v1'
const REQUEST = (req) => new Promise((resolve, reject) => { req.onsuccess=()=>resolve(req.result); req.onerror=()=>reject(req.error) })
let openPromise
function open(){
  if(!openPromise){
    const request=indexedDB.open(DB,1)
    request.onupgradeneeded=()=>request.result.createObjectStore('workspace')
    openPromise=REQUEST(request)
  }
  return openPromise
}
export async function readWorkspace(){
  const db=await open()
  return REQUEST(db.transaction('workspace').objectStore('workspace').get('main'))
}
export async function writeWorkspace(data){
  const db=await open()
  const t=db.transaction('workspace','readwrite')
  return new Promise((resolve,reject)=>{
    t.oncomplete=()=>resolve()
    t.onerror=t.onabort=()=>reject(t.error ?? new Error('Save aborted'))
    t.objectStore('workspace').put(data,'main')
  })
}
const list=(x)=>Array.isArray(x)?x:[]
export function migrateLegacy(old){
  if(typeof old==='string') old=JSON.parse(old)
  if(!old||typeof old!=='object'||!['people','places','events','strokes','links'].some(k=>Array.isArray(old[k]))) throw Error('Not a Fantasy Map Maker backup')
  const w=makeWorld(old.name||'Imported Fantasy Map')
  const kingdoms=new Map()
  function kid(name){
    if(typeof name!=='string'||!name.trim())return ''
    const key=name.trim().toLowerCase()
    if(!kingdoms.has(key)){
      const id=uid()
      kingdoms.set(key,id)
      const colors=['#c79564','#728da6','#8c9e77','#9a768d']
      w.entities.kingdoms.push({id,name:name.trim(),color:colors[(kingdoms.size-1)%colors.length]})
    }
    return kingdoms.get(key)
  }
  w.entities.characters=list(old.people).map(p=>({id:p.id||uid(),name:p.name||'Unnamed character',kingdomId:kid(p.kingdom),class:p.role||'',fantasy:p.fantasy||'',likes:p.likes||'',dislikes:p.dislikes||'',description:p.notes||''}))
  w.entities.locations=list(old.places).map(p=>({id:p.id||uid(),name:p.name||'Unnamed location',kingdomId:kid(p.kingdom),type:'City',description:p.notes||'',x:+p.x||0,y:(+p.y||0)*620/680}))
  const chars=new Set(w.entities.characters.map(p=>p.id))
  w.entities.relationships=list(old.links).filter(r=>chars.has(r.a)&&chars.has(r.b)).map(r=>({id:r.id||uid(),name:r.name||'Connection',type:r.name||'Connection',sourceId:r.a,targetId:r.b,strength:0}))
  w.events=[...list(old.events)].sort((a,b)=>a.chapter-b.chapter||String(a.name).localeCompare(String(b.name))).map((e,i)=>({id:e.id||uid(),title:e.name||'Untitled event',year:Number.isFinite(Number(e.chapter))?Number(e.chapter):i,order:i,category:'Legacy',description:e.notes||'',relatedCharacters:list(e.people),relatedLocations:list(e.places),changes:chars.has(e.allegiance)?[{collection:'characters',id:e.allegiance,patch:{kingdomId:kid(e.kingdom)}}]:[]}))
  w.legacyStrokes=list(old.strokes).filter(s=>typeof s.path==='string'&&/^[mMlLhHvVcCsSqQtTaAzZ0-9+.,\s-]+$/.test(s.path)).map(s=>({id:s.id||uid(),kind:s.kind,path:s.path,scaleY:620/680}))
  return w
}
export function openBackup(text){
  const raw=JSON.parse(text)
  if(raw&&typeof raw==='object'&&['people','places','links'].some(k=>Array.isArray(raw[k])))return migrateLegacy(raw)
  return parseBackup(text)
}
export function initialWorkspace(){
  const worlds=[demoWorld()]
  try{
    const raw=localStorage.getItem(LEGACY)
    if(raw)worlds.unshift(migrateLegacy(raw))
  }catch{/* A damaged old save is never removed or overwritten. */}
  return {worlds,active:worlds[0].id,year:worlds.length===1?100:worlds[0].events[0]?.year??0}
}
export function downloadBackup(world){
  const url=URL.createObjectURL(new Blob([buildBackup(world)],{type:'application/json'}))
  const a=document.createElement('a');a.href=url;a.download=(world.name.replace(/[^a-z0-9]+/gi,'-').toLowerCase()||'chronicle')+'.json';a.click()
  setTimeout(()=>URL.revokeObjectURL(url),1000)
}
