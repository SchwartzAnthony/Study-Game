import { appState, getSafeImageSrc } from './scripts/state.js';
import { awardGold, awardInk, awardPaper, updateEconomyUI } from './scripts/economy.js';
import { saveToStorage } from './scripts/storage.js';
import { generateMapCoordinates } from './scripts/mapRenderer.js';
import { launchArcaneDefenseGame, launchTriviaGame, launchMemoryGame, startFlashMatchGame, launchSpellweaverGame, launchRitualAlignmentGame, launchClozeGame, launchTrueFalseBlitz, launchGlimpseRecall } from './scripts/minigames.js';
import { buyItem, renderStore, renderUploadedRewards, deleteUploadedReward, buyCustomReward } from './scripts/store.js';
import { loadFileToEditor, cancelEdit, saveAndProcessWorld, createWorldFromSyntax } from './scripts/parser.js';
import { initMindMap } from './scripts/mindmapRenderer.js';
import { forgeWorldFromPdf } from './scripts/pdfAutoForge.js';

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

function showToast(message, duration = 3000) {
    const toast = document.createElement('div');
    toast.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(30,20,60,0.97);border:2px solid rgba(162,155,254,0.7);border-radius:16px;padding:24px 36px;z-index:99999;text-align:center;font-family:Cinzel,serif;color:#e0d6ff;font-size:1.1em;letter-spacing:1px;box-shadow:0 0 48px rgba(162,155,254,0.4);max-width:90vw;';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => { toast.style.transition = 'opacity 0.7s'; toast.style.opacity = '0'; setTimeout(() => toast.remove(), 700); }, duration);
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
    const autoForgeBtn = document.getElementById('btn-auto-forge-pdf');
    const autoForgeInput = document.getElementById('pdf-auto-upload-input');
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

    if (autoForgeBtn && autoForgeInput) {
        autoForgeBtn.addEventListener('click', (e) => {
            e.preventDefault();
            autoForgeBtn.style.pointerEvents = 'none';
            autoForgeInput.click();
            setTimeout(() => { autoForgeBtn.style.pointerEvents = 'auto'; }, 1000);
        });

        autoForgeInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            if (currentDownloadUrl) {
                window.URL.revokeObjectURL(currentDownloadUrl);
                currentDownloadUrl = null;
            }

            btnDownload.classList.add('hidden');
            progressTitle.innerText = 'Forging World from PDF...';
            progressTitle.style.color = '#f3d98a';
            progressStatus.innerText = 'Initializing offline parser and heuristic mentor...';
            progressBar.style.width = '0%';
            progressBar.style.background = 'linear-gradient(90deg, #5b3b12, #d4a843)';
            progressModal.classList.remove('hidden');

            autoForgeBtn.innerText = 'Forging... ⏳';
            autoForgeBtn.style.opacity = '0.7';
            autoForgeBtn.style.pointerEvents = 'none';

            try {
                await new Promise(r => setTimeout(r, 250));

                const forged = await forgeWorldFromPdf(file, (status, pct) => {
                    progressStatus.innerText = status;
                    progressBar.style.width = `${Math.max(0, Math.min(100, pct || 0))}%`;
                }, localStorage.getItem('openai_api_key') || '');

                progressStatus.innerText = 'Injecting generated syntax into a new world...';
                progressBar.style.width = '96%';
                await new Promise(r => setTimeout(r, 40));

                createWorldFromSyntax(forged.syntax, forged.worldName);
                setOwlTips(forged.owlTips, forged.worldName);
                if (workshopScreen && hubScreen) {
                    workshopScreen.classList.add('hidden');
                    hubScreen.classList.remove('hidden');
                }

                progressBar.style.width = '100%';
                progressTitle.innerText = 'World Forged Successfully';
                progressTitle.style.color = '#f3d98a';
                progressStatus.innerText = `Created ${forged.counts.sections} sections, ${forged.counts.flashcards} flashcards, ${forged.counts.quizzes} quizzes, and ${forged.counts.exams} exams.`;

                const syntaxFileName = `autoforge_${file.name.replace(/\.pdf$/i, '')}.md`;
                const blob = new Blob([forged.syntax], { type: 'text/markdown;charset=utf-8' });
                currentDownloadUrl = window.URL.createObjectURL(blob);

                btnDownload.innerText = '📥 Download Generated Syntax';
                btnDownload.onclick = () => {
                    const a = document.createElement('a');
                    a.style.display = 'none';
                    a.href = currentDownloadUrl;
                    a.download = syntaxFileName;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                };
                btnDownload.classList.remove('hidden');
            } catch (error) {
                console.error('Auto-forge PDF error:', error);
                progressTitle.innerText = 'Auto-Forge Failed';
                progressTitle.style.color = '#ff2400';
                progressBar.style.background = '#ff2400';
                const msg = error?.message || String(error);
                progressStatus.innerText = `Fehler: ${msg.slice(0, 200)}`;
            } finally {
                autoForgeBtn.innerText = 'Auto-Forge World from PDF (Offline)';
                autoForgeBtn.style.opacity = '1';
                autoForgeBtn.style.pointerEvents = 'auto';
                e.target.value = '';
            }
        });
    }

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

// Removes unwanted sections (student notes, TOC pages, etc.) from all worlds in saved data.
const JUNK_SECTION_PATTERN = /studenten(erkl[äa]rung|erklaerung|hinweis|ausgabe|version)?|hinweis f[üu]r (studenten|sch[üu]ler|lernende)|erkl[äa]rung f[üu]r (studenten|sch[üu]ler)|studentenausgabe|sch[üu]lerausgabe/i;

function purgeJunkSections() {
    let dirty = false;
    appState.hubs.forEach(hub => {
        hub.worlds.forEach(world => {
            const junk = new Set((world.sections || []).filter(s => JUNK_SECTION_PATTERN.test(s)));
            if (junk.size === 0) return;
            world.sections = (world.sections || []).filter(s => !junk.has(s));
            world.flashcards = (world.flashcards || []).filter(fc => !junk.has(fc.section));
            world.quizzes = (world.quizzes || []).filter(q => !junk.has(q.section));
            world.exams = (world.exams || []).filter(e => !junk.has(e.section));
            world.miniGames = (world.miniGames || []).filter(g => !junk.has(g.section));
            junk.forEach(s => { if (world.progress) delete world.progress[s]; });
            world.coordinates = generateMapCoordinates(world.sections.length);
            dirty = true;
        });
    });
    if (dirty) saveToStorage();
}

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
            if (appState.scholarXP === undefined) appState.scholarXP = 0;
            if (appState.scholarLevel === undefined) appState.scholarLevel = 1;
            if (!appState.owlMentor) appState.owlMentor = { tips: [], tipIndex: 0, lastWorldName: null };
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
            purgeJunkSections();
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
        if (!appState.owlMentor) appState.owlMentor = { tips: [], tipIndex: 0, lastWorldName: null };
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

function isSectionClearedForProgression(world, sectionName) {
    if (!world || !sectionName) return false;

    const progress = world.progress?.[sectionName] || { quizPassed: false, examPassed: false };
    const hasExams = (world.exams || []).some(exam => exam.section === sectionName);
    const hasQuizzes = (world.quizzes || []).some(quiz => quiz.section === sectionName);

    if (hasExams) return !!progress.examPassed;
    if (hasQuizzes) return !!progress.quizPassed;

    // Bridge sections (for example generated intros) should not block map progression.
    return true;
}

// --- OCCULT OWL MENTOR ---
function getDefaultOwlTips() {
    return [
        'I am Aset\'s Owl. Bring me a PDF in the Workshop and I will forge chapters, flashcards, quizzes, and game-ready sections offline.',
        'Best ritual: run one Comprehension Checkpoint immediately after reading each section to lock short-term memory.',
        'If your PDF is mostly scanned images, first run Convert PDF to MD, clean noise, then run Convert MD to Syntax for stronger structure.',
        'After each chapter: Chronicle entry, then Cloze Trial, then Vault review. This creates layered recall and retention.'
    ];
}

function renderOwlTip() {
    if (!appState.owlMentor) appState.owlMentor = { tips: [], tipIndex: 0, lastWorldName: null };
    const tips = (appState.owlMentor.tips && appState.owlMentor.tips.length > 0) ? appState.owlMentor.tips : getDefaultOwlTips();
    const index = Math.max(0, Math.min(appState.owlMentor.tipIndex || 0, tips.length - 1));
    appState.owlMentor.tipIndex = index;

    const message = document.getElementById('owl-message');
    if (message) message.textContent = tips[index];
}

function setOwlTips(tips, worldName) {
    if (!appState.owlMentor) appState.owlMentor = { tips: [], tipIndex: 0, lastWorldName: null };
    appState.owlMentor.tips = Array.isArray(tips) && tips.length > 0 ? tips : getDefaultOwlTips();
    appState.owlMentor.tipIndex = 0;
    appState.owlMentor.lastWorldName = worldName || null;
    renderOwlTip();
    saveToStorage();
}

