import { appState, getSafeImageSrc } from './scripts/state.js';
import { awardGold, awardInk, awardPaper, updateEconomyUI } from './scripts/economy.js';
import { saveToStorage } from './scripts/storage.js';
import { generateMapCoordinates } from './scripts/mapRenderer.js';
import { launchArcaneDefenseGame, launchTriviaGame, launchMemoryGame, startFlashMatchGame, launchSpellweaverGame, launchRitualAlignmentGame } from './scripts/minigames.js';
import { buyItem, renderStore, renderUploadedRewards, deleteUploadedReward, buyCustomReward } from './scripts/store.js';
import { loadFileToEditor, cancelEdit, saveAndProcessWorld } from './scripts/parser.js';
import { initMindMap } from './scripts/mindmapRenderer.js';

function sanitizeRewardImages() {
    if (!appState || !Array.isArray(appState.customRewards)) return;
    for (let i = 0; i < appState.customRewards.length; i++) {
        const r = appState.customRewards[i];
        if (r && r.image) {
            const safe = getSafeImageSrc(r.image);
            r.image = safe; // may be null
        }
    }
}

// UI Elements
const universeScreen = document.getElementById('universe-screen');
const hubScreen = document.getElementById('hub-screen');
const editorScreen = document.getElementById('editor-screen');
const homeScreen = document.getElementById('home-screen');
const workshopScreen = document.getElementById('workshop-screen');
const fileInput = document.getElementById('fileUpload');
const editor = document.getElementById('markdown-editor');
const mapSection = document.getElementById('map-section');
const mapContainer = document.getElementById('map-container');
const worldTitle = document.getElementById('world-title');
const hubSelector = document.getElementById('hub-selector');

if (document.getElementById('btn-goto-worlds')) {
    document.getElementById('btn-goto-worlds').addEventListener('click', () => {
        homeScreen.classList.add('hidden');
        universeScreen.classList.remove('hidden');
        renderShelf(); // Render the new Universe bookshelf
    });
}
if (document.getElementById('btn-goto-workshop')) {
    document.getElementById('btn-goto-workshop').addEventListener('click', () => {
        homeScreen.classList.add('hidden');
        workshopScreen.classList.remove('hidden');
    });
}
if (document.getElementById('btn-back-home')) {
    document.getElementById('btn-back-home').addEventListener('click', () => {
        universeScreen.classList.add('hidden');
        homeScreen.classList.remove('hidden');
    });
}
if (document.getElementById('btn-back-home-from-workshop')) {
    document.getElementById('btn-back-home-from-workshop').addEventListener('click', () => {
        workshopScreen.classList.add('hidden');
        homeScreen.classList.remove('hidden');
    });
}
if (document.getElementById('btn-back-universe')) {
    document.getElementById('btn-back-universe').addEventListener('click', () => {
        hubScreen.classList.add('hidden');
        universeScreen.classList.remove('hidden');
        renderShelf();
    });
}

if (document.getElementById('app-title-btn')) {
    document.getElementById('app-title-btn').addEventListener('click', () => {
        universeScreen.classList.add('hidden');
        hubScreen.classList.add('hidden');
        if (workshopScreen) workshopScreen.classList.add('hidden');
        homeScreen.classList.remove('hidden');
    });
}

