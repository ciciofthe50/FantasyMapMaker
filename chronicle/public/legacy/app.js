'use strict';
const $ = selector => document.querySelector(selector);
const el = (tag, text, className) => {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  if (className) node.className = className;
  return node;
};
function button(text, action, className) {
  const node = el('button', text, className);
  node.type = 'button';
  node.onclick = action;
  return node;
}
function svg(tag, attributes = {}) {
  const node = document.createElementNS('http://www.w3.org/2000/svg',tag);
  for (const [key,value] of Object.entries(attributes)) node.setAttribute(key,value);
  return node;
}
const storeKey = 'fantasy-map-maker-v1';
const collections = ['people','links','places','strokes','events'];
const empty = () => Object.fromEntries(collections.map(key => [key,[]]));
const id = () => globalThis.crypto?.randomUUID?.() || Date.now().toString(36) + Math.random().toString(36).slice(2);
const view = $('#view');
const dialog = $('#editor');
let world = empty();
let active = 'cast';
let selectedPerson;
let selectedPlace;
let mapTool = 'select';
let chapter = '';
let resize;

function message(text) {
  $('#status').textContent = text;
  $('#status').hidden = !text;
}
function valid(data) {
  const records = (key, check) => Array.isArray(data?.[key]) &&
    data[key].every(row => row && typeof row.id === 'string' && check(row)) &&
    new Set(data[key].map(row => row.id)).size === data[key].length;
  const named = row => typeof row.name === 'string' && row.name.trim();
  const strings = values => Array.isArray(values) && values.every(value => typeof value === 'string');
  return records('people',named) && records('places',row => named(row) && Number.isFinite(row.x) && Number.isFinite(row.y)) &&
    records('links',row => typeof row.name === 'string' && row.a !== row.b && [row.a,row.b].every(key => data.people.some(person => person.id === key))) &&
    records('events',row => named(row) && Number.isFinite(row.chapter) && strings(row.people) && strings(row.places)) &&
    records('strokes',row => ['land','border','river'].includes(row.kind) && typeof row.path === 'string' && /^[MLZ 0-9.,-]+$/.test(row.path));
}
try {
  const stored = JSON.parse(localStorage.getItem(storeKey));
  if (valid(stored)) world = stored;
  else if (stored !== null) message('The saved world could not be read.');
} catch {
  message('Local storage could not be read.');
}
function save() {
  try {
    localStorage.setItem(storeKey, JSON.stringify(world));
    message('');
  } catch {
    message('Autosave failed. Export your world to keep this session’s changes.');
  }
  render();
}
const lookup = (key, recordId) => world[key].find(record => record.id === recordId);
const orderedEvents = () => [...world.events].sort((a,b) => a.chapter - b.chapter || a.name.localeCompare(b.name));
const personFields = [
  ['name','Nickname or name'], ['fantasy','Fantasy name'], ['kingdom','Starting kingdom or faction'],
  ['role','Class or role'], ['likes','Likes'], ['dislikes','Dislikes'], ['notes','Story notes','textarea']
];
const placeFields = [['name','Place name'],['kingdom','Kingdom or region'],['notes','Place notes','textarea']];
const linkFields = [['name','Relationship'],['a','First person','select','people'],['b','Second person','select','people']];
const eventFields = [
  ['name','Event title'],['chapter','Chapter or story order','number'],['notes','What happens?','textarea'],
  ['people','Characters involved','multiple','people'],['places','Places involved','multiple','places'],
  ['allegiance','Character changing allegiance','select','people'],['kingdom','New kingdom or faction']
];
function edit(key, fields, record = {}, title, isNew = !record.id) {
  const controls = [];
  $('#form-title').textContent = title;
  $('#fields').replaceChildren();
  for (const [name,label,type,source] of fields) {
    const wrapper = el('label',label);
    const control = el(source ? 'select' : type === 'textarea' ? 'textarea' : 'input');
    if (type === 'number') {
      control.type = 'number';
      control.step = 'any';
      control.min = 0;
      control.required = true;
    }
    if (name === 'name' || name === 'a' || name === 'b') control.required = true;
    if (source) {
      control.multiple = type === 'multiple';
      if (!control.multiple) control.add(new Option('Choose a character',''));
      world[source].forEach(item => control.add(new Option(item.name,item.id)));
    }
    if (control.multiple) {
      for (const option of control.options) option.selected = (record[name] || []).includes(option.value);
    } else {
      control.value = record[name] ?? '';
    }
    control.addEventListener('input',() => control.setCustomValidity(''));
    wrapper.append(control);
    $('#fields').append(wrapper);
    controls.push([name,control]);
  }
  $('#remove').hidden = isNew;
  $('#remove').onclick = () => {
    if (!confirm('Delete ' + record.name + '?')) return;
    world[key] = world[key].filter(item => item.id !== record.id);
    if (key === 'people' || key === 'places') {
      world.events = world.events.map(event => {
        const updated = {...event,[key]:event[key].filter(value => value !== record.id)};
        if (key === 'people' && updated.allegiance === record.id) updated.allegiance = '';
        return updated;
      });
    }
    if (key === 'people') world.links = world.links.filter(link => link.a !== record.id && link.b !== record.id);
    dialog.close();
    save();
  };
  $('#form').onsubmit = event => {
    event.preventDefault();
    const row = {...record,id:record.id || id()};
    for (const [name,control] of controls) {
      row[name] = control.multiple ? Array.from(control.selectedOptions,option => option.value)
        : control.type === 'number' ? control.valueAsNumber : control.value.trim();
    }
    const invalidField = !row.name ? ['name','Enter a name.']
      : key === 'links' && row.a === row.b ? ['b','Choose two different people.']
      : key === 'events' && row.allegiance && !row.kingdom ? ['kingdom','Enter the new kingdom or faction.'] : null;
    if (invalidField) {
      const control = controls.find(([name]) => name === invalidField[0])[1];
      control.setCustomValidity(invalidField[1]);
      control.reportValidity();
      control.setCustomValidity('');
      return;
    }
    if (key === 'events' && row.allegiance && !row.people.includes(row.allegiance)) row.people.push(row.allegiance);
    world[key] = isNew ? [...world[key],row] : world[key].map(item => item.id === row.id ? row : item);
    if (key === 'people') selectedPerson = row.id;
    if (key === 'places') { selectedPlace = row.id; mapTool = 'select'; }
    dialog.close();
    save();
  };
  dialog.showModal();
}
$('#cancel').onclick = () => dialog.close();