function initOwlMentor() {
    const toggle = document.getElementById('owl-toggle');
    const panel = document.getElementById('owl-panel');
    const close = document.getElementById('owl-close');
    const prev = document.getElementById('owl-prev');
    const next = document.getElementById('owl-next');

    if (!toggle || !panel) return;
    if (!appState.owlMentor) appState.owlMentor = { tips: [], tipIndex: 0, lastWorldName: null };

    if (toggle.dataset.owlBound === '1') {
        renderOwlTip();
        return;
    }

    toggle.addEventListener('click', () => {
        panel.classList.toggle('hidden');
        renderOwlTip();
    });

    if (close) {
        close.addEventListener('click', () => panel.classList.add('hidden'));
    }

    if (prev) {
        prev.addEventListener('click', () => {
            const tips = (appState.owlMentor.tips && appState.owlMentor.tips.length > 0) ? appState.owlMentor.tips : getDefaultOwlTips();
            appState.owlMentor.tipIndex = (appState.owlMentor.tipIndex - 1 + tips.length) % tips.length;
            renderOwlTip();
        });
    }

    if (next) {
        next.addEventListener('click', () => {
            const tips = (appState.owlMentor.tips && appState.owlMentor.tips.length > 0) ? appState.owlMentor.tips : getDefaultOwlTips();
            appState.owlMentor.tipIndex = (appState.owlMentor.tipIndex + 1) % tips.length;
            renderOwlTip();
        });
    }

    toggle.dataset.owlBound = '1';

    renderOwlTip();
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
    updateStreakDisplay();

    if(worldTitle) worldTitle.innerText = world.name;

    // Evaluate Speed Read button status
    const speedReadBtn = document.getElementById('btn-speed-read');
    if (speedReadBtn) {
        let hasContent = false;
        if (world && world.content) {
            for (let secTitle in world.content) {
                if (world.content[secTitle] && world.content[secTitle].trim() !== "") {
                    hasContent = true; 
                    break;
                }
            }
        }
        
        if (hasContent) {
            speedReadBtn.style.opacity = '1';
            speedReadBtn.style.pointerEvents = 'auto';
            speedReadBtn.style.filter = 'none';
        } else {
            speedReadBtn.style.opacity = '0.4';
            speedReadBtn.style.pointerEvents = 'none';
            speedReadBtn.style.filter = 'grayscale(100%)';
        }
    }
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
                const previousSectionName = world.sections[index - 1];
                if (!isSectionClearedForProgression(world, previousSectionName)) isLocked = true;
            }

            if (isLocked) {
                node.classList.add('locked-node');
                node.onclick = () => {
                    const previousSectionName = world.sections[index - 1];
                    const requiresExam = (world.exams || []).some(exam => exam.section === previousSectionName);
                    const gateLabel = requiresExam ? 'Exam' : 'Quiz';
                    showToast(`🔒 Arcane Seal! You must pass the ${gateLabel} in "${previousSectionName}" first.`, 4000);
                };
            } else {
                if (isSectionClearedForProgression(world, sectionName)) {
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

    // Chronicle button
    const btnChronicle = document.getElementById('btn-section-chronicle');
    if (btnChronicle) {
        if (!world.chronicles) world.chronicles = [];
        const sectionChronicles = world.chronicles.filter(c => c.section === sectionName);
        const countEl = document.getElementById('chronicle-count');
        if (countEl) countEl.innerText = sectionChronicles.length;
        btnChronicle.onclick = () => openChronicleModal(sectionName);
    }
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
        showToast('✨ Scribing Complete! You generated Ink!'); saveToStorage(); renderMap(); if(fcModal) fcModal.classList.add('hidden');
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
    if (!card) return; // guard: grading buttons shown after queue exhausted

    // --- STREAK TRACKING ---
    const today = new Date().toDateString();
    if (appState.lastReviewDate !== today) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        if (appState.lastReviewDate === yesterday.toDateString()) {
            appState.streak = (appState.streak || 0) + 1;
        } else {
            appState.streak = 1; // first ever, or streak broken
        }
        appState.lastReviewDate = today;
        updateStreakDisplay();
    }

    if (quality === 0) { card.interval = 0; card.ease = Math.max(1.3, card.ease - 0.2); } 
    else {
        if (quality >= 2) awardInk(1); // EARN INK!
        if (card.interval === 0) card.interval = 1; else if (card.interval === 1) card.interval = 3;
        else { let easeBonus = quality === 3 ? 0.15 : (quality === 1 ? -0.15 : 0); card.ease = Math.max(1.3, card.ease + easeBonus); card.interval = Math.round(card.interval * card.ease); }
    }
    if (card.interval > 21) card.burned = true; else card.nextReview = Date.now() + (card.interval * 86400000);
    saveToStorage(); currentFcIndex++; loadFlashcard();
}

function updateStreakDisplay() {
    const badge = document.getElementById('streak-badge');
    const count = document.getElementById('streak-count');
    if (!badge || !count) return;
    const s = appState.streak || 0;
    if (s > 0) {
        count.innerText = s;
        badge.style.display = 'inline-flex';
    } else {
        badge.style.display = 'none';
    }
}

if(document.getElementById('btn-fc-again')) document.getElementById('btn-fc-again').onclick = () => gradeCard(0); 
if(document.getElementById('btn-fc-hard')) document.getElementById('btn-fc-hard').onclick = () => gradeCard(1);
if(document.getElementById('btn-fc-good')) document.getElementById('btn-fc-good').onclick = () => gradeCard(2); 
if(document.getElementById('btn-fc-easy')) document.getElementById('btn-fc-easy').onclick = () => gradeCard(3);

if(document.getElementById('btn-remove-fc')) {
    document.getElementById('btn-remove-fc').addEventListener('click', () => {
        const card = fcQueue[currentFcIndex];
        if (!card) return;
        const world = getActiveWorld();
        if (world) {
            const idx = world.flashcards.indexOf(card);
            if (idx !== -1) world.flashcards.splice(idx, 1);
        }
        fcQueue.splice(currentFcIndex, 1);
        saveToStorage();
        showToast('🗑️ Karte gelöscht.');
        loadFlashcard();
    });
}

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

// =============================================================================
// --- THE CHRONICLE ENGINE ---
// Narrative learning: write stories with your flashcard terms, then recall them.
// =============================================================================
let chronicleSectionName = '';

const chronicleModal = document.getElementById('chronicle-modal');
const chronicleReviewModal = document.getElementById('chronicle-review-modal');

if (document.getElementById('close-chronicle')) {
    document.getElementById('close-chronicle').addEventListener('click', () => {
        if (chronicleModal) chronicleModal.classList.add('hidden');
        openSectionModal(chronicleSectionName);
    });
}
if (document.getElementById('close-chronicle-from-list')) {
    document.getElementById('close-chronicle-from-list').addEventListener('click', () => {
        if (chronicleModal) chronicleModal.classList.add('hidden');
        openSectionModal(chronicleSectionName);
    });
}
if (document.getElementById('close-chronicle-review')) {
    document.getElementById('close-chronicle-review').addEventListener('click', () => {
        if (chronicleReviewModal) chronicleReviewModal.classList.add('hidden');
        if (chronicleModal) chronicleModal.classList.remove('hidden');
    });
}
if (document.getElementById('btn-save-chronicle')) {
    document.getElementById('btn-save-chronicle').addEventListener('click', saveChronicle);
}
if (document.getElementById('btn-view-past-chronicles')) {
    document.getElementById('btn-view-past-chronicles').addEventListener('click', openPastChronicles);
}
if (document.getElementById('btn-back-to-write')) {
    document.getElementById('btn-back-to-write').addEventListener('click', () => {
        document.getElementById('chronicle-list-view').classList.add('hidden');
        document.getElementById('chronicle-write-view').classList.remove('hidden');
    });
}

// Prompts themed around monastery / mountain scholar aesthetic
const CHRONICLE_PROMPTS = [
    (sectionName) => `A wandering scholar arrives at the mountain monastery of ${sectionName} seeking ancient wisdom. In your own words, describe what they discover — what the texts reveal, what it means, and how it changes their understanding. Weave in as many of the studied concepts as you can.`,
    (sectionName) => `You are the last monk transcribing the sacred knowledge of ${sectionName} before the library is sealed for a hundred years. Preserve what you know in your own words — every concept, every truth, every secret the texts hold.`,
    (sectionName) => `An apprentice must recite everything they have learned about ${sectionName} to their master before dawn breaks over the mountain peaks. Tell their story — the knowledge they carry, and what it means.`,
    (sectionName) => `The monastery of ${sectionName} has burned. You are the last scholar alive who remembers its teachings. Write what must be preserved before the knowledge is lost to the ages forever.`,
    (sectionName) => `A young scribe sits alone in the scriptorium at midnight, surrounded by the scrolls of ${sectionName}. They must summarize everything they have absorbed — for the examination at sunrise will test every word.`
];

function openChronicleModal(sectionName) {
    chronicleSectionName = sectionName;
    const world = getActiveWorld();
    if (!world) return;
    if (!world.chronicles) world.chronicles = [];

    const sectionCards = world.flashcards.filter(fc => fc.section === sectionName);
    const terms = [...new Set(sectionCards.map(fc => fc.answer).filter(a => a && a.trim()))];

    // Pick a random prompt
    const promptFn = CHRONICLE_PROMPTS[Math.floor(Math.random() * CHRONICLE_PROMPTS.length)];
    const prompt = promptFn(sectionName);

    document.getElementById('chronicle-section-label').innerText = `Section: ${sectionName}`;
    document.getElementById('chronicle-prompt-text').innerText = prompt;
    document.getElementById('chronicle-term-total').innerText = terms.length;
    document.getElementById('chronicle-term-count').innerText = '0';
    document.getElementById('chronicle-weave-fill').style.width = '0%';

    const editorEl = document.getElementById('chronicle-editor');
    editorEl.value = '';
    editorEl.dataset.terms = JSON.stringify(terms);
    editorEl.dataset.prompt = prompt;

    // Real-time term detection
    editorEl.oninput = () => {
        const text = editorEl.value.toLowerCase();
        const detected = terms.filter(t => text.includes(t.toLowerCase()));
        document.getElementById('chronicle-term-count').innerText = detected.length;
        const pct = terms.length > 0 ? (detected.length / terms.length) * 100 : 0;
        document.getElementById('chronicle-weave-fill').style.width = pct + '%';
    };

    // Show write view
    document.getElementById('chronicle-write-view').classList.remove('hidden');
    document.getElementById('chronicle-list-view').classList.add('hidden');

    if (sectionModal) sectionModal.classList.add('hidden');
    if (chronicleModal) chronicleModal.classList.remove('hidden');
}