// --- WORKSHOP PDF CONVERSION ---
if (document.getElementById('btn-convert-pdf')) {
    const pdfUploadBtn = document.getElementById('btn-convert-pdf');
    const pdfUploadInput = document.getElementById('pdf-upload-input');
    const txtSyntaxUploadBtn = document.getElementById('btn-convert-txt-syntax');
    const txtSyntaxUploadInput = document.getElementById('txt-syntax-upload-input');
    const progressModal = document.getElementById('pdf-progress-modal');
    const progressStatus = document.getElementById('pdf-progress-status');
    const progressBar = document.getElementById('pdf-progress-bar');
    const progressTitle = document.getElementById('pdf-progress-title');
    const btnDownload = document.getElementById('btn-download-pdf-txt');
    const closeProgress = document.getElementById('close-pdf-progress');
    
    let currentDownloadUrl = null;

    if (closeProgress) {
        closeProgress.addEventListener('click', () => {
            progressModal.classList.add('hidden');
        });
    }

    pdfUploadBtn.addEventListener('click', (e) => {
        e.preventDefault();
        // Prevent double-clicking which queues multiple file choosers on iOS
        pdfUploadBtn.style.pointerEvents = "none";
        pdfUploadInput.click();
        setTimeout(() => { pdfUploadBtn.style.pointerEvents = "auto"; }, 1000);
    });

    pdfUploadInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Reset and Show Modal
        if(currentDownloadUrl) {
            window.URL.revokeObjectURL(currentDownloadUrl);
            currentDownloadUrl = null;
        }
        btnDownload.classList.add('hidden');
        progressTitle.innerText = "Transmuting PDF...";
        progressTitle.style.color = "#aaffcc";
        progressStatus.innerText = "Closing file viewer & initializing arcane extraction...";
        progressBar.style.width = "0%";
        progressBar.style.background = "linear-gradient(90deg, #194d2f, #2b7a4b)";
        progressModal.classList.remove('hidden');

        pdfUploadBtn.innerText = "Converting... ⏳";
        pdfUploadBtn.style.opacity = "0.7";
        pdfUploadBtn.style.pointerEvents = "none";

        try {
            // Wait a healthy half second to GUARANTEE the iOS file picker animates completely away! 
            await new Promise(r => setTimeout(r, 600)); 
            
            const arrayBuffer = await file.arrayBuffer();
            progressStatus.innerText = "Deciphering the tome structure...";
            await new Promise(r => setTimeout(r, 50));
            
            const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
            let fullText = '';

            for (let i = 1; i <= pdf.numPages; i++) {
                // Update UI Per Page
                progressStatus.innerText = `Scribing Page ${i} of ${pdf.numPages}...`;
                let pct = Math.floor((i / pdf.numPages) * 100);
                progressBar.style.width = `${pct}%`;
                
                // Yield to main thread so progress bar visibly moves
                await new Promise(r => setTimeout(r, 10)); 

                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                
                let pageImages = [];
                try {
                    const ops = await page.getOperatorList();
                    for (let j = 0; j < ops.fnArray.length; j++) {
                        if (ops.fnArray[j] === pdfjsLib.OPS.paintImageXObject || ops.fnArray[j] === pdfjsLib.OPS.paintJpegXObject) {
                            const objId = ops.argsArray[j][0];
                            const img = page.objs.get(objId);
                            
                            if (img && img.data && img.width && img.height) {
                                const canvas = document.createElement('canvas');
                                canvas.width = img.width;
                                canvas.height = img.height;
                                const ctx = canvas.getContext('2d');
                                
                                let imgData = null;
                                const totalPixels = img.width * img.height;
                                
                                if (img.data.length === totalPixels * 4) {
                                    imgData = new ImageData(new Uint8ClampedArray(img.data), img.width, img.height);
                                } else if (img.data.length === totalPixels * 3) {
                                    const rgba = new Uint8ClampedArray(totalPixels * 4);
                                    for (let k = 0, l = 0; k < img.data.length; k += 3, l += 4) {
                                        rgba[l] = img.data[k];
                                        rgba[l+1] = img.data[k+1];
                                        rgba[l+2] = img.data[k+2];
                                        rgba[l+3] = 255;
                                    }
                                    imgData = new ImageData(rgba, img.width, img.height);
                                } else if (img.data.length === totalPixels) { // Grayscale
                                    const rgba = new Uint8ClampedArray(totalPixels * 4);
                                    for (let k = 0, l = 0; k < img.data.length; k += 1, l += 4) {
                                        rgba[l] = img.data[k];
                                        rgba[l+1] = img.data[k];
                                        rgba[l+2] = img.data[k];
                                        rgba[l+3] = 255;
                                    }
                                    imgData = new ImageData(rgba, img.width, img.height);
                                }
                                
                                if (imgData) {
                                    ctx.putImageData(imgData, 0, 0);
                                    // Embed image as base64 Markdown string!
                                    // Scale quality slightly to prevent massive file bloat
                                    pageImages.push(`\n!IMAGE! ${canvas.toDataURL('image/jpeg', 0.85)}\n`);
                                }
                            }
                        }
                    }
                } catch(e) {
                    console.warn(`Could not parse images on page ${i}`, e);
                }
                
                // Construct strings ensuring lines stay somewhat intact
                let lastY = -1;
                let pageText = '';
                for (let item of textContent.items) {
                    if (lastY !== -1 && Math.abs(item.transform[5] - lastY) > 5) {
                        pageText += '\n'; // Add newline if Y coordinate changes significantly
                    }
                    pageText += item.str;
                    lastY = item.transform[5];
                }
                
                // Add embedded images at the end of the page text
                if (pageImages.length > 0) {
                    pageText += '\n\n' + pageImages.join('\n\n') + '\n\n';
                }
                
                fullText += pageText + '\n\n';
            }

            progressStatus.innerText = "Binding complete! The grimoire is ready.";
            progressTitle.innerText = "Tome Translated";
            progressTitle.style.color = "#aaffcc";

            // Prepare download configuration
            const txtFileName = file.name.replace(/\.pdf$/i, '.md');
            const blob = new Blob([fullText], { type: 'text/markdown' });
            currentDownloadUrl = window.URL.createObjectURL(blob);
            
            // Show download button
            btnDownload.onclick = () => {
                const a = document.createElement('a');
                a.style.display = 'none';
                a.href = currentDownloadUrl;
                a.download = txtFileName;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a); // clean up
                progressModal.classList.add('hidden'); // auto-hide modal after download
            };
            
            btnDownload.classList.remove('hidden');

        } catch (error) {
            console.error("PDF Parsing Error: ", error);
            progressTitle.innerText = "Transmutation Failed";
            progressTitle.style.color = "#ff2400";
            progressBar.style.background = "#ff2400";
            progressStatus.innerText = "The arcane glyphs in this PDF are too corrupted to read.";
        } finally {
            // Reset main button
            pdfUploadBtn.innerText = "Convert PDF to MD";
            pdfUploadBtn.style.opacity = "1";
            pdfUploadBtn.style.pointerEvents = "auto";
            e.target.value = ''; // clear input allowing re-upload of same file
        }
    });

    if (txtSyntaxUploadBtn && txtSyntaxUploadInput) {
        txtSyntaxUploadBtn.addEventListener('click', (e) => {
            e.preventDefault();
            txtSyntaxUploadBtn.style.pointerEvents = "none";
            txtSyntaxUploadInput.click();
            setTimeout(() => { txtSyntaxUploadBtn.style.pointerEvents = "auto"; }, 1000);
        });

        txtSyntaxUploadInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            if (currentDownloadUrl) {
                window.URL.revokeObjectURL(currentDownloadUrl);
                currentDownloadUrl = null;
            }

            btnDownload.classList.add('hidden');
            progressTitle.innerText = "Transmuting Syntax...";
            progressTitle.style.color = "#aaffcc";
            progressStatus.innerText = "Preparing text purification...";
            progressBar.style.width = "0%";
            progressBar.style.background = "linear-gradient(90deg, #194d2f, #2b7a4b)";
            progressModal.classList.remove('hidden');

            txtSyntaxUploadBtn.innerText = "Converting... ⏳";
            txtSyntaxUploadBtn.style.opacity = "0.7";
            txtSyntaxUploadBtn.style.pointerEvents = "none";
            
            try {
                await new Promise(r => setTimeout(r, 600)); 

                const text = await file.text();
                progressStatus.innerText = "Applying syntactic purifications (Chapters, Sections, cleanup)...";
                progressBar.style.width = "40%";
                await new Promise(r => setTimeout(r, 50));
                
                // --- TXT TO SYNTAX LOGIC ---
                let rawLines = text.split(/\r?\n/);
                
                let lines = [];
                for(let line of rawLines) {
                    const trimmed = line.trim();
                    if (trimmed === "") continue;
                    if (/^\d+$/.test(trimmed)) continue; // strict page numbers
                    if (/^Page\s*\d+$/i.test(trimmed)) continue;
                    if (trimmed.includes("© Fernstudienzentrum")) continue;
                    if (trimmed.includes("Fernstudienzentrum Hamburg")) continue;
                    if (trimmed === "©") continue;
                    if (trimmed.startsWith("MECH 1")) continue;
                    if (trimmed === "Inhaltsverzeichnis" || trimmed === "Anhang") continue;
                    if (trimmed.includes("Alle Rechte vorbehalten")) continue; 
                    if (/\.{4,}/.test(trimmed)) continue; // TOC lines
                    
                    lines.push(trimmed);
                }

                let finalOutput = [];
                let currentBlock = [];
                let blockType = "none";
                let haveSeenChapter = false;

                const flushBlock = () => {
                    if (currentBlock.length > 0) {
                        const joined = currentBlock.join('\n');
                        if (blockType === "chapter") {
                            finalOutput.push(`!CHAPTER! ${joined}`);
                            haveSeenChapter = true;
                        } else if (blockType === "image") {
                            finalOutput.push(joined); // Keep !IMAGE! natively
                        } else if (haveSeenChapter && blockType === "section") {
                            if (joined.length > 5) { // Catch stray empty strings
                                finalOutput.push(`!SECTION! ${joined}`);
                            }
                        }
                        currentBlock = [];
                    }
                };

                for (let i = 0; i < lines.length; i++) {
                    let line = lines[i];
                    
                    // Progress UI yielding
                    if (i % 50 === 0) {
                        progressBar.style.width = Math.floor(40 + ((i / lines.length) * 50)) + "%";
                        await new Promise(r => setTimeout(r, 5));
                    }
                    
                    // Is Chapter check (starts with a number, a space, and capital letter)
                    // We remove the optional dot so things like "1. Nikolaus" aren't caught as chapters
                    const isChapter = /^\d+\s+[A-Za-z]/.test(line) && line.length < 150;
                    const isImageLine = line.startsWith('!IMAGE!');

                    let startNewBlock = false;

                    if (isChapter) {
                        startNewBlock = true;
                        flushBlock();
                        blockType = "chapter";
                    } else if (isImageLine) {
                        startNewBlock = true;
                        flushBlock();
                        blockType = "image";
                    } else if (currentBlock.length > 0) {
                        let prevLine = currentBlock[currentBlock.length - 1];
                        
                        if (blockType === "image") {
                            startNewBlock = true; 
                        } else {
                            // Heuristic A: Did previous line end with a sentence terminator? (. ! ? " ')
                            const endsWithTerminal = /[.!?]["')]*$/.test(prevLine);
                            // Heuristic B: Was the previous line noticeably short and didn't end with a hyphen?
                            const isShort = prevLine.length < 65 && !prevLine.endsWith('-');
                            
                            if (blockType === "chapter") {
                                // Break chapter block if next line is clearly prose or prev line was a complete terminal
                                if (line.length > 60 || endsWithTerminal) {
                                    startNewBlock = true;
                                }
                            } else {
                                if (endsWithTerminal || isShort) {
                                    startNewBlock = true;
                                }
                            }
                        }
                    }

                    if (startNewBlock && !isChapter && !isImageLine) {
                        flushBlock();
                        blockType = "section";
                    } else if (currentBlock.length === 0 && !isChapter) {
                        blockType = "section";
                    }

                    currentBlock.push(line);
                }
                
                flushBlock();

                const resultString = finalOutput.join("\n\n");
                
                progressBar.style.width = "100%";
                progressStatus.innerText = `Scroll forged! ${finalOutput.length} elements detected.`;

                // Prepare Download
                const mdFileName = "syntax_" + file.name.replace(/\.md$/i, '') + ".md";
                const blob = new Blob([resultString], { type: "text/markdown;charset=utf-8" });
                currentDownloadUrl = window.URL.createObjectURL(blob);
                
                btnDownload.innerText = `📥 Download Formatted Syntax`;
                btnDownload.onclick = () => {
                    const a = document.createElement('a');
                    a.style.display = 'none';
                    a.href = currentDownloadUrl;
                    a.download = mdFileName;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a); // clean up
                    progressModal.classList.add('hidden'); // auto-hide
                };
                
                btnDownload.classList.remove('hidden');

            } catch (error) {
                console.error("Syntax Conversion Error: ", error);
                progressTitle.innerText = "Transmutation Failed";
                progressTitle.style.color = "#ff2400";
                progressBar.style.background = "#ff2400";
                progressStatus.innerText = "The raw text could not be inscribed with arcane syntax.";
            } finally {
                txtSyntaxUploadBtn.innerText = "Convert MD to Syntax";
                txtSyntaxUploadBtn.style.opacity = "1";
                txtSyntaxUploadBtn.style.pointerEvents = "auto";
                e.target.value = '';
            }
        });
    }
}

if(document.getElementById('upload-btn')) document.getElementById('upload-btn').addEventListener('click', loadFileToEditor);
if(document.getElementById('prev-map')) document.getElementById('prev-map').addEventListener('click', () => changeWorld(-1));
if(document.getElementById('next-map')) document.getElementById('next-map').addEventListener('click', () => changeWorld(1));

// --- SAVE, LOAD & MIGRATE SYSTEM ---


