// =============================================================================
// PDF HIGHLIGHTER — Select & colour-code PDF text to build study content
// Types: flash (yellow), quiz (green), exam (red), note (blue)
// =============================================================================

export const TYPE_CONFIG = {
    flash: { label: '🟡 Karteikarte',    bg: 'rgba(255,224,0,0.38)',   border: 'rgba(255,200,0,0.9)',   text: '#ffe066' },
    quiz:  { label: '🟢 Quiz',           bg: 'rgba(0,210,85,0.32)',    border: 'rgba(0,210,85,0.9)',    text: '#66ff99' },
    exam:  { label: '🔴 Prüfung',        bg: 'rgba(220,50,50,0.32)',   border: 'rgba(220,50,50,0.9)',   text: '#ff9999' },
    note:  { label: '🔵 Notiz',          bg: 'rgba(50,140,255,0.28)',  border: 'rgba(50,140,255,0.9)',  text: '#66bbff' },
    read:  { label: '🟠 Speed Reading',  bg: 'rgba(255,140,0,0.30)',   border: 'rgba(255,140,0,0.9)',   text: '#ffb84d' },
};

let hlDoc        = null;
let hlType       = 'flash';   // currently selected type
let hlItems      = [];        // { id, text?, imageData?, type, answer, section }
let pageViewMode = false;     // false = text mode, true = canvas/image mode

export function getHighlightItems() { return hlItems; }

// ---------------------------------------------------------------------------
// Open the highlighter with a File object
// ---------------------------------------------------------------------------
export async function openPdfHighlighter(file) {
    hlItems      = [];
    hlDoc        = null;
    pageViewMode = false;

    try {
        const buf = await file.arrayBuffer();
        /* global pdfjsLib */
        hlDoc = await pdfjsLib.getDocument({ data: buf }).promise;
    } catch (e) {
        console.error('[Highlighter] PDF load error:', e);
        alert('PDF konnte nicht geladen werden.');
        return;
    }

    const modal = document.getElementById('pdf-highlighter-modal');
    if (!modal) return;

    // Reset UI
    _el('hl-filename').textContent  = file.name;
    _el('hl-count').textContent     = '0';
    _el('hl-items-list').innerHTML  = '';
    _el('hl-section-input').value   = '';
    _el('hl-answer-input').value    = '';

    // Sync toggle button state
    const toggleBtn = _el('btn-hl-toggle-view');
    if (toggleBtn) {
        toggleBtn.textContent = '📷 Bildmodus';
        toggleBtn.title = 'Zur Seitenansicht (mit Bildern) wechseln';
    }

    await _renderAllPages();
    modal.classList.remove('hidden');
}

// ---------------------------------------------------------------------------
// Initialise all static event listeners (call once on app load)
// ---------------------------------------------------------------------------
export function initHighlighterUI() {
    // Type buttons
    document.querySelectorAll('.hl-type-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            hlType = btn.dataset.type;
            document.querySelectorAll('.hl-type-btn').forEach(b => b.classList.remove('hl-active'));
            btn.classList.add('hl-active');
        });
    });

    // Close button
    const closeBtn = document.getElementById('close-pdf-highlighter');
    if (closeBtn) closeBtn.addEventListener('click', () => {
        document.getElementById('pdf-highlighter-modal').classList.add('hidden');
    });

    // Toggle text / canvas view
    const toggleBtn = _el('btn-hl-toggle-view');
    if (toggleBtn) {
        toggleBtn.addEventListener('click', async () => {
            if (!hlDoc) return;
            pageViewMode = !pageViewMode;
            toggleBtn.textContent = pageViewMode ? '📝 Textmodus' : '📷 Bildmodus';
            toggleBtn.title = pageViewMode ? 'Zurück zum Textmodus' : 'Zur Seitenansicht (mit Bildern) wechseln';
            await _renderAllPages();
        });
    }

    // Clear all button
    const clearBtn = document.getElementById('btn-hl-clear');
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            if (hlItems.length === 0) return;
            if (!confirm('Alle Markierungen löschen?')) return;
            hlItems = [];
            // Remove all <mark> elements from the text content
            document.querySelectorAll('#hl-pdf-content mark.hl-mark').forEach(m => {
                const parent = m.parentNode;
                while (m.firstChild) parent.insertBefore(m.firstChild, m);
                parent.removeChild(m);
                parent.normalize();
            });
            _renderItemList();
        });
    }
}