function saveChronicle() {
    const editorEl = document.getElementById('chronicle-editor');
    const text = editorEl.value.trim();

    if (text.length < 30) {
        showToast("Chronik zu kurz — schreibe mindestens ein paar Sätze.");
        return;
    }

    const world = getActiveWorld();
    if (!world.chronicles) world.chronicles = [];

    const terms = JSON.parse(editorEl.dataset.terms || '[]');
    const detectedTerms = terms.filter(t => text.toLowerCase().includes(t.toLowerCase()));

    world.chronicles.push({
        id: Date.now(),
        section: chronicleSectionName,
        prompt: editorEl.dataset.prompt || '',
        text: text,
        terms: detectedTerms,
        dateWritten: Date.now(),
        reviewed: false
    });

    saveToStorage();

    const inkEarned = Math.max(1, detectedTerms.length);
    awardInk(inkEarned);

    if (chronicleModal) chronicleModal.classList.add('hidden');
    openSectionModal(chronicleSectionName);

    // Update chronicle count badge
    const countEl = document.getElementById('chronicle-count');
    if (countEl) {
        const newCount = world.chronicles.filter(c => c.section === chronicleSectionName).length;
        countEl.innerText = newCount;
    }

    showToast(`📜 Chronik versiegelt! ${detectedTerms.length} Konzept(e) verwoben — +${inkEarned} 🖋️ Tinte`);
}

function openPastChronicles() {
    const world = getActiveWorld();
    if (!world.chronicles) world.chronicles = [];

    const sectionChronicles = world.chronicles
        .filter(c => c.section === chronicleSectionName)
        .sort((a, b) => b.dateWritten - a.dateWritten);

    document.getElementById('chronicle-list-section-label').innerText = `Section: ${chronicleSectionName}`;
    const list = document.getElementById('chronicle-entries-list');
    list.innerHTML = '';

    if (sectionChronicles.length === 0) {
        list.innerHTML = '<p style="color: #555; text-align: center; font-style: italic; padding: 20px;">No chronicles have been written for this section yet.</p>';
    } else {
        sectionChronicles.forEach(chronicle => {
            const date = new Date(chronicle.dateWritten).toLocaleDateString('en-US', {
                month: 'long', day: 'numeric', year: 'numeric'
            });
            const card = document.createElement('div');
            card.className = 'chronicle-entry-card';
            const excerpt = chronicle.text.length > 160
                ? chronicle.text.substring(0, 160).trimEnd() + '…'
                : chronicle.text;
            card.innerHTML = `
                <div class="chronicle-entry-header">
                    <span class="chronicle-entry-date">${date}</span>
                    <span class="chronicle-entry-terms">${chronicle.terms.length} concept(s) woven</span>
                </div>
                <p class="chronicle-entry-excerpt">&ldquo;${excerpt}&rdquo;</p>
                <button class="btn-occult chronicle-review-btn" style="width: 100%; margin-top: 8px; font-size: 0.88em; padding: 8px; border-color: rgba(180,140,60,0.4); color: #c9a84c;">🔮 Begin Recollection Trial</button>
            `;
            if (chronicle.terms.length > 0) {
                card.querySelector('.chronicle-review-btn').onclick = () => openChronicleReview(chronicle);
            } else {
                card.querySelector('.chronicle-review-btn').innerText = '(No terms woven — no trial available)';
                card.querySelector('.chronicle-review-btn').disabled = true;
                card.querySelector('.chronicle-review-btn').style.opacity = '0.4';
            }
            list.appendChild(card);
        });
    }

    document.getElementById('chronicle-write-view').classList.add('hidden');
    document.getElementById('chronicle-list-view').classList.remove('hidden');
}

function openChronicleReview(chronicle) {
    if (chronicleModal) chronicleModal.classList.add('hidden');

    const date = new Date(chronicle.dateWritten).toLocaleDateString('en-US', {
        month: 'long', day: 'numeric', year: 'numeric'
    });
    document.getElementById('chronicle-review-date').innerText = `Written: ${date}`;

    // Build cloze text — replace each woven term (first occurrence, case-insensitive) with an input
    let clozeHtml = chronicle.text;
    chronicle.terms.forEach((term, i) => {
        const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(escaped, 'i');
        const inputHtml = `<input type="text" id="cloze-${i}" class="cloze-blank" data-answer="${term.toLowerCase().replace(/"/g, '&quot;')}" placeholder="___" autocomplete="off" spellcheck="false">`;
        clozeHtml = clozeHtml.replace(regex, inputHtml);
    });
    // Preserve line breaks
    clozeHtml = clozeHtml.replace(/\n/g, '<br>');

    document.getElementById('chronicle-cloze-text').innerHTML = clozeHtml;
    document.getElementById('chronicle-review-result').classList.add('hidden');
    document.getElementById('chronicle-review-result').innerHTML = '';

    const verifyBtn = document.getElementById('btn-verify-recollection');
    verifyBtn.disabled = false;
    verifyBtn.onclick = () => {
        const inputs = document.querySelectorAll('#chronicle-cloze-text .cloze-blank');
        let correct = 0;
        inputs.forEach(input => {
            const answer = input.dataset.answer;
            const given = input.value.trim().toLowerCase();
            if (given === answer) {
                correct++;
                input.style.borderBottomColor = '#4cd137';
                input.style.color = '#4cd137';
            } else {
                input.style.borderBottomColor = '#ff4757';
                input.style.color = '#ff4757';
                input.value = ''; 
                input.placeholder = answer; // Show correct answer as placeholder
            }
        });

        const inkEarned = correct;
        if (inkEarned > 0) awardInk(inkEarned);
        chronicle.reviewed = true;
        saveToStorage();

        const resultEl = document.getElementById('chronicle-review-result');
        resultEl.innerHTML = `
            <p style="font-size: 1.15em; color: #d4a843; font-family: 'Cinzel', serif; letter-spacing: 1px; margin: 0 0 6px 0;">Recollection: ${correct} / ${inputs.length}</p>
            <p style="color: #8a7555; margin: 0; font-style: italic;">You earned ${inkEarned} 🖋️ Ink for correct recollections.</p>
        `;
        resultEl.classList.remove('hidden');
        verifyBtn.disabled = true;
    };

    if (chronicleReviewModal) chronicleReviewModal.classList.remove('hidden');
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
        if (sectionFlashcards.length < 2) { showToast('Mindestens 2 Karten benötigt für Memory Match!'); return; }
        if(sectionModal) sectionModal.classList.add('hidden'); 
        if(minigameModal) minigameModal.classList.remove('hidden');
        if(document.getElementById('minigame-title')) document.getElementById('minigame-title').innerText = "Memory Match";
        launchMemoryGame(sectionFlashcards, sectionName, gameName);
    } else if (gameName.toLowerCase() === 'trivia') {
        if (sectionFlashcards.length < 4) { showToast('Mindestens 4 Karten benötigt für Trivia Showdown!'); return; }
        if(sectionModal) sectionModal.classList.add('hidden'); 
        if(minigameModal) minigameModal.classList.remove('hidden');
        if(document.getElementById('minigame-title')) document.getElementById('minigame-title').innerText = "Trivia Showdown";
        launchTriviaGame(sectionFlashcards, world.flashcards, sectionName, gameName);
    } else if (gameName.toLowerCase() === 'spellweaver') {
        if (sectionFlashcards.length < 1) { showToast('Mindestens 1 Karte benötigt für Spellweaver!'); return; }
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
        if (sectionFlashcards.length < 1) { showToast('Mindestens 1 Karte benötigt für Arcane Defense!'); return; }
        if(sectionModal) sectionModal.classList.add('hidden'); 
        if(minigameModal) minigameModal.classList.remove('hidden');
        if(document.getElementById('minigame-title')) document.getElementById('minigame-title').innerText = "Arcane Defense";
        launchArcaneDefenseGame(sectionFlashcards, sectionName, gameName);
    } else if (gameName.toLowerCase() === 'ritual alignment' || gameName.toLowerCase() === 'ritual-alignment') {
        if(sectionModal) sectionModal.classList.add('hidden'); 
        if(minigameModal) minigameModal.classList.remove('hidden');
        if(document.getElementById('minigame-title')) document.getElementById('minigame-title').innerText = "Ritual Alignment";
        launchRitualAlignmentGame(sectionName, gameName);
    } else if (gameName.toLowerCase() === 'cloze' || gameName.toLowerCase() === 'cloze trial') {
        if (sectionFlashcards.length < 1) { showToast('Mindestens 1 Karte benötigt für den Cloze Trial!'); return; }
        if(sectionModal) sectionModal.classList.add('hidden');
        if(minigameModal) minigameModal.classList.remove('hidden');
        if(document.getElementById('minigame-title')) document.getElementById('minigame-title').innerText = "Cloze Trial";
        launchClozeGame(sectionFlashcards, sectionName, gameName);
    } else if (gameName.toLowerCase() === 'true/false blitz' || gameName.toLowerCase() === 'true-false blitz' || gameName.toLowerCase() === 'blitz') {
        if (sectionFlashcards.length < 2) { showToast('Mindestens 2 Karten benötigt für True/False Blitz!'); return; }
        if(sectionModal) sectionModal.classList.add('hidden');
        if(minigameModal) minigameModal.classList.remove('hidden');
        if(document.getElementById('minigame-title')) document.getElementById('minigame-title').innerText = "True/False Blitz";
        launchTrueFalseBlitz(sectionFlashcards, sectionName, gameName);
    } else if (gameName.toLowerCase() === 'glimpse & recall' || gameName.toLowerCase() === 'glimpse and recall' || gameName.toLowerCase() === 'glimpse') {
        if (sectionFlashcards.length < 1) { showToast('Mindestens 1 Karte benötigt für Glimpse & Recall!'); return; }
        if(sectionModal) sectionModal.classList.add('hidden');
        if(minigameModal) minigameModal.classList.remove('hidden');
        if(document.getElementById('minigame-title')) document.getElementById('minigame-title').innerText = "Glimpse & Recall";
        launchGlimpseRecall(sectionFlashcards, sectionName, gameName);
    } else {
        showToast(`Das Spiel „${gameName}" ist noch in Entwicklung!`);
    }   
}

