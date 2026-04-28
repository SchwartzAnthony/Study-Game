/**
 * workshop.js
 * Handles the "Items / Objects / Rewards" section of the Workshop screen.
 *
 * Six upload flows:
 *   1. Sprite Sheet — detect grid, preview on canvas, extract sprites, assign to rewards
 *   2. Temple Wallpaper — upload images tied to housing themes
 *   3. Image Rewards — upload PNGs linked to game reward entries
 *   4. Sound Rewards — upload audio files as button sounds
 *   5. Music Rewards — upload music tracks for the music player
 *   6. Achievements — define achievements that players can earn
 *
 * All data persisted in appState.assetLibrary via storage.js.
 */

import { appState } from './state.js';
import { saveToStorage } from './storage.js';

// ─── UNIQUE ID HELPER ──────────────────────────────────────────────────────

function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// ─── REWARD CHOICES (for assignment dropdowns) ─────────────────────────────

/**
 * Builds a flat list of { id, label } from appState.customRewards + a static catalog.
 */
function getRewardChoices() {
    const choices = [{ id: '', label: '— Unassigned —' }];

    const catalogItems = [
        'Space Map Background', 'Level Up Chime', 'Rare Parchment Pack'
    ];
    catalogItems.forEach(name => choices.push({ id: name, label: name }));

    (appState.customRewards || []).forEach(r => {
        if (r && r.name) choices.push({ id: r.name, label: r.name });
    });

    return choices;
}

// ─── HOUSING THEME CHOICES ─────────────────────────────────────────────────

const KNOWN_THEMES = [
    { id: 'obsidian-ritual', label: 'Obsidian Ritual' },
    { id: 'void-temple',     label: 'Void Temple'     },
    { id: 'crimson-vault',   label: 'Crimson Vault'   },
    { id: 'silver-sanctum',  label: 'Silver Sanctum'  },
    { id: 'arcane-library',  label: 'Arcane Library'  }
];

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 1 — SPRITE SHEET IMPORTER
// ═══════════════════════════════════════════════════════════════════════════

// Module-level state for the sprite flow
const _sprite = {
    src: null,         // dataURL of the loaded sprite sheet
    imgWidth: 0,
    imgHeight: 0,
    cols: 4,
    rows: 4,
    extracted: [],     // array of { dataURL, col, row }
};

/**
 * Wire the sprite sheet modal open button and all internal controls.
 */
function initSpriteSheet() {
    const btnOpen  = document.getElementById('btn-open-sprite-sheet');
    const modal    = document.getElementById('sprite-sheet-modal');
    const closeBtn = document.getElementById('close-sprite-sheet');
    const cancelBtn = document.getElementById('btn-sprite-cancel');

    if (btnOpen)   btnOpen.onclick   = openSpriteSheetModal;
    if (closeBtn)  closeBtn.onclick  = closeSpriteSheetModal;
    if (cancelBtn) cancelBtn.onclick = closeSpriteSheetModal;

    // File input
    const fileInput = document.getElementById('sprite-sheet-file-input');
    if (fileInput) fileInput.addEventListener('change', e => {
        const f = e.target.files[0];
        if (f) handleSpriteSheetFile(f);
        e.target.value = '';
    });

    // Drop zone
    const dropZone = document.getElementById('sprite-drop-zone');
    if (dropZone) {
        dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('asset-drop-active'); });
        dropZone.addEventListener('dragleave', () => dropZone.classList.remove('asset-drop-active'));
        dropZone.addEventListener('drop', e => {
            e.preventDefault();
            dropZone.classList.remove('asset-drop-active');
            const f = e.dataTransfer.files[0];
            if (f && f.type.startsWith('image/')) handleSpriteSheetFile(f);
        });
    }

    // Grid controls
    const colsInput = document.getElementById('sprite-cols-input');
    const rowsInput = document.getElementById('sprite-rows-input');
    const redetect  = document.getElementById('btn-sprite-redetect');
    const extract   = document.getElementById('btn-sprite-extract');
    const confirm   = document.getElementById('btn-sprite-confirm');

    if (colsInput) colsInput.addEventListener('input', () => {
        _sprite.cols = Math.max(1, parseInt(colsInput.value) || 1);
        if (_sprite.src) renderSheetPreview();
        updateDetectionSummary(_sprite.cols, _sprite.rows, 'manual');
    });
    if (rowsInput) rowsInput.addEventListener('input', () => {
        _sprite.rows = Math.max(1, parseInt(rowsInput.value) || 1);
        if (_sprite.src) renderSheetPreview();
        updateDetectionSummary(_sprite.cols, _sprite.rows, 'manual');
    });
    if (redetect)  redetect.onclick  = () => { if (_sprite.src) runAutoDetect(); };
    if (extract)   extract.onclick   = runExtractSprites;
    if (confirm)   confirm.onclick   = confirmSpriteImport;
}

function openSpriteSheetModal() {
    resetSpriteState();
    const modal = document.getElementById('sprite-sheet-modal');
    if (modal) modal.classList.remove('hidden');
}

function closeSpriteSheetModal() {
    const modal = document.getElementById('sprite-sheet-modal');
    if (modal) modal.classList.add('hidden');
}