function loadFromStorage() {
    const savedData = localStorage.getItem('studyQuestData');
    if (savedData) {
        try {
            let parsed = JSON.parse(savedData);
            if (!parsed.hubs) appState.hubs = [{ name: "Main Hub", worlds: parsed.worlds || [], currentWorldIndex: parsed.currentWorldIndex || 0 }];
            else Object.assign(appState, parsed);

            // THEME MIGRATION: Convert Farming items to Occult items
            if (appState.coins !== undefined) { appState.gold = appState.coins; delete appState.coins; }
            if (appState.water !== undefined) { appState.ink = appState.water; delete appState.water; }
            if (appState.seeds !== undefined) { appState.paper = appState.seeds; delete appState.seeds; }
            if (appState.garden !== undefined) { appState.library = appState.garden; delete appState.garden; }

            // Defaults if missing
            if (appState.ink === undefined) appState.ink = 0;
            if (appState.paper === undefined) appState.paper = {};
            if (!appState.library || appState.library.length === 0) {
                appState.library = [
                    { unlocked: true, tome: null, inkLevel: 0, timeStarted: null },
                    { unlocked: false, cost: 250 }, { unlocked: false, cost: 500 }, { unlocked: false, cost: 1000 }
                ];
            }

            appState.hubs.forEach(hub => {
                hub.worlds.forEach(world => {
                    if (!world.coordinates || world.coordinates.length !== world.sections.length) {
                        world.coordinates = generateMapCoordinates(world.sections.length);
                    }
                    if (world.progress) {
                        Object.values(world.progress).forEach(prog => {
                            if (!prog.gameCooldowns) prog.gameCooldowns = {};
                        });
                    }
                });
            });

            updateHubDropdown();
            // sanitize any stored uploaded reward images (fixes malformed data URLs from older saves)
            sanitizeRewardImages();
            if (appState.hubs.length > 0 && appState.hubs[appState.currentHubIndex].worlds.length > 0) {
                if(document.getElementById('training-card')) document.getElementById('training-card').classList.remove('locked');
                if(document.getElementById('vault-card')) document.getElementById('vault-card').classList.remove('locked');
                renderMap();
            }
        } catch (error) {
            console.error("Corrupted save file detected.", error);
            localStorage.removeItem('studyQuestData');
        }
    } else {
        appState.hubs = [{ name: "Main Hub", worlds: [], currentWorldIndex: 0 }];
        appState.library = [ { unlocked: true, tome: null }, { unlocked: false, cost: 250 }, { unlocked: false, cost: 500 }, { unlocked: false, cost: 1000 } ];
        updateHubDropdown();
    }
    updateEconomyUI();
}

window.navigateToMindmapNode = function(node) {
    if (node.id === 'root') {
        // optionally open global menu later
    } else if (node.id.startsWith('hub_')) {
        appState.currentHubIndex = node.hubIndex;
        if (hubSelector) hubSelector.value = node.hubIndex;
        saveToStorage();
        if (homeScreen && hubScreen && universeScreen) {
            homeScreen.classList.add('hidden');
            universeScreen.classList.add('hidden');
            hubScreen.classList.remove('hidden');
        }
        setTimeout(() => { if (typeof renderMap === 'function') renderMap(); }, 10);
    } else if (node.id.startsWith('world_')) {
        appState.currentHubIndex = node.hubIndex;
        if (hubSelector) hubSelector.value = node.hubIndex;
        appState.hubs[appState.currentHubIndex].currentWorldIndex = node.worldIndex;
        saveToStorage();
        if (homeScreen && hubScreen && universeScreen) {
            homeScreen.classList.add('hidden');
            universeScreen.classList.add('hidden');
            hubScreen.classList.remove('hidden');
        }
        setTimeout(() => { if (typeof renderMap === 'function') renderMap(); }, 10);
    }
};

window.renderShelf = function() {
    const shelf = document.getElementById('universe-shelf');
    if (!shelf) return;
    shelf.innerHTML = '';
    
    if (appState.hubs) {
        appState.hubs.forEach((hub, index) => {
            const book = document.createElement('div');
            book.className = 'hub-book';
            // Simple spine text
            const spineTitle = document.createElement('span');
            spineTitle.innerText = hub.name;
            book.appendChild(spineTitle);
            
            book.onclick = () => {
                appState.currentHubIndex = index;
                universeScreen.classList.add('hidden');
                hubScreen.classList.remove('hidden');
                // Ensure the Hub dropdown reflects the new selection
                if (hubSelector) hubSelector.value = index;
                // Wait for unhide, then render map
                setTimeout(() => { if (typeof renderMap === 'function') renderMap(); }, 10);
            };
            shelf.appendChild(book);
        });
    }
};

function getActiveWorld() {
    const hub = appState.hubs[appState.currentHubIndex];
    if (!hub || !hub.worlds || hub.worlds.length === 0) return null;
    return hub.worlds[hub.currentWorldIndex];
}

// --- OCCULT LIBRARY LOGIC (FOUNDATION) ---
const libraryModal = document.getElementById('library-modal');
if(document.getElementById('btn-open-library')) {
    document.getElementById('btn-open-library').addEventListener('click', () => {
        renderLibrary(); if(libraryModal) libraryModal.classList.remove('hidden');
    });
}
if(document.getElementById('close-library')) document.getElementById('close-library').addEventListener('click', () => libraryModal.classList.add('hidden'));

function renderLibrary() {
    const libraryContainer = document.getElementById('library-tomes');
    if(!libraryContainer) return;
    libraryContainer.innerHTML = '';

    appState.library.forEach((tomeSlot, index) => {
        const slotDiv = document.createElement('div');
        slotDiv.className = 'library-tome';

        if (!tomeSlot.unlocked) {
            slotDiv.classList.add('locked-tome');
            slotDiv.innerHTML = `<span style="font-size: 2em;">🔒</span><span style="color: #ffd700; margin-top: 10px;">${tomeSlot.cost} 🪙</span>`;
            slotDiv.onclick = () => {
                if (confirm(`Unlock this Grimoire Pedestal for ${tomeSlot.cost} Gold?`)) {
                    if (appState.gold >= tomeSlot.cost) {
                        appState.gold -= tomeSlot.cost; tomeSlot.unlocked = true; tomeSlot.tome = null;
                        saveToStorage(); renderLibrary();
                    } else alert("Not enough Gold! Play more Mini-Games!");
                }
            };
        } else {
            slotDiv.innerHTML = `<span style="font-size: 2em; opacity: 0.5;">📖</span><span style="color: #a8b2d1; margin-top: 10px; font-size: 0.8em;">Blank Grimoire</span>`;
            slotDiv.onclick = () => alert("Scribing system coming in the next phase! Check your inventory for Parchment.");
        }
        libraryContainer.appendChild(slotDiv);
    });
}

// --- HUB SWITCHER LOGIC ---
function updateHubDropdown() {
    if(!hubSelector) return;
    hubSelector.innerHTML = '';
    appState.hubs.forEach((hub, index) => {
        const option = document.createElement('option');
        option.value = index; option.innerText = hub.name;
        if (index === appState.currentHubIndex) option.selected = true;
        hubSelector.appendChild(option);
    });
}

if(hubSelector) {
    hubSelector.addEventListener('change', (e) => {
        appState.currentHubIndex = parseInt(e.target.value);
        saveToStorage();

        if (universeScreen && hubScreen) {
            universeScreen.classList.add('hidden');
            hubScreen.classList.remove('hidden');
        }
        setTimeout(() => { if (typeof renderMap === 'function') renderMap(); }, 10);
    });
}

if(document.getElementById('btn-new-hub')) {
    document.getElementById('btn-new-hub').addEventListener('click', () => {
        const hubName = prompt("Enter a name for your new Hub:");
        if (hubName && hubName.trim() !== "") {
            appState.hubs.push({ name: hubName.trim(), worlds: [], currentWorldIndex: 0 });
            appState.currentHubIndex = appState.hubs.length - 1;
            saveToStorage(); updateHubDropdown(); renderShelf(); renderMap();
        }
    });
}