// --- ASSESSMENT ENGINE (Rewards PAPER) ---
const assessmentModal = document.getElementById('assessment-modal');
let testQueue = [], currentTestIndex = 0, correctScore = 0, testType = "", currentTestSection = "";
if(document.getElementById('close-assessment')) document.getElementById('close-assessment').addEventListener('click', () => assessmentModal.classList.add('hidden'));

function startAssessment(type, questions, sectionName) {
    if (!questions || questions.length === 0) { showToast(`Keine ${type}-Fragen für diesen Abschnitt verfügbar.`); return; }
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

if(document.getElementById('btn-remove-question')) {
    document.getElementById('btn-remove-question').addEventListener('click', () => {
        const q = testQueue[currentTestIndex];
        if (!q) return;
        const world = getActiveWorld();
        if (world) {
            const arr = testType === 'Quiz' ? (world.quizzes || []) : (world.exams || []);
            const idx = arr.indexOf(q);
            if (idx !== -1) arr.splice(idx, 1);
        }
        testQueue.splice(currentTestIndex, 1);
        saveToStorage();
        showToast('🗑️ Frage gelöscht.');
        if (testQueue.length === 0) { finishAssessment(); return; }
        if (currentTestIndex >= testQueue.length) currentTestIndex = testQueue.length - 1;
        loadQuestion();
    });
}

function finishAssessment() {
    // Capture state before any resets so alerts always show the correct totals
    const total = testQueue.length;
    const finalScore = correctScore;
    const finalType = testType;
    const finalSection = currentTestSection;
    const isPerfect = (finalScore === total); const world = getActiveWorld();
    if (isPerfect) {
        if (finalType === 'Quiz' && !world.progress[finalSection].quizPassed) { 
            world.progress[finalSection].quizPassed = true; awardPaper('Blank Quiz Parchment');
        }
        if (finalType === 'Exam' && !world.progress[finalSection].examPassed) { 
            world.progress[finalSection].examPassed = true; awardPaper('Rare Exam Parchment');
        }
        saveToStorage(); renderMap(); showToast(`🏆 Perfect Score! You passed the ${finalType}!`);
    } else showToast(`You got ${finalScore} out of ${total}. Try again!`);
    if(assessmentModal) assessmentModal.classList.add('hidden'); openSectionModal(finalSection); 
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
        enableLexiconReadCapture();
        if(readModal) readModal.classList.remove('hidden');
    });
}

// =====================================================================
// READING TOOLS SUITE
// =====================================================================

// --- Scholar Level System ---
function updateScholarBadge() {
    const xp = appState.scholarXP || 0;
    const level = Math.floor(xp / 1000) + 1;
    appState.scholarLevel = level;
    const badge = document.getElementById('scholar-badge');
    const lvlEl = document.getElementById('scholar-level');
    if (!badge || !lvlEl) return;
    lvlEl.textContent = level;
    if (xp > 0) badge.style.display = 'inline-flex';
}

function awardScholarXP(words) {
    appState.scholarXP = (appState.scholarXP || 0) + words;
    const prevLevel = appState.scholarLevel || 1;
    updateScholarBadge();
    if (appState.scholarLevel > prevLevel) {
        const toast = document.createElement('div');
        toast.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(60,40,130,0.97);border:2px solid rgba(162,155,254,0.6);border-radius:14px;padding:28px 40px;z-index:99999;text-align:center;font-family:Cinzel,serif;box-shadow:0 0 60px rgba(162,155,254,0.35)';
        toast.innerHTML = `<div style="font-size:2.5em;margin-bottom:8px;">🎓</div><div style="color:#a29bfe;font-size:1.4em;letter-spacing:3px;text-shadow:0 0 16px rgba(162,155,254,0.6)">SCHOLAR LEVEL ${appState.scholarLevel}</div><div style="color:#6c5ce7;font-size:0.85em;margin-top:8px;font-style:italic;font-family:'Cormorant Garamond',serif">The archives yield their deeper secrets to you.</div>`;
        document.body.appendChild(toast);
        setTimeout(() => { toast.style.transition = 'opacity 0.8s'; toast.style.opacity = '0'; setTimeout(() => toast.remove(), 800); }, 2800);
    }
    saveToStorage();
}

// --- READING SPRINT ---
let sprintMinutes = 25;
let sprintTimerInterval = null;
let sprintSecondsLeft = 0;
let sprintTotalSeconds = 0;

const sprintModal = document.getElementById('sprint-modal');

if (document.getElementById('btn-sprint-start')) {
    document.getElementById('btn-sprint-start').addEventListener('click', () => {
        sprintModal.classList.remove('hidden');
        showSprintSetup();
    });
}
if (document.getElementById('close-sprint-modal')) {
    document.getElementById('close-sprint-modal').addEventListener('click', () => {
        if (sprintTimerInterval) clearInterval(sprintTimerInterval);
        sprintTimerInterval = null;
        sprintModal.classList.add('hidden');
        document.getElementById('sprint-live-bar-wrap').classList.add('hidden');
    });
}

function showSprintSetup() {
    document.getElementById('sprint-setup-view').classList.remove('hidden');
    document.getElementById('sprint-active-view').classList.add('hidden');
    document.getElementById('sprint-complete-view').classList.add('hidden');
    updateSprintRewardPreview();
}

function updateSprintRewardPreview() {
    const inkReward = sprintMinutes;
    const el = document.getElementById('sprint-reward-preview-ink');
    if (el) el.textContent = `${inkReward} Ink`;
}

document.querySelectorAll('.sprint-option-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.sprint-option-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        sprintMinutes = parseInt(btn.getAttribute('data-minutes'), 10);
        updateSprintRewardPreview();
    });
});

if (document.getElementById('btn-sprint-begin')) {
    document.getElementById('btn-sprint-begin').addEventListener('click', () => {
        sprintTotalSeconds = sprintMinutes * 60;
        sprintSecondsLeft = sprintTotalSeconds;

        document.getElementById('sprint-setup-view').classList.add('hidden');
        document.getElementById('sprint-active-view').classList.remove('hidden');
        document.getElementById('sprint-active-label').textContent = document.querySelector('.sprint-option-btn.active span')?.textContent + ' Sprint' || `${sprintMinutes}min Sprint`;

        // Show live bar on the read modal
        const liveWrap = document.getElementById('sprint-live-bar-wrap');
        if (liveWrap) liveWrap.classList.remove('hidden');

        updateSprintDisplay();
        if (sprintTimerInterval) clearInterval(sprintTimerInterval);
        sprintTimerInterval = setInterval(() => {
            sprintSecondsLeft--;
            if (sprintSecondsLeft <= 0) {
                clearInterval(sprintTimerInterval);
                sprintTimerInterval = null;
                onSprintComplete();
            } else {
                updateSprintDisplay();
            }
        }, 1000);
    });
}

function updateSprintDisplay() {
    const pct = sprintSecondsLeft / sprintTotalSeconds;
    const mm = Math.floor(sprintSecondsLeft / 60).toString().padStart(2, '0');
    const ss = (sprintSecondsLeft % 60).toString().padStart(2, '0');
    const timeStr = `${mm}:${ss}`;
    const pctStr = `${(pct * 100).toFixed(1)}%`;
    const inkSoFar = Math.floor((sprintTotalSeconds - sprintSecondsLeft) / 60);

    if (document.getElementById('sprint-big-timer')) document.getElementById('sprint-big-timer').textContent = timeStr;
    if (document.getElementById('sprint-active-fill')) document.getElementById('sprint-active-fill').style.width = pctStr;
    if (document.getElementById('sprint-xp-preview')) document.getElementById('sprint-xp-preview').textContent = `+${inkSoFar} 🖋️ earned so far`;
    if (document.getElementById('sprint-live-timer')) document.getElementById('sprint-live-timer').textContent = timeStr;
    if (document.getElementById('sprint-live-fill')) document.getElementById('sprint-live-fill').style.width = pctStr;
}

