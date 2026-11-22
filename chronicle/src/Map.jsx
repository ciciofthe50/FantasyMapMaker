import React, { useEffect, useId, useRef, useState } from 'react'
import { uid } from './engine.js'
import './Map.css'

const WIDTH = 1000
const HEIGHT = 620
const tools = [
  ['select', '↖', 'Select'], ['pan', '✥', 'Pan'], ['brush', '✎', 'Paint terrain'], ['erase', '◐', 'Erase terrain'],
  ['territory', '⬡', 'Draw border'], ['location', '✧', 'Place location'], ['army', '⚑', 'Place army'],
]
const layersDefault = { terrain: true, borders: true, locations: true, armies: true, background: true }
const modes = {
  Geographical: { ...layersDefault, borders: false, armies: false },
  Political: { ...layersDefault, armies: false },
  Military: layersDefault,
  Historical: layersDefault,
}
const terrainTypes = {
  Land: '#d3b989', Grasslands: '#81916c', Plains: '#c4b279', Forests: '#5d7758', Mountains: '#827862',
  Hills: '#ae9870', Deserts: '#d9b276', Swamps: '#7e8261', Snowfields: '#ece4ce', Tundra: '#a4a99c',
  Rivers: '#6b9c9f', Lakes: '#88aaaa', Oceans: '#98b6b0', Roads: '#805b40', Bridges: '#614632',
}
const landPath = 'M122 170 139 153 169 156 190 129 226 129 246 112 270 115 284 96 321 91 337 116 367 106 397 72 425 80 444 100 469 94 494 126 531 128 553 148 588 139 610 153 655 135 682 150 713 132 744 148 771 181 781 205 813 204 837 233 866 235 869 263 894 287 867 308 875 337 841 366 815 362 806 387 778 387 758 418 729 414 706 449 679 447 661 481 636 472 608 503 572 509 543 482 505 490 478 473 453 488 429 474 421 452 392 436 359 448 340 422 321 414 301 391 270 398 247 378 248 344 221 334 194 341 173 310 147 301 157 282 132 274 135 258 109 243 125 220 101 208 118 190Z'
const islandPath = 'M777 486 794 469 832 481 844 499 817 524 787 518 773 502Z M855 450 883 441 905 456 899 476 878 483 857 467Z M112 350 131 339 154 349 167 372 151 388 130 386 109 370Z M164 444 177 433 199 448 198 464 175 470 160 457Z M698 547 720 529 741 529 754 545 744 560 716 562Z'
const mountainSpots = [[305,158],[327,146],[352,154],[378,139],[403,152],[429,164],[456,168],[475,183],[499,189],[521,203],[548,215],[572,225],[595,232],[616,222],[639,212],[664,200],[692,200],[712,188],[298,312],[310,331],[330,344],[346,360],[358,380],[527,351],[544,365],[558,381],[574,397]]
const forestSpots = [[213,195],[232,201],[250,211],[271,216],[238,227],[261,234],[286,238],[250,253],[164,246],[179,258],[187,273],[629,300],[646,309],[669,308],[681,326],[648,330],[624,337],[664,350],[690,346],[696,363],[770,274],[782,290],[807,291],[804,310],[766,309],[468,399],[493,414],[480,435],[505,431]]
const hillSpots = [[371,211],[399,219],[424,233],[452,247],[476,241],[511,257],[546,271],[600,273],[359,269],[327,269],[735,269],[710,286],[783,350],[736,372],[607,432],[630,453],[408,350],[425,382],[325,394]]
const figure = {
  Capital: '✦', City: '◆', Town: '▪', Village: '•', Castle: '♜',
  Fortress: '♜', Port: '⚓', Temple: '✧', Ruins: '⌂', Battlefield: '⚔', Landmark: '✧',
}
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y)
const clampPoint = p => ({ x: Math.min(WIDTH, Math.max(0, p.x)), y: Math.min(HEIGHT, Math.max(0, p.y)) })
const safeImage = value => typeof value === 'string' && /^data:image\/(png|jpeg|svg\+xml);base64,/i.test(value)
const pathData = points => points.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ')