function resetSpriteState() {
    _sprite.src = null;
    _sprite.imgWidth = 0;
    _sprite.imgHeight = 0;
    _sprite.cols = 4;
    _sprite.rows = 4;
    _sprite.extracted = [];

    setElHidden('sprite-detection-summary', true);
    setElHidden('sprite-preview-area', true);
    setElHidden('sprite-extracted-area', true);
    setElHidden('sprite-assignment-area', true);

    const confirmBtn = document.getElementById('btn-sprite-confirm');
    if (confirmBtn) confirmBtn.disabled = true;

    const count = document.getElementById('sprite-import-count');
    if (count) count.textContent = '0';

    const thumbGrid = document.getElementById('sprite-thumbnails-grid');
    if (thumbGrid) thumbGrid.innerHTML = '';

    const assignList = document.getElementById('sprite-assignment-list');
    if (assignList) assignList.innerHTML = '';

    const colsInput = document.getElementById('sprite-cols-input');
    const rowsInput = document.getElementById('sprite-rows-input');
    if (colsInput) colsInput.value = 4;
    if (rowsInput) rowsInput.value = 4;
}

/**
 * Reads the file, loads image into an offscreen canvas, then runs auto-detect.
 */
function handleSpriteSheetFile(file) {
    const reader = new FileReader();
    reader.onload = e => {
        _sprite.src = e.target.result;
        const img = new Image();
        img.onload = () => {
            _sprite.imgWidth  = img.naturalWidth;
            _sprite.imgHeight = img.naturalHeight;
            runAutoDetect();
        };
        img.src = _sprite.src;
    };
    reader.readAsDataURL(file);
}

// ─── AUTO-DETECT GRID ──────────────────────────────────────────────────────

/**
 * Scans pixel rows and columns to find empty (transparent or background-colored) bands.
 * Returns { cols, rows, confidence: 'high'|'low' }
 */
function autoDetectGrid(src, imgW, imgH) {
    const offscreen = document.createElement('canvas');
    offscreen.width  = imgW;
    offscreen.height = imgH;
    const ctx = offscreen.getContext('2d');

    const img = new Image();
    return new Promise(resolve => {
        img.onload = () => {
            ctx.drawImage(img, 0, 0);
            const imageData = ctx.getImageData(0, 0, imgW, imgH);
            const data = imageData.data;

            // Sample the corner pixel as potential background color
            const bgR = data[0], bgG = data[1], bgB = data[2];
            const colorTol = 15; // tolerance for background color matching

            // For each row: is it "empty"?
            const emptyRows = new Uint8Array(imgH);
            for (let y = 0; y < imgH; y++) {
                let allEmpty = true;
                for (let x = 0; x < imgW; x++) {
                    const i = (y * imgW + x) * 4;
                    const alpha = data[i + 3];
                    if (alpha < 10) continue; // transparent → empty
                    const dr = Math.abs(data[i]   - bgR);
                    const dg = Math.abs(data[i+1] - bgG);
                    const db = Math.abs(data[i+2] - bgB);
                    if (dr < colorTol && dg < colorTol && db < colorTol) continue; // bg-colored → empty
                    allEmpty = false;
                    break;
                }
                emptyRows[y] = allEmpty ? 1 : 0;
            }

            // For each column: is it "empty"?
            const emptyCols = new Uint8Array(imgW);
            for (let x = 0; x < imgW; x++) {
                let allEmpty = true;
                for (let y = 0; y < imgH; y++) {
                    const i = (y * imgW + x) * 4;
                    const alpha = data[i + 3];
                    if (alpha < 10) continue;
                    const dr = Math.abs(data[i]   - bgR);
                    const dg = Math.abs(data[i+1] - bgG);
                    const db = Math.abs(data[i+2] - bgB);
                    if (dr < colorTol && dg < colorTol && db < colorTol) continue;
                    allEmpty = false;
                    break;
                }
                emptyCols[x] = allEmpty ? 1 : 0;
            }

            // Count contiguous non-empty bands in rows
            const rows = countBands(emptyRows, imgH);
            const cols = countBands(emptyCols, imgW);

            const confidence = (rows >= 2 && cols >= 2) ? 'high' : 'low';
            resolve({
                rows: rows >= 1 ? rows : 4,
                cols: cols >= 1 ? cols : 4,
                confidence
            });
        };
        img.src = src;
    });
}

/** Count contiguous filled bands separated by empty lines */
function countBands(emptyFlags, size) {
    let bands = 0;
    let inBand = false;
    for (let i = 0; i < size; i++) {
        if (!emptyFlags[i]) {
            if (!inBand) { bands++; inBand = true; }
        } else {
            inBand = false;
        }
    }
    return bands;
}

async function runAutoDetect() {
    const result = await autoDetectGrid(_sprite.src, _sprite.imgWidth, _sprite.imgHeight);
    _sprite.cols = result.cols;
    _sprite.rows = result.rows;

    // Sync inputs
    const colsInput = document.getElementById('sprite-cols-input');
    const rowsInput = document.getElementById('sprite-rows-input');
    if (colsInput) colsInput.value = _sprite.cols;
    if (rowsInput) rowsInput.value = _sprite.rows;

    updateDetectionSummary(_sprite.cols, _sprite.rows, result.confidence);
    renderSheetPreview();
    showSpritePreviewArea();
}

function updateDetectionSummary(cols, rows, confidence) {
    const total = cols * rows;
    const text = document.getElementById('sprite-detection-text');
    const badge = document.getElementById('sprite-detection-confidence');
    if (text) text.textContent = `Detected: ${total} sprites (${cols} cols × ${rows} rows)`;
    if (badge) {
        if (confidence === 'manual') {
            badge.textContent = 'Manual';
            badge.style.background = '#2980b9';
        } else if (confidence === 'high') {
            badge.textContent = 'High confidence';
            badge.style.background = '#27ae60';
        } else {
            badge.textContent = 'Low confidence — please adjust';
            badge.style.background = '#e67e22';
        }
    }
    setElHidden('sprite-detection-summary', false);
}