// --- MAP LOGIC ---
function renderMap() {
    const hub = appState.hubs[appState.currentHubIndex];

    // --- NEW VISIBILITY CHECK (BOTTOM UPLOAD) ---
    const mainUploadContainer = document.getElementById('main-hub-bottom-upload');
    if (mainUploadContainer) {
        if (!hub || hub.worlds.length === 0) {
            mainUploadContainer.style.display = 'block'; // Shows if there is no world
        } else {
            mainUploadContainer.style.display = 'none'; // Hides if a world exists
        }
    }
    // --------------------------------------------

    if (!hub || hub.worlds.length === 0) { 
        if(mapSection) mapSection.classList.add('hidden'); 
        return; 
    }

    // --- SET DEFAULT WORLD WALLPAPER ---
    if (mapSection) {
        mapSection.classList.remove('hidden'); // Ensures the map container is visible
        mapSection.style.backgroundImage = "none";
    }

    if (!hub || hub.worlds.length === 0) { if(mapSection) mapSection.classList.add('hidden'); return; }

    if(mapSection) mapSection.classList.remove('hidden');
    const world = getActiveWorld();
    const now = Date.now();

    const globalDueCards = world.flashcards.filter(fc => !fc.burned && fc.nextReview <= now);
    if(document.getElementById('global-fc-count')) document.getElementById('global-fc-count').innerText = globalDueCards.length;
    if(document.getElementById('btn-global-flashcards')) document.getElementById('btn-global-flashcards').onclick = () => startFlashcards('Global', globalDueCards, "Entire World");

    if(worldTitle) worldTitle.innerText = world.name;
    const mapWrapper = document.getElementById('map-wrapper'); const btnClearBg = document.getElementById('btn-clear-bg');
    
    if(mapWrapper) {
        mapWrapper.style.backgroundImage = world.background ? `url(${world.background})` : "url('TempleTemplate.jpg')";
        mapWrapper.style.backgroundSize = '100% 100%';
        mapWrapper.style.backgroundPosition = 'center';
        mapWrapper.style.backgroundRepeat = 'no-repeat';
        mapWrapper.style.overflow = 'hidden';
    }

    if (world.background) {
        if(btnClearBg) btnClearBg.classList.remove('hidden');
    } else {
        if(btnClearBg) btnClearBg.classList.add('hidden');
    }

    if(mapContainer) {
        mapContainer.innerHTML = '';
        world.sections.forEach((sectionName, index) => {
            const node = document.createElement('div'); node.className = 'map-node';
            const isLastNode = index === world.sections.length - 1; const isMilestone = (index + 1) % 5 === 0;

            if (isLastNode) { node.classList.add('boss-node'); node.innerHTML = '<img src="assets/Hologram.png" style="width: 100%; height: 100%; object-fit: contain; filter: drop-shadow(0 0 10px red);" alt="Boss Node" title="Sith Holocron" />'; }
            else {
                const numberSpan = document.createElement('span'); numberSpan.innerText = index + 1;
                node.appendChild(numberSpan); if (isMilestone) node.classList.add('milestone-node');
            }
            
            node.setAttribute('data-name', sectionName);
            if (world.coordinates && world.coordinates[index]) {
                let offset = 25; if (isLastNode) offset = 37.5; else if (isMilestone) offset = 32.5; 
                node.style.left = `calc(${world.coordinates[index].x}% - ${offset}px)`; node.style.top = `calc(${world.coordinates[index].y}% - ${offset}px)`;
            }
            
            let isLocked = false;
            if (index > 0) {
                const prevProgress = world.progress[world.sections[index - 1]];
                if (!prevProgress || !prevProgress.examPassed) isLocked = true;
            }

            if (isLocked) {
                node.classList.add('locked-node'); node.onclick = () => alert(`🔒 Arcane Seal! You must pass the Exam in "${world.sections[index - 1]}" first.`);
            } else {
                const progress = world.progress && world.progress[sectionName];
                if (progress && progress.examPassed) {
                    const sectionFc = world.flashcards.filter(fc => fc.section === sectionName);
                    if (sectionFc.length === 0 || sectionFc.every(fc => fc.burned)) node.classList.add('mastered'); else node.classList.add('completed'); 
                }
                node.onclick = () => openSectionModal(sectionName);
            }
            mapContainer.appendChild(node);
        });
    }

    setTimeout(drawMapLines, 50);
    if(document.getElementById('prev-map')) document.getElementById('prev-map').disabled = hub.currentWorldIndex === 0;
    if(document.getElementById('next-map')) document.getElementById('next-map').disabled = hub.currentWorldIndex === hub.worlds.length - 1;
}

function drawMapLines() {
    const svg = document.getElementById('map-svg'); 
    if(!svg) return;
    svg.innerHTML = '';
    const world = getActiveWorld(); if (!world || !world.coordinates || world.coordinates.length === 0) return;
    const w = svg.clientWidth; const h = svg.clientHeight;
    let pathData = "M ";
    world.coordinates.forEach((point, i) => {
        const pixelX = (point.x / 100) * w; const pixelY = (point.y / 100) * h;
        if (i === 0) pathData += `${pixelX} ${pixelY}`; else pathData += ` L ${pixelX} ${pixelY}`;
    });
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    const strokeWidth = window.innerWidth <= 880 ? '2' : '4';
    path.setAttribute('d', pathData); path.setAttribute('stroke', '#a8b2d1'); path.setAttribute('stroke-width', strokeWidth); path.setAttribute('fill', 'none'); path.setAttribute('stroke-dasharray', '8, 8');
    svg.appendChild(path);
}
window.addEventListener('resize', () => { if (mapSection && !mapSection.classList.contains('hidden')) drawMapLines(); });
function changeWorld(direction) { appState.hubs[appState.currentHubIndex].currentWorldIndex += direction; renderMap(); }

// --- MODALS & EXTRAS ---
const syntaxModal = document.getElementById('syntax-modal');
if (document.getElementById('btn-syntax-guide')) document.getElementById('btn-syntax-guide').addEventListener('click', () => syntaxModal.classList.remove('hidden'));
if (document.getElementById('close-syntax')) document.getElementById('close-syntax').addEventListener('click', () => syntaxModal.classList.add('hidden'));

// --- SECTION LEVEL MENU LOGIC ---
const sectionModal = document.getElementById('section-modal');
const sectionTitle = document.getElementById('section-modal-title');
const taskList = document.getElementById('section-task-list');

if(document.getElementById('close-section-modal')) document.getElementById('close-section-modal').addEventListener('click', () => sectionModal.classList.add('hidden'));

function openSectionModal(sectionName) {
    const world = getActiveWorld(); const now = Date.now();
    sectionTitle.innerText = sectionName;

    const sectionTasks = world.tasks.filter(t => t.section === sectionName);
    const sectionFlashcards = world.flashcards.filter(fc => fc.section === sectionName);
    const dueFlashcards = sectionFlashcards.filter(fc => !fc.burned && fc.nextReview <= now);
    const sectionGames = world.miniGames.filter(g => g.section === sectionName);
    const sectionQuizzes = (world.quizzes || []).filter(q => q.section === sectionName);
    const sectionExams = (world.exams || []).filter(e => e.section === sectionName);
    const sectionProgress = world.progress[sectionName] || { quizPassed: false, examPassed: false, gameCooldowns: {} };

    if(taskList) {
        taskList.innerHTML = '';
        if (sectionTasks.length === 0) taskList.innerHTML = '<li><span style="color: #555;">No quests assigned.</span></li>';
        else sectionTasks.forEach((task) => {
            const li = document.createElement('li'); const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.checked = task.completed;
            checkbox.onchange = (e) => { task.completed = e.target.checked; saveToStorage(); }; 
            const label = document.createElement('span'); label.innerText = task.text; li.append(checkbox, label); taskList.appendChild(li);
        });
    }
    
    const btnFlashcards = document.getElementById('btn-section-flashcards');
    if(btnFlashcards) {
        if(document.getElementById('fc-count')) document.getElementById('fc-count').innerText = dueFlashcards.length;
        btnFlashcards.disabled = dueFlashcards.length === 0; btnFlashcards.onclick = () => startFlashcards('Section', dueFlashcards, sectionName);
    }
    
    // ARCADE SELECTION WIRING
    const btnGame = document.getElementById('btn-section-game');
    if(btnGame) {
        btnGame.style.display = 'block'; 
        if (sectionGames.length > 0) { 
            btnGame.innerText = `🎮 Arcade (${sectionGames.length})`; 
            btnGame.disabled = false;
            btnGame.style.opacity = 1;
            btnGame.style.cursor = 'pointer';
            btnGame.onclick = () => openGameListModal(sectionGames, sectionName);
        } else { 
            btnGame.innerText = `🎮 Arcade (Empty)`;
            btnGame.disabled = true;
            btnGame.style.opacity = 0.5;
            btnGame.style.cursor = 'not-allowed';
        } 
    }

    const btnQuiz = document.getElementById('btn-section-quiz'); const btnExam = document.getElementById('btn-section-exam');
    if(btnQuiz && btnExam) {
        if(document.getElementById('quiz-count')) document.getElementById('quiz-count').innerText = sectionQuizzes.length; 
        if(document.getElementById('exam-count')) document.getElementById('exam-count').innerText = sectionExams.length;
        btnQuiz.disabled = sectionQuizzes.length === 0; btnExam.disabled = sectionExams.length === 0 || (!sectionProgress.quizPassed && sectionQuizzes.length !== 0);
        btnQuiz.onclick = () => startAssessment('Quiz', sectionQuizzes, sectionName); btnExam.onclick = () => startAssessment('Exam', sectionExams, sectionName);
    }
    if(sectionModal) sectionModal.classList.remove('hidden');
}