// ---------------------------------------------------------------------------
// Import all highlights into the given world object
// Returns number of items imported
// ---------------------------------------------------------------------------
export function importHighlightsToWorld(world, generateMapCoordinates) {
    if (!world || hlItems.length === 0) return 0;

    const sections = [...new Set(hlItems.map(it => it.section || 'PDF Highlights'))];

    sections.forEach(sec => {
        if (!world.sections.includes(sec)) world.sections.push(sec);
        if (!world.content)   world.content   = {};
        if (!world.progress)  world.progress  = {};
        if (!world.content[sec])  world.content[sec]  = '';
        if (!world.progress[sec]) world.progress[sec] = { quizPassed: false, examPassed: false, gameCooldowns: {} };
    });

    hlItems.forEach(item => {
        const sec = item.section || 'PDF Highlights';
        const questionText = item.text || (item.imageData ? '[Bild]' : '');
        switch (item.type) {
            case 'flash':
                world.flashcards.push({
                    section: sec,
                    question: questionText,
                    answer:   item.answer || questionText.slice(0, 120),
                    imageData: item.imageData || null,
                    interval: 0, ease: 2.5, nextReview: 0, burned: false,
                });
                break;
            case 'quiz':
                (world.quizzes = world.quizzes || []).push({
                    section: sec, question: questionText, answer: item.answer || '',
                    imageData: item.imageData || null,
                });
                break;
            case 'exam':
                (world.exams = world.exams || []).push({
                    section: sec, question: questionText, answer: item.answer || '',
                    imageData: item.imageData || null,
                });
                break;
            case 'note':
                world.content[sec] += (world.content[sec] ? '\n\n' : '') + questionText;
                break;
            case 'read':
                // Speed-read text — appended with a !SECTION! separator so the
                // read-modal paginates it as its own page
                world.content[sec] += (world.content[sec] ? '\n\n!SECTION!\n\n' : '') + questionText;
                break;
        }
    });

    world.coordinates = generateMapCoordinates(world.sections.length);
    return hlItems.length;
}

// ===========================================================================
// Internal helpers
// ===========================================================================

function _el(id) { return document.getElementById(id); }

async function _renderAllPages() {
    if (pageViewMode) {
        await _renderCanvasPages();
    } else {
        await _renderTextPages();
    }
}

// ---- TEXT MODE ----
async function _renderTextPages() {
    const container = _el('hl-pdf-content');
    container.innerHTML = '<p style="color:#555;text-align:center;margin-top:60px;font-family:Cinzel,serif;">Lade Seiten…</p>';
    container.style.cursor = 'text';

    const pages = [];
    for (let i = 1; i <= hlDoc.numPages; i++) {
        const page = await hlDoc.getPage(i);
        const tc   = await page.getTextContent();

        let text = '', lastY = null, lastX = null;
        for (const item of tc.items) {
            if (!item.str) continue;
            const ty = item.transform[5], tx = item.transform[4];
            if (lastY !== null) {
                if (Math.abs(ty - lastY) > 4) text += '\n';
                else if (tx > (lastX || 0) + 6) text += ' ';
            }
            text  += item.str;
            lastY  = ty;
            lastX  = tx + (item.width || item.str.length * 5);
        }
        if (text.trim()) pages.push({ num: i, text: text.trim() });
    }

    container.innerHTML = '';
    if (pages.length === 0) {
        container.innerHTML = '<p style="color:#888;text-align:center;margin-top:60px;">Kein lesbarer Text — gescanntes PDF? → Bildmodus verwenden.</p>';
        return;
    }

    for (const p of pages) {
        const sep = document.createElement('div');
        sep.style.cssText = 'text-align:center;color:#444;font-size:0.78em;margin:22px 0 6px;padding:3px 0;border-top:1px solid #222;letter-spacing:2px;';
        sep.textContent = `— Seite ${p.num} —`;
        container.appendChild(sep);

        const block = document.createElement('div');
        block.className    = 'hl-page-text';
        block.dataset.page = p.num;
        block.style.cssText = 'white-space:pre-wrap;padding:10px 14px;border-radius:5px;background:rgba(255,255,255,0.025);line-height:1.75;';
        block.textContent   = p.text;
        container.appendChild(block);
    }

    container.removeEventListener('mouseup', _onMouseUp);
    container.addEventListener('mouseup', _onMouseUp);
}