function showSpritePreviewArea() {
    setElHidden('sprite-preview-area', false);
}

// ─── CANVAS PREVIEW WITH GRID OVERLAY ─────────────────────────────────────

function renderSheetPreview() {
    const canvas = document.getElementById('sprite-preview-canvas');
    if (!canvas || !_sprite.src) return;

    const img = new Image();
    img.onload = () => {
        // Scale canvas to fit container (max 800px wide)
        const maxW = 800;
        const scale = img.naturalWidth > maxW ? maxW / img.naturalWidth : 1;
        canvas.width  = Math.round(img.naturalWidth  * scale);
        canvas.height = Math.round(img.naturalHeight * scale);

        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        // Draw grid overlay
        const cellW = canvas.width  / _sprite.cols;
        const cellH = canvas.height / _sprite.rows;

        ctx.strokeStyle = 'rgba(155, 89, 182, 0.8)';
        ctx.lineWidth = 1.5;

        for (let c = 1; c < _sprite.cols; c++) {
            ctx.beginPath();
            ctx.moveTo(Math.round(c * cellW), 0);
            ctx.lineTo(Math.round(c * cellW), canvas.height);
            ctx.stroke();
        }
        for (let r = 1; r < _sprite.rows; r++) {
            ctx.beginPath();
            ctx.moveTo(0, Math.round(r * cellH));
            ctx.lineTo(canvas.width, Math.round(r * cellH));
            ctx.stroke();
        }

        // Label cell numbers
        ctx.fillStyle = 'rgba(215, 167, 255, 0.85)';
        ctx.font = `${Math.max(9, Math.min(14, cellW * 0.25))}px monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        let idx = 0;
        for (let r = 0; r < _sprite.rows; r++) {
            for (let c = 0; c < _sprite.cols; c++) {
                const cx = c * cellW + cellW / 2;
                const cy = r * cellH + cellH / 2;
                ctx.fillText(String(idx + 1), cx, cy);
                idx++;
            }
        }
    };
    img.src = _sprite.src;
}

// ─── EXTRACT SPRITES ──────────────────────────────────────────────────────

function runExtractSprites() {
    if (!_sprite.src || _sprite.cols < 1 || _sprite.rows < 1) return;
    _sprite.extracted = [];

    const img = new Image();
    img.onload = () => {
        const cellW = Math.floor(img.naturalWidth  / _sprite.cols);
        const cellH = Math.floor(img.naturalHeight / _sprite.rows);

        for (let r = 0; r < _sprite.rows; r++) {
            for (let c = 0; c < _sprite.cols; c++) {
                const offscreen = document.createElement('canvas');
                offscreen.width  = cellW;
                offscreen.height = cellH;
                const ctx = offscreen.getContext('2d');
                ctx.drawImage(img, c * cellW, r * cellH, cellW, cellH, 0, 0, cellW, cellH);
                _sprite.extracted.push({
                    dataURL: offscreen.toDataURL('image/png'),
                    col: c,
                    row: r
                });
            }
        }

        renderExtractedGrid();
        renderAssignmentPanel();
        setElHidden('sprite-extracted-area', false);
        setElHidden('sprite-assignment-area', false);

        const countLabel  = document.getElementById('sprite-count-label');
        const importCount = document.getElementById('sprite-import-count');
        if (countLabel)  countLabel.textContent  = _sprite.extracted.length;
        if (importCount) importCount.textContent  = _sprite.extracted.length;

        const confirmBtn = document.getElementById('btn-sprite-confirm');
        if (confirmBtn) confirmBtn.disabled = false;
    };
    img.src = _sprite.src;
}

function renderExtractedGrid() {
    const grid = document.getElementById('sprite-thumbnails-grid');
    if (!grid) return;
    grid.innerHTML = '';

    _sprite.extracted.forEach((sprite, i) => {
        const thumb = document.createElement('div');
        thumb.className = 'asset-thumb-item';
        thumb.innerHTML = `
            <img src="${sprite.dataURL}" alt="Sprite ${i+1}" title="Sprite #${i+1} (col ${sprite.col}, row ${sprite.row})">
            <div class="asset-thumb-label">#${i+1}</div>
        `;
        grid.appendChild(thumb);
    });
}

function renderAssignmentPanel() {
    const list = document.getElementById('sprite-assignment-list');
    if (!list) return;
    list.innerHTML = '';

    const choices = getRewardChoices();

    _sprite.extracted.forEach((sprite, i) => {
        const row = document.createElement('div');
        row.className = 'asset-assign-row';
        row.dataset.index = i;

        const img = document.createElement('img');
        img.src = sprite.dataURL;
        img.className = 'asset-assign-thumb';

        const label = document.createElement('span');
        label.textContent = `Sprite #${i+1}`;
        label.style.cssText = 'font-size:0.82em;color:#d7a7ff;min-width:60px;';

        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.placeholder = `Sprite ${i+1}`;
        nameInput.className = 'asset-name-input';
        nameInput.dataset.spriteIndex = i;

        const select = document.createElement('select');
        select.className = 'asset-assign-select';
        select.dataset.spriteIndex = i;
        choices.forEach(choice => {
            const opt = document.createElement('option');
            opt.value = choice.id;
            opt.textContent = choice.label;
            select.appendChild(opt);
        });

        row.appendChild(img);
        row.appendChild(label);
        row.appendChild(nameInput);
        row.appendChild(select);
        list.appendChild(row);
    });
}