// --- ARCADE GAME LIST MODAL LOGIC ---
const gameListModal = document.getElementById('game-list-modal');
let cooldownInterval;

if(document.getElementById('close-game-list')) {
    document.getElementById('close-game-list').addEventListener('click', () => {
        clearInterval(cooldownInterval);
        if(gameListModal) gameListModal.classList.add('hidden');
    });
}

function openGameListModal(games, sectionName) {
    const world = getActiveWorld();
    const container = document.getElementById('game-list-container');
    if(!container) return;

    // 1. Create the buttons only ONCE so they don't lose hover state
    container.innerHTML = '';
    const buttonElements = [];
    
    games.forEach(game => {
        const li = document.createElement('li');
        const btn = document.createElement('button');
        btn.className = 'game-list-btn';
        li.appendChild(btn);
        container.appendChild(li);
        buttonElements.push({ btn, game }); // Store them to update later
    });

    // 2. Only update the text inside the buttons every second
    function updateList() {
        const now = Date.now();
        buttonElements.forEach(({ btn, game }) => {
            let cooldown = world.progress[sectionName].gameCooldowns[game.name] || 0;
            
            if (now < cooldown) {
                let diff = cooldown - now;
                let hours = Math.floor(diff / (1000 * 60 * 60));
                let minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                let seconds = Math.floor((diff % (1000 * 60)) / 1000);
                let h = hours.toString().padStart(2, '0');
                let m = minutes.toString().padStart(2, '0');
                let s = seconds.toString().padStart(2, '0');
                
                btn.disabled = true;
                btn.innerHTML = `<span>${game.name}</span> <span class="cooldown-text">⏳ ${h}:${m}:${s}</span>`;
                btn.onclick = null;
            } else {
                btn.disabled = false;
                // Check so we don't unnecessarily rewrite the HTML if it's already playable
                if (!btn.innerHTML.includes('▶ Play')) {
                    btn.innerHTML = `<span>${game.name}</span> <span style="color: #4cd137; font-weight: bold;">▶ Play</span>`;
                    btn.onclick = () => {
                        clearInterval(cooldownInterval);
                        if(gameListModal) gameListModal.classList.add('hidden');
                        startMiniGame(game.name, sectionName); // NOTE: Ensure startMiniGame function exists or adjust to your game start logic
                    };
                }
            }
        });
    }

    updateList(); // Run once immediately
    clearInterval(cooldownInterval);
    cooldownInterval = setInterval(updateList, 1000); // Then update the clocks every second
    if(gameListModal) gameListModal.classList.remove('hidden');
}

// --- FLASHCARD ENGINE (Rewards INK) ---
const fcModal = document.getElementById('flashcard-modal');
const fcInner = document.getElementById('fc-inner');
const btnFlipFc = document.getElementById('btn-flip-fc');
const fcGradingBtns = document.getElementById('fc-grading-buttons');
let fcQueue = [], currentFcIndex = 0, fcContext = "";

if(document.getElementById('close-flashcard')) document.getElementById('close-flashcard').addEventListener('click', () => { fcModal.classList.add('hidden'); saveToStorage(); renderMap(); });

function startFlashcards(mode, cards, contextName) {
    fcQueue = cards; currentFcIndex = 0; fcContext = contextName;
    if(document.getElementById('fc-title')) document.getElementById('fc-title').innerText = `Scribing: ${contextName}`;
    if (mode === 'Section' && sectionModal) sectionModal.classList.add('hidden');
    if(fcModal) fcModal.classList.remove('hidden'); loadFlashcard();
}

function loadFlashcard() {
    if (currentFcIndex >= fcQueue.length) {
        alert(`Scribing Complete! You generated Ink!`); saveToStorage(); renderMap(); if(fcModal) fcModal.classList.add('hidden');
        if (fcContext !== 'Entire World') openSectionModal(fcContext); return;
    }
    if(document.getElementById('fc-progress')) document.getElementById('fc-progress').innerText = `Incantation ${currentFcIndex + 1} of ${fcQueue.length}`;
    if(document.getElementById('fc-question')) document.getElementById('fc-question').innerText = fcQueue[currentFcIndex].question;
    if(document.getElementById('fc-answer')) document.getElementById('fc-answer').innerText = fcQueue[currentFcIndex].answer;
    if(fcInner) fcInner.classList.remove('is-flipped'); if(btnFlipFc) btnFlipFc.classList.remove('hidden'); if(fcGradingBtns) fcGradingBtns.classList.add('hidden');
}

function flipCard() { if(fcInner) fcInner.classList.add('is-flipped'); if(btnFlipFc) btnFlipFc.classList.add('hidden'); if(fcGradingBtns) fcGradingBtns.classList.remove('hidden'); }
if(btnFlipFc) btnFlipFc.addEventListener('click', flipCard); 
if(fcInner) fcInner.addEventListener('click', () => { if (!fcInner.classList.contains('is-flipped')) flipCard(); });

function gradeCard(quality) {
    let card = fcQueue[currentFcIndex];
    if (quality === 0) { card.interval = 0; card.ease = Math.max(1.3, card.ease - 0.2); } 
    else {
        if (quality >= 2) awardInk(1); // EARN INK!
        if (card.interval === 0) card.interval = 1; else if (card.interval === 1) card.interval = 3;
        else { let easeBonus = quality === 3 ? 0.15 : (quality === 1 ? -0.15 : 0); card.ease = Math.max(1.3, card.ease + easeBonus); card.interval = Math.round(card.interval * card.ease); }
    }
    if (card.interval > 21) card.burned = true; else card.nextReview = Date.now() + (card.interval * 86400000);
    saveToStorage(); currentFcIndex++; loadFlashcard();
}

if(document.getElementById('btn-fc-again')) document.getElementById('btn-fc-again').onclick = () => gradeCard(0); 
if(document.getElementById('btn-fc-hard')) document.getElementById('btn-fc-hard').onclick = () => gradeCard(1);
if(document.getElementById('btn-fc-good')) document.getElementById('btn-fc-good').onclick = () => gradeCard(2); 
if(document.getElementById('btn-fc-easy')) document.getElementById('btn-fc-easy').onclick = () => gradeCard(3);

// --- FLASHCARD VAULT ---
const fcVaultModal = document.getElementById('fc-vault-modal');
if(document.getElementById('close-vault')) document.getElementById('close-vault').addEventListener('click', () => fcVaultModal.classList.add('hidden'));
if(document.getElementById('btn-open-vault')) document.getElementById('btn-open-vault').addEventListener('click', () => { if(getActiveWorld()) openVault(); });

function openVault() {
    const world = getActiveWorld(); let learning = 0, shortTerm = 0, longTerm = 0, burned = 0; let burnedCards = [];
    world.flashcards.forEach(fc => {
        if (fc.burned) { burned++; burnedCards.push(fc); } else if (fc.interval === 0) learning++; else if (fc.interval <= 3) shortTerm++; else longTerm++;
    });
    if(document.getElementById('vault-stats')) document.getElementById('vault-stats').innerHTML = `
        <div class="stat-card"><h4>Learning</h4><span>${learning}</span></div><div class="stat-card"><h4>Short-Term</h4><span>${shortTerm}</span></div>
        <div class="stat-card"><h4>Long-Term</h4><span>${longTerm}</span></div><div class="stat-card" style="border-color: #ffd700;"><h4>Burned</h4><span style="color: #ffd700;">${burned}</span></div>
    `;
    const list = document.getElementById('burned-cards-list'); 
    if(list) {
        list.innerHTML = '';
        if (burnedCards.length === 0) list.innerHTML = '<li><span style="color: #555;">No burned cards yet.</span></li>';
        else {
            burnedCards.forEach(fc => {
                const li = document.createElement('li'); const textSpan = document.createElement('span'); textSpan.innerText = `[${fc.section}] ${fc.question}`;
                const restoreBtn = document.createElement('button'); restoreBtn.className = 'restore-btn'; restoreBtn.innerText = '♻️ Restore';
                restoreBtn.onclick = () => { fc.burned = false; fc.interval = 0; fc.nextReview = 0; saveToStorage(); renderMap(); openVault(); };
                li.append(textSpan, restoreBtn); list.appendChild(li);
            });
        }
    }
    if(fcVaultModal) fcVaultModal.classList.remove('hidden');
}