function SampleArt({ prefix }) {
  return <g aria-hidden="true" pointerEvents="none">
    <path d={landPath} fill="#7f9a86" stroke="#6b887a" strokeWidth="9" opacity=".21" />
    <path d={islandPath} fill="none" stroke="#6b887a" strokeWidth="8" opacity=".18" />
    <path d={landPath} fill={`url(#${prefix}-paper)`} stroke="#6a715a" strokeWidth="2.8" />
    <path d={islandPath} fill={`url(#${prefix}-paper)`} stroke="#6a715a" strokeWidth="2.5" />
    <g clipPath={`url(#${prefix}-coast)`}>
      <path d="M110 266Q216 204 297 240T469 260T660 214T893 271 M185 320Q284 281 363 329T580 329T860 308 M253 369Q337 343 421 391T657 395T816 393" fill="none" stroke="#988661" opacity=".24" strokeWidth="1" strokeDasharray="2 6"/>
      <path d="M329 163q19 42 37 57t4 34q-17 22 1 42t-18 32q-21 7-53 26M537 209q-8 22 2 39t-3 33q-31 29-14 44t10 47q-32 24-5 58t-5 49M688 210q-11 12-8 30t25 22q36 9 33 31t30 25q35 14 54 41" fill="none" stroke="#739994" strokeWidth="2.7" strokeLinecap="round"/>
      <path d="M545 349Q565 358 568 374Q553 389 539 378Q534 363 545 349Z" fill="#7d9c8f"/>
      <g opacity=".70" fill="#a58f68" stroke="#796a50" strokeWidth="1.05" strokeLinejoin="round">
        {mountainSpots.map(([x,y],i) => <path key={i} d={`M${x-14} ${y+7}l10 -14 7 9 5 -6 10 11z M${x-10} ${y+2}l6 -3 3 4 3 -3`} />)}
      </g>
      <g opacity=".60" fill="none" stroke="#657854" strokeWidth="1.4" strokeLinecap="round">
        {forestSpots.map(([x,y], i) => <path key={i} d={`M${x-5} ${y+4}l5 -9 5 9z m5 0v4 m5 -3l4 -7 4 7z m4 0v3`}/>)}
      </g>
      <g opacity=".53" fill="none" stroke="#9e825d" strokeWidth="1.25" strokeLinecap="round">
        {hillSpots.map(([x,y], i) => <path key={i} d={`M${x-7} ${y+4}q6 -9 12 -1m0 0q4 -5 8 0`}/>)}
      </g>
    </g>
    <g fill="#597d78" opacity=".85" fontFamily="Georgia, serif" fontStyle="italic" fontSize="14" letterSpacing="3">
      <text x="103" y="129">The Gloaming Sea</text>
      <text x="634" y="574">S a p p h i r e   S t r a i t</text>
    </g>
  </g>
}