function confirmSpriteImport() {
    if (!_sprite.extracted.length) return;
    appState.assetLibrary = appState.assetLibrary || { sprites: [], spriteSheets: [], wallpapers: [], imageRewards: [] };

    const sheetId = uid();

    // Save the sprite sheet metadata
    appState.assetLibrary.spriteSheets.push({
        id:          sheetId,
        name:        `Sheet-${sheetId}`,
        src:         _sprite.src,
        cols:        _sprite.cols,
        rows:        _sprite.rows,
        imgWidth:    _sprite.imgWidth,
        imgHeight:   _sprite.imgHeight,
        extractedAt: new Date().toISOString()
    });

    // Save each extracted sprite with its assignment
    const assignRows = document.querySelectorAll('#sprite-assignment-list .asset-assign-row');
    _sprite.extracted.forEach((sprite, i) => {
        const nameInput = document.querySelector(`#sprite-assignment-list input[data-sprite-index="${i}"]`);
        const select    = document.querySelector(`#sprite-assignment-list select[data-sprite-index="${i}"]`);
        const name = (nameInput && nameInput.value.trim()) ? nameInput.value.trim() : `Sprite ${i+1}`;
        const assignedTo = (select && select.value) ? [select.value] : [];

        const spriteEntry = {
            id:         uid(),
            sheetId,
            name,
            src:        sprite.dataURL,
            col:        sprite.col,
            row:        sprite.row,
            assignedTo
        };
        appState.assetLibrary.sprites.push(spriteEntry);

        // Patch the image of any matching custom reward
        if (assignedTo.length > 0) {
            patchRewardImage(assignedTo[0], sprite.dataURL);
        }
    });

    saveToStorage();
    alert(`✅ Imported ${_sprite.extracted.length} sprites into the Asset Library!`);
    closeSpriteSheetModal();
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 2 — TEMPLE WALLPAPER IMPORTER
// ═══════════════════════════════════════════════════════════════════════════

// Staged wallpaper entries before confirm
let _pendingWallpapers = [];

function initWallpaperUpload() {
    const btnOpen  = document.getElementById('btn-open-wallpaper-upload');
    const modal    = document.getElementById('wallpaper-upload-modal');
    const closeBtn = document.getElementById('close-wallpaper-upload');
    const cancelBtn = document.getElementById('btn-wallpaper-cancel');
    const confirmBtn = document.getElementById('btn-wallpaper-confirm');
    const fileInput = document.getElementById('wallpaper-file-input');
    const dropZone  = document.getElementById('wallpaper-drop-zone');

    if (btnOpen)   btnOpen.onclick    = openWallpaperModal;
    if (closeBtn)  closeBtn.onclick   = closeWallpaperModal;
    if (cancelBtn) cancelBtn.onclick  = closeWallpaperModal;
    if (confirmBtn) confirmBtn.onclick = confirmWallpaperImport;

    if (fileInput) fileInput.addEventListener('change', e => {
        handleWallpaperFiles(Array.from(e.target.files));
        e.target.value = '';
    });
    if (dropZone) {
        dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('asset-drop-active'); });
        dropZone.addEventListener('dragleave', () => dropZone.classList.remove('asset-drop-active'));
        dropZone.addEventListener('drop', e => {
            e.preventDefault();
            dropZone.classList.remove('asset-drop-active');
            const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
            handleWallpaperFiles(files);
        });
    }
}

function openWallpaperModal() {
    _pendingWallpapers = [];
    const grid = document.getElementById('wallpaper-preview-grid');
    if (grid) grid.innerHTML = '';
    const btn = document.getElementById('btn-wallpaper-confirm');
    if (btn) btn.disabled = true;
    const modal = document.getElementById('wallpaper-upload-modal');
    if (modal) modal.classList.remove('hidden');
}

function closeWallpaperModal() {
    const modal = document.getElementById('wallpaper-upload-modal');
    if (modal) modal.classList.add('hidden');
}

function handleWallpaperFiles(files) {
    if (!files || files.length === 0) return;
    let loaded = 0;
    const grid = document.getElementById('wallpaper-preview-grid');

    files.forEach(file => {
        const reader = new FileReader();
        reader.onload = e => {
            const src = e.target.result;
            const entry = { id: uid(), name: file.name.replace(/\.[^.]+$/, ''), src, assignedThemes: [] };
            _pendingWallpapers.push(entry);
            loaded++;

            if (grid) {
                const card = buildWallpaperCard(entry);
                grid.appendChild(card);
            }

            if (loaded === files.length) {
                const btn = document.getElementById('btn-wallpaper-confirm');
                if (btn) btn.disabled = false;
            }
        };
        reader.readAsDataURL(file);
    });
}