function onSprintComplete() {
    document.getElementById('sprint-active-view').classList.add('hidden');
    document.getElementById('sprint-complete-view').classList.remove('hidden');
    const inkEarned = sprintMinutes;
    awardInk(inkEarned);
    // Award Scholar XP based on approximate words read (rough estimate: 200 wpm average)
    awardScholarXP(sprintMinutes * 200);
    if (document.getElementById('sprint-complete-msg')) document.getElementById('sprint-complete-msg').textContent = `You held the flame for ${sprintMinutes} minutes without breaking.`;
    if (document.getElementById('sprint-complete-reward')) document.getElementById('sprint-complete-reward').textContent = `+${inkEarned} 🖋️ Ink`;
    if (document.getElementById('sprint-live-bar-wrap')) document.getElementById('sprint-live-bar-wrap').classList.add('hidden');
}

if (document.getElementById('btn-sprint-abandon')) {
    document.getElementById('btn-sprint-abandon').addEventListener('click', () => {
        if (sprintTimerInterval) clearInterval(sprintTimerInterval);
        sprintTimerInterval = null;
        const secondsSpent = sprintTotalSeconds - sprintSecondsLeft;
        const inkPartial = Math.floor(secondsSpent / 60);
        if (inkPartial > 0) {
            awardInk(inkPartial);
            awardScholarXP(inkPartial * 200);
            alert(`Sprint abandoned. You earned ${inkPartial} Ink for the time you spent.`);
        } else {
            alert('Sprint abandoned. No time had passed yet.');
        }
        sprintModal.classList.add('hidden');
        if (document.getElementById('sprint-live-bar-wrap')) document.getElementById('sprint-live-bar-wrap').classList.add('hidden');
    });
}

if (document.getElementById('btn-sprint-again')) {
    document.getElementById('btn-sprint-again').addEventListener('click', showSprintSetup);
}

// --- COMPASS MODE (Paragraph-by-Paragraph Focus) ---
let compassParagraphs = [];
let compassIndex = 0;
let compassAutoTimer = null;

if (document.getElementById('btn-compass-mode')) {
    document.getElementById('btn-compass-mode').addEventListener('click', openCompassMode);
}
if (document.getElementById('btn-close-compass')) {
    document.getElementById('btn-close-compass').addEventListener('click', closeCompassMode);
}

function openCompassMode() {
    const rawText = currentReadPages[currentReadIndex] || '';
    // Split by double newlines, filter empties
    compassParagraphs = rawText.split(/\n\n+/).map(p => p.trim()).filter(p => p.length > 10);
    if (compassParagraphs.length === 0) { alert('No paragraphs found on this page.'); return; }
    compassIndex = 0;
    renderCompassParagraph();
    document.getElementById('compass-mode-display').style.display = 'flex';
    document.getElementById('compass-mode-display').classList.remove('hidden');
    if (readModal) readModal.classList.add('hidden');
}

function closeCompassMode() {
    stopCompassAuto();
    document.getElementById('compass-mode-display').style.display = 'none';
    document.getElementById('compass-mode-display').classList.add('hidden');
    if (readModal) readModal.classList.remove('hidden');
    // Award XP for reading
    const words = compassParagraphs.slice(0, compassIndex + 1).join(' ').split(/\s+/).length;
    awardScholarXP(words);
}

function renderCompassParagraph() {
    const para = document.getElementById('compass-paragraph-text');
    if (para) {
        para.style.opacity = '0';
        setTimeout(() => {
            para.textContent = compassParagraphs[compassIndex] || '';
            para.style.opacity = '1';
        }, 200);
    }
    const prog = document.getElementById('compass-progress-label');
    if (prog) prog.textContent = `Paragraph ${compassIndex + 1} of ${compassParagraphs.length}`;

    // Dots
    const dotTrack = document.getElementById('compass-dot-track');
    if (dotTrack) {
        dotTrack.innerHTML = '';
        const maxDots = 20;
        const showCount = Math.min(compassParagraphs.length, maxDots);
        for (let i = 0; i < showCount; i++) {
            const d = document.createElement('div');
            d.className = 'compass-dot' + (i === compassIndex ? ' active' : (i < compassIndex ? ' visited' : ''));
            dotTrack.appendChild(d);
        }
    }

    const prevBtn = document.getElementById('compass-prev-btn');
    const nextBtn = document.getElementById('compass-next-btn');
    if (prevBtn) prevBtn.style.opacity = compassIndex === 0 ? '0.3' : '1';
    if (nextBtn) nextBtn.style.opacity = compassIndex === compassParagraphs.length - 1 ? '0.3' : '1';
}

if (document.getElementById('compass-prev-btn')) {
    document.getElementById('compass-prev-btn').addEventListener('click', () => {
        if (compassIndex > 0) { compassIndex--; renderCompassParagraph(); }
    });
}
if (document.getElementById('compass-next-btn')) {
    document.getElementById('compass-next-btn').addEventListener('click', () => {
        if (compassIndex < compassParagraphs.length - 1) { compassIndex++; renderCompassParagraph(); }
        else { closeCompassMode(); }
    });
}

if (document.getElementById('compass-auto-toggle')) {
    document.getElementById('compass-auto-toggle').addEventListener('change', function() {
        if (this.checked) startCompassAuto(); else stopCompassAuto();
    });
}
if (document.getElementById('compass-speed-select')) {
    document.getElementById('compass-speed-select').addEventListener('change', () => {
        if (document.getElementById('compass-auto-toggle').checked) {
            stopCompassAuto(); startCompassAuto();
        }
    });
}

function startCompassAuto() {
    stopCompassAuto();
    const delay = parseInt(document.getElementById('compass-speed-select').value, 10) || 2500;
    compassAutoTimer = setInterval(() => {
        if (compassIndex < compassParagraphs.length - 1) { compassIndex++; renderCompassParagraph(); }
        else { closeCompassMode(); }
    }, delay);
}
function stopCompassAuto() {
    if (compassAutoTimer) { clearInterval(compassAutoTimer); compassAutoTimer = null; }
    const tog = document.getElementById('compass-auto-toggle');
    if (tog) tog.checked = false;
}

// --- COMPREHENSION CHECKPOINT ---
let checkpointQueue = [];
let checkpointIndex = 0;
let checkpointCorrect = 0;
let checkpointCombo = 0;

const checkpointModal = document.getElementById('checkpoint-modal');

if (document.getElementById('btn-checkpoint-trigger')) {
    document.getElementById('btn-checkpoint-trigger').addEventListener('click', openCheckpoint);
}
if (document.getElementById('close-checkpoint')) {
    document.getElementById('close-checkpoint').addEventListener('click', () => checkpointModal.classList.add('hidden'));
}
if (document.getElementById('btn-checkpoint-close')) {
    document.getElementById('btn-checkpoint-close').addEventListener('click', () => checkpointModal.classList.add('hidden'));
}

function openCheckpoint() {
    const world = getActiveWorld();
    if (!world) return;
    const section = world.flashcards?.filter(fc => fc.section === currentReadSectionTitle);
    if (!section || section.length === 0) {
        alert('No flashcards found for this section. Add some !FLASH! cards to your notes first.');
        return;
    }
    checkpointQueue = [...section].sort(() => Math.random() - 0.5).slice(0, Math.min(5, section.length));
    checkpointIndex = 0;
    checkpointCorrect = 0;
    checkpointCombo = 0;

    document.getElementById('checkpoint-active-view').classList.remove('hidden');
    document.getElementById('checkpoint-results-view').classList.add('hidden');
    renderCheckpointCard();
    checkpointModal.classList.remove('hidden');
}

function renderCheckpointCard() {
    const card = checkpointQueue[checkpointIndex];
    document.getElementById('checkpoint-question').textContent = card.question;
    document.getElementById('checkpoint-answer').textContent = card.answer;
    document.getElementById('checkpoint-answer').classList.add('hidden');
    document.getElementById('btn-checkpoint-reveal').classList.remove('hidden');
    document.getElementById('checkpoint-grade-btns').classList.add('hidden');
    document.getElementById('checkpoint-progress').textContent = `Card ${checkpointIndex + 1} of ${checkpointQueue.length}`;
    const pct = (checkpointIndex / checkpointQueue.length) * 100;
    document.getElementById('checkpoint-prog-fill').style.width = `${pct}%`;
    const comboBadge = document.getElementById('checkpoint-combo-badge');
    if (checkpointCombo >= 2) {
        comboBadge.classList.remove('hidden');
        comboBadge.textContent = `🔥 x${checkpointCombo}`;
        comboBadge.style.animation = 'none'; void comboBadge.offsetWidth; comboBadge.style.animation = 'comboPulse 0.6s ease-in-out';
    } else {
        comboBadge.classList.add('hidden');
    }
}

if (document.getElementById('btn-checkpoint-reveal')) {
    document.getElementById('btn-checkpoint-reveal').addEventListener('click', () => {
        document.getElementById('checkpoint-answer').classList.remove('hidden');
        document.getElementById('btn-checkpoint-reveal').classList.add('hidden');
        document.getElementById('checkpoint-grade-btns').classList.remove('hidden');
    });
}
if (document.getElementById('btn-cp-right')) {
    document.getElementById('btn-cp-right').addEventListener('click', () => advanceCheckpoint(true));
}
if (document.getElementById('btn-cp-wrong')) {
    document.getElementById('btn-cp-wrong').addEventListener('click', () => advanceCheckpoint(false));
}

