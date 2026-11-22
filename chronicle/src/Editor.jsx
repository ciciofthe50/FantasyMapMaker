import React,{useState} from 'react'
import {collections,checkEvent,uid} from './engine.js'

export const labels={kingdoms:'Kingdoms & Factions',characters:'Characters',territories:'Territories',locations:'Cities & Locations',armies:'Armies & Warfare',relationships:'Relationships',diplomacy:'Diplomacy',events:'Events & Lore'}
const descriptors={
  kingdoms:[['color','Banner color','color'],['government','Government'],['capitalId','Capital','locations'],['rulerId','Ruler','characters'],['culture','Culture'],['religion','Religion']],
  characters:[['class','Class'],['kingdomId','Allegiance','kingdoms'],['originId','Kingdom of origin','kingdoms'],['birthplaceId','Birthplace','locations'],['role','Playable / Enemy / NPC'],['fantasy','In-world name'],['portrait','Portrait image','portrait'],['likes','Likes'],['dislikes','Dislikes'],['recruitment','Recruitment notes']],
  locations:[['type','Location type',['Capital','City','Town','Village','Castle','Fortress','Outpost','Port','Temple','Ruin','Dungeon','Battlefield','Monument','Custom']],['kingdomId','Kingdom','kingdoms'],['rulerId','Governor','characters'],['population','Population','number'],['x','Map X','number'],['y','Map Y','number']],
  territories:[['ownerId','Owner','kingdoms'],['governorId','Governor','characters'],['status','Status',['Claimed','Disputed','Unclaimed']]],
  armies:[['kingdomId','Kingdom','kingdoms'],['commanderId','Commander','characters'],['troops','Troops','number'],['morale','Morale','number'],['status','Status'],['x','Map X','number'],['y','Map Y','number']],
  relationships:[['sourceId','From character','characters'],['targetId','To character','characters'],['type','Relationship type'],['strength','Strength (−100 to +100)','number']],
  diplomacy:[['sourceId','From kingdom','kingdoms'],['targetId','To kingdom','kingdoms'],['type','Diplomatic status'],['strength','Strength','number']],
}
const dates=(c)=>[['from',c==='characters'?'Birth year':'Starts in year','number'],['to',c==='characters'?'Death year':'Ends in year','number']]
const defaults={kingdoms:{color:'#b78c5b'},locations:{type:'City',x:500,y:310},territories:{status:'Unclaimed',points:[{x:460,y:270},{x:565,y:300},{x:465,y:355}]},armies:{x:525,y:330,troops:100,morale:75,status:'Stationed'},relationships:{type:'Friendship',strength:40},diplomacy:{type:'Neutral',strength:0}}
const fieldKeys=(collection)=>[['name','Name'],...(descriptors[collection]??[]),...dates(collection),['description','Notes','textarea']]
const editable=(collection)=>fieldKeys(collection)
const asNumber=(v)=>v===''?null:Number(v)
const nameOf=(i)=>i?.name??i?.title??'Untitled'
function itemName(e,world){
  if(!e.sourceId)return nameOf(e)
  const all=[...world.entities.characters,...world.entities.kingdoms]
  return `${nameOf(all.find(x=>x.id===e.sourceId))} → ${nameOf(all.find(x=>x.id===e.targetId))}`
}
export function createEntity(collection,world,year){
  let noun={kingdoms:'kingdom',characters:'character',locations:'location',armies:'army',territories:'territory',relationships:'relationship',diplomacy:'treaty'}[collection]
  const data={id:uid(),name:'New '+noun,from:year,...defaults[collection]}
  if(collection==='relationships'||collection==='diplomacy'){
    const a=world.entities[collection==='relationships'?'characters':'kingdoms']
    if(a.length<2)return null
    data.sourceId=a[0].id;data.targetId=a[1].id
  }
  return data
}
function Field({label,type,value,onChange,world}){
  const val=value??''
  let input
  if(Array.isArray(type)||collections.includes(type)){
    const options=Array.isArray(type)?type.map(s=>({id:s,name:s})):world.entities[type]
    input=<select value={val} onChange={e=>onChange(e.target.value)}><option value="">None</option>{options.map(x=><option value={x.id} key={x.id}>{x.name}</option>)}</select>
  }else if(type==='portrait')input=<div className="portrait-field">{typeof value==='string'&&/^data:image\/(png|jpeg|webp|gif);base64,/i.test(value)&&<img src={value} alt="Current portrait"/>}<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={e=>{const f=e.target.files?.[0];if(!f)return;if(f.size>2_000_000){e.target.setCustomValidity('Select an image smaller than 2 MB.');e.target.reportValidity();return}e.target.setCustomValidity('');const r=new FileReader();r.onload=()=>onChange(r.result);r.readAsDataURL(f)}}/>{value&&<button className="link" type="button" onClick={()=>onChange('')}>Remove portrait</button>}</div>
  else if(type==='textarea')input=<textarea rows={3} value={val} onChange={e=>onChange(e.target.value)}/>
  else input=<input type={type??'text'} step={type==='number'?'any':undefined} value={type==='color'&&!val?'#b78c5b':val} onChange={e=>onChange(type==='number'?asNumber(e.target.value):e.target.value)}/>
  return <label className="field"><span>{label}</span>{input}</label>
}
export function Archive({collection,world,snapshot,selected,setSelected,make,year}){
  const [q,search]=useState('')
  const [all,setAll]=useState(false)
  const data=collection==='events'?[...world.events].sort((a,b)=>a.year-b.year||a.order-b.order):all?world.entities[collection]:snapshot.entities[collection]
  const filtered=data.filter(e=>(itemName(e,world)+' '+(e.type||e.class||e.description||'')).toLowerCase().includes(q.toLowerCase()))
  return <div className="archive"><div className="archive-head"><div><span className="eyebrow">THE WORLD RECORD</span><h2>{labels[collection]}</h2><p>{collection==='events'?'Record what happened and how it changed the world.':`Explore records as of Year ${year}.`}</p></div><button className="btn gold" onClick={()=>make(collection)}>+ {collection==='events'?'New event':'New record'}</button></div>
  <div className="archive-filter"><input aria-label="Search records" value={q} onChange={e=>search(e.target.value)} placeholder="Search the archive…"/>{collection!=='events'&&<label><input type="checkbox" checked={all} onChange={e=>setAll(e.target.checked)}/> Include other dates</label>}</div>
  <div className="record-grid">{filtered.map(e=><button key={e.id} className={'record '+(selected?.id===e.id?'active':'')} onClick={()=>setSelected({collection,id:e.id})}><span className="record-dot" style={{background:e.color||undefined}}/><span><strong>{itemName(e,world)}</strong><small>{collection==='events'?`Year ${e.year} · ${e.category||'Custom'}`:e.type||e.class||e.government||(e.alive===false?'Deceased':'World record')}</small></span><span className="arrow">›</span></button>)}
  {!filtered.length&&<div className="empty">No matching records. Create one to add it to the world.</div>}</div></div>
}
function EntityEditor({collection,item,world,year,applyChange,baseEdit,remove,selectRecord}){
  const [draft,setDraft]=useState({})
  const [notice,setNotice]=useState('')
  const change=(key,value)=>{setDraft(p=>({...p,[key]:value}));setNotice('')}
  const pending=Object.keys(draft).filter(k=>draft[k]!==item[k])
  function save(dated){
    const patch=Object.fromEntries(pending.map(k=>[k,draft[k]]))
    if('name' in patch&&!patch.name.trim()){setNotice('Give this record a name.');return}
    if((Object.hasOwn(patch,'sourceId')||Object.hasOwn(patch,'targetId'))&&((patch.sourceId??item.sourceId)===(patch.targetId??item.targetId)||!(patch.sourceId??item.sourceId)||!(patch.targetId??item.targetId))){setNotice('Choose two different records.');return}
    if('strength' in patch && patch.strength!=null && (patch.strength<-100||patch.strength>100)){setNotice('Strength must be between −100 and 100.');return}
    if(dated) applyChange(collection,item.id,patch)
    else baseEdit(collection,item.id,patch)
    setDraft({});setNotice(dated?`Recorded in Year ${year}.`:'Baseline updated.')
  }
  const linked=world.events.filter(e=>(e.relatedCharacters??[]).includes(item.id)||(e.relatedLocations??[]).includes(item.id)||(e.relatedKingdoms??[]).includes(item.id)||(e.relatedArmies??[]).includes(item.id)||e.changes.some(c=>c.id===item.id&&c.collection===collection)).sort((a,b)=>a.year-b.year)
  return <><span className="eyebrow">{labels[collection]}</span><h2>{itemName(item,world)}</h2>{collection==='characters'&&item.age!=null&&<div className="status-chip">{item.alive===false?'Deceased':'Age '+item.age}</div>}
    {fieldKeys(collection).map(([key,label,type])=><Field key={key} world={world} {...{label,type}} value={Object.hasOwn(draft,key)?draft[key]:item[key]} onChange={v=>change(key,v)}/>)}
    {notice&&<p role="status" className="inspector-note">{notice}</p>}
    <div className="inspect-actions"><button className="btn gold" disabled={!pending.length} onClick={()=>save(true)}>Record at Year {year}</button><button className="btn" disabled={!pending.length} onClick={()=>save(false)}>Edit baseline</button></div>
    <p className="inspector-note">A dated change preserves earlier history. Baseline edits can affect every date.</p>
    {linked.length>0&&<section className="linked"><h3>Linked history</h3>{linked.map(e=><button className="link" key={e.id} onClick={()=>selectRecord({collection:'events',id:e.id})}>{e.year} · {e.title}</button>)}</section>}
    <button className="danger link" onClick={()=>remove(collection,item.id)}>Delete record</button></>
}
function EventEditor({item,world,baseEdit,remove,setYear}){
  const [draft,setDraft]=useState(item)
  const [warn,setWarn]=useState([])
  const set=(k,v)=>{setDraft(p=>({...p,[k]:v}));setWarn([])}
  const edits=draft.changes??[]
  const changeAt=(idx,newValue)=>set('changes',edits.map((v,i)=>i===idx?{...v,...newValue}:v))
  const cleared=edits.filter(x=>x.id&&Object.keys(x.patch).length)
  function save(force=false){
    const event={...draft,changes:cleared}
    const warnings=checkEvent(world,event)
    if (!event.title?.trim() || !Number.isFinite(event.year) || !Number.isSafeInteger(event.order??0)) {setWarn(warnings.length?warnings:['Supply a valid title, year and order.']);return}
    if(warnings.length&&!force){setWarn(warnings);return}
    baseEdit('events',item.id,event);setWarn([])
  }
  return <><span className="eyebrow">TIMELINE ENTRY</span><h2>{item.title}</h2>
  {[[ 'title','Title'],['year','Year','number'],['order','Same-year order','number'],['category','Category'],['description','Description','textarea']].map(([key,label,type])=><Field key={key} world={world} {...{label,type}} value={draft[key]} onChange={v=>set(key,v)}/>)}
  <h3>Linked records</h3>
  {[[ 'relatedCharacters','characters'],['relatedLocations','locations'],['relatedKingdoms','kingdoms'],['relatedArmies','armies']].filter(([,c])=>world.entities[c].length).map(([key,c])=><label className="field" key={key}><span>{labels[c]} (select one or more)</span><select multiple size={3} value={draft[key]??[]} onChange={e=>set(key,[...e.target.selectedOptions].map(o=>o.value))}>{world.entities[c].map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>)}
  <h3>State changes</h3>
  {edits.map((chg,i)=>{
    const patch=chg.patch??{}, fs=editable(chg.collection), first=Object.keys(patch).filter(k=>fs.some(([f])=>f===k))
    return <section key={i} className="change-card"><Field world={world} label="Record type" type={collections} value={chg.collection} onChange={v=>changeAt(i,{collection:v,id:'',patch:{}})}/><label className="field"><span>Record</span><select value={chg.id} onChange={e=>changeAt(i,{id:e.target.value})}><option value="">Choose a record</option>{world.entities[chg.collection]?.map(v=><option key={v.id} value={v.id}>{nameOf(v)}</option>)}</select></label>
    {first.map(key=>{const [,label,type]=fs.find(([f])=>f===key);return <Field key={key} world={world} {...{label,type}} value={patch[key]} onChange={v=>changeAt(i,{patch:{...patch,[key]:v}})}/>})}
    <label className="field"><span>Add a change</span><select value="" onChange={e=>{if(e.target.value)changeAt(i,{patch:{...patch,[e.target.value]:''}})}}><option value="">Select field</option>{fs.filter(([k])=>!Object.hasOwn(patch,k)).map(([k,l])=><option key={k} value={k}>{l}</option>)}</select></label>
    {Object.keys(patch).length>first.length&&<small>Additional stored map or system changes are preserved.</small>}
    <button className="link danger" onClick={()=>set('changes',edits.filter((_,n)=>n!==i))}>Remove state change</button></section>
  })}
  <button className="btn" onClick={()=>set('changes',[...edits,{collection:'kingdoms',id:'',patch:{}}])}>+ Add state change</button>
  {!!warn.length&&<div role="alert" className="warning">{warn.map((x,i)=><p key={i}>{x}</p>)}</div>}
  <div className="inspect-actions"><button className="btn gold" onClick={()=>save()}>Save event</button>{!!warn.length&&<button className="btn" onClick={()=>save(true)}>Save despite warnings</button>}<button className="btn" onClick={()=>setYear(item.year)}>Jump to Year {item.year}</button></div><button className="danger link" onClick={()=>remove('events',item.id)}>Delete event</button></>
}
export function Inspector({selected,world,snapshot,year,applyChange,baseEdit,remove,setYear,clear,selectRecord}){
  const c=selected?.collection
  const item=c==='events'?world.events.find(x=>x.id===selected.id):c?(snapshot.entities[c]?.find(x=>x.id===selected.id)??world.entities[c]?.find(x=>x.id===selected.id)):null
  return <aside className="inspector"><div className="inspector-head"><span>INSPECTOR</span>{item&&<button className="icon" onClick={clear} aria-label="Clear selection">×</button>}</div><div className="inspector-body">{!item?<div className="inspector-empty"><span className="crest small">✦</span><h2>Nothing selected</h2><p>Choose a map feature, character, or event to inspect its history.</p></div>:c==='events'?<EventEditor key={item.id+':'+JSON.stringify(item)} {...{item,world,baseEdit,remove,setYear}}/>:<EntityEditor key={item.id+':'+year} collection={c} {...{item,world,year,applyChange,baseEdit,remove,selectRecord}}/>}</div></aside>
}