// ---- CANVAS / IMAGE MODE ----
async function _renderCanvasPages() {
    const container = _el('hl-pdf-content');
    container.innerHTML = '<p style="color:#555;text-align:center;margin-top:60px;font-family:Cinzel,serif;">Rendere Seiten…</p>';
    container.style.cursor = 'default';
    container.removeEventListener('mouseup', _onMouseUp);

    await new Promise(r => setTimeout(r, 30));
    container.innerHTML = '';

    const hint = document.createElement('p');
    hint.style.cssText = 'text-align:center;color:#666;font-size:0.8em;font-family:Georgia,serif;margin:6px 0 14px;';
    hint.textContent = '📐 Rechteck auf einer Seite aufziehen, um ein Bild zu erfassen.';
    container.appendChild(hint);

    for (let i = 1; i <= hlDoc.numPages; i++) {
        const page     = await hlDoc.getPage(i);
        const baseVp   = page.getViewport({ scale: 1 });
        const scale    = Math.min(1.5, Math.max(0.8, (container.clientWidth - 40) / baseVp.width));
        const viewport = page.getViewport({ scale });

        const sep = document.createElement('div');
        sep.style.cssText = 'text-align:center;color:#444;font-size:0.78em;margin:22px 0 6px;padding:3px 0;border-top:1px solid #222;letter-spacing:2px;';
        sep.textContent = `— Seite ${i} —`;
        container.appendChild(sep);

        const wrapper = document.createElement('div');
        wrapper.style.cssText = `position:relative;display:block;margin:0 auto 10px;width:${viewport.width}px;height:${viewport.height}px;max-width:100%;`;

        const canvas = document.createElement('canvas');
        canvas.width  = viewport.width;
        canvas.height = viewport.height;
        canvas.style.cssText = 'display:block;border:1px solid #2a2a3a;border-radius:4px;width:100%;height:auto;';

        await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;

        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;cursor:crosshair;';

        wrapper.appendChild(canvas);
        wrapper.appendChild(overlay);
        container.appendChild(wrapper);

        _addCanvasDragSelect(overlay, canvas);
    }
}

function _addCanvasDragSelect(overlay, canvas) {
    let startX = 0, startY = 0, dragging = false, selBox = null;

    overlay.addEventListener('mousedown', e => {
        e.preventDefault();
        const r = overlay.getBoundingClientRect();
        startX = e.clientX - r.left;
        startY = e.clientY - r.top;
        dragging = true;
        if (selBox) selBox.remove();
        selBox = document.createElement('div');
        selBox.style.cssText = 'position:absolute;border:2px dashed #a29bfe;background:rgba(162,155,254,0.15);pointer-events:none;box-sizing:border-box;';
        overlay.appendChild(selBox);
    });

    overlay.addEventListener('mousemove', e => {
        if (!dragging || !selBox) return;
        const r = overlay.getBoundingClientRect();
        const cx = e.clientX - r.left, cy = e.clientY - r.top;
        selBox.style.left   = `${Math.min(startX, cx)}px`;
        selBox.style.top    = `${Math.min(startY, cy)}px`;
        selBox.style.width  = `${Math.abs(cx - startX)}px`;
        selBox.style.height = `${Math.abs(cy - startY)}px`;
    });

    overlay.addEventListener('mouseup', e => {
        if (!dragging) return;
        dragging = false;
        const r = overlay.getBoundingClientRect();
        const endX = e.clientX - r.left, endY = e.clientY - r.top;
        const left = Math.min(startX, endX), top = Math.min(startY, endY);
        const w = Math.abs(endX - startX), h = Math.abs(endY - startY);
        if (selBox) { selBox.remove(); selBox = null; }
        if (w < 12 || h < 12) return;

        const sx = canvas.width  / overlay.offsetWidth;
        const sy = canvas.height / overlay.offsetHeight;
        const cx = Math.round(left * sx), cy = Math.round(top * sy);
        const cw = Math.min(Math.round(w * sx), canvas.width  - cx);
        const ch = Math.min(Math.round(h * sy), canvas.height - cy);

        const crop = document.createElement('canvas');
        crop.width = cw; crop.height = ch;
        crop.getContext('2d').drawImage(canvas, cx, cy, cw, ch, 0, 0, cw, ch);
        _captureImageItem(crop.toDataURL('image/jpeg', 0.78));
    });
}

function _captureImageItem(imageData) {
    const section = (_el('hl-section-input')?.value || '').trim() || 'PDF Highlights';
    const answer  = (_el('hl-answer-input')?.value  || '').trim();
    const id      = Date.now();
    hlItems.push({ id, imageData, text: '', type: hlType, answer, section });
    if (_el('hl-answer-input')) _el('hl-answer-input').value = '';
    _renderItemList();
    // Flash count to give visual feedback
    const el = _el('hl-count');
    if (el) { el.style.color = '#ffe066'; setTimeout(() => { el.style.color = ''; }, 700); }
}

function _onMouseUp() {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) return;

    const text = sel.toString().trim();
    if (text.length < 3) { sel.removeAllRanges(); return; }

    // Only allow highlighting within .hl-page-text blocks
    const range  = sel.getRangeAt(0);
    const anchor = range.startContainer;
    if (!anchor.parentElement?.closest('.hl-page-text')) { sel.removeAllRanges(); return; }

    _applyVisualHighlight(text, range);
    sel.removeAllRanges();
}