function advanceCheckpoint(isCorrect) {
    if (isCorrect) { checkpointCorrect++; checkpointCombo++; } else { checkpointCombo = 0; }
    checkpointIndex++;
    if (checkpointIndex >= checkpointQueue.length) {
        showCheckpointResults();
    } else {
        renderCheckpointCard();
    }
}

function showCheckpointResults() {
    document.getElementById('checkpoint-active-view').classList.add('hidden');
    document.getElementById('checkpoint-results-view').classList.remove('hidden');
    document.getElementById('checkpoint-prog-fill').style.width = '100%';

    const total = checkpointQueue.length;
    const pct = Math.round((checkpointCorrect / total) * 100);
    const inkEarned = checkpointCorrect * 2;
    const icon = pct >= 80 ? '🏆' : pct >= 50 ? '📜' : '⚗️';
    const title = pct >= 80 ? 'Excellent Comprehension!' : pct >= 50 ? 'Partial Mastery' : 'Keep Studying';

    document.getElementById('checkpoint-result-icon').textContent = icon;
    document.getElementById('checkpoint-result-title').textContent = title;
    document.getElementById('checkpoint-result-title').style.color = pct >= 80 ? '#4cd137' : pct >= 50 ? '#d4a843' : '#ff6b6b';
    document.getElementById('checkpoint-result-stats').textContent = `${checkpointCorrect} / ${total} recalled correctly (${pct}%)`;
    document.getElementById('checkpoint-result-reward').textContent = inkEarned > 0 ? `+${inkEarned} 🖋️ Ink awarded` : 'No Ink earned — try harder next time.';
    if (inkEarned > 0) awardInk(inkEarned);
    saveToStorage();
}

// --- SCHOLAR'S LEXICON ---
let lexiconWords = []; // { word, definition, defined }
let lexiconDefineQueue = [];
let lexiconDefineIndex = 0;
let lexiconDefineCorrect = 0;

const lexiconModal = document.getElementById('lexicon-modal');
const lexiconDefineModal = document.getElementById('lexicon-define-modal');

if (document.getElementById('btn-lexicon-open')) {
    document.getElementById('btn-lexicon-open').addEventListener('click', () => {
        renderLexiconList();
        lexiconModal.classList.remove('hidden');
    });
}
if (document.getElementById('close-lexicon')) {
    document.getElementById('close-lexicon').addEventListener('click', () => lexiconModal.classList.add('hidden'));
}
if (document.getElementById('close-lexicon-define')) {
    document.getElementById('close-lexicon-define').addEventListener('click', () => { lexiconDefineModal.classList.add('hidden'); lexiconModal.classList.remove('hidden'); });
}
if (document.getElementById('btn-lexicon-clear')) {
    document.getElementById('btn-lexicon-clear').addEventListener('click', () => {
        if (confirm('Clear all collected words from the Lexicon?')) { lexiconWords = []; renderLexiconList(); }
    });
}

// Enable double-click word collection while reading
function enableLexiconReadCapture() {
    const contentEl = document.getElementById('read-modal-content');
    if (!contentEl) return;
    contentEl.ondblclick = function(e) {
        const sel = window.getSelection();
        if (!sel || sel.isCollapsed) return;
        const word = sel.toString().trim().replace(/[^a-zA-ZÀ-ÿ\-]/g, '').toLowerCase();
        if (!word || word.length < 3) return;
        if (!lexiconWords.find(w => w.word === word)) {
            // Try to find a matching flashcard answer as a definition hint
            const world = getActiveWorld();
            let hint = '';
            if (world) {
                const match = world.flashcards?.find(fc => fc.answer.toLowerCase().includes(word));
                if (match) hint = match.answer;
            }
            lexiconWords.push({ word, hint, definition: '', defined: false });
            const toast = document.createElement('div');
            toast.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:rgba(60,40,130,0.95);border:1px solid rgba(162,155,254,0.4);border-radius:20px;padding:8px 20px;z-index:99999;font-family:Cinzel,serif;color:#a29bfe;font-size:0.85em;pointer-events:none;';
            toast.textContent = `"${word}" added to Lexicon`;
            document.body.appendChild(toast);
            setTimeout(() => { toast.style.transition='opacity 0.5s'; toast.style.opacity='0'; setTimeout(()=>toast.remove(),500); }, 1600);
        }
        sel.removeAllRanges();
    };
}

function renderLexiconList() {
    const listEl = document.getElementById('lexicon-entries');
    const emptyMsg = document.getElementById('lexicon-empty-msg');
    if (!listEl) return;
    listEl.innerHTML = '';
    if (lexiconWords.length === 0) {
        if (emptyMsg) emptyMsg.style.display = 'block';
        return;
    }
    if (emptyMsg) emptyMsg.style.display = 'none';
    lexiconWords.forEach((entry, idx) => {
        const chip = document.createElement('div');
        chip.className = 'lexicon-word-chip' + (entry.defined ? ' defined' : '');
        chip.innerHTML = `<span>${entry.word}</span>${entry.defined ? '<span title="Defined">✓</span>' : ''}<span class="chip-remove" title="Remove" data-idx="${idx}">✕</span>`;
        chip.querySelector('.chip-remove').addEventListener('click', (ev) => {
            ev.stopPropagation();
            lexiconWords.splice(idx, 1);
            renderLexiconList();
        });
        listEl.appendChild(chip);
    });
}

if (document.getElementById('btn-lexicon-quiz')) {
    document.getElementById('btn-lexicon-quiz').addEventListener('click', () => {
        const undefs = lexiconWords.filter(w => !w.defined);
        if (undefs.length === 0) { alert('All collected words have already been defined! Clear the list or add new words.'); return; }
        lexiconDefineQueue = [...undefs];
        lexiconDefineIndex = 0;
        lexiconDefineCorrect = 0;
        lexiconModal.classList.add('hidden');
        renderLexiconDefineCard();
        lexiconDefineModal.classList.remove('hidden');
    });
}

function renderLexiconDefineCard() {
    const entry = lexiconDefineQueue[lexiconDefineIndex];
    const termEl = document.getElementById('lexicon-term-display');
    const inputEl = document.getElementById('lexicon-define-input');
    const revealEl = document.getElementById('lexicon-define-reveal');
    const gradeEl = document.getElementById('lexicon-define-grade');
    const submitEl = document.getElementById('btn-lexicon-submit-def');
    const progEl = document.getElementById('lexicon-define-progress');

    if (termEl) termEl.textContent = entry.word;
    if (inputEl) { inputEl.value = ''; inputEl.style.display = 'block'; }
    if (revealEl) { revealEl.classList.add('hidden'); revealEl.textContent = ''; }
    if (gradeEl) { gradeEl.classList.add('hidden'); gradeEl.style.display = 'none'; }
    if (submitEl) submitEl.classList.remove('hidden');
    if (progEl) progEl.textContent = `Term ${lexiconDefineIndex + 1} of ${lexiconDefineQueue.length}`;
}

if (document.getElementById('btn-lexicon-submit-def')) {
    document.getElementById('btn-lexicon-submit-def').addEventListener('click', () => {
        const inputEl = document.getElementById('lexicon-define-input');
        const revealEl = document.getElementById('lexicon-define-reveal');
        const gradeEl = document.getElementById('lexicon-define-grade');
        const submitEl = document.getElementById('btn-lexicon-submit-def');
        const entry = lexiconDefineQueue[lexiconDefineIndex];
        if (!inputEl.value.trim()) return;

        const hint = entry.hint || `(No flashcard context found for "${entry.word}")`;
        revealEl.textContent = hint;
        revealEl.classList.remove('hidden');
        gradeEl.classList.remove('hidden');
        gradeEl.style.display = 'flex';
        submitEl.classList.add('hidden');
        inputEl.style.display = 'block';
    });
}

function advanceLexiconDefine(isCorrect) {
    const entry = lexiconDefineQueue[lexiconDefineIndex];
    const idx = lexiconWords.findIndex(w => w.word === entry.word);
    if (isCorrect) {
        lexiconDefineCorrect++;
        const defInput = document.getElementById('lexicon-define-input');
        if (idx !== -1 && defInput) lexiconWords[idx].definition = defInput.value.trim();
        if (idx !== -1) lexiconWords[idx].defined = true;
    }
    lexiconDefineIndex++;
    if (lexiconDefineIndex >= lexiconDefineQueue.length) {
        const inkEarned = lexiconDefineCorrect * 3;
        if (inkEarned > 0) awardInk(inkEarned);
        saveToStorage();
        alert(`Lexicon session complete!\n${lexiconDefineCorrect}/${lexiconDefineQueue.length} terms understood.\n+${inkEarned} 🖋️ Ink earned.`);
        lexiconDefineModal.classList.add('hidden');
        lexiconModal.classList.remove('hidden');
        renderLexiconList();
    } else {
        renderLexiconDefineCard();
    }
}

if (document.getElementById('btn-lex-right')) {
    document.getElementById('btn-lex-right').addEventListener('click', () => advanceLexiconDefine(true));
}
if (document.getElementById('btn-lex-wrong')) {
    document.getElementById('btn-lex-wrong').addEventListener('click', () => advanceLexiconDefine(false));
}

// --- FEYNMAN SIMPLIFIER ---
let feynmanTerms = [];
let feynmanSectionLabel = '';

const feynmanModal = document.getElementById('feynman-modal');

