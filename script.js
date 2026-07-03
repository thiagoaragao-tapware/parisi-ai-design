const $ = id => document.getElementById(id);
const rawData = window.PARISI_DATA || [];
const STORAGE_KEY = 'parisi_back_to_stock_clean_v1';
let query = '';
let selectedItem = null;
let cameraStream = null;

function fmt(value, fallback = '—') {
  const s = String(value ?? '').trim();
  return s ? s : fallback;
}
function escapeHtml(value) {
  return fmt(value, '').replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
}
function normalizeCode(value) {
  return String(value || '')
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/[–—]/g, '-')
    .replace(/,/g, '.')
    .replace(/O(?=\d)/g, '0')
    .replace(/(?<=\d)O/g, '0')
    .replace(/I(?=\d)/g, '1')
    .replace(/(?<=\d)I/g, '1')
    .replace(/[^A-Z0-9.\-\/]/g, '');
}
function cleanLocation(value) {
  let s = String(value || '').trim().toUpperCase();
  if (!s) return '';
  s = s.replace(/^\/NSW\//, '').replace(/^NSW\//, '').replace(/\s+/g, '');
  s = s.replace(/[^A-Z0-9.]/g, '');
  const m = s.match(/^([A-Z])(\d)(?:\.)?(\d{1,2})$/);
  if (m) return `${m[1]}${m[2]}${m[3].padStart(2,'0')}`;
  const m2 = s.match(/^([A-Z])(\d{2})(\d)$/);
  if (m2) return `${m2[1]}${m2[2]}${m2[3]}`;
  return s.replace('.', '');
}
function normalizeBarcode(value) {
  const s = String(value || '').trim();
  if (!s) return '';
  return s;
}
function hasUsableLocationOrShelf(item) {
  return Boolean(item.location || item.shelf);
}
const data = rawData.map((item, index) => {
  const code = fmt(item.code || item.Product || item.CODE, '');
  const description = fmt(item.description || item.name || item.category, '');
  const location = cleanLocation(item.location || item.LOCATION || item.Location);
  const shelf = fmt(item.shelf || item.SHELF || item.Column1, '').toUpperCase();
  const availableStock = fmt(item.availableStock || item.stock || item.Stock, '');
  const stockingStatus = fmt(item.stockingStatus || item.status || item.Status || item.shelfStatus, '');
  const barcode = normalizeBarcode(item.barcode || item.Barcode || item.BARCODE);
  const section = fmt(item.section || item.Section, '');
  return {
    ...item,
    id: index,
    code,
    description,
    location,
    shelf,
    availableStock,
    stockingStatus,
    barcode,
    section,
    searchText: [code, description, location, shelf, barcode, section, stockingStatus].join(' ').toLowerCase(),
    normalizedCode: normalizeCode(code).toLowerCase()
  };
}).filter(hasUsableLocationOrShelf);

function scoreItem(item, q) {
  if (!q) return 0;
  const lower = q.toLowerCase();
  const norm = normalizeCode(q).toLowerCase();
  const code = item.code.toLowerCase();
  let score = 0;
  if (code === lower || item.normalizedCode === norm) score += 1000;
  if (code.startsWith(lower) || item.normalizedCode.startsWith(norm)) score += 550;
  if (code.includes(lower) || item.normalizedCode.includes(norm)) score += 350;
  if (item.location.toLowerCase() === lower) score += 460;
  if (item.location.toLowerCase().startsWith(lower)) score += 280;
  if (item.shelf.toLowerCase() === lower) score += 420;
  if (item.shelf.toLowerCase().startsWith(lower)) score += 250;
  if (item.description.toLowerCase().includes(lower)) score += 150;
  if (item.barcode && item.barcode.toLowerCase().includes(lower)) score += 140;
  if (item.searchText.includes(lower)) score += 40;
  return score;
}
function getMatches() {
  const q = query.trim();
  if (!q) return [];
  return data.map(item => ({...item, _score: scoreItem(item, q)}))
    .filter(item => item._score > 0)
    .sort((a,b) => b._score - a._score || a.code.localeCompare(b.code))
    .slice(0, 12);
}
function highlight(text) {
  const safe = escapeHtml(text);
  const q = query.trim();
  if (!q) return safe;
  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  try { return safe.replace(new RegExp(`(${escaped})`, 'ig'), '<span class="match">$1</span>'); }
  catch { return safe; }
}
function renderSuggestions() {
  const box = $('suggestions');
  const matches = getMatches();
  if (!query.trim() || !matches.length) {
    box.hidden = true;
    box.innerHTML = '';
    return;
  }
  box.hidden = false;
  box.innerHTML = matches.map(item => `
    <button class="suggestion" data-id="${item.id}">
      <span>
        <strong>${highlight(item.code)}</strong>
        <small>${highlight(item.description || 'No description')}</small>
      </span>
      <span class="suggestion-loc">${escapeHtml(item.location || 'NO LOC')}<span class="suggestion-shelf">${escapeHtml(item.shelf || 'NO SHELF')}</span></span>
    </button>
  `).join('');
}
function showHome() {
  $('home').hidden = false;
  $('resultScreen').hidden = true;
  $('backstockScreen').hidden = true;
  renderQueueMini();
  setTimeout(() => $('searchInput').focus(), 80);
}
function showResult(item) {
  selectedItem = item;
  $('home').hidden = true;
  $('resultScreen').hidden = false;
  $('backstockScreen').hidden = true;
  $('resultCode').textContent = item.code;
  $('resultName').textContent = item.description || 'No description';
  $('resultLocation').textContent = item.location || 'NO LOC';
  $('resultShelf').textContent = item.shelf || 'NO SHELF';
  $('resultStock').textContent = fmt(item.availableStock);
  $('resultStatus').textContent = fmt(item.stockingStatus);
  $('resultBarcode').textContent = fmt(item.barcode);
  $('resultSection').textContent = fmt(item.section);
  vibrate(12);
}
function selectById(id) {
  const item = data.find(x => String(x.id) === String(id));
  if (!item) return;
  $('suggestions').hidden = true;
  $('searchInput').value = item.code;
  query = item.code;
  showResult(item);
}
function toast(message) {
  const el = $('toast');
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove('show'), 1500);
}
function vibrate(ms = 10) {
  if (navigator.vibrate) navigator.vibrate(ms);
}
async function copy(text, label) {
  if (!text) return;
  try { await navigator.clipboard.writeText(text); toast(`${label} copied`); vibrate(8); }
  catch { toast('Copy failed'); }
}
function getQueue() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
  catch { return []; }
}
function setQueue(list) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  renderQueueMini();
  renderBackstock();
}
function addCurrentToBackstock() {
  if (!selectedItem) return;
  const list = getQueue();
  const row = {
    uid: `${selectedItem.id}-${Date.now()}`,
    id: selectedItem.id,
    code: selectedItem.code,
    description: selectedItem.description,
    location: selectedItem.location,
    shelf: selectedItem.shelf,
    stock: selectedItem.availableStock,
    time: new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})
  };
  setQueue([row, ...list]);
  toast('Added to Back to Stock');
  vibrate(20);
}
function locationOrder(loc) {
  const s = cleanLocation(loc);
  const m = s.match(/^([A-Z])(\d)(\d{2})$/);
  if (!m) return s;
  return `${m[1]}-${m[2].padStart(2,'0')}-${m[3]}`;
}
function groupQueue() {
  const groups = new Map();
  getQueue().forEach(item => {
    const key = item.location || 'NO LOCATION';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  });
  return [...groups.entries()].sort((a,b) => locationOrder(a[0]).localeCompare(locationOrder(b[0])));
}
function renderQueueMini() {
  const count = getQueue().length;
  $('backstockMini').textContent = `${count} item${count === 1 ? '' : 's'} queued`;
}
function renderBackstock() {
  const groups = groupQueue();
  const total = getQueue().length;
  $('backstockCount').textContent = `${total} item${total === 1 ? '' : 's'} grouped by location.`;
  const holder = $('backstockGroups');
  if (!total) {
    holder.innerHTML = `<div class="empty-queue">Search an item and press <strong>BACK TO STOCK</strong> to build your grouped list.</div>`;
    return;
  }
  holder.innerHTML = groups.map(([loc, items]) => `
    <article class="group">
      <div class="group-head"><strong>${escapeHtml(loc)}</strong><small>${items.length} item${items.length === 1 ? '' : 's'}</small></div>
      ${items.map(item => `
        <div class="queue-item">
          <div><h4>${escapeHtml(item.code)}</h4><p>${escapeHtml(item.description)} · Shelf ${escapeHtml(item.shelf || 'NO SHELF')} · ${escapeHtml(item.time)}</p></div>
          <button class="remove-item" data-uid="${escapeHtml(item.uid)}">Done</button>
        </div>`).join('')}
    </article>
  `).join('');
}
function removeQueueItem(uid) {
  setQueue(getQueue().filter(item => item.uid !== uid));
  toast('Item completed');
}
function exportBackstock() {
  const list = getQueue();
  if (!list.length) return toast('Queue is empty');
  const rows = [['Location','Shelf','Code','Description','Stock','Time'], ...list.map(i => [i.location, i.shelf, i.code, i.description, i.stock, i.time])];
  const csv = rows.map(row => row.map(cell => `"${String(cell ?? '').replace(/"/g,'""')}"`).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], {type:'text/csv'}));
  a.download = 'parisi-back-to-stock.csv';
  a.click();
}
async function startOCR() {
  const dialog = $('ocrDialog');
  dialog.showModal();
  $('ocrStatus').textContent = 'Opening camera...';
  $('ocrCandidates').innerHTML = '';
  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
    $('camera').srcObject = cameraStream;
    $('ocrStatus').textContent = 'Camera ready. Center the product code and tap READ TEXT.';
  } catch (error) {
    $('ocrStatus').textContent = `Camera error: ${error.message}`;
  }
}
function stopOCR() {
  if (cameraStream) cameraStream.getTracks().forEach(track => track.stop());
  cameraStream = null;
  $('camera').srcObject = null;
}
function extractCandidates(text) {
  const cleaned = String(text || '').toUpperCase().replace(/\s+/g, ' ');
  const raw = cleaned.match(/[A-Z0-9]{1,5}[.\-][A-Z0-9.\-\/]{2,}/g) || [];
  const expanded = raw.map(normalizeCode).filter(Boolean);
  return [...new Set(expanded)].slice(0, 8);
}
async function readText() {
  const video = $('camera');
  const canvas = $('captureCanvas');
  const status = $('ocrStatus');
  if (!video.videoWidth) return status.textContent = 'Camera is not ready yet.';
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext('2d').drawImage(video, 0, 0);
  status.textContent = 'Reading text...';
  $('ocrCandidates').innerHTML = '';
  try {
    const result = await Tesseract.recognize(canvas, 'eng', {
      logger: m => {
        if (m.status) status.textContent = `OCR: ${m.status}${m.progress ? ` ${Math.round(m.progress * 100)}%` : ''}`;
      }
    });
    const candidates = extractCandidates(result.data.text);
    if (!candidates.length) {
      status.textContent = 'No product code detected. Try closer, brighter and flatter.';
      return;
    }
    status.textContent = 'Choose the detected code:';
    $('ocrCandidates').innerHTML = candidates.map(c => `<button data-code="${escapeHtml(c)}">${escapeHtml(c)}</button>`).join('');
  } catch (error) {
    status.textContent = `OCR error: ${error.message}`;
  }
}
function searchCandidate(code) {
  query = code;
  $('searchInput').value = code;
  const found = getMatches()[0];
  $('ocrDialog').close();
  stopOCR();
  if (found) showResult(found);
  else { showHome(); renderSuggestions(); toast('No matching product found'); }
}

