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

let hlDoc     = null;
let hlType    = 'flash';   // currently selected type
let hlItems   = [];        // { id, text, type, answer, section }

export function getHighlightItems() { return hlItems; }

// ---------------------------------------------------------------------------
// Open the highlighter with a File object
// ---------------------------------------------------------------------------
export async function openPdfHighlighter(file) {
    hlItems = [];
    hlDoc   = null;

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

    // Clear all button
    const clearBtn = document.getElementById('btn-hl-clear');
    if (clearBtn) clearBtn.addEventListener('click', () => {
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
        switch (item.type) {
            case 'flash':
                world.flashcards.push({
                    section: sec,
                    question: item.text,
                    answer:   item.answer || item.text.slice(0, 120),
                    interval: 0, ease: 2.5, nextReview: 0, burned: false,
                });
                break;
            case 'quiz':
                (world.quizzes = world.quizzes || []).push({ section: sec, question: item.text, answer: item.answer || '' });
                break;
            case 'exam':
                (world.exams = world.exams || []).push({ section: sec, question: item.text, answer: item.answer || '' });
                break;
            case 'note':
                world.content[sec] += (world.content[sec] ? '\n\n' : '') + item.text;
                break;
            case 'read':
                // Speed-read text — appended with a !SECTION! separator so the
                // read-modal paginates it as its own page
                world.content[sec] += (world.content[sec] ? '\n\n!SECTION!\n\n' : '') + item.text;
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
    const container = _el('hl-pdf-content');
    container.innerHTML = '<p style="color:#555;text-align:center;margin-top:60px;font-family:Cinzel,serif;">Lade Seiten…</p>';

    const pages = [];
    for (let i = 1; i <= hlDoc.numPages; i++) {
        const page  = await hlDoc.getPage(i);
        const tc    = await page.getTextContent();

        // Build readable text respecting line breaks from vertical position changes
        let text  = '';
        let lastY = null;
        let lastX = null;
        for (const item of tc.items) {
            if (!item.str) continue;
            const ty = item.transform[5];
            const tx = item.transform[4];
            if (lastY !== null) {
                const dy = Math.abs(ty - lastY);
                if (dy > 4) {
                    text += '\n';
                } else if (tx > (lastX || 0) + 6) {
                    text += ' ';
                }
            }
            text  += item.str;
            lastY  = ty;
            lastX  = tx + (item.width || item.str.length * 5);
        }

        if (text.trim()) pages.push({ num: i, text: text.trim() });
    }

    container.innerHTML = '';

    if (pages.length === 0) {
        container.innerHTML = '<p style="color:#888;text-align:center;margin-top:60px;">Kein lesbarer Text gefunden (gescanntes PDF?).</p>';
        return;
    }

    for (const p of pages) {
        // Page separator
        const sep = document.createElement('div');
        sep.style.cssText = 'text-align:center;color:#444;font-size:0.78em;margin:22px 0 6px;padding:3px 0;border-top:1px solid #222;letter-spacing:2px;';
        sep.textContent = `— Seite ${p.num} —`;
        container.appendChild(sep);

        // Text block
        const block = document.createElement('div');
        block.className   = 'hl-page-text';
        block.dataset.page = p.num;
        block.style.cssText = 'white-space:pre-wrap;padding:10px 14px;border-radius:5px;background:rgba(255,255,255,0.025);line-height:1.75;';
        block.textContent   = p.text;
        container.appendChild(block);
    }

    // Single mouseup listener on container
    container.removeEventListener('mouseup', _onMouseUp);
    container.addEventListener('mouseup', _onMouseUp);
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
        list.innerHTML = '<p style="color:#444;font-size:0.82em;text-align:center;margin-top:24px;">Noch keine Markierungen.<br><br>Text im PDF markieren,<br>dann Typ wählen.</p>';
        return;
    }

    list.innerHTML = '';

    hlItems.forEach(item => {
        const cfg = TYPE_CONFIG[item.type];
        const div = document.createElement('div');
        div.style.cssText = `border:1px solid ${cfg.border};border-radius:7px;padding:9px 10px;margin-bottom:9px;background:${cfg.bg};`;
        div.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px;">
                <span style="font-size:0.73em;color:${cfg.text};font-weight:bold;letter-spacing:0.5px;">${cfg.label}</span>
                <button class="hl-del-btn" data-id="${item.id}" style="background:none;border:none;color:#f66;cursor:pointer;font-size:0.95em;padding:0 3px;" title="Löschen">🗑️</button>
            </div>
            <p style="margin:0 0 6px;font-size:0.8em;color:#ccc;line-height:1.45;max-height:48px;overflow:hidden;">${_esc(item.text.slice(0, 130))}${item.text.length > 130 ? '…' : ''}</p>
            <input type="text" class="hl-ans-input" data-id="${item.id}" value="${_esc(item.answer)}"
                placeholder="${item.type === 'note' ? 'Kein Pflichtfeld…' : 'Antwort / Erklärung…'}"
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
