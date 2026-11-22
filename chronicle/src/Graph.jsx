import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { uid } from './engine.js';
import './Graph.css';

const WIDTH = 1000;
const HEIGHT = 600;
const RADIUS = 38;
const characterTypes = ['Friendship', 'Best friends', 'Rivalry', 'Hatred', 'Romance', 'Marriage', 'Family', 'Parent / Child', 'Siblings', 'Mentor / Student', 'Commander / Subordinate', 'Political alliance', 'Betrayal', 'Loyalty', 'Distrust', 'Neutral'];
const diplomaticTypes = ['Allied', 'Friendly', 'Neutral', 'Hostile', 'At war', 'Vassal', 'Tributary', 'Occupied', 'Trade partner', 'Non-aggression pact'];
const typeColors = {
  friend: '#88c495', friendship: '#88c495', 'best friends': '#88c495', friendly: '#88c495', enemy: '#e38986', enemies: '#e38986', hatred: '#e38986', hostile: '#e38986', 'at war': '#e38986',
  romance: '#df92bb', marriage: '#df92bb', family: '#89b8db', 'parent / child': '#89b8db', siblings: '#89b8db',
  'political alliance': '#e2bb75', alliance: '#e2bb75', allied: '#e2bb75', loyalty: '#e2bb75', vassal: '#e2bb75',
  rivalry: '#b49bdd', betrayal: '#db9a70', distrust: '#db9a70', neutral: '#afb5b4', 'trade partner': '#86c7c1', 'non-aggression pact': '#86c7c1',
};
const fallbacks = ['#cba873', '#92bad0', '#aeba8a', '#d8a0ba', '#baaae0'];
const keyOf = value => String(value || '').trim().toLowerCase();
function edgeColor(type) {
  const key = keyOf(type);
  if (Object.hasOwn(typeColors, key)) return typeColors[key];
  let number = 0;
  for (const char of key) number = (number + char.codePointAt(0)) % fallbacks.length;
  return fallbacks[number];
}
function initialPositions(nodes, groups = false) {
  const output = Object.create(null);
  let order = nodes;
  if (groups) order = [...nodes].sort((a, b) => String(a.kingdomId || '').localeCompare(String(b.kingdomId || '')) || a.name.localeCompare(b.name));
  const ringCount = Math.ceil(order.length / 9);
  order.forEach(({ id }, index) => {
    const ring = Math.floor(index / 9);
    const slot = index % 9;
    const count = Math.min(9, order.length - ring * 9);
    const angle = -Math.PI / 2 + (Math.PI * 2 * slot / count) + ring * .24;
    const radius = ringCount <= 1 ? 1 : 1 + ring * .48;
    output[id] = order.length === 1
      ? { x: WIDTH / 2, y: HEIGHT / 2 }
      : { x: WIDTH / 2 + Math.cos(angle) * Math.min(360, (155 + count * 20)) * radius, y: HEIGHT / 2 + Math.sin(angle) * Math.min(236, (119 + count * 12)) * radius };
  });
  return output;
}
function tidyPositions(nodes, edges) {
  if (nodes.length > 80) return initialPositions(nodes, true);
  const output = initialPositions(nodes, true);
  const alive = new Set(nodes.map(node => node.id));
  const visible = edges.filter(edge => alive.has(edge.sourceId) && alive.has(edge.targetId));
  for (let step = 0; step < 60; step++) {
    const forces = Object.fromEntries(nodes.map(node => [node.id, { x: 0, y: 0 }]));
    for (let a = 0; a < nodes.length; a++) {
      for (let b = a + 1; b < nodes.length; b++) {
        const aId = nodes[a].id;
        const bId = nodes[b].id;
        const dx = output[aId].x - output[bId].x || .5;
        const dy = output[aId].y - output[bId].y || .5;
        const distance = Math.max(8, Math.hypot(dx, dy));
        const force = Math.min(23, 160000 / distance ** 2);
        forces[aId].x += force * dx / distance;
        forces[aId].y += force * dy / distance;
        forces[bId].x -= force * dx / distance;
        forces[bId].y -= force * dy / distance;
      }
    }
    for (const edge of visible) {
      const a = output[edge.sourceId], b = output[edge.targetId];
      const dx = b.x - a.x, dy = b.y - a.y, distance = Math.max(1, Math.hypot(dx, dy));
      const force = (distance - 182) * .014;
      forces[edge.sourceId].x += dx * force / distance;
      forces[edge.sourceId].y += dy * force / distance;
      forces[edge.targetId].x -= dx * force / distance;
      forces[edge.targetId].y -= dy * force / distance;
    }
    for (const node of nodes) {
      const n = output[node.id], f = forces[node.id];
      n.x += (f.x + (WIDTH / 2 - n.x) * .014) * (1 - step / 70);
      n.y += (f.y + (HEIGHT / 2 - n.y) * .014) * (1 - step / 70);
    }
  }
  return output;
}
function edgePath(a, b, offset) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const length = Math.max(1, Math.hypot(dx, dy));
  const ux = dx / length, uy = dy / length;
  const cx = (a.x + b.x) / 2 - uy * offset;
  const cy = (a.y + b.y) / 2 + ux * offset;
  const sr = RADIUS + 4;
  const tr = RADIUS + 13;
  const sx = a.x + ux * Math.min(sr, length / 3);
  const sy = a.y + uy * Math.min(sr, length / 3);
  const ex = b.x - ux * Math.min(tr, length / 3);
  const ey = b.y - uy * Math.min(tr, length / 3);
  const labelX = (sx + ex) / 4 + cx / 2;
  const labelY = (sy + ey) / 4 + cy / 2 - 6;
  return { path: `M${sx} ${sy} Q${cx} ${cy} ${ex} ${ey}`, labelX, labelY };
}
function initials(name) {
  return name.trim().split(/\s+/).slice(0, 2).map(word => Array.from(word)[0] || '').join('').toUpperCase();
}
function safePortrait(value) {
  return typeof value === 'string' && /^data:image\/(png|jpeg|webp|gif);base64,/i.test(value) ? value : null;
}
function safeColor(value) {
  return typeof value === 'string' && /^#[0-9a-f]{3,8}$/i.test(value) ? value : '#b5a47f';
}
function short(value, length) {
  return String(value || '').length > length ? String(value).slice(0, length - 1) + '…' : String(value || '');
}