function buildWallpaperCard(entry) {
    const card = document.createElement('div');
    card.className = 'asset-card';
    card.dataset.entryId = entry.id;

    const img = document.createElement('img');
    img.src = entry.src;
    img.className = 'asset-card-thumb';
    img.alt = entry.name;

    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.value = entry.name;
    nameInput.className = 'asset-name-input';
    nameInput.style.marginTop = '6px';
    nameInput.addEventListener('input', () => { entry.name = nameInput.value.trim() || entry.name; });

    const themeLabel = document.createElement('label');
    themeLabel.style.cssText = 'font-size:0.78em;color:#d7a7ff;margin-top:6px;display:block;';
    themeLabel.textContent = 'Assign to Theme:';

    const themeSelect = document.createElement('select');
    themeSelect.className = 'asset-assign-select';
    themeSelect.style.width = '100%';
    const noneOpt = document.createElement('option');
    noneOpt.value = '';
    noneOpt.textContent = '— None —';
    themeSelect.appendChild(noneOpt);
    KNOWN_THEMES.forEach(t => {
        const opt = document.createElement('option');
        opt.value = t.id;
        opt.textContent = t.label;
        if (t.id === (appState.housing && appState.housing.selectedTheme)) opt.selected = true;
        themeSelect.appendChild(opt);
    });
    themeSelect.addEventListener('change', () => {
        entry.assignedThemes = themeSelect.value ? [themeSelect.value] : [];
    });

    card.appendChild(img);
    card.appendChild(nameInput);
    card.appendChild(themeLabel);
    card.appendChild(themeSelect);
    return card;
}

function confirmWallpaperImport() {
    if (!_pendingWallpapers.length) return;
    appState.assetLibrary = appState.assetLibrary || { sprites: [], spriteSheets: [], wallpapers: [], imageRewards: [] };
    _pendingWallpapers.forEach(entry => appState.assetLibrary.wallpapers.push(entry));
    saveToStorage();
    alert(`✅ Saved ${_pendingWallpapers.length} wallpaper(s) to the Asset Library!`);
    closeWallpaperModal();
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 3 — IMAGE REWARDS IMPORTER
// ═══════════════════════════════════════════════════════════════════════════

let _pendingImageRewards = [];

function initImageRewards() {
    const btnOpen   = document.getElementById('btn-open-image-rewards');
    const modal     = document.getElementById('image-rewards-modal');
    const closeBtn  = document.getElementById('close-image-rewards');
    const cancelBtn = document.getElementById('btn-image-rewards-cancel');
    const confirmBtn = document.getElementById('btn-image-rewards-confirm');
    const fileInput = document.getElementById('image-rewards-file-input');
    const dropZone  = document.getElementById('image-rewards-drop-zone');

    if (btnOpen)   btnOpen.onclick    = openImageRewardsModal;
    if (closeBtn)  closeBtn.onclick   = closeImageRewardsModal;
    if (cancelBtn) cancelBtn.onclick  = closeImageRewardsModal;
    if (confirmBtn) confirmBtn.onclick = confirmImageRewardImport;

    if (fileInput) fileInput.addEventListener('change', e => {
        handleImageRewardFiles(Array.from(e.target.files));
        e.target.value = '';
    });
    if (dropZone) {
        dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('asset-drop-active'); });
        dropZone.addEventListener('dragleave', () => dropZone.classList.remove('asset-drop-active'));
        dropZone.addEventListener('drop', e => {
            e.preventDefault();
            dropZone.classList.remove('asset-drop-active');
            const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
            handleImageRewardFiles(files);
        });
    }
}

function openImageRewardsModal() {
    _pendingImageRewards = [];
    const grid = document.getElementById('image-rewards-preview-grid');
    if (grid) grid.innerHTML = '';
    const btn = document.getElementById('btn-image-rewards-confirm');
    if (btn) btn.disabled = true;
    const modal = document.getElementById('image-rewards-modal');
    if (modal) modal.classList.remove('hidden');
}

function closeImageRewardsModal() {
    const modal = document.getElementById('image-rewards-modal');
    if (modal) modal.classList.add('hidden');
}

function handleImageRewardFiles(files) {
    if (!files || files.length === 0) return;
    let loaded = 0;
    const grid = document.getElementById('image-rewards-preview-grid');

    files.forEach(file => {
        const reader = new FileReader();
        reader.onload = e => {
            const src = e.target.result;
            const entry = {
                id:               uid(),
                name:             file.name.replace(/\.[^.]+$/, ''),
                src:              [src],
                cost:             100,
                assignedRewardIds: []
            };
            _pendingImageRewards.push(entry);
            loaded++;

            if (grid) {
                const card = buildImageRewardCard(entry);
                grid.appendChild(card);
            }

            if (loaded === files.length) {
                const btn = document.getElementById('btn-image-rewards-confirm');
                if (btn) btn.disabled = false;
            }
        };
        reader.readAsDataURL(file);
    });
}

function buildImageRewardCard(entry) {
    const choices = getRewardChoices();

    const card = document.createElement('div');
    card.className = 'asset-card';
    card.dataset.entryId = entry.id;

    const img = document.createElement('img');
    img.src = entry.src[0];
    img.className = 'asset-card-thumb';
    img.alt = entry.name;

    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.value = entry.name;
    nameInput.placeholder = 'Reward name';
    nameInput.className = 'asset-name-input';
    nameInput.style.marginTop = '6px';
    nameInput.addEventListener('input', () => { entry.name = nameInput.value.trim() || entry.name; });

    const costRow = document.createElement('div');
    costRow.style.cssText = 'display:flex;align-items:center;gap:6px;margin-top:6px;';
    const costLabel = document.createElement('label');
    costLabel.textContent = 'Cost 🪙';
    costLabel.style.cssText = 'font-size:0.78em;color:#d7a7ff;';
    const costInput = document.createElement('input');
    costInput.type = 'number';
    costInput.min = '0';
    costInput.value = entry.cost;
    costInput.className = 'asset-number-input';
    costInput.style.width = '70px';
    costInput.addEventListener('input', () => { entry.cost = parseInt(costInput.value) || 0; });
    costRow.appendChild(costLabel);
    costRow.appendChild(costInput);

    const assignLabel = document.createElement('label');
    assignLabel.style.cssText = 'font-size:0.78em;color:#d7a7ff;margin-top:6px;display:block;';
    assignLabel.textContent = 'Link to Reward:';

    const select = document.createElement('select');
    select.className = 'asset-assign-select';
    select.style.width = '100%';
    choices.forEach(choice => {
        const opt = document.createElement('option');
        opt.value = choice.id;
        opt.textContent = choice.label;
        select.appendChild(opt);
    });
    select.addEventListener('change', () => {
        entry.assignedRewardIds = select.value ? [select.value] : [];
    });

    card.appendChild(img);
    card.appendChild(nameInput);
    card.appendChild(costRow);
    card.appendChild(assignLabel);
    card.appendChild(select);
    return card;
}

