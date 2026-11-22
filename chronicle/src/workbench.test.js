import {test} from 'node:test'
import assert from 'node:assert/strict'
import {build} from 'esbuild'
import {JSDOM} from 'jsdom'
import 'fake-indexeddb/auto'
const delay=(ms)=>new Promise(resolve=>setTimeout(resolve,ms))
async function eventually(fn,message){for(let i=0;i<80;i++){const out=fn();if(out)return out;await delay(15)}assert.fail(message)}
test('workbench shares the year between the map and graph, and reopens a saved edit',async()=>{
 const d=new JSDOM('<div id="root"></div>',{url:'https://chronicle.test',pretendToBeVisual:true})
 const {window}=d
 for(const k of ['window','document','localStorage','HTMLElement','SVGElement','Event','MouseEvent','FileReader'])globalThis[k]=k==='window'?window:window[k]
 globalThis.confirm=()=>true
 const out=await build({entryPoints:['src/main.jsx'],bundle:true,format:'iife',logLevel:'silent',write:false,loader:{'.css':'empty'},define:{'process.env.NODE_ENV':'"production"'}})
 const app=out.outputFiles[0].text
 const mount=()=>Function(app)()
 const button=(t)=>[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===t)
 const nav=(t)=>[...document.querySelectorAll('nav button')].find(b=>b.textContent.includes(t))
 const mapTitle=(t)=>[...document.querySelectorAll('svg polygon title')].some(x=>x.textContent===t)
 mount()
 await eventually(()=>mapTitle('Ashgate Pass · Valoria'),'Year 100 map did not load')
 const at105=[...document.querySelectorAll('.event-pill')].find(b=>b.querySelector('b')?.textContent==='105')
 assert.ok(at105);at105.click()
 await eventually(()=>mapTitle('Ashgate Pass · Draken'),'Territory did not change with the year')
 nav('Relationship Web').click()
 await eventually(()=>document.querySelector('.cg')?.textContent.includes('Distrust'),'Graph did not show the same year')
 nav('Cities & Locations').click()
 await eventually(()=>button('+ New record'),'Archive creation control did not appear')
 button('+ New record').click()
 await eventually(()=>document.querySelector('.inspector h2')?.textContent==='New location','Creation did not show in the inspector')
 await eventually(()=>document.body.textContent.includes('Saved on this device'),'Autosave did not finish')
 document.body.innerHTML='<div id="root"></div>'
 mount()
 await eventually(()=>mapTitle('Ashgate Pass · Draken'),'Saved historical year did not load')
 nav('Cities & Locations').click()
 await eventually(()=>[...document.querySelectorAll('.record')].some(x=>x.textContent.includes('New location')),'Created location did not survive reload')
 d.window.close()
})