if (document.getElementById('btn-feynman-open')) {
    document.getElementById('btn-feynman-open').addEventListener('click', openFeynmanLab);
}
if (document.getElementById('close-feynman')) {
    document.getElementById('close-feynman').addEventListener('click', () => feynmanModal.classList.add('hidden'));
}

function openFeynmanLab() {
    const world = getActiveWorld();
    if (!world) return;
    feynmanSectionLabel = currentReadSectionTitle;
    feynmanTerms = (world.flashcards || [])
        .filter(fc => fc.section === feynmanSectionLabel)
        .map(fc => fc.answer.toLowerCase().trim())
        .filter(a => a.length > 3);

    const labelEl = document.getElementById('feynman-section-label');
    const promptEl = document.getElementById('feynman-prompt');
    const editorEl = document.getElementById('feynman-editor');
    const totalEl = document.getElementById('feynman-term-total');
    const resultEl = document.getElementById('feynman-result');

    if (labelEl) labelEl.textContent = `Section: ${feynmanSectionLabel}`;
    const prompts = [
        `Explain everything you understand about "${feynmanSectionLabel}" as if teaching a curious child with no prior knowledge.`,
        `A student from the outside world finds a sealed scroll about "${feynmanSectionLabel}". What is the single most important thing it teaches, and why does it matter?`,
        `Describe the core concepts of "${feynmanSectionLabel}" using only the simplest possible language. Avoid jargon — use plain, vivid analogies.`,
        `You have 5 minutes before the monastery library burns. Write everything essential about "${feynmanSectionLabel}" that must be remembered.`
    ];
    if (promptEl) promptEl.textContent = prompts[Math.floor(Math.random() * prompts.length)];
    if (editorEl) { editorEl.value = ''; editorEl.oninput = updateFeynmanProgress; }
    if (totalEl) totalEl.textContent = feynmanTerms.length;
    if (resultEl) { resultEl.classList.add('hidden'); resultEl.className = 'feynman-result-box hidden'; resultEl.textContent = ''; }
    updateFeynmanProgress();
    feynmanModal.classList.remove('hidden');
}

function updateFeynmanProgress() {
    const text = (document.getElementById('feynman-editor')?.value || '').toLowerCase();
    const found = feynmanTerms.filter(term => text.includes(term)).length;
    const total = feynmanTerms.length;
    if (document.getElementById('feynman-term-count')) document.getElementById('feynman-term-count').textContent = found;
    if (document.getElementById('feynman-fill')) {
        document.getElementById('feynman-fill').style.width = total > 0 ? `${(found / total) * 100}%` : '0%';
    }
}

if (document.getElementById('btn-feynman-submit')) {
    document.getElementById('btn-feynman-submit').addEventListener('click', submitFeynman);
}

function submitFeynman() {
    const text = (document.getElementById('feynman-editor')?.value || '').trim();
    if (text.length < 30) { alert('Write at least a few sentences before submitting.'); return; }
    const textLow = text.toLowerCase();
    const found = feynmanTerms.filter(term => textLow.includes(term));
    const total = feynmanTerms.length;
    const pct = total > 0 ? (found.length / total) : 1;
    const inkEarned = Math.max(1, found.length * 3);
    const resultEl = document.getElementById('feynman-result');

    if (pct >= 0.6 || total === 0) {
        resultEl.className = 'feynman-result-box pass';
        resultEl.innerHTML = `<div style="font-size:1.8em;margin-bottom:8px;">⚗️</div>The Feynman Test: Passed<br><span style="font-size:0.85em;color:#4e8a68;font-family:'Cormorant Garamond',serif;font-style:italic;">${found.length} of ${total} key terms woven in.</span><br><span style="color:#aaffcc;font-size:1em;">+${inkEarned} 🖋️ Ink</span>`;
        awardInk(inkEarned);
    } else {
        resultEl.className = 'feynman-result-box fail';
        resultEl.innerHTML = `<div style="font-size:1.8em;margin-bottom:8px;">🔬</div>Incomplete Understanding<br><span style="font-size:0.85em;color:#a06040;font-family:'Cormorant Garamond',serif;font-style:italic;">Only ${found.length} of ${total} key terms found. Go deeper.<br>Missing: ${feynmanTerms.filter(t=>!textLow.includes(t)).slice(0,4).map(t=>`"${t}"`).join(', ')}</span>`;
    }
    resultEl.classList.remove('hidden');
    saveToStorage();
}

if (document.getElementById('btn-feynman-hint')) {
    document.getElementById('btn-feynman-hint').addEventListener('click', () => {
        const missing = feynmanTerms.filter(t => !(document.getElementById('feynman-editor')?.value || '').toLowerCase().includes(t));
        if (missing.length === 0) { alert('You have already used all known key terms!'); return; }
        const hint = missing[Math.floor(Math.random() * missing.length)];
        alert(`Hint: try working the concept of "${hint}" into your explanation.`);
    });
}

// Wire lexicon capture whenever the read modal opens content
// (called from btn-section-read handler below)

// Update scholar badge on load
updateScholarBadge();

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

function refreshDeletePageOptions() {
    const select = document.getElementById('delete-page-select');
    const btn = document.getElementById('delete-page-btn');
    const world = getActiveWorld();
    if (!select) return;

    select.innerHTML = '';

    if (!world || !Array.isArray(world.sections) || world.sections.length === 0) {
        const option = document.createElement('option');
        option.value = '';
        option.innerText = 'No pages available';
        select.appendChild(option);
        select.disabled = true;
        if (btn) btn.disabled = true;
        return;
    }

    world.sections.forEach((sectionName, index) => {
        const option = document.createElement('option');
        option.value = sectionName;
        option.innerText = `${index + 1}. ${sectionName}`;
        select.appendChild(option);
    });

    select.disabled = false;
    if (btn) btn.disabled = world.sections.length <= 1;
}

if (document.getElementById('settings-btn')) {
    document.getElementById('settings-btn').addEventListener('click', () => { 
        if(settingsModal) {
            settingsModal.classList.remove('hidden');
            const world = getActiveWorld();
            if (world && document.getElementById('world-rename-input')) {
                document.getElementById('world-rename-input').value = world.name || world.title || "";
            }
            refreshDeletePageOptions();
            // Populate OpenAI key field
            const keyInput = document.getElementById('openai-key-input');
            const keyStatus = document.getElementById('openai-key-status');
            const clearBtn = document.getElementById('btn-clear-openai-key');
            const savedKey = localStorage.getItem('openai_api_key') || '';
            if (keyInput) keyInput.value = savedKey;
            if (keyStatus) {
                keyStatus.textContent = savedKey ? '✓ API-Schlüssel gespeichert — KI-Generierung aktiv beim nächsten PDF-Import.' : 'Kein Schlüssel gespeichert — Offline-Methode wird verwendet.';
                keyStatus.style.color = savedKey ? '#a29bfe' : '#888';
            }
            if (clearBtn) clearBtn.style.display = savedKey ? 'block' : 'none';
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
            showToast("Welt erfolgreich umbenannt!");
        }
    });
}
if (document.getElementById('close-settings')) {
    document.getElementById('close-settings').addEventListener('click', () => { if(settingsModal) settingsModal.classList.add('hidden') });
}