export default function MapEditor({ world, snapshot, year, selected, setSelected, commit, applyChange }) {
  const prefix = `map-${useId().replace(/[^\w-]/g, '')}`
  const data = snapshot?.entities ?? snapshot ?? world.entities
  const [tool, setTool] = useState('select')
  const [terrain, setTerrain] = useState('Land')
  const [size, setSize] = useState(22)
  const [mode, setMode] = useState('Historical')
  const [layers, setLayers] = useState(layersDefault)
  const [view, setView] = useState({ x: 0, y: 0, z: 1 })
  const [polygon, setPolygon] = useState([])
  const [draft, setDraft] = useState(null)
  const [hint, setHint] = useState('')
  const svgRef = useRef(null), graphicRef = useRef(null), gesture = useRef(null)
  const fileInput = useRef(null)
  const currentSelection = selected?.collection === 'territories' ? data.territories.find(t => t.id === selected.id) : null

  function chooseTool(value) {
    if (value !== 'territory') setPolygon([])
    setTool(value)
    setHint('')
  }

  useEffect(() => {
    const key = e => {
      if (e.key === 'Escape') { setPolygon([]); setHint(''); gesture.current = null; setDraft(null) }
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [])

  useEffect(() => {
    setView({ x: 0, y: 0, z: 1 })
    setHint('')
  }, [world.id])
  useEffect(() => {
    setPolygon([])
    setDraft(null)
    gesture.current = null
  }, [world.id, year])

  function chooseMode(value) { setMode(value); setLayers(modes[value]) }

  function svgPoint(e, layer = graphicRef.current) {
    const node = layer?.getScreenCTM()
    if (!node) return { x: 0, y: 0 }
    const point = new DOMPoint(e.clientX, e.clientY).matrixTransform(node.inverse())
    return { x: point.x, y: point.y }
  }

  function zoom(scale, point = { x: WIDTH / 2, y: HEIGHT / 2 }) {
    setView(v => {
      const z = Math.max(.15, Math.min(32, v.z * scale))
      return { z, x: point.x - (point.x - v.x) * z / v.z, y: point.y - (point.y - v.y) * z / v.z }
    })
  }
  useEffect(() => {
    const node = svgRef.current
    if (!node) return
    const wheel = event => { event.preventDefault(); zoom(event.deltaY < 0 ? 1.14 : 1 / 1.14, svgPoint(event, node)) }
    node.addEventListener('wheel', wheel, { passive: false })
    return () => node.removeEventListener('wheel', wheel)
  }, [])

  function create(collection, values) {
    const entity = { id: uid(), from: Number(year), ...values }
    commit(w => ({ ...w, entities: { ...w.entities, [collection]: [...w.entities[collection], entity] } }))
    setSelected({ collection, id: entity.id })
  }
  function finishBorder() {
    if (polygon.length < 3) { setHint('A border needs at least three points.'); return }
    create('territories', { name: 'New territory', ownerId: '', points: polygon, description: '' })
    setPolygon([]); setTool('select'); setHint('Border created. Assign its owner in the inspector.')
  }
  function addAt(toolName, point) {
    if (toolName === 'location') create('locations', { name: 'New settlement', type: 'Town', kingdomId: '', population: 0, description: '', ...point })
    else create('armies', { name: 'New army', type: 'Army', kingdomId: '', commanderId: '', troops: 0, description: '', ...point })
    setTool('select')
  }
  function pointerDown(e) {
    if (e.button !== 0 && e.button !== 1) return
    const point = clampPoint(svgPoint(e))
    if (tool === 'territory' && e.button === 0) {
      if (polygon.length >= 3 && distance(point, polygon[0]) < Math.max(5, 13 / view.z)) finishBorder()
      else setPolygon(p => [...p, point])
      return
    }
    if ((tool === 'location' || tool === 'army') && e.button === 0) { addAt(tool, point); return }
    if (tool === 'select' && e.button === 0) { setSelected(null); return }
    if (tool === 'pan' || e.button === 1) gesture.current = { kind: 'pan', start: svgPoint(e, svgRef.current), view }
    else gesture.current = { kind: tool, points: [point], id: uid(), terrain, size: Number(size), year: Number(year) }
    if (['brush', 'erase'].includes(gesture.current.kind)) setDraft({ ...gesture.current, terrain: tool === 'erase' ? 'Oceans' : terrain })
    svgRef.current.setPointerCapture(e.pointerId)
  }
  function pointerMove(e) {
    const current = gesture.current
    if (!current) return
    if (current.kind === 'pan') {
      const p = svgPoint(e, svgRef.current)
      setView({ ...current.view, x: current.view.x + p.x - current.start.x, y: current.view.y + p.y - current.start.y })
      return
    }
    const p = clampPoint(svgPoint(e))
    if (current.kind === 'brush' || current.kind === 'erase') {
      if (distance(p, current.points.at(-1)) > Math.max(.7, 2 / view.z)) current.points.push(p)
      setDraft({ ...current, terrain: current.kind === 'erase' ? 'Oceans' : current.terrain, points: [...current.points] })
      return
    }
    if (current.kind === 'marker' || current.kind === 'vertex') {
      if (distance(p, current.start) > 2 / view.z) current.moved = true
      if (current.moved) { current.point = p; setDraft({ ...current }) }
    }
  }
  function endPointer(e) {
    const current = gesture.current
    gesture.current = null; setDraft(null)
    if (!current) return
    if (svgRef.current?.hasPointerCapture(e.pointerId)) svgRef.current.releasePointerCapture(e.pointerId)
    if (e.type === 'pointercancel') return
    if (current.kind === 'brush' || current.kind === 'erase') {
      const { id, terrain, size, year, points } = current
      const stroke = { id, terrain: current.kind === 'erase' ? 'Oceans' : terrain, size, year, points }
      commit(w => ({ ...w, strokes: [...(w.strokes || []), stroke] }))
    } else if (current.kind === 'marker' && current.moved) {
      const { x, y } = current.point
      applyChange(current.collection, current.id, { x, y })
    } else if (current.kind === 'vertex' && current.moved) {
      const points = current.points.map((p, i) => i === current.index ? current.point : p)
      applyChange('territories', current.id, { points })
    }
  }

  function startMarker(e, collection, entity) {
    if (tool !== 'select' || e.button !== 0) return
    e.stopPropagation(); setSelected({ collection, id: entity.id })
    if (collection === 'territories') return
    gesture.current = { kind: 'marker', collection, id: entity.id, start: clampPoint(svgPoint(e)) }
    svgRef.current.setPointerCapture(e.pointerId)
  }
  function startVertex(e, entity, index) {
    if (tool !== 'select' || e.button !== 0) return
    e.stopPropagation()
    gesture.current = { kind: 'vertex', id: entity.id, index, points: entity.points, start: clampPoint(svgPoint(e)) }
    svgRef.current.setPointerCapture(e.pointerId)
  }
  function redrawMap(file) {
    if (!file) return
    if (!/\.(png|jpeg|jpg|svg)$/i.test(file.name) || file.size > 8 * 1024 * 1024) {
      setHint('Choose a PNG, JPEG, or SVG image under 8 MB.'); return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const src = reader.result
      if (!safeImage(src)) {
        setHint('This file could not be loaded as a supported image.'); return
      }
      commit(w => ({ ...w, background: { src, opacity: .7 } }))
      setLayers(l => ({ ...l, background: true })); setHint('Reference image imported.')
    }
    reader.onerror = () => setHint('The reference image could not be read.')
    reader.readAsDataURL(file)
  }
  function exportSVG() {
    const copy = svgRef.current.cloneNode(true)
    copy.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
    copy.setAttribute('width', String(WIDTH)); copy.setAttribute('height', String(HEIGHT))
    copy.querySelector('[data-map-view]')?.removeAttribute('transform')
    copy.querySelectorAll('[data-map-ui]').forEach(node => node.remove())
    const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(copy)], { type: 'image/svg+xml' }))
    const link = document.createElement('a')
    link.href = url; link.download = `${world.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'world'}-${year}.svg`
    link.click(); setTimeout(() => URL.revokeObjectURL(url), 500)
  }

  function renderStroke(s) {
    if (!Array.isArray(s.points) || !s.points.length || !s.points.every(p => Number.isFinite(p?.x) && Number.isFinite(p?.y))) return null
    const width = ['Roads', 'Bridges', 'Rivers'].includes(s.terrain) ? Math.max(2, s.size / 4) : s.size
    const color = terrainTypes[s.terrain] || terrainTypes.Land
    return s.points.length === 1
      ? <circle key={s.id} cx={s.points[0].x} cy={s.points[0].y} r={width/2} fill={color} />
      : <path key={s.id} d={pathData(s.points)} fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round"/>
  }

  function renderMarker(entity, collection) {
    const isArmy = collection === 'armies'
    const active = selected?.id === entity.id && selected?.collection === collection
    const position = draft?.kind === 'marker' && draft.id === entity.id ? draft.point : entity
    if (!Number.isFinite(position?.x) || !Number.isFinite(position?.y)) return null
    const faction = data.kingdoms.find(k => k.id === entity.kingdomId)
    return <g key={entity.id} className={tool === 'select' ? 'chronicle-map-marker' : ''} style={tool !== 'select' ? { pointerEvents: 'none' } : undefined}
      transform={`translate(${position.x},${position.y})`} onPointerDown={e => startMarker(e, collection, entity)}
      role={tool === 'select' ? 'button' : undefined} tabIndex={tool === 'select' ? 0 : undefined} aria-label={`Select ${entity.name}`}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelected({ collection, id: entity.id }) } }}>
      {active && <circle r="18" fill="none" stroke="#fff0be" strokeWidth="2" strokeDasharray="2 3" data-map-ui="true"/>}
      {isArmy ? <path d="M0 -13 12 -3 10 10 0 16 -10 10 -12 -3Z" fill={faction?.color || '#763d3b'} stroke="#fff2c7" strokeWidth="1.3"/>
        : <circle r={entity.type === 'Capital' ? 12 : 10} fill="#3e372c" stroke="#fff2c7" strokeWidth="1.5" />}
      <text textAnchor="middle" y="4" fill="#fff3d1" fontFamily="Georgia, serif" fontWeight="bold" fontSize="14" pointerEvents="none">{isArmy ? '⚑' : figure[entity.type] || '◆'}</text>
      <text textAnchor="middle" y={isArmy ? 30 : 24} fill="#3f362b" stroke="#ebdfba" strokeWidth="3.6" strokeLinejoin="round" paintOrder="stroke" fontFamily="Georgia, serif" fontWeight="bold" fontSize="13" pointerEvents="none">{entity.name}</text>
      <title>{faction ? `${entity.name} · ${faction.name}` : entity.name}</title>
    </g>
  }

  return <div className="chronicle-map">
    <div className="chronicle-map-top">
      <div className="chronicle-map-mode">
        {Object.keys(modes).map(item => <button type="button" key={item} onClick={() => chooseMode(item)} aria-pressed={item === mode}>{item}</button>)}
      </div>
      <details className="chronicle-map-layers">
        <summary>▱ Layers</summary>
        <div>
          {Object.keys(layers).map(key => <label key={key}><input type="checkbox" checked={layers[key]} onChange={e => setLayers(l => ({ ...l, [key]: e.target.checked }))} />{key}</label>)}
          <button type="button" onClick={() => fileInput.current?.click()}>Import image</button>
          {safeImage(world.background?.src) && <><label className="chronicle-map-opacity">Opacity<input type="range" aria-label="Background opacity" min="0" max="1" step=".05" value={world.background.opacity} onChange={e => commit(w => ({ ...w, background: { ...w.background, opacity: Number(e.target.value) } }))} /></label><button type="button" onClick={() => commit(w => ({ ...w, background: null }))}>Remove image</button></>}
          <button type="button" onClick={exportSVG}>Export map as SVG</button>
        </div>
      </details>
      <input ref={fileInput} type="file" hidden accept=".png,.jpg,.jpeg,.svg" onChange={e => { redrawMap(e.target.files?.[0]); e.target.value = '' }} />
    </div>
    <div className="chronicle-map-frame">
      <svg ref={svgRef} viewBox="0 0 1000 620" className={`chronicle-map-svg chronicle-map-${tool}`} aria-label="Interactive world map"
        onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={endPointer} onPointerCancel={endPointer} onLostPointerCapture={e => { if (gesture.current) endPointer({ type: 'pointercancel', pointerId: e.pointerId }) }}>
        <defs>
          <linearGradient id={`${prefix}-sea`} x2="0" y2="1">
            <stop stopColor="#c4cdaf"/><stop offset="1" stopColor="#a1b9aa"/>
          </linearGradient>
          <linearGradient id={`${prefix}-paper`} x2=".8" y2="1">
            <stop stopColor="#f0dfab"/><stop offset="1" stopColor="#c6ad7b"/>
          </linearGradient>
          <pattern id={`${prefix}-grid`} width="29" height="29" patternUnits="userSpaceOnUse"><path d="M0 29V0H29" fill="none" stroke="#566b5f" strokeWidth=".55" opacity=".25"/></pattern>
          <pattern id={`${prefix}-dispute`} width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(35)"><path d="M0 0V9" stroke="#3e3529" strokeOpacity=".54" strokeWidth="3"/></pattern>
          <clipPath id={`${prefix}-coast`}><path d={landPath}/></clipPath>
          <clipPath id={`${prefix}-frame`}><rect width={WIDTH} height={HEIGHT}/></clipPath>
          <filter id={`${prefix}-grain`}><feTurbulence type="fractalNoise" baseFrequency=".52" numOctaves="2" stitchTiles="stitch"/></filter>
        </defs>
        <rect width={WIDTH} height={HEIGHT} fill={`url(#${prefix}-sea)`} />
        <g clipPath={`url(#${prefix}-frame)`}>
          <g ref={graphicRef} data-map-view="true" transform={`translate(${view.x} ${view.y}) scale(${view.z})`}>
            <rect width={WIDTH} height={HEIGHT} fill={`url(#${prefix}-grid)`} />
            {layers.terrain && world.mapStyle === 'demo' && <SampleArt prefix={prefix}/>}
            {layers.background && safeImage(world.background?.src) && <image href={world.background.src} width={WIDTH} height={HEIGHT} opacity={world.background.opacity} pointerEvents="none"/>}
            <g pointerEvents="none">
              {(world.legacyStrokes || []).filter(s => typeof s.path === 'string' && (s.kind === 'border' ? layers.borders : layers.terrain)).map(s =>
                <path key={s.id} d={s.path} transform={s.scaleY===620/680?"scale(1 "+s.scaleY+")":undefined} fill={s.kind === 'land' ? `url(#${prefix}-paper)` : 'none'} stroke={s.kind === 'land' ? '#716b52' : s.kind === 'river' ? '#4f858b' : '#855344'} strokeWidth={s.kind === 'land' ? 2 : 2.5} strokeLinecap="round" strokeLinejoin="round"/>)}
              {layers.terrain && (world.strokes || []).filter(s => (s.year ?? -Infinity) <= year && (s.to == null || year < s.to)).sort((a, b) => (a.year ?? 0) - (b.year ?? 0)).map(renderStroke)}
              {layers.terrain && (draft?.kind === 'brush' || draft?.kind === 'erase') && renderStroke(draft)}
            </g>
            {layers.borders && data.territories.map(entity => {
              const active = selected?.id === entity.id && selected?.collection === 'territories'
              const kingdom = data.kingdoms.find(k => k.id === entity.ownerId)
              const color = kingdom?.color || '#756c5a'
              const points = draft?.kind === 'vertex' && draft.id === entity.id ? entity.points.map((p,i) => i === draft.index ? draft.point : p) : entity.points
              if (!points?.length) return null
              const line = points.map(p => `${p.x},${p.y}`).join(' ')
              return <g key={entity.id}>
                <polygon points={line} data-owner={kingdom?.name || 'Unclaimed'} fill={color} fillOpacity={active ? '.37' : '.23'} stroke={color} strokeWidth={active ? '3' : '2.2'} strokeLinejoin="round" strokeDasharray={(entity.disputed || entity.status==='Disputed') ? '5 4' : undefined}
                  onPointerDown={e => startMarker(e, 'territories', entity)} style={{ cursor: tool === 'select' ? 'pointer' : undefined, pointerEvents: tool === 'select' ? 'auto' : 'none' }}
                  role={tool === 'select' ? 'button' : undefined} tabIndex={tool === 'select' ? 0 : undefined} aria-label={`Select ${entity.name}`}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelected({ collection: 'territories', id: entity.id }) } }}>
                  <title>{`${entity.name} · ${kingdom?.name || 'Unclaimed'}`}</title>
                </polygon>
                {(entity.disputed || entity.status==='Disputed') && <polygon points={line} fill={`url(#${prefix}-dispute)`} opacity=".35" pointerEvents="none"/>}
                <text x={points.reduce((sum,p) => sum+p.x, 0)/points.length} y={points.reduce((sum,p) => sum+p.y, 0)/points.length-17} textAnchor="middle" pointerEvents="none" fill={color} stroke="#eddeb3" strokeWidth="2" paintOrder="stroke" fontFamily="Georgia, serif" fontSize="13" letterSpacing="1.4">{entity.name.toUpperCase()}</text>
              </g>
            })}
            {mode === 'Military' && layers.armies && <g pointerEvents="none">
              {data.armies.map(army => {
                const base = world.entities.armies.find(a => a.id === army.id)
                const positions = Number.isFinite(base?.x) && Number.isFinite(base?.y) ? [{ x: base.x, y: base.y }] : []
                const events = world.events.filter(e => e.year <= year).sort((a, b) => a.year - b.year || a.order - b.order || a.id.localeCompare(b.id))
                for (const event of events) for (const change of event.changes || []) {
                  if (change.collection !== 'armies' || change.id !== army.id) continue
                  const prior = positions.at(-1), nextX = change.patch.x ?? prior?.x, nextY = change.patch.y ?? prior?.y
                  if (Number.isFinite(nextX) && Number.isFinite(nextY) && (!prior || nextX !== prior.x || nextY !== prior.y)) positions.push({ x: nextX, y: nextY })
                }
                if (positions.length < 2) return null
                const color = data.kingdoms.find(k => k.id === army.kingdomId)?.color || '#763d3b'
                return <path key={army.id} d={pathData(positions)} fill="none" stroke={color} strokeWidth="2.6" strokeDasharray="6 5" strokeLinecap="round"><title>{`${army.name} · Recorded movement`}</title></path>
              })}
            </g>}
            {layers.locations && data.locations.map(e => renderMarker(e, 'locations'))}
            {layers.armies && data.armies.map(e => renderMarker(e, 'armies'))}
            {tool === 'select' && layers.borders && currentSelection?.points?.map((p, i) => {
              const position = draft?.kind === 'vertex' && draft.id === currentSelection.id && draft.index === i ? draft.point : p
              return <circle key={i} cx={position.x} cy={position.y} r={5/view.z} fill="#fff1c8" stroke="#69533c" strokeWidth={1.2/view.z} onPointerDown={e => startVertex(e, currentSelection, i)} className="chronicle-map-marker" data-map-ui="true"/>
            })}
            {polygon.length > 0 && <g data-map-ui="true" pointerEvents="none">
              <polyline points={polygon.map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke="#392b35" strokeDasharray="7 5" strokeWidth="2"/>
              {polygon.map((p,i) => <circle key={i} cx={p.x} cy={p.y} r={(i === 0 ? 8 : 4)/view.z} fill={i === 0 ? '#edbb61' : '#fff2ce'} stroke="#493b32" strokeWidth={1.25/view.z}/>)}
            </g>}
          </g>
        </g>
        <rect width={WIDTH} height={HEIGHT} filter={`url(#${prefix}-grain)`} opacity=".11" style={{ mixBlendMode: 'multiply' }} pointerEvents="none"/>
        <g transform="translate(931 87)" pointerEvents="none" fill="#3c5b52" opacity=".85" aria-hidden="true">
          <circle r="25" fill="#d9d4b3" fillOpacity=".7" stroke="#3c5b52" strokeWidth=".8"/>
          <path d="M0-21 5-4 21 0 5 4 0 21-5 4-21 0-5-4Z" fill="none" stroke="#3c5b52"/>
          <path d="M0-21 5-4 0 0-5-4Z"/>
          <text y="-32" textAnchor="middle" fontSize="11" fontWeight="bold" fontFamily="Georgia, serif">N</text>
        </g>
      </svg>
      <div className="chronicle-map-tools" role="toolbar" aria-label="Map editing tools">
        {tools.map(([key,icon,label]) => <button type="button" key={key} onClick={() => chooseTool(key)} aria-pressed={tool === key} aria-label={label} title={label}>{icon}</button>)}
      </div>
      <div className="chronicle-map-zoom" role="toolbar" aria-label="Map zoom">
        <button type="button" aria-label="Zoom in" title="Zoom in" onClick={() => zoom(1.25)}>+</button>
        <button type="button" aria-label="Reset map view" title="Reset map view" onClick={() => setView({ x: 0, y: 0, z: 1 })}>{Math.round(view.z * 100)}%</button>
        <button type="button" aria-label="Zoom out" title="Zoom out" onClick={() => zoom(.8)}>−</button>
      </div>
      <div className="chronicle-map-action">
        {tool === 'brush' && <label>Terrain <select aria-label="Terrain type" value={terrain} onChange={e => setTerrain(e.target.value)}>{Object.keys(terrainTypes).map(t => <option key={t}>{t}</option>)}</select></label>}
        {(tool === 'brush' || tool === 'erase') && <label>Size <input type="range" min="4" max="100" aria-label="Brush size" value={size} onChange={e => setSize(e.target.value)} /></label>}
        {tool === 'territory' && <><span>Click to add points</span><button type="button" disabled={polygon.length < 3} onClick={finishBorder}>Finish border</button><button type="button" disabled={!polygon.length} onClick={() => setPolygon(p => p.slice(0, -1))}>Undo point</button></>}
        {tool === 'location' && <span>Click the map to place a town</span>}
        {tool === 'army' && <span>Click the map to place an army</span>}
        {tool === 'erase' && <span>Brush ocean over terrain from this year onward</span>}
        {hint && <span role="status">{hint}</span>}
      </div>
    </div>
  </div>
}