export function Graph({ world, snapshot, year, selected, setSelected, commit, mode = 'characters' }) {
  const diplomacy = mode === 'diplomacy';
  const nodeCollection = diplomacy ? 'kingdoms' : 'characters';
  const edgeCollection = diplomacy ? 'diplomacy' : 'relationships';
  const types = diplomacy ? diplomaticTypes : characterTypes;
  const active = snapshot.entities[nodeCollection] || [];
  const stableNodes = world.entities[nodeCollection] || [];
  const edges = snapshot.entities[edgeCollection] || [];
  const kingdoms = snapshot.entities.kingdoms || [];
  const byKingdom = new Map(kingdoms.map(k => [k.id, k]));
  const [filter, setFilter] = useState({ query: '', kingdom: '', class: '', type: '', deceased: false, network: 'all' });
  const [camera, setCamera] = useState({ x: 0, y: 0, scale: 1 });
  const [form, setForm] = useState(null);
  const [linkSource, setLinkSource] = useState(null);
  const [creating, setCreating] = useState(false);
  const [editingLegend, setEditingLegend] = useState(false);
  const [drag, setDrag] = useState(null);
  const [error, setError] = useState('');
  const surface = useRef(null);
  const gesture = useRef(null);
  const unique = useId().replace(/[^a-z\d_-]/gi, '');
  const base = useMemo(() => initialPositions(stableNodes), [stableNodes]);
  const placed = world.graphLayouts?.[nodeCollection] || {};
  const position = id => {
    const saved = Object.hasOwn(placed, id) ? placed[id] : null;
    return (drag?.id === id ? drag : null) || (Number.isFinite(saved?.x) && Number.isFinite(saved?.y) ? saved : null) || base[id] || { x: WIDTH / 2, y: HEIGHT / 2 };
  };

  const classChoices = [...new Set(active.map(node => node.class).filter(Boolean))].sort();
  const typeChoices = [...new Set(edges.map(edge => edge.type).filter(Boolean))].sort();
  const legend = world.graphLegend?.[edgeCollection] || {};
  const relationshipColor = type => {
    const key = keyOf(type);
    return Object.hasOwn(legend, key) && /^#[0-9a-f]{6}$/i.test(legend[key]) ? legend[key] : edgeColor(type);
  };
  function changeLegend(type, color) {
    const key = keyOf(type);
    if (!key || ['__proto__', 'prototype', 'constructor'].includes(key)) return;
    commit(previous => {
      const working = { ...previous.graphLegend?.[edgeCollection] };
      if (color) working[key] = color;
      else delete working[key];
      return { ...previous, graphLegend: { ...previous.graphLegend, [edgeCollection]: working } };
    });
  }
  const actual = active.filter(node => {
    if (!diplomacy && node.alive === false && !filter.deceased) return false;
    if (!diplomacy && filter.kingdom && node.kingdomId !== filter.kingdom) return false;
    if (!diplomacy && filter.class && node.class !== filter.class) return false;
    const searchable = [node.name, node.class, byKingdom.get(node.kingdomId)?.name].filter(Boolean).join(' ').toLowerCase();
    return !filter.query || searchable.includes(filter.query.trim().toLowerCase());
  });
  const visibleIds = new Set(actual.map(node => node.id));
  const eligibleEdges = edges.filter(edge => visibleIds.has(edge.sourceId) && visibleIds.has(edge.targetId) && (!filter.type || edge.type === filter.type));
  const focusId = selected?.collection === nodeCollection ? selected.id : null;
  let network = null;
  if (filter.network !== 'all' && visibleIds.has(focusId)) {
    const adjacency = new Map();
    for (const edge of eligibleEdges) {
      if (!adjacency.has(edge.sourceId)) adjacency.set(edge.sourceId, []);
      if (!adjacency.has(edge.targetId)) adjacency.set(edge.targetId, []);
      adjacency.get(edge.sourceId).push(edge.targetId);
      adjacency.get(edge.targetId).push(edge.sourceId);
    }
    network = new Set([focusId]);
    const pending = [focusId];
    for (let index = 0; index < pending.length; index++) {
      for (const other of adjacency.get(pending[index]) || []) {
        if (!network.has(other)) { network.add(other); pending.push(other); }
      }
      if (filter.network === 'direct') break;
    }
  }
  const visibleEdges = network ? eligibleEdges.filter(e => network.has(e.sourceId) && network.has(e.targetId)) : eligibleEdges;
  const byId = new Map(active.map(node => [node.id, node]));
  const makePairKey = (source, target) => JSON.stringify([source, target]);
  const edgeGroups = new Map();
  for (const edge of visibleEdges) {
    const key = makePairKey(edge.sourceId, edge.targetId);
    if (!edgeGroups.has(key)) edgeGroups.set(key, []);
    edgeGroups.get(key).push(edge.id);
  }
  const classes = name => ({ value: filter[name], onChange: event => setFilter(previous => ({ ...previous, [name]: event.target.value })) });
  const newForm = (sourceId = '', targetId = '') => ({ sourceId, targetId, type: diplomacy ? 'Allied' : 'Friendship', strength: 50, description: '' });

  function idleConnect() {
    setCreating(false); setLinkSource(null);
  }
  function selectNode(id) {
    if (creating) {
      if (!linkSource) setLinkSource(id);
      else if (linkSource !== id) {
        setForm(newForm(linkSource, id));
        idleConnect();
      }
      return;
    }
    setSelected({ collection: nodeCollection, id });
  }
  function coords(event) {
    const inverse = surface.current?.getScreenCTM()?.inverse();
    return inverse ? new DOMPoint(event.clientX, event.clientY).matrixTransform(inverse) : { x: 0, y: 0 };
  }
  function begin(event, id) {
    if (event.button !== 0 || !surface.current) return;
    event.stopPropagation();
    const point = coords(event);
    const current = id ? position(id) : camera;
    gesture.current = { id, x: point.x, y: point.y, startX: current.x, startY: current.y, moved: false };
    surface.current.setPointerCapture(event.pointerId);
  }
  function move(event) {
    const current = gesture.current;
    if (!current) return;
    const point = coords(event);
    const dx = point.x - current.x, dy = point.y - current.y;
    if (Math.hypot(dx, dy) > 4) current.moved = true;
    if (!current.moved) return;
    if (current.id) {
      if (creating) return;
      current.next = { id: current.id, x: current.startX + dx / camera.scale, y: current.startY + dy / camera.scale };
      setDrag(current.next);
    } else setCamera(previous => ({ ...previous, x: current.startX + dx, y: current.startY + dy }));
  }
  function storeLayout(layout) {
    commit(previous => ({
      ...previous,
      graphLayouts: { ...previous.graphLayouts, [nodeCollection]: layout },
    }));
  }
  function finish(event) {
    const current = gesture.current;
    if (!current) return;
    gesture.current = null;
    if (surface.current?.hasPointerCapture(event.pointerId)) surface.current.releasePointerCapture(event.pointerId);
    setDrag(null);
    if (event.type === 'pointercancel') return;
    if (current.id && current.next) {
      const { id, x, y } = current.next;
      storeLayout({ ...placed, [id]: { x: Math.round(x), y: Math.round(y) } });
    } else if (current.id) selectNode(current.id);
    else if (!current.moved && !creating) setSelected(null);
  }
  function zoom(ratio, anchor = { x: WIDTH / 2, y: HEIGHT / 2 }) {
    setCamera(previous => {
      const scale = Math.min(5, Math.max(.25, previous.scale * ratio));
      const actualRatio = scale / previous.scale;
      return { scale, x: anchor.x - (anchor.x - previous.x) * actualRatio, y: anchor.y - (anchor.y - previous.y) * actualRatio };
    });
  }
  useEffect(() => {
    const element = surface.current;
    if (!element) return;
    const onWheel = event => {
      event.preventDefault();
      zoom(event.deltaY < 0 ? 1.12 : 1 / 1.12, coords(event));
    };
    element.addEventListener('wheel', onWheel, { passive: false });
    return () => element.removeEventListener('wheel', onWheel);
  }, []);
  function fitGraph() {
    if (!actual.length) { setCamera({ x: 0, y: 0, scale: 1 }); return; }
    const points = actual.map(node => position(node.id));
    const minX = Math.min(...points.map(point => point.x));
    const maxX = Math.max(...points.map(point => point.x));
    const minY = Math.min(...points.map(point => point.y));
    const maxY = Math.max(...points.map(point => point.y));
    const scale = Math.max(.25, Math.min(1, (WIDTH - 200) / Math.max(1, maxX - minX), (HEIGHT - 200) / Math.max(1, maxY - minY)));
    setCamera({ scale, x: WIDTH / 2 - (minX + maxX) * scale / 2, y: HEIGHT / 2 - (minY + maxY) * scale / 2 });
  }
  function createEdge(event) {
    event.preventDefault();
    const type = form.type.trim();
    const activeIds = new Set(active.map(node => node.id));
    if (!type || ['__proto__', 'prototype', 'constructor'].includes(keyOf(type)) || !activeIds.has(form.sourceId) || !activeIds.has(form.targetId) || form.sourceId === form.targetId) {
      setError('Choose two different active nodes and enter a valid connection type.');
      return;
    }
    if (edges.some(edge => edge.sourceId === form.sourceId && edge.targetId === form.targetId && keyOf(edge.type) === keyOf(type))) {
      setError('That directed link is already active at this date.');
      return;
    }
    const id = uid();
    const edge = { id, sourceId: form.sourceId, targetId: form.targetId, name: type, type, description: form.description.trim(), strength: Number(form.strength), from: year };
    commit(previous => ({ ...previous, entities: { ...previous.entities, [edgeCollection]: [...(previous.entities[edgeCollection] || []), edge] } }));
    setSelected({ collection: edgeCollection, id });
    setForm(null);
    setError('');
  }
  const updateForm = (key, value) => setForm(previous => ({ ...previous, [key]: value }));

  return (
    <section className="cg" aria-label={diplomacy ? 'Diplomacy graph' : 'Relationship graph'}>
      <div className="cg-controls">
        <input aria-label="Search graph" placeholder={diplomacy ? 'Search realms…' : 'Find a character…'} type="search" {...classes('query')} />
        {!diplomacy && <select aria-label="Filter kingdom" {...classes('kingdom')}><option value="">All realms</option>{kingdoms.map(kingdom => <option key={kingdom.id} value={kingdom.id}>{kingdom.name}</option>)}</select>}
        {!diplomacy && <select aria-label="Filter class" {...classes('class')}><option value="">All classes</option>{classChoices.map(item => <option key={item}>{item}</option>)}</select>}
        <select aria-label="Filter relationship" {...classes('type')}><option value="">All links</option>{typeChoices.map(item => <option key={item}>{item}</option>)}</select>
        <select aria-label="Highlight connections" {...classes('network')}><option value="all">Full network</option><option value="direct">Direct links</option><option value="extended">Extended links</option></select>
        {!diplomacy && <label className="cg-check"><input type="checkbox" checked={filter.deceased} onChange={event => setFilter(previous => ({ ...previous, deceased: event.target.checked }))} /> Show deceased</label>}
      </div>
      <div className="cg-toolbar">
        <div><button type="button" disabled={active.length < 2} onClick={() => { setError(''); setForm(newForm(focusId || '')); }}>＋ New {diplomacy ? 'treaty' : 'relationship'}</button>
          <button type="button" disabled={active.length < 2} aria-pressed={creating} onClick={() => { setForm(null); setLinkSource(null); setCreating(value => !value); }}>Connect nodes</button></div>
        <div><button type="button" disabled={!stableNodes.length} onClick={() => storeLayout(initialPositions(stableNodes, true))}>Group by realm</button>
          <button type="button" disabled={!stableNodes.length} onClick={() => storeLayout(tidyPositions(stableNodes, edges))}>Auto arrange</button></div>
      </div>
      {creating && <div className="cg-callout" role="status">{linkSource ? 'Select the target node.' : 'Select the source node.'}<button type="button" onClick={idleConnect}>Cancel</button></div>}
      {form && <form className="cg-form" onSubmit={createEdge}>
        <label>From<select value={form.sourceId} required onChange={event => updateForm('sourceId', event.target.value)}><option value="">Select source</option>{active.map(node => <option key={node.id} value={node.id}>{node.name}</option>)}</select></label>
        <label>To<select value={form.targetId} required onChange={event => updateForm('targetId', event.target.value)}><option value="">Select target</option>{active.map(node => <option key={node.id} value={node.id}>{node.name}</option>)}</select></label>
        <label>Type<input list={`cg-types-${unique}`} maxLength={50} value={form.type} required onChange={event => updateForm('type', event.target.value)} />
          <datalist id={`cg-types-${unique}`}>{types.map(type => <option key={type} value={type} />)}</datalist></label>
        <label>Strength<input type="number" required min="-100" max="100" value={form.strength} onChange={event => updateForm('strength', event.target.value)} /></label>
        <label className="cg-description">Description <input value={form.description} onChange={event => updateForm('description', event.target.value)} /></label>
        <div className="cg-form-actions"><span>Starts in Year {year}</span><button type="submit">Save link</button><button type="button" onClick={() => { setForm(null); setError(''); }}>Cancel</button></div>
        {error && <p role="alert">{error}</p>}
      </form>}
      <div className="cg-frame">
        <svg ref={surface} className="cg-surface" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} aria-label="Interactive node canvas"
          onPointerDown={event => begin(event, null)} onPointerMove={move} onPointerUp={finish} onPointerCancel={finish}>
          <defs>
            <pattern id={`cg-stars-${unique}`} width="22" height="22" patternUnits="userSpaceOnUse"><circle cx="3" cy="3" r="1" fill="#dbc393" opacity=".19" /></pattern>
            <radialGradient id={`cg-shade-${unique}`}><stop offset="0%" stopColor="#28312d" /><stop offset="100%" stopColor="#151e1c" /></radialGradient>
            {visibleEdges.map((edge, index) => <marker key={edge.id} id={`cg-arrow-${unique}-${index}`} markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0L8 4L0 8z" fill={relationshipColor(edge.type)} /></marker>)}
            <clipPath id={`cg-portrait-${unique}`}><circle r={RADIUS - 5} /></clipPath>
          </defs>
          <rect width={WIDTH} height={HEIGHT} fill={`url(#cg-shade-${unique})`} /><rect width={WIDTH} height={HEIGHT} fill={`url(#cg-stars-${unique})`} />
          <g transform={`translate(${camera.x}, ${camera.y}) scale(${camera.scale})`}>
            {visibleEdges.map((edge, index) => {
              const peer = edgeGroups.has(makePairKey(edge.targetId, edge.sourceId));
              const parallel = edgeGroups.get(makePairKey(edge.sourceId, edge.targetId));
              const offset = (peer ? 27 : 0) + (parallel.indexOf(edge.id) - (parallel.length - 1) / 2) * 28;
              const { path, labelX, labelY } = edgePath(position(edge.sourceId), position(edge.targetId), offset);
              const title = edge.type || edge.name || 'Connection';
              const lineColor = relationshipColor(title);
              const isSelected = selected?.collection === edgeCollection && selected.id === edge.id;
              const activate = () => setSelected({ collection: edgeCollection, id: edge.id });
              return <g key={edge.id} role="button" tabIndex={0} aria-label={`${byId.get(edge.sourceId)?.name} to ${byId.get(edge.targetId)?.name}: ${title}`}
                className={`cg-edge ${isSelected ? 'cg-edge-selected' : ''}`} onPointerDown={event => event.stopPropagation()} onClick={activate}
                onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); activate(); } }}>
                <title>{[title, edge.strength != null ? ` (${edge.strength})` : '', edge.description ? ` · ${edge.description}` : ''].join('')}</title>
                <path d={path} stroke="transparent" strokeWidth="16" fill="none" />
                <path d={path} stroke={lineColor} strokeWidth={isSelected ? 4 : 2} fill="none" markerEnd={`url(#cg-arrow-${unique}-${index})`} />
                <text x={labelX} y={labelY} className="cg-edge-label" fill={lineColor}>{short(title, 24)}</text>
              </g>;
            })}
            {actual.map(node => {
              const here = position(node.id);
              const k = diplomacy ? node : byKingdom.get(node.kingdomId);
              const color = safeColor(k?.color || k?.primaryColor);
              const image = safePortrait(diplomacy ? node.banner || node.flag : node.portrait);
              const isSelected = focusId === node.id || linkSource === node.id;
              return <g key={node.id} className={`cg-node ${isSelected ? 'cg-node-selected' : ''} ${node.alive === false ? 'cg-node-deceased' : ''} ${network && !network.has(node.id) ? 'cg-node-muted' : ''}`}
                role="button" tabIndex={0} aria-label={node.name} aria-pressed={Boolean(isSelected)} transform={`translate(${here.x},${here.y})`} onPointerDown={event => begin(event, node.id)}
                onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); selectNode(node.id); } }}>
                <title>{[node.name, node.class, node.alive === false ? 'Deceased' : null, !diplomacy ? k?.name : null].filter(Boolean).join(' · ')}</title>
                <circle r={RADIUS + 6} className="cg-node-halo" stroke={color} />
                <circle r={RADIUS} className="cg-node-disc" stroke={color} />
                {image ? <image href={image} x={-RADIUS + 5} y={-RADIUS + 5} width={2 * RADIUS - 10} height={2 * RADIUS - 10} preserveAspectRatio="xMidYMid slice" clipPath={`url(#cg-portrait-${unique})`} />
                  : <text className="cg-monogram" y="9">{initials(node.name)}</text>}
                <text y={RADIUS + 22} className="cg-node-name">{short(node.name, 23)}</text>
                {(!diplomacy && (node.class || node.alive === false)) && <text y={RADIUS + 41} className="cg-node-details">{node.alive === false ? 'Deceased' : short(node.class, 23)}</text>}
                {!diplomacy && k && <text y={RADIUS + (node.class || node.alive === false ? 59 : 41)} className="cg-node-details cg-node-affiliation">{short(k.name, 23)}</text>}
              </g>;
            })}
          </g>
        </svg>
        {!actual.length && <div className="cg-empty"><b>No matching {diplomacy ? 'realms' : 'characters'}</b><span>{active.length ? 'Change the filters or try another year.' : 'Create an entry in the roster or try another year.'}</span></div>}
        <div className="cg-zoom"><button type="button" onClick={() => zoom(.8)} aria-label="Zoom graph out">−</button><span>{Math.round(camera.scale * 100)}%</span><button type="button" onClick={() => zoom(1.25)} aria-label="Zoom graph in">＋</button><button type="button" onClick={fitGraph}>Fit</button></div>
      </div>
      <div className="cg-legend" aria-label="Relationship legend">
        <span>{actual.length} {diplomacy ? 'realms' : 'characters'} · {visibleEdges.length} links</span>
        {typeChoices.map(type => <span key={type}><i style={{ background: relationshipColor(type) }} />{type}</span>)}
        {typeChoices.length > 0 && <button type="button" aria-pressed={editingLegend} onClick={() => setEditingLegend(value => !value)}>Legend colors</button>}
      </div>
      {editingLegend && <div className="cg-legend-options">{typeChoices.map(type => <div key={type}>
        <label>{type}<input type="color" value={relationshipColor(type)} onChange={event => changeLegend(type, event.target.value)} /></label>
        {Object.hasOwn(legend, keyOf(type)) && <button type="button" onClick={() => changeLegend(type, null)}>Reset</button>}
      </div>)}</div>}
    </section>
  );
}

export default Graph;
