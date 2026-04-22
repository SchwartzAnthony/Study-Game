import { appState } from './state.js';
import { saveToStorage } from './storage.js';
import { getActiveWorld, renderMap } from '../app.js';

// DOM Elements Required
const editor = document.getElementById('markdown-editor');
const fileInput = document.getElementById('fileUpload');
const mainHubFileInput = document.getElementById('main-hub-file-upload');
const editorScreen = document.getElementById('editor-screen');
const hubScreen = document.getElementById('hub-screen');

// --- Excel Reward Parser --- 
const excelUploadInput = document.getElementById('excelUpload');

if (excelUploadInput) {
    excelUploadInput.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();

        reader.onload = function(event) {
            const data = new Uint8Array(event.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            
            // Convert to array of objects
            const rewardsData = XLSX.utils.sheet_to_json(worksheet);
            // NOTE: Accept headers in a forgiving, case-insensitive way and append to existing uploads
            appState.customRewards = appState.customRewards || [];

            function sanitizeString(v) { return (v === undefined || v === null) ? null : String(v).trim(); }
            function isValidImageUrl(u) {
                if (!u) return false;
                const s = String(u).trim();
                if (s === '') return false;
                // allow data URLs and http(s) and relative paths starting with / or ./
                return /^data:image\/.+;base64,/.test(s) || /^https?:\/\//i.test(s) || /^\//.test(s) || /^\.\//.test(s);
            }

            rewardsData.forEach(row => {
                // normalize keys to lower-case for forgiving headers
                const lower = {};
                Object.keys(row).forEach(k => { lower[k.toLowerCase().trim()] = row[k]; });

                const name = sanitizeString(lower.name || lower['reward name'] || lower.title || lower.n);
                const costRaw = sanitizeString(lower.cost || lower.amount || lower.price);
                const desc = sanitizeString(lower.description || lower.desc || lower.info) || "A special reward!";
                const imgRaw = sanitizeString(lower.image || lower.img || lower.icon);

                if (!name || !costRaw) return; // skip incomplete rows

                const cost = parseInt(costRaw) || 0;

                // Normalize image values: accept full data URLs, http(s), relative paths, or raw base64 blobs (assume PNG)
                let image = null;
                if (imgRaw) {
                    const trimmed = imgRaw.trim();
                    const withoutWs = trimmed.replace(/\s+/g, '');
                    if (/^data:image\/.+;base64,/.test(trimmed)) image = trimmed;
                    else if (/^[A-Za-z0-9+/=]+$/.test(withoutWs)) image = 'data:image/png;base64,' + withoutWs; // raw base64 fallback
                    else if (/^https?:\/\//i.test(trimmed) || /^\//.test(trimmed) || /^\.\//.test(trimmed)) image = trimmed;
                }

                appState.customRewards.push({ name, cost, description: desc, image });
            });
            
            saveToStorage();
            alert("Excel Rewards Imported Successfully!");
            
            // Only refresh the store if it's currently open
            // Always update uploaded list and refresh store UI (re-render both panels)
            try { renderUploadedRewards(); } catch (e) { /* DOM might not be ready */ }
            if (!document.getElementById('store-modal').classList.contains('hidden')) {
                renderStore();
            }
        };

        reader.readAsArrayBuffer(file);
    });
}

// --- FILE UPLOAD & EDITOR LOGIC ---
let tempFilename = "New World";
function loadFileToEditor() {
    const file = fileInput.files[0];
    if (!file) return alert("Please select a file first!");
    tempFilename = file.name.replace(/\.[^/.]+$/, "");
    const reader = new FileReader();
    reader.onload = function(event) {
        editor.value = event.target.result;
        hubScreen.classList.add('hidden'); editorScreen.classList.remove('hidden');
    };
    reader.readAsText(file);
}

function cancelEdit() {
    editor.value = ""; fileInput.value = "";
    editorScreen.classList.add('hidden'); hubScreen.classList.remove('hidden');
}