// --- MINI-GAME ARCADE ENGINE (Rewards GOLD & Triggers Cooldowns) ---
const minigameModal = document.getElementById('minigame-modal');
const minigameBoard = document.getElementById('minigame-board');
if (document.getElementById('close-minigame')) {
    document.getElementById('close-minigame').addEventListener('click', () => {
        if(minigameModal) minigameModal.classList.add('hidden');
        if(sectionTitle) openSectionModal(sectionTitle.innerText);
    });
}

function startMiniGame(gameName, sectionName) {
    const world = getActiveWorld();
    const sectionFlashcards = world.flashcards.filter(fc => fc.section === sectionName);

    if (gameName.toLowerCase() === 'memory') {
        if (sectionFlashcards.length < 2) return alert("You need at least 2 Flashcards in this section to play Memory Match!");
        if(sectionModal) sectionModal.classList.add('hidden'); 
        if(minigameModal) minigameModal.classList.remove('hidden');
        if(document.getElementById('minigame-title')) document.getElementById('minigame-title').innerText = "Memory Match";
        launchMemoryGame(sectionFlashcards, sectionName, gameName);
    } else if (gameName.toLowerCase() === 'trivia') {
        if (sectionFlashcards.length < 4) return alert("You need at least 4 Flashcards in this section to play Trivia Showdown!");
        if(sectionModal) sectionModal.classList.add('hidden'); 
        if(minigameModal) minigameModal.classList.remove('hidden');
        if(document.getElementById('minigame-title')) document.getElementById('minigame-title').innerText = "Trivia Showdown";
        launchTriviaGame(sectionFlashcards, world.flashcards, sectionName, gameName);
    } else if (gameName.toLowerCase() === 'spellweaver') {
        if (sectionFlashcards.length < 1) return alert("You need at least 1 Flashcard in this section to play Spellweaver!");
        if(sectionModal) sectionModal.classList.add('hidden'); 
        if(minigameModal) minigameModal.classList.remove('hidden');
        if(document.getElementById('minigame-title')) document.getElementById('minigame-title').innerText = "Spellweaver";
        launchSpellweaverGame(sectionFlashcards, sectionName, gameName);
    } else if (gameName.toLowerCase() === 'flash match' || gameName.toLowerCase() === 'flash-match') {
        // --- THIS IS THE NEW CONNECTION ---
        if(sectionModal) sectionModal.classList.add('hidden'); 
        if(minigameModal) minigameModal.classList.remove('hidden');
        if(document.getElementById('minigame-title')) document.getElementById('minigame-title').innerText = "Flash Match";
        startFlashMatchGame(sectionName, gameName);
    } else if (gameName.toLowerCase() === 'arcane defense' || gameName.toLowerCase() === 'arcane-defense') {
        if (sectionFlashcards.length < 1) return alert("You need at least 1 Flashcard in this section to play Arcane Defense!");
        if(sectionModal) sectionModal.classList.add('hidden'); 
        if(minigameModal) minigameModal.classList.remove('hidden');
        if(document.getElementById('minigame-title')) document.getElementById('minigame-title').innerText = "Arcane Defense";
        launchArcaneDefenseGame(sectionFlashcards, sectionName, gameName);
    } else if (gameName.toLowerCase() === 'ritual alignment' || gameName.toLowerCase() === 'ritual-alignment') {
        if(sectionModal) sectionModal.classList.add('hidden'); 
        if(minigameModal) minigameModal.classList.remove('hidden');
        if(document.getElementById('minigame-title')) document.getElementById('minigame-title').innerText = "Ritual Alignment";
        launchRitualAlignmentGame(sectionName, gameName);
    }    else {
        alert(`The game "${gameName}" is currently under construction!`);
    }   
}

// --- ASSESSMENT ENGINE (Rewards PAPER) ---
const assessmentModal = document.getElementById('assessment-modal');
let testQueue = [], currentTestIndex = 0, correctScore = 0, testType = "", currentTestSection = "";
if(document.getElementById('close-assessment')) document.getElementById('close-assessment').addEventListener('click', () => assessmentModal.classList.add('hidden'));

function startAssessment(type, questions, sectionName) {
    testType = type; testQueue = questions; currentTestSection = sectionName; currentTestIndex = 0; correctScore = 0;
    if(document.getElementById('assessment-title')) document.getElementById('assessment-title').innerText = `${type} Mode: ${sectionName}`;
    if(sectionModal) sectionModal.classList.add('hidden'); 
    if(assessmentModal) assessmentModal.classList.remove('hidden'); loadQuestion();
}
function loadQuestion() {
    if(document.getElementById('assessment-progress')) document.getElementById('assessment-progress').innerText = `Question ${currentTestIndex + 1} of ${testQueue.length}`;
    if(document.getElementById('assessment-question')) document.getElementById('assessment-question').innerText = testQueue[currentTestIndex].question;
    if(document.getElementById('assessment-answer')) document.getElementById('assessment-answer').innerText = testQueue[currentTestIndex].answer;
    if(document.getElementById('assessment-answer')) document.getElementById('assessment-answer').classList.add('hidden'); 
    if(document.getElementById('btn-show-answer')) document.getElementById('btn-show-answer').classList.remove('hidden'); 
    if(document.getElementById('grading-buttons')) document.getElementById('grading-buttons').classList.add('hidden');
}
if(document.getElementById('btn-show-answer')) {
    document.getElementById('btn-show-answer').addEventListener('click', () => {
        document.getElementById('assessment-answer').classList.remove('hidden'); 
        document.getElementById('btn-show-answer').classList.add('hidden'); 
        document.getElementById('grading-buttons').classList.remove('hidden');
    });
}
function gradeQuestion(isCorrect) { if (isCorrect) correctScore++; currentTestIndex++; if (currentTestIndex < testQueue.length) loadQuestion(); else finishAssessment(); }
if(document.getElementById('btn-grade-right')) document.getElementById('btn-grade-right').addEventListener('click', () => gradeQuestion(true)); 
if(document.getElementById('btn-grade-wrong')) document.getElementById('btn-grade-wrong').addEventListener('click', () => gradeQuestion(false));

function finishAssessment() {
    const isPerfect = (correctScore === testQueue.length); const world = getActiveWorld();
    if (isPerfect) {
        if (testType === 'Quiz' && !world.progress[currentTestSection].quizPassed) { 
            world.progress[currentTestSection].quizPassed = true; awardPaper('Blank Quiz Parchment');
        }
        if (testType === 'Exam' && !world.progress[currentTestSection].examPassed) { 
            world.progress[currentTestSection].examPassed = true; awardPaper('Rare Exam Parchment');
        }
        saveToStorage(); renderMap(); alert(`Perfect Score! You passed the ${testType}!`);
    } else alert(`You got ${correctScore} out of ${testQueue.length}. Try again!`);
    if(assessmentModal) assessmentModal.classList.add('hidden'); openSectionModal(currentTestSection); 
}