// --- OpenAI API key save / clear ---
if (document.getElementById('btn-save-openai-key')) {
    document.getElementById('btn-save-openai-key').addEventListener('click', () => {
        const keyInput = document.getElementById('openai-key-input');
        const keyStatus = document.getElementById('openai-key-status');
        const clearBtn = document.getElementById('btn-clear-openai-key');
        const val = (keyInput?.value || '').trim();
        if (!val || !val.startsWith('sk-')) {
            if (keyStatus) { keyStatus.textContent = '✗ Ungültiger Schlüssel — muss mit sk- beginnen.'; keyStatus.style.color = '#ff5e5e'; }
            return;
        }
        localStorage.setItem('openai_api_key', val);
        if (keyStatus) { keyStatus.textContent = '✓ Gespeichert — nächster PDF-Import nutzt KI.'; keyStatus.style.color = '#a29bfe'; }
        if (clearBtn) clearBtn.style.display = 'block';
    });
}
if (document.getElementById('btn-clear-openai-key')) {
    document.getElementById('btn-clear-openai-key').addEventListener('click', () => {
        localStorage.removeItem('openai_api_key');
        const keyInput = document.getElementById('openai-key-input');
        const keyStatus = document.getElementById('openai-key-status');
        const clearBtn = document.getElementById('btn-clear-openai-key');
        if (keyInput) keyInput.value = '';
        if (keyStatus) { keyStatus.textContent = 'Schlüssel gelöscht — Offline-Methode wird verwendet.'; keyStatus.style.color = '#888'; }
        if (clearBtn) clearBtn.style.display = 'none';
    });
}
if (document.getElementById('delete-page-btn')) {
    document.getElementById('delete-page-btn').addEventListener('click', () => {
        const world = getActiveWorld();
        const select = document.getElementById('delete-page-select');
        if (!world || !select) return;
        if (!Array.isArray(world.sections) || world.sections.length <= 1) {
            alert('At least one page must remain. Use Delete Current World if you want to remove everything.');
            return;
        }

        const sectionToDelete = select.value;
        if (!sectionToDelete) return;

        if (!confirm(`Delete page "${sectionToDelete}" from this world?`)) return;

        world.sections = world.sections.filter(section => section !== sectionToDelete);
        if (world.content) delete world.content[sectionToDelete];
        if (world.progress) delete world.progress[sectionToDelete];
        if (world.readProgress) delete world.readProgress[sectionToDelete];

        world.tasks = (world.tasks || []).filter(item => item.section !== sectionToDelete);
        world.flashcards = (world.flashcards || []).filter(item => item.section !== sectionToDelete);
        world.quizzes = (world.quizzes || []).filter(item => item.section !== sectionToDelete);
        world.exams = (world.exams || []).filter(item => item.section !== sectionToDelete);
        world.miniGames = (world.miniGames || []).filter(item => item.section !== sectionToDelete);
        world.rituals = (world.rituals || []).filter(item => item.section !== sectionToDelete);
        world.chronicles = (world.chronicles || []).filter(item => item.section !== sectionToDelete);

        world.coordinates = generateMapCoordinates(world.sections.length);

        saveToStorage();
        renderMap();
        refreshDeletePageOptions();
        alert(`Deleted page "${sectionToDelete}".`);
    });
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


if (document.getElementById('btn-force-sync')) {
    document.getElementById('btn-force-sync').addEventListener('click', async () => {
        try {
            // Force fetch bypasses browser cache using a timestamp
            const response = await fetch('./saveData.json?t=' + new Date().getTime(), { cache: 'no-store' });
            if (response.ok) {
                const cloudData = await response.json();
                const confirmSync = confirm("Force sync your phone from the cloud?\nThis will bring in your PC worlds while keeping your phone's economy and progress.");
                
                if (confirmSync) {
                    console.log("Forced Sync! Merging data...");
                    // MERGE PC CONTENT WITH PHONE PROGRESS (For the Owner)
                    cloudData.gold = Math.max(appState.gold || 0, cloudData.gold || 0);
                    cloudData.ink = Math.max(appState.ink || 0, cloudData.ink || 0);
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

                    // Fix any corrupted lastExported timestamps
                    cloudData.lastExported = Date.now();
                    localStorage.setItem('studyQuestData', JSON.stringify(cloudData));
                    alert("Sync Successful! Reloading app...");
                    location.reload(); 
                }
            } else {
                alert("Could not load saveData.json. Make sure you pushed it to GitHub!");
            }
        } catch(e) {
            console.error(e);
            alert("Network error or saveData.json is missing.");
        }
    });
}

// Boot Application
async function bootApp() {
    loadFromStorage();
    // Bind Owl controls immediately so the button responds even during cloud sync fetch.
    try { initOwlMentor(); } catch(e) { console.error('Owl mentor init error', e); }
    
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

    const speedReadBtn = document.getElementById('btn-speed-read');
    if (speedReadBtn) {
        speedReadBtn.addEventListener('click', () => {
            const world = getActiveWorld();
            if (!world || !world.content || world.sections.length === 0) return;

            let allTextContent = [];
            world.sections.forEach(secName => {
                let secText = world.content[secName] || "";
                if (secText.trim()) {
                    // Filter out !IMAGE! data tags for RSVP reader
                    secText = secText.replace(/!IMAGE!\s*(data:image\/[^ \n]+)/g, '[Image Reference Skipped]');
                    allTextContent.push(`\n\n=== ${secName.toUpperCase()} ===\n\n` + secText.trim());
                }
            });

            if (allTextContent.length === 0) {
                alert("No readable text found in this world.");
                return;
            }

            // Combine into one master string
            const combinedText = allTextContent.join('\n');
            const wordsList = combinedText.match(/\S+/g) || [];
            
            if (wordsList.length === 0) {
                alert("No readable text found in this world.");
                return;
            }

            // Expose globally to interval runner
            window.speedReadWords = wordsList;
            window.speedReadIndex = 0;
            window.speedReadWordsSinceReward = 0;

            const srModal = document.getElementById('speed-read-modal');
            const srDisplay = document.getElementById('speed-read-display');
            const srSettings = document.getElementById('speed-read-settings');
            
            // Show Modal into configuration state
            if (srModal) srModal.classList.remove('hidden');
            if (srSettings) srSettings.style.display = 'flex';
            if (srDisplay) srDisplay.classList.add('hidden');
        });
    }
}

// --- SPEED READ LOGIC ---
let speedReadInterval = null;

const srSpeedSlider = document.getElementById('sr-speed-slider');
const srSizeSlider = document.getElementById('sr-size-slider');
const srChunkSlider = document.getElementById('sr-chunk-slider');

if (srSpeedSlider) {
    srSpeedSlider.addEventListener('input', (e) => {
        document.getElementById('sr-speed-val').innerText = e.target.value;
    });
}
if (srSizeSlider) {
    srSizeSlider.addEventListener('input', (e) => {
        document.getElementById('sr-size-val').innerText = e.target.value + 'px';
        document.getElementById('sr-text-box').style.fontSize = e.target.value + 'px';
    });
}
if (srChunkSlider) {
    srChunkSlider.addEventListener('input', (e) => {
        document.getElementById('sr-chunk-val').innerText = e.target.value;
    });
}

const srStartBtn = document.getElementById('btn-sr-start');
const srStopBtn = document.getElementById('btn-sr-stop');
const srCloseBtn = document.getElementById('close-speed-read-modal');

if (srCloseBtn) {
    srCloseBtn.addEventListener('click', stopSpeedReadAndClose);
}

if (srStartBtn) {
    srStartBtn.addEventListener('click', () => {
        const srSettings = document.getElementById('speed-read-settings');
        const srDisplay = document.getElementById('speed-read-display');
        const srModal = document.getElementById('speed-read-modal');
        
        if (srModal) srModal.classList.add('hidden');
        if (srDisplay) srDisplay.classList.remove('hidden');
        
        const wpm = parseInt(srSpeedSlider.value) || 300;
        const chunkSize = parseInt(srChunkSlider.value) || 2;
        const useBionic = document.getElementById('sr-bionic-toggle') ? document.getElementById('sr-bionic-toggle').checked : false;
        
        // Calculate milliseconds per interval: (60,000 ms / WPM) * Chunk Size
        const msPerChunk = (60000 / wpm) * chunkSize;
        
        const textBox = document.getElementById('sr-text-box');
        
        speedReadInterval = setInterval(() => {
            if (!window.speedReadWords || window.speedReadIndex >= window.speedReadWords.length) {
                // Done Reading
                stopSpeedRead();
                textBox.innerHTML = "<span style='color: #4CAF50;'>End of Text</span>";
                return;
            }
            
            // Extract the chunk of words
            const chunkWords = window.speedReadWords.slice(window.speedReadIndex, window.speedReadIndex + chunkSize);
            window.speedReadIndex += chunkSize;
            
            // Standard reading page length is about 250 words
            window.speedReadWordsSinceReward += chunkWords.length;
            if (window.speedReadWordsSinceReward >= 250) {
                window.speedReadWordsSinceReward -= 250;
                
                // Silent Reward for 1 "Page" read
                appState.ink = (appState.ink || 0) + 1;
                appState.gold = (appState.gold || 0) + 1;
                if (!appState.paper) appState.paper = {};
                appState.paper['Generic Scroll'] = (appState.paper['Generic Scroll'] || 0) + 1;
                
                saveToStorage();
                updateEconomyUI();
                
                // Show visual feedback on screen without stuttering
                const floater = document.createElement('div');
                floater.innerHTML = "+1 Gold, +1 Ink, +1 Generic Scroll";
                floater.style.position = "fixed";
                floater.style.bottom = "20%"; // Pop up lower on the screen
                floater.style.left = "50%";
                floater.style.transform = "translateX(-50%)"; // Center it horizontally
                floater.style.color = "#ffebaa";
                floater.style.backgroundColor = "rgba(20, 20, 20, 0.8)";
                floater.style.padding = "10px 20px";
                floater.style.borderRadius = "10px";
                floater.style.border = "1px solid rgba(255, 215, 0, 0.4)";
                floater.style.fontFamily = "'Cinzel', serif";
                floater.style.textShadow = "0 0 10px rgba(255, 200, 50, 0.8)";
                floater.style.fontWeight = "bold";
                floater.style.fontSize = "1.2em";
                floater.style.pointerEvents = "none";
                floater.style.transition = "all 1s ease-in-out";
                floater.style.opacity = "1";
                document.getElementById('speed-read-display').appendChild(floater);
                
                // Animate floating up and fading
                setTimeout(() => {
                    floater.style.bottom = "30%";
                }, 50);
                
                // Disappear after 3 seconds
                setTimeout(() => {
                    floater.style.opacity = "0";
                }, 2000); // 2s mark start fading
                setTimeout(() => floater.remove(), 3000); // 3s explicitly remove
            }
            
            const chunkText = chunkWords.join(' ');
            if (useBionic) {
                textBox.innerHTML = applyBionicReading(chunkText);
            } else {
                textBox.innerText = chunkText;
            }
        }, msPerChunk);
    });
}

if (srStopBtn) {
    srStopBtn.addEventListener('click', () => {
        stopSpeedRead();
        document.getElementById('speed-read-modal').classList.remove('hidden');
        document.getElementById('speed-read-display').classList.add('hidden');
    });
}

function stopSpeedRead() {
    if (speedReadInterval) {
        clearInterval(speedReadInterval);
        speedReadInterval = null;
    }
}

function stopSpeedReadAndClose() {
    stopSpeedRead();
    document.getElementById('speed-read-modal').classList.add('hidden');
}

initStaticListeners();



























export { getActiveWorld };



export { renderMap };
