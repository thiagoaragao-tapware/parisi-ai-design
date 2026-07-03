const $ = (id) => document.getElementById(id);
const rawData = window.PARISI_DATA || [];
const data = rawData.map((item, index) => ({
  ...item,
  id: index,
  code: item.code || '',
  description: item.description || item.category || '',
  searchText: [item.code,item.description,item.category,item.barcode,item.location,item.shelf,item.section,item.stockingStatus].join(' ').toLowerCase()
}));
let query = '';
let filter = 'all';
let results = data.slice(0, 24);
let selected = null;
const LS_RECENT = 'parisi_recent_v3';
const getRecent = () => { try { return JSON.parse(localStorage.getItem(LS_RECENT)) || [] } catch { return [] } };
const setRecent = (v) => localStorage.setItem(LS_RECENT, JSON.stringify(v));
const fmt = (v) => (v === undefined || v === null || String(v).trim() === '' ? '—' : String(v));
const esc = (s) => fmt(s).replace(/[&<>'"]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[m]));
const clean = (s) => String(s || '').replace(/'/g, "\\'");
function toast(text){ const t=$('toast'); t.textContent=text; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'), 1200); }
function copyText(text){ navigator.clipboard?.writeText(text || ''); toast('Copied: ' + fmt(text)); event?.stopPropagation?.(); }
function addRecent(text){ text = String(text || '').trim(); if(text.length < 2) return; const r = [text, ...getRecent().filter(x => x.toLowerCase() !== text.toLowerCase())].slice(0, 9); setRecent(r); renderMiniStats(); }
function highlight(text){ const safe = esc(text); if(!query.trim()) return safe; const q = query.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); return safe.replace(new RegExp(`(${q})`, 'ig'), '<mark>$1</mark>'); }
function hasStock(v){ return !isNaN(parseFloat(v)) && parseFloat(v) > 0; }
function passesFilter(p){
  return filter === 'all' ||
    (filter === 'withLocation' && p.location) ||
    (filter === 'withoutLocation' && !p.location) ||
    (filter === 'withShelf' && p.shelf) ||
    (filter === 'withoutShelf' && !p.shelf);
}
function score(p, q){
  if(!q) return 1;
  q = q.toLowerCase(); let s = 0;
  const code = (p.code || '').toLowerCase(), desc=(p.description||'').toLowerCase();
  if(code === q) s += 250;
  if(code.startsWith(q)) s += 140;
  if(code.includes(q)) s += 80;
  if((p.barcode||'').toLowerCase().includes(q)) s += 75;
  if((p.location||'').toLowerCase().includes(q)) s += 55;
  if((p.shelf||'').toLowerCase().includes(q)) s += 55;
  if(desc.includes(q)) s += 35;
  if(p.searchText.includes(q)) s += 12;
  return s;
}
function runSearch(){
  const q = query.trim().toLowerCase();
  let arr = data.filter(p => passesFilter(p));
  if(q){ arr = arr.map(p => ({...p, _score: score(p,q)})).filter(p => p._score > 0).sort((a,b)=>b._score-a._score || a.code.localeCompare(b.code)); }
  results = arr.slice(0, 60);
  selected = results[0] || null;
  renderFeatured(); renderSuggestions(); renderResults(); renderMiniStats();
}
function renderFeatured(){
  const el = $('featured');
  if(!selected){
    el.className = 'featured empty-state';
    el.innerHTML = `<div class="empty-copy"><span class="small-gold">No result</span><h2>Nenhum item encontrado</h2><p>Tente digitar menos caracteres, barcode, location ou shelf.</p></div>`;
    return;
  }
  const p = selected;
  el.className = 'featured';
  el.innerHTML = `<div class="product-focus">
    <div class="product-main">
      <span class="small-gold">Best match</span>
      <h2 class="product-code">${highlight(p.code)}</h2>
      <p class="product-name">${highlight(p.description || p.category || 'No description available')}</p>
      <div class="product-tags">
        <span class="tag">Barcode: ${esc(p.barcode)}</span>
        <span class="tag">Stock: ${esc(p.availableStock)}</span>
        <span class="tag">Status: ${esc(p.stockingStatus || p.shelfStatus)}</span>
        <span class="tag">Section: ${esc(p.section)}</span>
      </div>
    </div>
    <div class="location-board">
      <div class="big-location ${p.location ? '' : 'missing'}"><span>Location</span><strong>${highlight(p.location || 'NO LOCATION')}</strong></div>
      <div class="big-location ${p.shelf ? '' : 'missing'}"><span>Shelf</span><strong>${highlight(p.shelf || 'NO SHELF')}</strong></div>
      <div class="copy-grid">
        <button onclick="copyText('${clean(p.code)}')">Copy Code</button>
        <button onclick="copyText('${clean(p.location)}')">Copy Loc</button>
        <button onclick="copyText('${clean(p.shelf)}')">Copy Shelf</button>
        <button class="details-btn" onclick="openDetail(${p.id})">Full Details</button>
      </div>
    </div>
  </div>`;
}
function renderSuggestions(){
  const el = $('suggestions');
  const q = query.trim();
  if(!q || results.length === 0){ el.classList.add('hidden'); el.innerHTML = ''; return; }
  el.classList.remove('hidden');
  el.innerHTML = results.slice(0, 8).map((p, idx) => `<div class="suggestion ${idx===0?'active':''}" onclick="selectProduct(${p.id}, true)">
    <div><b>${highlight(p.code)}</b><small>${highlight(p.description || p.category || 'No description')}</small></div>
    <span class="sug-loc ${p.location ? '' : 'bad'}">${esc(p.location || 'NO LOC')}</span>
    <span class="sug-shelf ${p.shelf ? '' : 'bad'}">${esc(p.shelf || 'NO SHELF')}</span>
  </div>`).join('');
}
function renderResults(){
  $('results').innerHTML = results.slice(1, 25).map(p => `<article class="card" onclick="selectProduct(${p.id}, true)">
    <div class="card-code">${highlight(p.code)}</div>
    <p class="card-name">${highlight(p.description || p.category || 'No description')}</p>
    <div class="card-loc">
      <div><span>Location</span><strong class="${p.location ? '' : 'bad'}">${highlight(p.location || 'NO LOCATION')}</strong></div>
      <div><span>Shelf</span><strong class="${p.shelf ? '' : 'bad'}">${highlight(p.shelf || 'NO SHELF')}</strong></div>
    </div>
  </article>`).join('');
}
function renderMiniStats(){
  $('totalCount').textContent = data.length.toLocaleString();
  $('resultCount').textContent = results.length.toLocaleString();
  $('recentChip').textContent = getRecent()[0] || '—';
}
function selectProduct(id, addToRecent=false){
  selected = data.find(p => p.id === id);
  if(selected){ if(addToRecent) addRecent(selected.code); renderFeatured(); $('suggestions').classList.add('hidden'); window.scrollTo({top:0, behavior:'smooth'}); }
}
function openDetail(id){
  const p = data.find(x => x.id === id); if(!p) return;
  const fields = [
    ['Product Code', p.code], ['Description', p.description], ['Location', p.location], ['Shelf', p.shelf], ['Barcode', p.barcode],
    ['Available Stock', p.availableStock], ['Category', p.category], ['Kit Components', p.kitComponents], ['Stocking Status', p.stockingStatus],
    ['Shelf Qty', p.shelfQty], ['Section', p.section], ['Shelf Status', p.shelfStatus], ['Street', p.street], ['Building', p.building], ['Level', p.level], ['Side', p.side], ['Obs', p.obs]
  ];
  $('detailContent').innerHTML = `<span class="small-gold">Full product data</span><h2 class="product-code">${esc(p.code)}</h2><p class="product-name">${esc(p.description || p.category || '')}</p><div class="detail-grid">${fields.map(([k,v])=>`<div class="detail-cell"><span>${esc(k)}</span><strong>${esc(v)}</strong></div>`).join('')}</div>`;
  $('detailDialog').showModal();
}
$('searchInput').addEventListener('input', e => { query = e.target.value; runSearch(); });
$('searchInput').addEventListener('keydown', e => { if(e.key === 'Enter' && selected){ addRecent(selected.code); $('suggestions').classList.add('hidden'); } });
$('clearBtn').addEventListener('click', () => { query=''; $('searchInput').value=''; runSearch(); $('searchInput').focus(); });
document.querySelectorAll('.pill').forEach(btn => btn.addEventListener('click', () => { document.querySelectorAll('.pill').forEach(b=>b.classList.remove('active')); btn.classList.add('active'); filter = btn.dataset.filter; runSearch(); }));
$('closeDialog').addEventListener('click', () => $('detailDialog').close());
document.addEventListener('click', (e) => { if(!e.target.closest('.search-card')) $('suggestions').classList.add('hidden'); });
runSearch();