function eventList(events) {
  if (!events.length) return el('p','No events yet.');
  const list = el('ul','','list');
  for (const event of events) {
    const item = el('li','','event');
    const detail = button(event.name,() => edit('events',eventFields,event,'Edit event'));
    const names = [...event.people.map(key => lookup('people',key)),...event.places.map(key => lookup('places',key))]
      .filter(Boolean).map(record => record.name);
    if (names.length) detail.append(el('p',names.join(' · ')));
    if (event.notes) detail.append(el('p',event.notes));
    if (event.allegiance && lookup('people',event.allegiance)) {
      detail.append(el('p',lookup('people',event.allegiance).name + ' joins ' + event.kingdom));
    }
    item.append(el('time','Chapter ' + event.chapter),detail);
    list.append(item);
  }
  return list;
}
function kingdomAt(person) {
  return orderedEvents().filter(event => event.allegiance === person.id && (chapter === '' || event.chapter <= Number(chapter)))
    .at(-1)?.kingdom || person.kingdom || 'Unaffiliated';
}
function renderCast() {
  const person = lookup('people',selectedPerson) || world.people[0];
  selectedPerson = person?.id;
  const bar = el('div','','toolbar');
  bar.append(button('+ Add person',() => edit('people',personFields,{},'Add person'),'primary'));
  if (world.people.length > 1) {
    bar.append(button('+ Relationship',() => edit('links',linkFields,{a:selectedPerson},'Add relationship')));
  }
  if (world.events.some(event => event.allegiance)) {
    const time = el('select');
    time.add(new Option('Latest',''));
    for (const number of [...new Set([0,...orderedEvents().map(event => event.chapter)])]) time.add(new Option('Chapter ' + number,number));
    time.value = chapter;
    time.onchange = () => { chapter = time.value; render(); };
    const label = el('label','Allegiance at');
    label.append(time);
    bar.append(label);
  }
  view.append(bar);
  if (!person) {
    view.append(el('div','Add someone to start your cast map.','panel'));
    return;
  }
  const layout = el('div','','split');
  const board = el('div','','panel board');
  const edges = svg('svg',{class:'edges','aria-hidden':'true'});
  const bubbles = el('div','','bubbles');
  const positions = new Map();
  for (const entry of world.people) {
    const bubble = button('',() => { selectedPerson = entry.id; render(); $('#view [aria-pressed=true]')?.focus(); },'bubble');
    bubble.setAttribute('aria-pressed',String(entry.id === person.id));
    bubble.append(el('span',entry.name),el('small',kingdomAt(entry)));
    bubbles.append(bubble);
    positions.set(entry.id,bubble);
  }
  const profile = el('aside','','panel');
  profile.append(el('h2',person.fantasy || person.name),el('p',[person.role,kingdomAt(person)].filter(Boolean).join(' · ')));
  const details = el('dl');
  if (person.fantasy) details.append(el('dt','Inspired by'),el('dd',person.name));
  for (const key of ['likes','dislikes','notes']) {
    if (person[key]) details.append(el('dt',personFields.find(field => field[0] === key)[1]),el('dd',person[key]));
  }
  profile.append(details,button('Edit profile',() => edit('people',personFields,person,'Edit profile')),el('hr'),el('h3','Relationships'));
  const links = el('ul','','list');
  for (const link of world.links.filter(row => row.a === person.id || row.b === person.id)) {
    const other = lookup('people',link.a === person.id ? link.b : link.a);
    const item = el('li');
    item.append(button(other.name,() => {selectedPerson = other.id; render();}),
      button(link.name,() => edit('links',linkFields,link,'Edit relationship')));
    links.append(item);
  }
  profile.append(links.children.length ? links : el('p','No relationships yet.'),el('h3','Story events'),
    eventList(orderedEvents().filter(event => event.people.includes(person.id))));
  board.append(edges,bubbles);
  layout.append(board,profile);
  view.append(layout);
  resize = new ResizeObserver(() => {
    const bounds = edges.getBoundingClientRect();
    edges.replaceChildren(...world.links.map(link => {
      const a = positions.get(link.a)?.getBoundingClientRect();
      const b = positions.get(link.b)?.getBoundingClientRect();
      if (!a || !b) return svg('g');
      return svg('line',{x1:a.left+a.width/2-bounds.left,y1:a.top+a.height/2-bounds.top,
        x2:b.left+b.width/2-bounds.left,y2:b.top+b.height/2-bounds.top,
        stroke:[link.a,link.b].includes(person.id) ? '#e2bd79' : '#637568','stroke-width':2});
    }));
  });
  resize.observe(board);
}