function confirmImageRewardImport() {
    if (!_pendingImageRewards.length) return;
    appState.assetLibrary = appState.assetLibrary || { sprites: [], spriteSheets: [], wallpapers: [], imageRewards: [] };

    _pendingImageRewards.forEach(entry => {
        appState.assetLibrary.imageRewards.push(entry);

        // Patch matching customRewards with the uploaded image
        entry.assignedRewardIds.forEach(rewardName => {
            patchRewardImage(rewardName, entry.src[0]);
        });

        // Also add to customRewards if not already present
        const exists = (appState.customRewards || []).some(r => r.name === entry.name);
        if (!exists) {
            appState.customRewards = appState.customRewards || [];
            appState.customRewards.push({
                name:        entry.name,
                cost:        entry.cost,
                description: 'Uploaded image reward.',
                image:       entry.src[0]
            });
        }
    });

    saveToStorage();
    alert(`✅ Saved ${_pendingImageRewards.length} image reward(s) to the Asset Library and Reward Pool!`);
    closeImageRewardsModal();
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 4 — SOUND REWARDS IMPORTER
// ═══════════════════════════════════════════════════════════════════════════

let _pendingSoundRewards = [];

function initSoundRewards() {
    const btnOpen   = document.getElementById('btn-open-sound-rewards');
    const modal     = document.getElementById('sound-rewards-modal');
    const closeBtn  = document.getElementById('close-sound-rewards');
    const cancelBtn = document.getElementById('btn-sound-rewards-cancel');
    const confirmBtn = document.getElementById('btn-sound-rewards-confirm');
    const fileInput = document.getElementById('sound-rewards-file-input');
    const dropZone  = document.getElementById('sound-rewards-drop-zone');

    if (btnOpen)   btnOpen.onclick    = openSoundRewardsModal;
    if (closeBtn)  closeBtn.onclick   = closeSoundRewardsModal;
    if (cancelBtn) cancelBtn.onclick  = closeSoundRewardsModal;
    if (confirmBtn) confirmBtn.onclick = confirmSoundRewardImport;

    if (fileInput) fileInput.addEventListener('change', e => {
        handleSoundRewardFiles(Array.from(e.target.files));
        e.target.value = '';
    });
    if (dropZone) {
        dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('asset-drop-active'); });
        dropZone.addEventListener('dragleave', () => dropZone.classList.remove('asset-drop-active'));
        dropZone.addEventListener('drop', e => {
            e.preventDefault();
            dropZone.classList.remove('asset-drop-active');
            const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('audio/'));
            handleSoundRewardFiles(files);
        });
    }
}

function openSoundRewardsModal() {
    _pendingSoundRewards = [];
    const grid = document.getElementById('sound-rewards-preview-grid');
    if (grid) grid.innerHTML = '';
    const btn = document.getElementById('btn-sound-rewards-confirm');
    if (btn) btn.disabled = true;
    const modal = document.getElementById('sound-rewards-modal');
    if (modal) modal.classList.remove('hidden');
}

function closeSoundRewardsModal() {
    const modal = document.getElementById('sound-rewards-modal');
    if (modal) modal.classList.add('hidden');
}

function handleSoundRewardFiles(files) {
    if (!files || files.length === 0) return;
    let loaded = 0;
    const grid = document.getElementById('sound-rewards-preview-grid');

    files.forEach(file => {
        const reader = new FileReader();
        reader.onload = e => {
            const src = e.target.result;
            const entry = {
                id:        uid(),
                name:      file.name.replace(/\.[^.]+$/, ''),
                src:       src,
                duration:  0,
                rewardType: 'sound'
            };
            _pendingSoundRewards.push(entry);
            loaded++;

            if (grid) {
                const card = buildSoundRewardCard(entry);
                grid.appendChild(card);
            }

            if (loaded === files.length) {
                const btn = document.getElementById('btn-sound-rewards-confirm');
                if (btn) btn.disabled = false;
            }
        };
        reader.readAsDataURL(file);
    });
}

function buildSoundRewardCard(entry) {
    const card = document.createElement('div');
    card.className = 'asset-card';
    card.dataset.entryId = entry.id;

    const player = document.createElement('audio');
    player.controls = true;
    player.src = entry.src;
    player.style.width = '100%';
    player.style.borderRadius = '4px';

    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.value = entry.name;
    nameInput.placeholder = 'Sound name';
    nameInput.className = 'asset-name-input';
    nameInput.style.marginTop = '6px';
    nameInput.addEventListener('input', () => { entry.name = nameInput.value.trim() || entry.name; });

    card.appendChild(player);
    card.appendChild(nameInput);
    return card;
}