function _applyVisualHighlight(text, range) {
    const cfg  = TYPE_CONFIG[hlType];
    const id   = Date.now();
    const mark = document.createElement('mark');
    mark.className    = `hl-mark hl-${hlType}`;
    mark.dataset.hlid = id;
    mark.style.cssText = `background:${cfg.bg};outline:1px solid ${cfg.border};border-radius:2px;cursor:pointer;padding:0 1px;`;
    mark.title = 'Klicken zum Entfernen';

    try {
        range.surroundContents(mark);
    } catch (e) {
        try {
            const frag = range.extractContents();
            mark.appendChild(frag);
            range.insertNode(mark);
        } catch (e2) {
            return; // give up if DOM structure can't be wrapped
        }
    }

    const section = (_el('hl-section-input')?.value || '').trim() || 'PDF Highlights';
    const answer  = (_el('hl-answer-input')?.value  || '').trim();

    const item = { id, text, type: hlType, answer, section };
    hlItems.push(item);

    // Clear answer input after capture
    if (_el('hl-answer-input')) _el('hl-answer-input').value = '';

    // Click mark → remove
    mark.addEventListener('click', (e) => {
        e.stopPropagation();
        _removeHighlight(id);
    });

    _renderItemList();
}

function _removeHighlight(id) {
    hlItems = hlItems.filter(it => it.id !== id);
    const mark = document.querySelector(`mark.hl-mark[data-hlid="${id}"]`);
    if (mark && mark.parentNode) {
        const parent = mark.parentNode;
        while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
        parent.removeChild(mark);
        parent.normalize();
    }
    _renderItemList();
}

function _renderItemList() {
    const list    = _el('hl-items-list');
    const countEl = _el('hl-count');
    if (!list) return;
    if (countEl) countEl.textContent = hlItems.length;

    if (hlItems.length === 0) {
        list.innerHTML = pageViewMode
            ? '<p style="color:#444;font-size:0.82em;text-align:center;margin-top:24px;">Rechteck auf einer Seite<br>aufziehen, um Bild zu erfassen.</p>'
            : '<p style="color:#444;font-size:0.82em;text-align:center;margin-top:24px;">Noch keine Markierungen.<br><br>Text im PDF markieren,<br>dann Typ wählen.</p>';
        return;
    }

    list.innerHTML = '';

    hlItems.forEach(item => {
        const cfg   = TYPE_CONFIG[item.type];
        const isImg = !!item.imageData;
        const div   = document.createElement('div');
        div.style.cssText = `border:1px solid ${cfg.border};border-radius:7px;padding:9px 10px;margin-bottom:9px;background:${cfg.bg};`;

        const preview = isImg
            ? `<img src="${item.imageData}" style="width:100%;max-height:90px;object-fit:contain;border-radius:4px;margin-bottom:6px;border:1px solid rgba(255,255,255,0.1);background:#111;">`
            : `<p style="margin:0 0 6px;font-size:0.8em;color:#ccc;line-height:1.45;max-height:48px;overflow:hidden;">${_esc(item.text.slice(0, 130))}${item.text.length > 130 ? '…' : ''}</p>`;

        const placeholder = isImg ? 'Frage / Beschriftung zum Bild…' : (item.type === 'note' ? 'Kein Pflichtfeld…' : 'Antwort / Erklärung…');

        div.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px;">
                <span style="font-size:0.73em;color:${cfg.text};font-weight:bold;letter-spacing:0.5px;">${cfg.label}${isImg ? ' 🖼️' : ''}</span>
                <button class="hl-del-btn" data-id="${item.id}" style="background:none;border:none;color:#f66;cursor:pointer;font-size:0.95em;padding:0 3px;" title="Löschen">🗑️</button>
            </div>
            ${preview}
            <input type="text" class="hl-ans-input" data-id="${item.id}" value="${_esc(item.answer)}"
                placeholder="${placeholder}"
                style="width:100%;padding:4px 7px;background:#111;border:1px solid #2a2a3a;color:#bbb;border-radius:4px;font-size:0.78em;box-sizing:border-box;">
        `;
        list.appendChild(div);
    });

    list.querySelectorAll('.hl-ans-input').forEach(inp => {
        inp.addEventListener('input', e => {
            const id = parseInt(e.target.dataset.id);
            const it = hlItems.find(x => x.id === id);
            if (it) it.answer = e.target.value;
        });
    });

    list.querySelectorAll('.hl-del-btn').forEach(btn => {
        btn.addEventListener('click', e => {
            _removeHighlight(parseInt(e.currentTarget.dataset.id));
        });
    });
}

function _esc(s) {
    return String(s || '')
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}