// --- BACKGROUND, SETTINGS & READ NOTES ---
if (document.getElementById('bg-upload-input')) {
    document.getElementById('bg-upload-input').addEventListener('change', function(e) {
        const file = e.target.files[0]; if (!file) return;
        const reader = new FileReader();
        reader.onload = function(event) {
            const img = new Image();
            img.onload = function() {
                const canvas = document.createElement('canvas'); let width = img.width, height = img.height;
                if (width > 1200) { height *= 1200 / width; width = 1200; }
                canvas.width = width; canvas.height = height; canvas.getContext('2d').drawImage(img, 0, 0, width, height);
                getActiveWorld().background = canvas.toDataURL('image/jpeg', 0.6); saveToStorage(); renderMap();
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    });
}
if (document.getElementById('btn-clear-bg')) {
    document.getElementById('btn-clear-bg').addEventListener('click', () => { getActiveWorld().background = null; saveToStorage(); renderMap(); });
}
if (document.getElementById('btn-reshuffle-map')) {
    document.getElementById('btn-reshuffle-map').addEventListener('click', () => {
        const world = getActiveWorld(); if (!world) return;
        world.coordinates = generateMapCoordinates(world.sections.length); saveToStorage(); renderMap(); 
        if(document.getElementById('settings-modal')) document.getElementById('settings-modal').classList.add('hidden');
    });
}

// --- READING VIEWER ---
const readModal = document.getElementById('read-modal');
let currentReadPages = [];
let currentReadIndex = 0;
let currentReadSectionTitle = "";
let bionicReadingEnabled = false;

function applyBionicReading(text) {
    if (!text) return "";
    return text.split(/(\s+)/).map(word => {
        if (/^\s+$/.test(word)) return word; // Preserve whitespace exactly
        const alphaMatch = word.match(/[a-zA-ZÀ-ÿ0-9]+/g);
        if(!alphaMatch) return word; 
        
        return word.replace(/[a-zA-ZÀ-ÿ0-9]+/, (match) => {
            let splitIndex = Math.ceil(match.length / 2);
            if (match.length === 3) splitIndex = 1;
            const boldPart = match.substring(0, splitIndex);
            const normalPart = match.substring(splitIndex);
            return `<strong style="color: #fff; font-weight: 800;">${boldPart}</strong>${normalPart}`;
        });
    }).join("");
}

function updateReadModalContent() {
    const contentEl = document.getElementById('read-modal-content');
    if(!contentEl) return;
    
    let baseText = currentReadPages[currentReadIndex] || "No text available.";
    
    // Parse out !IMAGE! data tags to display images seamlessly inline
    let formattedHTML = "";
    
    if (baseText.includes("!IMAGE!")) {
        const segments = baseText.split(/!IMAGE!\s*(data:image\/[^ \n]+)/); // Split strictly on our injected base64 pattern
        for (let i = 0; i < segments.length; i++) {
            if (i % 2 === 0) { 
                // Regular Text
                const textPart = segments[i].trim();
                if (textPart.length > 0) {
                    if (bionicReadingEnabled) {
                        formattedHTML += applyBionicReading(textPart);
                    } else {
                        const tempDiv = document.createElement('div');
                        tempDiv.innerText = textPart;
                        formattedHTML += tempDiv.innerHTML;
                    }
                    formattedHTML += "<br/><br/>";
                }
            } else {
                // Image Data URI
                formattedHTML += `<div style="text-align:center; margin: 15px 0;"><img src="${segments[i]}" style="max-width: 100%; border-radius: 8px; border: 1px solid #1c4228; box-shadow: 0 4px 8px rgba(0,0,0,0.5);"></div>`;
            }
        }
        contentEl.innerHTML = formattedHTML;
    } else {
        // Safe Text fallback when no images
        if (bionicReadingEnabled) {
            contentEl.innerHTML = applyBionicReading(baseText);
        } else {
            contentEl.innerText = baseText; 
        }
    }
    
    let paginationEl = document.getElementById('read-pagination-controls');
    let resetBtnContainer = document.getElementById('read-reset-container');
    
    if(!paginationEl) {
        paginationEl = document.createElement('div');
        paginationEl.id = 'read-pagination-controls';
        paginationEl.style.display = 'flex';
        paginationEl.style.justifyContent = 'space-between';
        paginationEl.style.alignItems = 'center';
        paginationEl.style.marginTop = '20px';
        paginationEl.style.paddingTop = '15px';
        paginationEl.style.borderTop = '1px solid rgba(255,255,255,0.1)';
        document.querySelector('#read-modal .modal-content').appendChild(paginationEl);
    }
    
    if (!resetBtnContainer) {
        resetBtnContainer = document.createElement('div');
        resetBtnContainer.id = 'read-reset-container';
        resetBtnContainer.style.textAlign = 'center';
        resetBtnContainer.style.marginTop = '15px';
        document.querySelector('#read-modal .modal-content').appendChild(resetBtnContainer);
    }
    resetBtnContainer.style.display = 'none'; // hide by default
    
    if (currentReadPages.length <= 1) {
        paginationEl.style.display = 'none';
        resetBtnContainer.style.display = 'none';
        return;
    } else {
        paginationEl.style.display = 'flex';
        resetBtnContainer.style.display = 'block';
    }
    
    paginationEl.innerHTML = `
        <button id="read-prev-btn" class="btn-secondary" style="padding: 10px 20px; font-weight: bold; ${currentReadIndex === 0 ? 'opacity:0.5; pointer-events:none;' : ''}">&lt; Prev</button>
        <span style="font-family: 'Cinzel', serif; color: #a8b2d1; font-weight: bold; font-size: 1.1em;">Part ${currentReadIndex + 1} of ${currentReadPages.length}</span>
        <button id="read-next-btn" class="btn-primary" style="padding: 10px 20px; font-weight: bold; ${currentReadIndex === currentReadPages.length - 1 ? 'opacity:0.5; pointer-events:none;' : ''}">Next &gt;</button>
    `;
    
    resetBtnContainer.innerHTML = `<button id="btn-read-reset" class="btn-occult" style="font-size:0.8em; padding:10px 20px; width: 100%; box-sizing: border-box; border-color: #8b1d0c;">↺ Reset to Part 1</button>`;

    const prevBtn = document.getElementById('read-prev-btn');
    const nextBtn = document.getElementById('read-next-btn');
    const resetBtn = document.getElementById('btn-read-reset');

    if (prevBtn) prevBtn.addEventListener('click', () => {
        if(currentReadIndex > 0) {
            currentReadIndex--;
            saveReadProgress();
            updateReadModalContent();
        }
    });

    if (nextBtn) nextBtn.addEventListener('click', () => {
        if(currentReadIndex < currentReadPages.length - 1) {
            currentReadIndex++;
            saveReadProgress();
            updateReadModalContent();
        }
    });

    if (resetBtn) resetBtn.addEventListener('click', () => {
        currentReadIndex = 0;
        saveReadProgress();
        updateReadModalContent();
    });
}

function saveReadProgress() {
    const world = getActiveWorld();
    if(!world) return;
    if(!world.readProgress) world.readProgress = {};
    world.readProgress[currentReadSectionTitle] = currentReadIndex;
    saveToStorage();
}

if (document.getElementById('toggle-bionic-btn')) {
    document.getElementById('toggle-bionic-btn').addEventListener('click', () => {
        bionicReadingEnabled = !bionicReadingEnabled;
        const btn = document.getElementById('toggle-bionic-btn');
        btn.style.color = bionicReadingEnabled ? "#aaffcc" : "";
        btn.style.borderColor = bionicReadingEnabled ? "#aaffcc" : "";
        updateReadModalContent(); // Refresh the viewer
    });
}

if (document.getElementById('close-read-modal')) {
    document.getElementById('close-read-modal').addEventListener('click', () => {
        readModal.classList.add('hidden');
        saveReadProgress();
    });
}

if (document.getElementById('btn-section-read')) {
    document.getElementById('btn-section-read').addEventListener('click', () => {
        const world = getActiveWorld(); 
        const sectionTitle = document.getElementById('section-modal-title');
        currentReadSectionTitle = sectionTitle.innerText;
        
        if(document.getElementById('read-modal-title')) document.getElementById('read-modal-title').innerText = currentReadSectionTitle + " - Notes";
        
        let fullText = world.content[currentReadSectionTitle] || "No text available.";
        // Split text by !SECTION!, clean up empty whitespace
        currentReadPages = fullText.split('!SECTION!').map(page => page.trim()).filter(page => page.length > 0);
        if (currentReadPages.length === 0) currentReadPages = ["No text available."];
        
        if (world.readProgress && typeof world.readProgress[currentReadSectionTitle] === 'number') {
            currentReadIndex = world.readProgress[currentReadSectionTitle];
            if (currentReadIndex >= currentReadPages.length) currentReadIndex = 0;
        } else {
            currentReadIndex = 0;
        }
        
        updateReadModalContent();
        if(readModal) readModal.classList.remove('hidden');
    });
}

// --- LIBRARY (UNIVERSE) SETTINGS ---
const librarySettingsModal = document.getElementById('library-settings-modal');
if (document.getElementById('btn-library-settings')) {
    document.getElementById('btn-library-settings').addEventListener('click', () => {
        if (librarySettingsModal) librarySettingsModal.classList.remove('hidden');
        if (typeof renderLibrarySettings === 'function') renderLibrarySettings();
    });
}
if (document.getElementById('close-library-settings')) {
    document.getElementById('close-library-settings').addEventListener('click', () => {
        if (librarySettingsModal) librarySettingsModal.classList.add('hidden');
    });
}

function renderLibrarySettings() {
    const list = document.getElementById('library-hub-list');
    if (!list) return;
    list.innerHTML = '';
    appState.hubs.forEach((hub, index) => {
        const item = document.createElement('div');
        item.className = 'hub-setting-item';
        
        const input = document.createElement('input');
        input.type = 'text';
        input.value = hub.name;
        input.className = 'hub-setting-input';
        
        const btn = document.createElement('button');
        btn.textContent = 'Rename';
        btn.className = 'btn-occult';
        
        btn.onclick = () => {
            const newName = input.value.trim();
            if (newName !== '') {
                hub.name = newName;
                saveToStorage();
                if (typeof updateHubDropdown === 'function') updateHubDropdown();
                if (typeof renderShelf === 'function') renderShelf();
                if (typeof initMindMap === 'function') initMindMap(appState);
                renderLibrarySettings(); // Refresh
                alert(`Renamed successfully to "${newName}"!`);
            }
        };
        
        item.appendChild(input);
        item.appendChild(btn);
        list.appendChild(item);
    });
}

// --- SETTINGS & RESET ---
const settingsModal = document.getElementById('settings-modal');
if (document.getElementById('settings-btn')) {
    document.getElementById('settings-btn').addEventListener('click', () => { 
        if(settingsModal) {
            settingsModal.classList.remove('hidden');
            const world = getActiveWorld();
            if (world && document.getElementById('world-rename-input')) {
                document.getElementById('world-rename-input').value = world.name || world.title || "";
            }
        }
    });
}
if (document.getElementById('btn-rename-world')) {
    document.getElementById('btn-rename-world').addEventListener('click', () => {
        const world = getActiveWorld();
        const newName = document.getElementById('world-rename-input').value.trim();
        if (world && newName) {
            world.name = newName;
            world.title = newName; // ensuring we catch whatever property was used
            saveToStorage();
            if (typeof renderMap === 'function') renderMap();
            if (typeof renderShelf === 'function') renderShelf();
            if (typeof initMindMap === 'function') initMindMap(appState);
            alert("World renamed successfully!");
        }
    });
}
if (document.getElementById('close-settings')) {
    document.getElementById('close-settings').addEventListener('click', () => { if(settingsModal) settingsModal.classList.add('hidden') });
}
if (document.getElementById('delete-world-btn')) {
    document.getElementById('delete-world-btn').addEventListener('click', () => {
        const hub = appState.hubs[appState.currentHubIndex]; if (hub.worlds.length === 0) return;
        if (confirm("Delete this world?")) {
            hub.worlds.splice(hub.currentWorldIndex, 1); hub.currentWorldIndex = Math.max(0, hub.worlds.length - 1); saveToStorage(); 
            if(settingsModal) settingsModal.classList.add('hidden');
            if (hub.worlds.length > 0) renderMap(); else { 
                if(mapSection) mapSection.classList.add('hidden'); 
                if(document.getElementById('training-card')) document.getElementById('training-card').classList.add('locked'); 
                if(document.getElementById('vault-card')) document.getElementById('vault-card').classList.add('locked'); 
            }
        }
    });
}
if (document.getElementById('reset-app-btn')) {
    document.getElementById('reset-app-btn').addEventListener('click', () => {
        if (confirm("WARNING: Delete ALL worlds?")) { if (confirm("ABSOLUTELY sure?")) { localStorage.removeItem('studyQuestData'); location.reload(); } }
    });
}
if (document.getElementById('btn-export-cloud')) {
    document.getElementById('btn-export-cloud').addEventListener('click', () => {
        appState.lastExported = Date.now(); // Stamp it so the phone knows it's the newest!
        saveToStorage();
        
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(appState, null, 4));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", "saveData.json");
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
        
        alert("Downloaded 'saveData.json'! Move this file into your MainHub folder and publish it to GitHub to sync your phone.");
    });
}


// Boot Application
async function bootApp() {
    loadFromStorage();
    
    // Attempt Cloud Sync Fetch
    try {
        const response = await fetch('./saveData.json?t=' + new Date().getTime());
        if (response.ok) {
            const cloudData = await response.json();
            const localDate = appState.lastExported || 0;
            const cloudDate = cloudData.lastExported || 0;
            
            // If cloud data is officially newer than phone data
            if (cloudDate > localDate) {
                console.log("Cloud save is newer! Syncing and Merging data...");

                // Detect if this is a completely fresh browser / new player vs the owner restoring their save
                let isNewPlayer = false;
                if (localDate === 0 && cloudDate > 0) {
                    isNewPlayer = !confirm("Found a pre-existing cloud save!\n\nAre you the creator syncing your personal content? (Click OK)\n\nOR are you a new player wanting to start fresh using these worlds? (Click Cancel)");
                }

                if (isNewPlayer) {
                    // --- WIPE PROGRESS: New Player Mode ---
                    // Give them the uploaded worlds/text/sections, but reset all economy, items, and progress!
                    cloudData.gold = 0;
                    cloudData.ink = 0;
                    cloudData.inventory = [];
                    cloudData.library = [];
                    cloudData.paper = {};
                    
                    if (cloudData.hubs) {
                        cloudData.hubs.forEach(hub => {
                            if (hub.worlds) {
                                hub.worlds.forEach(w => {
                                    // Reset section progress (quizzes, exams, games)
                                    if (w.progress) {
                                        Object.keys(w.progress).forEach(secKey => {
                                            w.progress[secKey] = { quizPassed: false, examPassed: false, gameCooldowns: {} };
                                        });
                                    }
                                    // Reset Flashcard SRS memory
                                    if (w.flashcards) {
                                        w.flashcards.forEach(f => {
                                            f.interval = 0; f.ease = 2.5; f.nextReview = 0; f.burned = false;
                                        });
                                    }
                                    // Reset checkable tasks
                                    if (w.tasks) {
                                        w.tasks.forEach(t => t.completed = false);
                                    }
                                });
                            }
                        });
                    }
                    cloudData.lastExported = Date.now(); // Stamp to prevent re-asking on this device
                } else {
                    // --- MERGE PC CONTENT WITH PHONE PROGRESS (For the Owner) ---
                    // Keep the phone's economy & inventory if they are greater, preserving accomplishments
                    cloudData.gold = Math.max(appState.gold || 0, cloudData.gold || 0);
                cloudData.ink = Math.max(appState.ink || 0, cloudData.ink || 0);
                
                // For paper/inventory, union them or prefer the phone if it has more
                cloudData.paper = (Object.keys(appState.paper || {}).length > Object.keys(cloudData.paper || {}).length) ? appState.paper : cloudData.paper;
                cloudData.inventory = ((appState.inventory || []).length > (cloudData.inventory || []).length) ? appState.inventory : cloudData.inventory;
                cloudData.library = ((appState.library || []).length > (cloudData.library || []).length) ? appState.library : cloudData.library;

                // Merge Worlds progress: keep progress for existing worlds
                if (cloudData.hubs && appState.hubs) {
                    cloudData.hubs.forEach((cloudHub, hIndex) => {
                        const localHub = appState.hubs[hIndex];
                        if (localHub) {
                            cloudHub.worlds.forEach((cloudWorld) => {
                                const localWorld = localHub.worlds.find(lw => lw.name === cloudWorld.name);
                                if (localWorld) {
                                    // Retain section progress (exams, quizzes, etc) by merging keys
                                    if (cloudWorld.progress && localWorld.progress) {
                                        Object.keys(localWorld.progress).forEach(secKey => {
                                            // Only overwrite if the section still exists in the freshly parsed PC content
                                            if (cloudWorld.progress[secKey]) {
                                                cloudWorld.progress[secKey] = localWorld.progress[secKey];
                                            }
                                        });
                                    }
                                    
                                    // Retain Flashcard SRS data
                                    if (cloudWorld.flashcards && localWorld.flashcards) {
                                        cloudWorld.flashcards.forEach(cf => {
                                            const lf = localWorld.flashcards.find(f => f.question === cf.question);
                                            if (lf) {
                                                cf.interval = lf.interval;
                                                cf.ease = lf.ease;
                                                cf.nextReview = lf.nextReview;
                                                cf.burned = lf.burned;
                                            }
                                        });
                                    }
                                    
                                    // Retain Task completions
                                    if (cloudWorld.tasks && localWorld.tasks) {
                                        cloudWorld.tasks.forEach(ct => {
                                            const lt = localWorld.tasks.find(t => t.text === ct.text);
                                            if (lt) {
                                                ct.completed = lt.completed;
                                            }
                                        });
                                    }
                                }
                            });
                        }
                    });
                }
                
                } // Close the 'else' block for the owner

                localStorage.setItem('studyQuestData', JSON.stringify(cloudData));
                location.reload(); // Refresh immediately to apply
                return;
            }
        }
    } catch(e) {
        console.log("No newer cloud save found or offline.");
    }
    
    // Render uploaded rewards into the store panel (if any were saved)
    try { renderUploadedRewards(); } catch (e) { /* ignore if DOM not ready */ }
    try { initMindMap(appState); } catch(e) { console.error("MindMap init error", e); }
}

bootApp();

// --- STATIC DOM EVENT BINDINGS ---
function initStaticListeners() {
    const cancelBtn = document.getElementById('btn-cancel-edit');
    if (cancelBtn) cancelBtn.addEventListener('click', cancelEdit);

    const saveWorldBtn = document.getElementById('btn-save-world');
    if (saveWorldBtn) saveWorldBtn.addEventListener('click', saveAndProcessWorld);

    const buyScrollBtn = document.getElementById('btn-buy-scroll');
    if (buyScrollBtn) buyScrollBtn.addEventListener('click', () => tradeForSpecialPaper('Scroll of Fire', 2));
}
initStaticListeners();



























export { getActiveWorld };



export { renderMap };