$('searchInput').addEventListener('input', e => { query = e.target.value; renderSuggestions(); });
$('searchInput').addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    const first = getMatches()[0];
    if (first) selectById(first.id);
  }
});
$('suggestions').addEventListener('click', e => {
  const btn = e.target.closest('.suggestion');
  if (btn) selectById(btn.dataset.id);
});
$('clearBtn').addEventListener('click', () => { query = ''; $('searchInput').value = ''; $('suggestions').hidden = true; $('searchInput').focus(); });
$('backHome').addEventListener('click', showHome);
$('resultClose').addEventListener('click', showHome);
$('copyLocation').addEventListener('click', () => copy(selectedItem?.location, 'Location'));
$('copyShelf').addEventListener('click', () => copy(selectedItem?.shelf, 'Shelf'));
$('addToBackstock').addEventListener('click', addCurrentToBackstock);
$('openBackstock').addEventListener('click', () => { $('home').hidden = true; $('resultScreen').hidden = true; $('backstockScreen').hidden = false; renderBackstock(); });
$('closeBackstock').addEventListener('click', showHome);
$('clearBackstock').addEventListener('click', () => { if (confirm('Clear Back to Stock queue?')) setQueue([]); });
$('exportBackstock').addEventListener('click', exportBackstock);
$('backstockGroups').addEventListener('click', e => { const btn = e.target.closest('.remove-item'); if (btn) removeQueueItem(btn.dataset.uid); });
$('ocrBtn').addEventListener('click', startOCR);
$('closeOcr').addEventListener('click', () => { $('ocrDialog').close(); stopOCR(); });
$('ocrDialog').addEventListener('close', stopOCR);
$('readText').addEventListener('click', readText);
$('ocrCandidates').addEventListener('click', e => { const btn = e.target.closest('button[data-code]'); if (btn) searchCandidate(btn.dataset.code); });

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
renderQueueMini();
renderBackstock();