const ink = {
  land:{fill:'#637347',stroke:'#d9c895','stroke-width':3},
  border:{fill:'none',stroke:'#f1c779','stroke-width':3,'stroke-dasharray':'8 5'},
  river:{fill:'none',stroke:'#92d1e1','stroke-width':4}
};
function renderMap() {
  const bar = el('div','','toolbar');
  const tools = {select:'Select',land:'Draw land',border:'Draw border',river:'Draw river',pin:'Place pin'};
  for (const [tool,label] of Object.entries(tools)) {
    const control = button(label,() => { mapTool = tool; render(); view.querySelector('[aria-pressed=true]')?.focus(); });
    control.setAttribute('aria-pressed',String(tool === mapTool));
    bar.append(control);
  }
  const undo = button('Undo last stroke',() => {world.strokes.pop(); save();});
  undo.disabled = !world.strokes.length;
  bar.append(undo);
  const layout = el('div','','split');
  const map = svg('svg',{class:'map',viewBox:'0 0 1000 680','data-tool':mapTool,'aria-label':'World map drawing surface'});
  const defs = svg('defs');
  const grid = svg('pattern',{id:'atlas-grid',width:40,height:40,patternUnits:'userSpaceOnUse'});
  grid.append(svg('path',{d:'M 40 0 L 0 0 L 0 40',fill:'none',stroke:'#adc4b4','stroke-opacity':'.19'}));
  defs.append(grid);
  map.append(defs,svg('rect',{width:1000,height:680,fill:'url(#atlas-grid)'}));
  const strokes = svg('g',{'pointer-events':'none'});
  const pins = svg('g');
  map.append(strokes,pins);
  for (const stroke of world.strokes) strokes.append(svg('path',{d:stroke.path,...ink[stroke.kind],'stroke-linejoin':'round','stroke-linecap':'round'}));
  for (const place of world.places) {
    const marker = svg('g',{'data-pin':place.id,transform:'translate('+place.x+' '+place.y+')',tabindex:mapTool === 'select' ? 0 : -1,role:'button','aria-label':place.name});
    const select = () => { selectedPlace = place.id; render(); };
    marker.onclick = () => {if (mapTool === 'select') select();};
    marker.onkeydown = event => {
      if (mapTool === 'select' && ['Enter',' '].includes(event.key)) {event.preventDefault(); select();}
    };
    const label = svg('text',{x:15,y:6,'font-size':20});
    label.textContent = place.name;
    marker.append(svg('circle',{r:19,fill:'transparent'}),svg('circle',{r:10,fill:place.id === selectedPlace ? '#ffe5a1' : '#e2bd79',stroke:'#161d18','stroke-width':3}),label);
    pins.append(marker);
  }
  function point(event) {
    const coordinates = new DOMPoint(event.clientX,event.clientY).matrixTransform(map.getScreenCTM().inverse());
    return [Math.round(Math.min(1000,Math.max(0,coordinates.x))),Math.round(Math.min(680,Math.max(0,coordinates.y)))];
  }
  let drawing;
  map.onpointerdown = event => {
    if (event.button !== 0 || mapTool === 'select' || drawing) return;
    event.preventDefault();
    const [x,y] = point(event);
    if (mapTool === 'pin') {
      edit('places',placeFields,{x,y},'Place pin');
      return;
    }
    const path = 'M ' + x + ' ' + y;
    const mark = svg('path',{d:path,...ink[mapTool],'stroke-linejoin':'round','stroke-linecap':'round'});
    strokes.append(mark);
    drawing = {pointer:event.pointerId,mark,path,x,y,count:1};
    map.setPointerCapture(event.pointerId);
  };
  map.onpointermove = event => {
    if (drawing?.pointer !== event.pointerId) return;
    const [x,y] = point(event);
    if (Math.hypot(x-drawing.x,y-drawing.y) < 3) return;
    drawing.path += ' L ' + x + ' ' + y;
    drawing.mark.setAttribute('d',drawing.path);
    Object.assign(drawing,{x,y,count:drawing.count+1});
  };
  function finish(event) {
    if (drawing?.pointer !== event.pointerId) return;
    const stroke = drawing;
    drawing = undefined;
    if (event.type !== 'pointerup' || stroke.count < (mapTool === 'land' ? 3 : 2)) {
      stroke.mark.remove();
      return;
    }
    world.strokes.push({id:id(),kind:mapTool,path:stroke.path+(mapTool === 'land' ? ' Z' : '')});
    save();
  }
  map.onpointerup = finish;
  map.onpointercancel = finish;
  map.onlostpointercapture = finish;
  const panel = el('aside','','panel');
  const place = lookup('places',selectedPlace);
  panel.append(el('h2',place?.name || 'Places'));
  if (place) {
    if (place.kingdom) panel.append(el('p',place.kingdom));
    if (place.notes) panel.append(el('p',place.notes));
    panel.append(button('Edit place',() => edit('places',placeFields,place,'Edit place')),el('hr'),el('h3','Story events'),
      eventList(orderedEvents().filter(event => event.places.includes(place.id))));
  }
  if (world.places.length) {
    const list = el('ul','','list');
    for (const entry of world.places) {
      const item = el('li');
      item.append(button(entry.name,() => {selectedPlace = entry.id; render();}));
      list.append(item);
    }
    panel.append(list);
  } else panel.append(el('p','Choose Place pin, then click the map.'));
  layout.append(map,panel);
  view.append(bar,layout);
}
function renderTimeline() {
  const bar = el('div','','toolbar');
  bar.append(button('+ Add event',() => edit('events',eventFields,{chapter:1},'Add event'),'primary'));
  const panel = el('div','','panel');
  panel.append(el('h2','Story timeline'),eventList(orderedEvents()));
  view.append(bar,panel);
}
function render() {
  resize?.disconnect();
  view.replaceChildren();
  for (const tab of document.querySelectorAll('[data-view]')) tab.setAttribute('aria-current',String(tab.dataset.view === active));
  ({cast:renderCast,map:renderMap,timeline:renderTimeline})[active]();
}
for (const tab of document.querySelectorAll('[data-view]')) {
  tab.onclick = () => {active = tab.dataset.view; render();};
}
$('#export').onclick = () => {
  const url = URL.createObjectURL(new Blob([JSON.stringify(world,null,2)],{type:'application/json'}));
  const link = el('a');
  link.href = url;
  link.download = 'fantasy-world.json';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url),1000);
};
$('#import').onclick = () => $('#file').click();
$('#file').onchange = async event => {
  const file = event.target.files[0];
  event.target.value = '';
  if (!file) return;
  try {
    const imported = JSON.parse(await file.text());
    if (!valid(imported)) throw new Error('Invalid world');
    if (collections.some(key => world[key].length) && !confirm('Replace this world with the imported file?')) return;
    world = imported;
    selectedPerson = undefined;
    selectedPlace = undefined;
    chapter = '';
    save();
  } catch {
    message('Could not import this file. Choose a Fantasy Map Maker world export.');
  }
};
render();
