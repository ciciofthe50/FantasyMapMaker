import React,{useCallback,useEffect,useMemo,useRef,useState} from 'react'
import{createRoot}from'react-dom/client'
import{collections,demoWorld,makeWorld,projectWorld,uid}from'./engine.js'
import{downloadBackup,initialWorkspace,openBackup,readWorkspace,writeWorkspace}from'./persistence.js'
import{Archive,Inspector,createEntity,labels}from'./Editor.jsx'
import Map from'./Map.jsx'
import Graph from'./Graph.jsx'
import './style.css'
const sections=[['overview','World Overview','✦'],['map','Map Editor','◇'],['kingdoms','Kingdoms & Factions','⚑'],['characters','Characters','♙'],['graph','Relationship Web','◎'],['armies','Armies & Warfare','⚔'],['locations','Cities & Locations','⌂'],['territories','Territories','⬡'],['events','Events & Lore','◷'],['diplomacy','Diplomacy','◈'],['settings','World Settings','⚙']]
const trimYear=(v)=>Math.round(v*1e6)/1e6
const sortEvents=(w)=>[...w.events].sort((a,b)=>a.year-b.year||a.order-b.order||a.id.localeCompare(b.id))
function App(){
 const [data,setData]=useState(null)
 const [loadError,setLoadError]=useState('')
 const [view,setView]=useState('map')
 const [selection,setSelection]=useState(null)
 const [mobilePanel,setMobilePanel]=useState('map')
 const [save,setSave]=useState('Loading…')
 const [notice,tell]=useState('')
 const [timeline,setTimeline]=useState(true)
 const [playing,play]=useState(false)
 const [speed,setSpeed]=useState(1)
 const [past,setPast]=useState([])
 const [future,setFuture]=useState([])
 const file=useRef(null)
 const ready=useRef(false)
 const saveSeq=useRef(0)
 useEffect(()=>{let ignore=false;readWorkspace().then(s=>{if(!ignore){ready.current=true;setData(s?.worlds?.length?s:initialWorkspace())}}).catch(()=>{if(!ignore){setLoadError('Browser storage is unavailable. Export your projects before closing.');setData(initialWorkspace())}});return()=>{ignore=true}},[])
 useEffect(()=>{
   if(!data||!ready.current)return
   const seq=++saveSeq.current
   setSave('Saving…')
   // Queue immediately: a debounce can lose the last edit on reload.
   writeWorkspace(data).then(()=>{if(seq===saveSeq.current)setSave('Saved on this device')}).catch(()=>{if(seq===saveSeq.current)setSave('Save failed · export a backup')})
 },[data])
 useEffect(()=>{if(!notice)return;const id=setTimeout(()=>tell(''),4200);return()=>clearTimeout(id)},[notice])
 const world=data?.worlds.find(x=>x.id===data.active)??data?.worlds[0]
 const year=data?.year??100
 const snapshot=useMemo(()=>world?projectWorld(world,year):null,[world,year])
 const events=useMemo(()=>world?sortEvents(world):[],[world])
 const min=Math.floor(Math.min(year,events[0]?.year??year)-5)
 const max=Math.ceil(Math.max(year,events.at(-1)?.year??year)+5)
 const setYear=useCallback(v=>{if(v!==''&&Number.isFinite(Number(v))&&Math.abs(Number(v))<1e9)setData(d=>({...d,year:trimYear(Number(v))}))},[])
 function changeView(x){setView(x);setMobilePanel('map')}
 function setSelected(x){setSelection(x);if(x)setMobilePanel('inspector')}
 function commit(fn){
   const next=fn(world)
   if(next===world)return
   setPast(prev=>[...prev.slice(-79),world]);setFuture([])
   setData(d=>({...d,worlds:d.worlds.map(w=>w.id===world.id?next:w)}))
 }
 function replaceDuringHistory(next){setData(d=>({...d,worlds:d.worlds.map(w=>w.id===world.id?next:w)}));setSelection(null)}
 function undo(){if(!past.length)return;replaceDuringHistory(past.at(-1));setPast(past.slice(0,-1));setFuture([world,...future]);tell('Undid last edit.')}
 function redo(){if(!future.length)return;replaceDuringHistory(future[0]);setFuture(future.slice(1));setPast([...past,world]);tell('Restored edit.')}
 useEffect(()=>{
   if(!world)return
   const onKey=e=>{if(!(e.ctrlKey||e.metaKey)||e.altKey||e.target?.closest('input,textarea,select,[contenteditable]'))return;const k=e.key.toLowerCase();if(k==='z'||k==='y'){e.preventDefault();k==='y'||e.shiftKey?redo():undo()}}
   window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey)
 },[world,past,future])
 useEffect(()=>{
   if(!playing||!data)return
   const timer=setInterval(()=>setData(d=>{
     const next=events.find(e=>e.year>d.year)
     if(!next){play(false);return d}
     return {...d,year:next.year}
   }),1100/speed)
   return()=>clearInterval(timer)
 },[playing,speed,events,!!data])
 function switchWorld(id){const target=data.worlds.find(x=>x.id===id);setData(d=>({...d,active:id,year:target.events.length?Math.min(...target.events.map(e=>e.year)):100}));setSelection(null);setPast([]);setFuture([]);play(false)}
 function addWorld(demo=false){
   const name=demo?null:window.prompt('Name the new world','Untitled world')
   if(!demo&&!name?.trim())return
   const w=demo?demoWorld():makeWorld(name)
   setData(d=>({worlds:[...d.worlds,w],active:w.id,year:100}));setSelection(null);setPast([]);setFuture([]);changeView('map');tell(demo?'Editable demo added.':'World created.')
 }
 async function importFile(e){
   const f=e.target.files?.[0];e.target.value='';if(!f)return
   try{if(f.size>40*1024*1024)throw Error('Backups must be smaller than 40 MB.')
     const w=openBackup(await f.text());w.id=uid()
     setData(d=>({worlds:[...d.worlds,w],active:w.id,year:w.events.length?Math.min(...w.events.map(e=>e.year)):100}));setSelection(null);setPast([]);setFuture([]);changeView('map');tell('Imported '+w.name+' as a separate world.')
   }catch(e){tell('Import failed: '+e.message)}
 }
 function make(collection){
   if(collection==='events'){
     const e={id:uid(),title:'New event',year,order:nextOrder(world,year),category:'Custom',description:'',changes:[]}
     commit(w=>({...w,events:[...w.events,e]}));setSelected({collection,id:e.id});return
   }
   const item=createEntity(collection,world,year);if(!item){tell('Create two records first to connect them.');return}
   commit(w=>({...w,entities:{...w.entities,[collection]:[...w.entities[collection],item]}}));setSelected({collection,id:item.id})
 }
 const nextOrder=(w,y)=>Math.max(0,...w.events.filter(e=>e.year===y).map(e=>e.order??0))+1
 function applyChange(collection,id,patch){
   if(!Object.keys(patch).length)return
   commit(w=>{
     const name=w.entities[collection].find(e=>e.id===id)?.name??collection
     const e={id:uid(),title:name+' updated',year,order:nextOrder(w,year),category:labels[collection]||'Custom',description:'',changes:[{collection,id,patch}]}
     return {...w,events:[...w.events,e]}
   })
 }
 function baseEdit(collection,id,patch){
   commit(w=>collection==='events'?{...w,events:w.events.map(x=>x.id===id?{...x,...patch}:x)}:{...w,entities:{...w.entities,[collection]:w.entities[collection].map(x=>x.id===id?{...x,...patch}:x)}})
 }
 function remove(collection,id){
   if(collection==='events'){
     if(!confirm('Delete this event? Later historical views will recalculate.'))return
     commit(w=>({...w,events:w.events.filter(e=>e.id!==id)}));setSelection(null);return
   }
   const referencesIds=(obj)=>Object.entries(obj).some(([k,v])=>k!=='id'&&(v===id||Array.isArray(v)&&v.includes(id)))
   const impacted=world.events.some(e=>e.changes.some(c=>c.id===id||referencesIds(c.patch))||referencesIds(e))
    ||collections.some(c=>world.entities[c].some(x=>x.id!==id&&referencesIds(x)))
   if(impacted){tell('This record is referenced. End it at a date, or unlink those entries before deleting.');return}
   if(!confirm('Delete this record from all dates?'))return
   commit(w=>({...w,entities:{...w.entities,[collection]:w.entities[collection].filter(x=>x.id!==id)}}));setSelection(null)
 }
 function deleteWorld(){
   if(!confirm(`Delete ${world.name} from this browser? Export a backup first if you want to keep it.`))return
   const remaining=data.worlds.filter(w=>w.id!==world.id);if(!remaining.length)remaining.push(makeWorld())
   setData({worlds:remaining,active:remaining[0].id,year:remaining[0].events[0]?.year??100});setSelection(null);setPast([]);setFuture([]);tell('World removed.')
 }
 if(!world)return <div className="loading">✦ Opening the Chronicle…</div>
 const graphProps={world,snapshot,year,selected:selection,setSelected,commit,applyChange}
 const title=sections.find(x=>x[0]===view)?.[1]??'World Map'
 const prev=events.filter(x=>x.year<year).at(-1),next=events.find(x=>x.year>year)
 const dateLabel=world.era?year+' '+world.era:'Year '+year
 return <div className={'app '+(world.theme==='light'?'light':'')+' mobile-'+mobilePanel}>
 <header className="topbar"><div className="brand"><span className="crest">✦</span><div><strong>CHRONICLE</strong><small>FANTASY MAP MAKER</small></div></div>
 <div className="world-picker"><label className="sr-only" htmlFor="world-select">Current world</label><select id="world-select" value={world.id} onChange={e=>switchWorld(e.target.value)}>{data.worlds.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}</select><button className="icon" title="Create world" aria-label="Create world" onClick={()=>addWorld()}>+</button></div>
 <span className="save-state" role="status"><span/> {loadError?'Storage unavailable':save}</span>
 <div className="top-actions"><button className="icon" onClick={undo} title="Undo" aria-label="Undo" disabled={!past.length}>↶</button><button className="icon" onClick={redo} title="Redo" aria-label="Redo" disabled={!future.length}>↷</button><button className="btn" onClick={()=>file.current.click()}>Import</button><button className="btn gold" onClick={()=>{downloadBackup(world);tell('Exported world backup.')}}>Export world</button></div>
 <input ref={file} type="file" accept=".json,application/json" hidden onChange={importFile}/></header>
 <div className="mobile-controls"><select aria-label="Workspace" value={view} onChange={e=>changeView(e.target.value)}>{sections.map(([id,text])=><option key={id} value={id}>{text}</option>)}</select><button className="btn" onClick={()=>setMobilePanel(mobilePanel==='inspector'?'map':'inspector')}>{mobilePanel==='inspector'?'Workspace':'Inspector'}</button></div>
 <div className="workbench"><nav className="sidebar"><span className="eyebrow">WORLD WORKSPACES</span>{sections.map(([id,text,icon])=><button key={id} className={view===id?'active':''} aria-current={view===id?'page':undefined} onClick={()=>changeView(id)}><span>{icon}</span>{text}</button>)}<div className="sidebar-footer"><span className="eyebrow">LOCAL ATLAS</span><span>Keep the past. Shape the world.</span></div></nav>
 <main className="workspace"><div className="workspace-head"><div><span className="eyebrow">WORLD ARCHIVE / {world.name}</span><h1>{title}</h1></div><span className="date-badge"><b>◷</b> {dateLabel}</span></div>
 {loadError&&<div className="warning">{loadError}</div>}
 {view==='map'?<Map key={world.id} {...graphProps}/>:view==='graph'||view==='diplomacy'?<Graph key={world.id+view} {...graphProps} mode={view==='diplomacy'?'diplomacy':'characters'}/>:view==='overview'?<div className="overview"><span className="eyebrow">THE STORY SO FAR</span><h2>{world.name}</h2><p>Explore the world as it stood in {dateLabel}. Move the timeline to see the same records evolve across every workspace.</p><div className="overview-cards">{['kingdoms','characters','locations','armies','territories','events'].map(c=><button key={c} className="record" onClick={()=>changeView(c)}><strong>{c==='events'?events.length:snapshot.entities[c].length}</strong><span>{labels[c]}</span><span>›</span></button>)}</div><button className="btn gold" onClick={()=>changeView('map')}>Open the atlas →</button></div>:view==='settings'?<div className="settings"><h2>World preferences</h2><label className="field"><span>World name</span><input key={world.id+world.name} defaultValue={world.name} onBlur={e=>{const name=e.target.value.trim();if(name&&name!==world.name)commit(w=>({...w,name}));else e.target.value=world.name}} onKeyDown={e=>e.key==='Enter'&&e.target.blur()}/></label><label className="field"><span>Calendar era label</span><input key={world.id+(world.era??'')} defaultValue={world.era??''} placeholder="E.E." onBlur={e=>{const era=e.target.value.trim();if(era!==(world.era??''))commit(w=>({...w,era}))}} onKeyDown={e=>e.key==='Enter'&&e.target.blur()}/></label><label className="field"><span>Theme</span><select value={world.theme??'dark'} onChange={e=>commit(w=>({...w,theme:e.target.value}))}><option value="dark">Midnight atlas</option><option value="light">Parchment</option></select></label><div className="inspect-actions"><button className="btn" onClick={()=>addWorld(true)}>Add a fresh demo</button><button className="btn danger" onClick={deleteWorld}>Delete this world</button></div><p>Worlds stay on this device. Export a JSON backup to move your work to another browser.</p><a href="./legacy/index.html">Open the original Fantasy Map Maker</a></div>:<Archive key={view} collection={view} {...{world,snapshot,year,setSelected,make}} selected={selection}/>}
 </main>
 <Inspector selected={selection} {...{world,snapshot,year,applyChange,baseEdit,remove,setYear}} clear={()=>setSelected(null)} selectRecord={setSelected}/></div>
 <section className={'timeline '+(!timeline?'collapsed':'')}><header className="timeline-head"><button className="icon" aria-label={timeline?'Collapse timeline':'Expand timeline'} onClick={()=>setTimeline(!timeline)}>{timeline?'⌄':'⌃'}</button><strong>Historical Timeline</strong><span>{dateLabel}</span><div className="timeline-spacer"/><button className="btn" onClick={()=>{setTimeline(true);make('events')}}>+ Event</button></header>
 {timeline&&<div className="timeline-body"><div className="timeline-controls"><button className="icon" aria-label="Previous event" disabled={!prev} onClick={()=>setYear(prev.year)}>⏮</button><button className="icon" aria-label={playing?'Pause timeline':'Play timeline'} onClick={()=>{if(!playing&&!next&&events.length)setYear(events[0].year);play(!playing)}}>{playing?'Ⅱ':'▶'}</button><button className="icon" aria-label="Next event" disabled={!next} onClick={()=>setYear(next.year)}>⏭</button><select aria-label="Playback speed" value={speed} onChange={e=>setSpeed(+e.target.value)}><option value=".5">0.5×</option><option value="1">1×</option><option value="2">2×</option></select><input aria-label="Selected year" type="number" step="any" key={year} defaultValue={year} onBlur={e=>{if(e.target.value==='')e.target.value=year;else setYear(e.target.value)}} onKeyDown={e=>e.key==='Enter'&&e.target.blur()}/></div><div className="timeline-rail"><input aria-label="Scrub historical timeline" type="range" min={min} max={max} step="0.001" value={year} onChange={e=>setYear(e.target.value)}/><div className="timeline-events">{events.map(e=><button key={e.id} className={e.year===year?'event-pill active':'event-pill'} onClick={()=>{setYear(e.year);setSelected({collection:'events',id:e.id})}} title={e.title}><b>{e.year}</b> {e.title}</button>)}{!events.length&&<span className="no-events">No historical events yet.</span>}</div></div></div>}</section>
 {notice&&<div className="toast" role="status">{notice}</div>}</div>
}
createRoot(document.getElementById('root')).render(<App/>)