function confirmSoundRewardImport() {
    if (!_pendingSoundRewards.length) return;
    appState.assetLibrary = appState.assetLibrary || { sprites: [], spriteSheets: [], wallpapers: [], imageRewards: [], soundRewards: [], musicRewards: [], achievements: [] };

    _pendingSoundRewards.forEach(entry => {
        appState.assetLibrary.soundRewards.push(entry);
    });

    saveToStorage();
    alert(`✅ Saved ${_pendingSoundRewards.length} sound reward(s) to the Asset Library!`);
    closeSoundRewardsModal();
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 5 — MUSIC REWARDS IMPORTER
// ═══════════════════════════════════════════════════════════════════════════

let _pendingMusicRewards = [];

function initMusicRewards() {
    const btnOpen   = document.getElementById('btn-open-music-rewards');
    const modal     = document.getElementById('music-rewards-modal');
    const closeBtn  = document.getElementById('close-music-rewards');
    const cancelBtn = document.getElementById('btn-music-rewards-cancel');
    const confirmBtn = document.getElementById('btn-music-rewards-confirm');
    const fileInput = document.getElementById('music-rewards-file-input');
    const dropZone  = document.getElementById('music-rewards-drop-zone');

    if (btnOpen)   btnOpen.onclick    = openMusicRewardsModal;
    if (closeBtn)  closeBtn.onclick   = closeMusicRewardsModal;
    if (cancelBtn) cancelBtn.onclick  = closeMusicRewardsModal;
    if (confirmBtn) confirmBtn.onclick = confirmMusicRewardImport;

    if (fileInput) fileInput.addEventListener('change', e => {
        handleMusicRewardFiles(Array.from(e.target.files));
        e.target.value = '';
    });
    if (dropZone) {
        dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('asset-drop-active'); });
        dropZone.addEventListener('dragleave', () => dropZone.classList.remove('asset-drop-active'));
        dropZone.addEventListener('drop', e => {
            e.preventDefault();
            dropZone.classList.remove('asset-drop-active');
            const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('audio/'));
            handleMusicRewardFiles(files);
        });
    }
}

function openMusicRewardsModal() {
    _pendingMusicRewards = [];
    const grid = document.getElementById('music-rewards-preview-grid');
    if (grid) grid.innerHTML = '';
    const btn = document.getElementById('btn-music-rewards-confirm');
    if (btn) btn.disabled = true;
    const modal = document.getElementById('music-rewards-modal');
    if (modal) modal.classList.remove('hidden');
}

function closeMusicRewardsModal() {
    const modal = document.getElementById('music-rewards-modal');
    if (modal) modal.classList.add('hidden');
}

function handleMusicRewardFiles(files) {
    if (!files || files.length === 0) return;
    let loaded = 0;
    const grid = document.getElementById('music-rewards-preview-grid');

    files.forEach(file => {
        const reader = new FileReader();
        reader.onload = e => {
            const src = e.target.result;
            const entry = {
                id:     uid(),
                title:  file.name.replace(/\.[^.]+$/, ''),
                artist: 'Unknown',
                src:    src,
                duration: 0,
                rewardType: 'music'
            };
            _pendingMusicRewards.push(entry);
            loaded++;

            if (grid) {
                const card = buildMusicRewardCard(entry);
                grid.appendChild(card);
            }

            if (loaded === files.length) {
                const btn = document.getElementById('btn-music-rewards-confirm');
                if (btn) btn.disabled = false;
            }
        };
        reader.readAsDataURL(file);
    });
}

function buildMusicRewardCard(entry) {
    const card = document.createElement('div');
    card.className = 'asset-card';
    card.dataset.entryId = entry.id;

    const player = document.createElement('audio');
    player.controls = true;
    player.src = entry.src;
    player.style.width = '100%';
    player.style.borderRadius = '4px';

    const titleInput = document.createElement('input');
    titleInput.type = 'text';
    titleInput.value = entry.title;
    titleInput.placeholder = 'Song title';
    titleInput.className = 'asset-name-input';
    titleInput.style.marginTop = '6px';
    titleInput.addEventListener('input', () => { entry.title = titleInput.value.trim() || entry.title; });

    const artistInput = document.createElement('input');
    artistInput.type = 'text';
    artistInput.value = entry.artist;
    artistInput.placeholder = 'Artist name';
    artistInput.className = 'asset-name-input';
    artistInput.style.marginTop = '6px';
    artistInput.addEventListener('input', () => { entry.artist = artistInput.value.trim() || entry.artist; });

    card.appendChild(player);
    card.appendChild(titleInput);
    card.appendChild(artistInput);
    return card;
}