function saveAndProcessWorld() {
    const finalContent = editor.value;
    let newWorld = {
        name: tempFilename, sections: new Set(),
        flashcards: [], quizzes: [], exams: [], tasks: [], miniGames: [], rituals: [], // <-- ADDED RITUALS ARRAY
        content: {}, progress: {}, background: null, coordinates: []
    };

    const lines = finalContent.split('\n');
    let currentSection = "Intro"; let hasStarted = false;

    lines.forEach(line => {
        let trimmedLine = line.trim();
        if (trimmedLine === "") return; 

        if (trimmedLine.startsWith('# ')) {
            currentSection = trimmedLine.replace('# ', '').trim();
            newWorld.sections.add(currentSection); 
            newWorld.content[currentSection] = ""; newWorld.progress[currentSection] = { quizPassed: false, examPassed: false, gameCooldowns: {} };
            hasStarted = true; return;
        }

        if (!hasStarted) {
            newWorld.sections.add(currentSection); 
            newWorld.content[currentSection] = ""; newWorld.progress[currentSection] = { quizPassed: false, examPassed: false, gameCooldowns: {} };
            hasStarted = true;
        }

        // --- NEW: Filter out the syntax tags from the reading material ---
        let isSyntaxCommand = trimmedLine.startsWith('!FLASH!') || 
                              trimmedLine.startsWith('!QUIZZ!') || 
                              trimmedLine.startsWith('!EXAM!') || 
                              trimmedLine.startsWith('!RITUAL!') || 
                              trimmedLine.startsWith('!GAME!') || 
                              trimmedLine.startsWith('- [ ]') || 
                              trimmedLine.startsWith('- [x]');

        // Note: We DO NOT filter !SECTION! here. We leave it inscribed in the raw text. Let the reader split by it dynamically!
        // Only scribe the line into the book if it is normal reading text
        if (!isSyntaxCommand) {
            newWorld.content[currentSection] += line + '\n';
        }

        if (trimmedLine.startsWith('!FLASH!')) {
            const parts = trimmedLine.replace('!FLASH!', '').split('::');
            if (parts.length === 2) newWorld.flashcards.push({ section: currentSection, question: parts[0].trim(), answer: parts[1].trim(), interval: 0, ease: 2.5, nextReview: 0, burned: false });
        }
        if (trimmedLine.startsWith('!QUIZZ!')) {
            const parts = trimmedLine.replace('!QUIZZ!', '').split('::');
            if (parts.length === 2) newWorld.quizzes.push({ section: currentSection, question: parts[0].trim(), answer: parts[1].trim() });
        }
        if (trimmedLine.startsWith('!RITUAL!')) {
            const parts = trimmedLine.replace('!RITUAL!', '').split('::');
            if (parts.length === 2) {
                newWorld.rituals.push({ 
                    section: currentSection, 
                    name: parts[0].trim(), 
                    steps: parts[1].split('>').map(s => s.trim()) 
                });
            }
        }
        if (trimmedLine.startsWith('!EXAM!')) {
            const parts = trimmedLine.replace('!EXAM!', '').split('::');
            if (parts.length === 2) newWorld.exams.push({ section: currentSection, question: parts[0].trim(), answer: parts[1].trim() });
        }
        if (trimmedLine.includes('- [ ]') || trimmedLine.includes('- [x]')) {
            let isCompleted = trimmedLine.includes('- [x]');
            let taskText = trimmedLine.replace('- [ ]', '').replace('- [x]', '').trim();
            newWorld.tasks.push({ section: currentSection, text: taskText, completed: isCompleted });
        }
        if (trimmedLine.startsWith('!GAME!')) {
            newWorld.miniGames.push({ section: currentSection, name: trimmedLine.replace('!GAME!', '').trim() });
        }
    });

    newWorld.sections = Array.from(newWorld.sections);
    newWorld.coordinates = generateMapCoordinates(newWorld.sections.length); 
    
    const hub = appState.hubs[appState.currentHubIndex];
    hub.worlds.push(newWorld); hub.currentWorldIndex = hub.worlds.length - 1;

    saveToStorage(); cancelEdit();
    if(document.getElementById('training-card')) document.getElementById('training-card').classList.remove('locked');
    if(document.getElementById('vault-card')) document.getElementById('vault-card').classList.remove('locked');
    renderMap();
}

// --- MAIN HUB BOTTOM UPLOAD LOGIC ---
const mainHubUploadBtn = document.getElementById('main-hub-upload-world-btn');


if (mainHubUploadBtn && mainHubFileInput) {
    // 1. Clicking the button opens your computer's file explorer
    mainHubUploadBtn.addEventListener('click', () => {
        mainHubFileInput.click();
    });

    // 2. When a file is selected, read it and open the editor
    mainHubFileInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function(e) {
            // Put the text from the file into the editor
            document.getElementById('markdown-editor').value = e.target.result;
            
            // Switch screens
            document.getElementById('hub-screen').classList.add('hidden');
            document.getElementById('editor-screen').classList.remove('hidden');
            
            // Reset the input so you can upload the same file again later if needed
            mainHubFileInput.value = ''; 
        };
        reader.readAsText(file); // Reads the file as text
    });
}




export { loadFileToEditor, cancelEdit, saveAndProcessWorld };