function confirmMusicRewardImport() {
    if (!_pendingMusicRewards.length) return;
    appState.assetLibrary = appState.assetLibrary || { sprites: [], spriteSheets: [], wallpapers: [], imageRewards: [], soundRewards: [], musicRewards: [], achievements: [] };

    _pendingMusicRewards.forEach(entry => {
        appState.assetLibrary.musicRewards.push(entry);
    });

    saveToStorage();
    alert(`✅ Saved ${_pendingMusicRewards.length} music track(s) to the Asset Library!`);
    closeMusicRewardsModal();
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 6 — ACHIEVEMENTS IMPORTER
// ═══════════════════════════════════════════════════════════════════════════

let _pendingAchievements = [];

function initAchievements() {
    const btnOpen   = document.getElementById('btn-open-achievements');
    const modal     = document.getElementById('achievements-modal');
    const closeBtn  = document.getElementById('close-achievements');
    const cancelBtn = document.getElementById('btn-achievements-cancel');
    const confirmBtn = document.getElementById('btn-achievements-confirm');
    const addBtn    = document.getElementById('btn-add-achievement');

    if (btnOpen)   btnOpen.onclick    = openAchievementsModal;
    if (closeBtn)  closeBtn.onclick   = closeAchievementsModal;
    if (cancelBtn) cancelBtn.onclick  = closeAchievementsModal;
    if (confirmBtn) confirmBtn.onclick = confirmAchievementsImport;
    if (addBtn)    addBtn.onclick     = addNewAchievement;
}

function openAchievementsModal() {
    _pendingAchievements = [];
    const grid = document.getElementById('achievements-preview-grid');
    if (grid) grid.innerHTML = '';
    const btn = document.getElementById('btn-achievements-confirm');
    if (btn) btn.disabled = true;
    const modal = document.getElementById('achievements-modal');
    if (modal) modal.classList.remove('hidden');
}

function closeAchievementsModal() {
    const modal = document.getElementById('achievements-modal');
    if (modal) modal.classList.add('hidden');
}

function addNewAchievement() {
    const nameInput = document.getElementById('achievement-name-input');
    const descInput = document.getElementById('achievement-desc-input');

    const name = nameInput ? nameInput.value.trim() : '';
    const desc = descInput ? descInput.value.trim() : '';

    if (!name) {
        alert('Please enter an achievement name.');
        return;
    }

    const achievement = {
        id:          uid(),
        name:        name,
        description: desc,
        icon:        '🏆',
        completed:   false,
        createdAt:   new Date().toISOString()
    };

    _pendingAchievements.push(achievement);

    if (nameInput) nameInput.value = '';
    if (descInput) descInput.value = '';

    renderAchievementsList();

    const confirmBtn = document.getElementById('btn-achievements-confirm');
    if (confirmBtn) confirmBtn.disabled = false;
}

function renderAchievementsList() {
    const grid = document.getElementById('achievements-preview-grid');
    if (!grid) return;
    grid.innerHTML = '';

    _pendingAchievements.forEach((achievement, i) => {
        const card = document.createElement('div');
        card.className = 'asset-card';
        card.dataset.index = i;

        const iconSpan = document.createElement('span');
        iconSpan.style.cssText = 'font-size:2.5em;text-align:center;';
        iconSpan.textContent = achievement.icon;

        const nameSpan = document.createElement('div');
        nameSpan.style.cssText = 'font-weight:700;color:#d7a7ff;font-size:0.95em;';
        nameSpan.textContent = achievement.name;

        const descSpan = document.createElement('div');
        descSpan.style.cssText = 'font-size:0.75em;color:#bfd2c5;margin-top:4px;line-height:1.3;';
        descSpan.textContent = achievement.description;

        const removeBtn = document.createElement('button');
        removeBtn.className = 'btn-secondary';
        removeBtn.style.cssText = 'margin-top:8px;width:100%;padding:4px;font-size:0.8em;';
        removeBtn.textContent = 'Remove';
        removeBtn.onclick = () => {
            _pendingAchievements.splice(i, 1);
            renderAchievementsList();
            if (_pendingAchievements.length === 0) {
                const confirmBtn = document.getElementById('btn-achievements-confirm');
                if (confirmBtn) confirmBtn.disabled = true;
            }
        };

        card.appendChild(iconSpan);
        card.appendChild(nameSpan);
        card.appendChild(descSpan);
        card.appendChild(removeBtn);
        grid.appendChild(card);
    });
}

function confirmAchievementsImport() {
    if (!_pendingAchievements.length) return;
    appState.assetLibrary = appState.assetLibrary || { sprites: [], spriteSheets: [], wallpapers: [], imageRewards: [], soundRewards: [], musicRewards: [], achievements: [] };

    _pendingAchievements.forEach(achievement => {
        appState.assetLibrary.achievements.push(achievement);
        // Initialize achievement as available (not yet completed)
        if (!appState.earnedAchievements) appState.earnedAchievements = { completed: [], available: [] };
        appState.earnedAchievements.available.push(achievement.id);
    });

    saveToStorage();
    alert(`✅ Saved ${_pendingAchievements.length} achievement(s) to the Asset Library!`);
    closeAchievementsModal();
}

// ─── SHARED HELPERS ────────────────────────────────────────────────────────

/** Set element visibility by toggling the 'hidden' class */
function setElHidden(id, hidden) {
    const el = document.getElementById(id);
    if (!el) return;
    if (hidden) {
        el.classList.add('hidden');
    } else {
        el.classList.remove('hidden');
        // Override any inline display:none from flex declarations in HTML
        if (el.style.display === 'none') el.style.display = '';
    }
}

/** Update an existing customReward's image by name */
function patchRewardImage(rewardName, src) {
    if (!rewardName || !src) return;
    const reward = (appState.customRewards || []).find(r => r.name === rewardName);
    if (reward) reward.image = src;
}

// ─── INIT ENTRY POINT ──────────────────────────────────────────────────────

/**
 * Main init called from app.js after ensureDesignSystemState.
 * Wires up all six upload flows.
 */
export function initWorkshopItems() {
    initSpriteSheet();
    initWallpaperUpload();
    initImageRewards();
    initSoundRewards();
    initMusicRewards();
    initAchievements();
}
