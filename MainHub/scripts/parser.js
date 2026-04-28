import { appState } from './state.js';
import { saveToStorage } from './storage.js';
import { getActiveWorld, renderMap } from '../app.js';
import { generateMapCoordinates } from './mapRenderer.js';
import { renderStore, renderUploadedRewards } from './store.js';

// DOM Elements Required
const editor = document.getElementById('markdown-editor');
const fileInput = document.getElementById('fileUpload');
const mainHubFileInput = document.getElementById('main-hub-file-upload');
const editorScreen = document.getElementById('editor-screen');
const hubScreen = document.getElementById('hub-screen');

// --- Excel Reward Parser --- 
const excelUploadInput = document.getElementById('excelUpload');

if (excelUploadInput) {
    excelUploadInput.addEventListener('click', function() {
        excelUploadInput.value = '';
    });
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
            e.target.value = '';
        };
        reader.onerror = function() {
            e.target.value = '';
        };

        reader.readAsArrayBuffer(file);
    });
}

// --- FILE UPLOAD & EDITOR LOGIC ---
let tempFilename = "New World";
let editorMode = 'create';
let editTarget = null;

const DEFAULT_MINIGAMES = ['Flash Match', 'Spellweaver', 'Cloze Trial'];

function setEditorMode(mode, target = null) {
    editorMode = mode;
    editTarget = target;
    const saveBtn = document.getElementById('btn-save-world');
    if (saveBtn) {
        saveBtn.innerText = mode === 'edit' ? 'Save Changes to World' : 'Save & Initialize World';
    }
}

function escapeSyntaxValue(value) {
    return String(value || '').replace(/\n/g, ' ').trim();
}

function worldToSyntax(world) {
    if (!world) return '';

    const lines = [];
    const sections = Array.isArray(world.sections) ? world.sections : [];
    const sectionSet = new Set(sections);

    sections.forEach((sectionName, idx) => {
        lines.push(`!CHAPTER! ${sectionName}`);

        const sectionText = String((world.content && world.content[sectionName]) || '').replace(/\r\n/g, '\n');
        if (sectionText.trim()) {
            lines.push(sectionText.trimEnd());
        }

        (world.tasks || []).filter(t => t.section === sectionName).forEach(t => {
            lines.push(`- [${t.completed ? 'x' : ' '}] ${escapeSyntaxValue(t.text)}`);
        });

        (world.flashcards || []).filter(fc => fc.section === sectionName).forEach(fc => {
            lines.push(`!FLASH! ${escapeSyntaxValue(fc.question)} :: ${escapeSyntaxValue(fc.answer)}`);
        });

        (world.quizzes || []).filter(q => q.section === sectionName).forEach(q => {
            lines.push(`!QUIZ! ${escapeSyntaxValue(q.question)} :: ${escapeSyntaxValue(q.answer)}`);
        });

        (world.exams || []).filter(ex => ex.section === sectionName).forEach(ex => {
            lines.push(`!EXAM! ${escapeSyntaxValue(ex.question)} :: ${escapeSyntaxValue(ex.answer)}`);
        });

        (world.rituals || []).filter(r => r.section === sectionName).forEach(r => {
            const steps = Array.isArray(r.steps) ? r.steps.map(s => escapeSyntaxValue(s)).filter(Boolean).join(' > ') : '';
            lines.push(`!RITUAL! ${escapeSyntaxValue(r.name)} :: ${steps}`);
        });

        (world.miniGames || []).filter(g => g.section === sectionName).forEach(g => {
            lines.push(`!GAME! ${escapeSyntaxValue(g.name)}`);
        });

        if (idx < sections.length - 1) lines.push('');
    });

    // Preserve sectionless chronicles by appending at end as plain notes.
    (world.chronicles || []).forEach(ch => {
        if (ch && ch.section && !sectionSet.has(ch.section)) {
            lines.push(`\n# Chronicle (${ch.section})`);
            lines.push(String(ch.text || '').trim());
        }
    });

    return lines.join('\n').trim() + '\n';
}

function mergeProgressData(oldWorld, newWorld) {
    if (!oldWorld || !newWorld) return;

    newWorld.background = oldWorld.background || newWorld.background || null;
    newWorld.readProgress = {};

    (newWorld.sections || []).forEach(section => {
        if (oldWorld.progress && oldWorld.progress[section]) {
            newWorld.progress[section] = oldWorld.progress[section];
            if (!newWorld.progress[section].gameCooldowns) newWorld.progress[section].gameCooldowns = {};
        }
        if (oldWorld.readProgress && oldWorld.readProgress[section]) {
            newWorld.readProgress[section] = oldWorld.readProgress[section];
        }
    });

    const oldFlashByKey = new Map((oldWorld.flashcards || []).map(fc => [`${fc.section}|||${fc.question}`, fc]));
    (newWorld.flashcards || []).forEach(fc => {
        const old = oldFlashByKey.get(`${fc.section}|||${fc.question}`);
        if (!old) return;
        fc.interval = old.interval;
        fc.ease = old.ease;
        fc.nextReview = old.nextReview;
        fc.burned = old.burned;
    });

    const oldTaskByKey = new Map((oldWorld.tasks || []).map(t => [`${t.section}|||${t.text}`, t]));
    (newWorld.tasks || []).forEach(t => {
        const old = oldTaskByKey.get(`${t.section}|||${t.text}`);
        if (old) t.completed = !!old.completed;
    });

    // Keep existing chronicles that still belong to current sections.
    const validSections = new Set(newWorld.sections || []);
    newWorld.chronicles = (oldWorld.chronicles || []).filter(c => c && validSections.has(c.section));
}

function ensureSectionSkeleton(world, sectionName) {
    if (!world.content[sectionName]) world.content[sectionName] = '';
    if (!world.progress[sectionName]) {
        world.progress[sectionName] = { quizPassed: false, examPassed: false, gameCooldowns: {} };
    }
    if (!world.progress[sectionName].gameCooldowns) {
        world.progress[sectionName].gameCooldowns = {};
    }
}

function firstMeaningfulSentence(text) {
    const cleaned = String(text || '').replace(/\s+/g, ' ').trim();
    if (!cleaned) return '';
    const split = cleaned.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(Boolean);
    return split[0] || cleaned;
}

function clampText(text, maxLen) {
    const normalized = String(text || '').replace(/\s+/g, ' ').trim();
    if (!normalized) return '';
    if (normalized.length <= maxLen) return normalized;
    return normalized.slice(0, maxLen - 3).trim() + '...';
}

function deriveQuestionFromSection(sectionName, sectionText) {
    const seed = firstMeaningfulSentence(sectionText);
    if (seed.length > 12) {
        return `Explain this key idea from ${sectionName}: ${clampText(seed, 110)}`;
    }
    return `What is the core concept of ${sectionName}?`;
}

function deriveAnswerFromSection(sectionName, sectionText) {
    const seed = firstMeaningfulSentence(sectionText);
    if (seed.length > 10) return clampText(seed, 220);
    return `${sectionName} introduces foundational concepts that should be reviewed in reading notes.`;
}

function normalizeAndRepairWorld(world) {
    const report = {
        normalizedCommands: 0,
        createdSections: 0,
        addedFlashcards: 0,
        addedQuizzes: 0,
        addedExams: 0,
        addedMiniGames: 0,
        addedTasks: 0,
        addedRituals: 0,
        removedOrphans: 0,
        totalFixes: 0
    };

    world.sections = Array.from(new Set((world.sections || []).map(s => String(s || '').trim()).filter(Boolean)));
    if (world.sections.length === 0) {
        world.sections.push('Intro');
        report.createdSections += 1;
    }

    world.content = world.content || {};
    world.progress = world.progress || {};
    world.readProgress = world.readProgress || {};

    world.sections.forEach(sectionName => ensureSectionSkeleton(world, sectionName));

    const validSections = new Set(world.sections);
    const scopedArrays = ['tasks', 'flashcards', 'quizzes', 'exams', 'miniGames', 'rituals', 'chronicles'];
    scopedArrays.forEach(key => {
        world[key] = Array.isArray(world[key]) ? world[key] : [];
        const before = world[key].length;
        world[key] = world[key].filter(item => item && validSections.has(item.section));
        report.removedOrphans += (before - world[key].length);
    });

    world.sections.forEach((sectionName, index) => {
        const sectionText = world.content[sectionName] || '';

        const sectionFlash = world.flashcards.filter(fc => fc.section === sectionName);
        if (sectionFlash.length === 0) {
            world.flashcards.push({
                section: sectionName,
                question: deriveQuestionFromSection(sectionName, sectionText),
                answer: deriveAnswerFromSection(sectionName, sectionText),
                interval: 0,
                ease: 2.5,
                nextReview: 0,
                burned: false
            });
            report.addedFlashcards += 1;
        }

        const sectionQuiz = world.quizzes.filter(q => q.section === sectionName);
        if (sectionQuiz.length === 0) {
            const seedFlash = world.flashcards.find(fc => fc.section === sectionName);
            world.quizzes.push({
                section: sectionName,
                question: seedFlash ? seedFlash.question : `Checkpoint: What matters most in ${sectionName}?`,
                answer: seedFlash ? seedFlash.answer : deriveAnswerFromSection(sectionName, sectionText)
            });
            report.addedQuizzes += 1;
        }

        const sectionExam = world.exams.filter(ex => ex.section === sectionName);
        if (sectionExam.length === 0) {
            const seedQuiz = world.quizzes.find(q => q.section === sectionName);
            world.exams.push({
                section: sectionName,
                question: seedQuiz ? seedQuiz.question : `Exam: Summarize ${sectionName}.`,
                answer: seedQuiz ? seedQuiz.answer : deriveAnswerFromSection(sectionName, sectionText)
            });
            report.addedExams += 1;
        }

        const sectionGames = world.miniGames.filter(g => g.section === sectionName);
        if (sectionGames.length === 0) {
            DEFAULT_MINIGAMES.forEach(name => world.miniGames.push({ section: sectionName, name }));
            report.addedMiniGames += DEFAULT_MINIGAMES.length;
        }

        const sectionTasks = world.tasks.filter(t => t.section === sectionName);
        if (sectionTasks.length === 0) {
            world.tasks.push({ section: sectionName, text: `Read the full ${sectionName} page carefully.`, completed: false });
            world.tasks.push({ section: sectionName, text: `Complete quiz and exam for ${sectionName}.`, completed: false });
            report.addedTasks += 2;
        }

        const sectionRituals = world.rituals.filter(r => r.section === sectionName);
        if (sectionRituals.length === 0) {
            world.rituals.push({
                section: sectionName,
                name: `${sectionName} Recall Rite`,
                steps: ['Read section notes', 'Recall key terms', 'Summarize in your own words']
            });
            report.addedRituals += 1;
        }

        // Keep a stable fallback for page content if syntax was mostly commands.
        if (!String(world.content[sectionName] || '').trim()) {
            world.content[sectionName] = `${sectionName} notes were auto-repaired during import. Add richer notes here as needed.`;
        }

        if (!world.progress[sectionName]) {
            world.progress[sectionName] = { quizPassed: false, examPassed: false, gameCooldowns: {} };
        }
        if (!world.progress[sectionName].gameCooldowns) {
            world.progress[sectionName].gameCooldowns = {};
        }
        if (typeof world.progress[sectionName].quizPassed !== 'boolean') {
            world.progress[sectionName].quizPassed = false;
        }
        if (typeof world.progress[sectionName].examPassed !== 'boolean') {
            world.progress[sectionName].examPassed = false;
        }
    });

    world.coordinates = generateMapCoordinates(world.sections.length);

    report.totalFixes = report.createdSections + report.addedFlashcards + report.addedQuizzes + report.addedExams +
        report.addedMiniGames + report.addedTasks + report.addedRituals + report.removedOrphans;

    return report;
}

function parseSyntaxLine(line) {
    const trimmed = String(line || '').trim();
    if (!trimmed) return { type: 'EMPTY' };

    if (/^!CHAPTER!\s*/i.test(trimmed)) {
        return { type: 'CHAPTER', value: trimmed.replace(/^!CHAPTER!\s*/i, '').trim() };
    }

    if (/^#{1,3}\s+/.test(trimmed)) {
        return { type: 'CHAPTER', value: trimmed.replace(/^#{1,3}\s+/, '').trim() };
    }

    if (/^!FLASH(CARD)?!\s*/i.test(trimmed)) {
        return { type: 'FLASH', value: trimmed.replace(/^!FLASH(CARD)?!\s*/i, '').trim(), normalized: !/^!FLASH!/i.test(trimmed) };
    }

    if (/^!QUIZ(Z)?!\s*/i.test(trimmed)) {
        return { type: 'QUIZ', value: trimmed.replace(/^!QUIZ(Z)?!\s*/i, '').trim(), normalized: !/^!QUIZZ!/i.test(trimmed) };
    }

    if (/^!EXAM(TEST)?!\s*/i.test(trimmed)) {
        return { type: 'EXAM', value: trimmed.replace(/^!EXAM(TEST)?!\s*/i, '').trim(), normalized: !/^!EXAM!/i.test(trimmed) };
    }

    if (/^!RITUAL!\s*/i.test(trimmed)) {
        return { type: 'RITUAL', value: trimmed.replace(/^!RITUAL!\s*/i, '').trim() };
    }

    if (/^!GAME!\s*/i.test(trimmed)) {
        return { type: 'GAME', value: trimmed.replace(/^!GAME!\s*/i, '').trim() };
    }

    if (/^-\s*\[( |x|X)\]\s*/.test(trimmed)) {
        const isCompleted = /-\s*\[(x|X)\]/.test(trimmed);
        const text = trimmed.replace(/^-\s*\[( |x|X)\]\s*/, '').trim();
        return { type: 'TASK', value: text, isCompleted };
    }

    return { type: 'TEXT', value: line };
}

function splitPromptAnswer(value) {
    const idx = String(value || '').indexOf('::');
    if (idx >= 0) {
        return {
            prompt: value.slice(0, idx).trim(),
            answer: value.slice(idx + 2).trim()
        };
    }

    // Fallback for malformed rows that used a single colon.
    const fallback = String(value || '').split(':');
    if (fallback.length >= 2) {
        const prompt = fallback.shift().trim();
        const answer = fallback.join(':').trim();
        return { prompt, answer };
    }

    return { prompt: String(value || '').trim(), answer: '' };
}

function parseWorldFromSyntax(finalContent, worldName) {
    let newWorld = {
        name: worldName || tempFilename,
        sections: new Set(),
        flashcards: [], quizzes: [], exams: [], tasks: [], miniGames: [], rituals: [], chronicles: [],
        content: {}, progress: {}, background: null, coordinates: [],
        reminders: [],
        reminderScroller: { cursor: 0, dailyShown: {} }
    };

    const lines = String(finalContent || '').split('\n');
    let currentSection = "Intro";
    let hasStarted = false;

    lines.forEach(line => {
        const parsed = parseSyntaxLine(line);
        let trimmedLine = String(line || '').trim();
        if (parsed.type === 'EMPTY') return;

        if (parsed.normalized) {
            newWorld._normalizedCommands = (newWorld._normalizedCommands || 0) + 1;
        }

        if (parsed.type === 'CHAPTER') {
            currentSection = parsed.value || `Section ${newWorld.sections.size + 1}`;
            newWorld.sections.add(currentSection);
            newWorld.content[currentSection] = "";
            newWorld.progress[currentSection] = { quizPassed: false, examPassed: false, gameCooldowns: {} };
            hasStarted = true;
            return;
        }

        if (!hasStarted) {
            newWorld.sections.add(currentSection);
            newWorld.content[currentSection] = "";
            newWorld.progress[currentSection] = { quizPassed: false, examPassed: false, gameCooldowns: {} };
            hasStarted = true;
        }

        let isSyntaxCommand = parsed.type === 'FLASH' ||
            parsed.type === 'QUIZ' ||
            parsed.type === 'EXAM' ||
            parsed.type === 'RITUAL' ||
            parsed.type === 'GAME' ||
            parsed.type === 'TASK';

        if (!isSyntaxCommand) {
            newWorld.content[currentSection] += line + '\n';
        }

        if (parsed.type === 'FLASH') {
            const parts = splitPromptAnswer(parsed.value);
            if (parts.prompt && parts.answer) newWorld.flashcards.push({ section: currentSection, question: parts.prompt, answer: parts.answer, interval: 0, ease: 2.5, nextReview: 0, burned: false });
        }
        if (parsed.type === 'QUIZ') {
            const parts = splitPromptAnswer(parsed.value);
            if (parts.prompt && parts.answer) newWorld.quizzes.push({ section: currentSection, question: parts.prompt, answer: parts.answer });
        }
        if (parsed.type === 'RITUAL') {
            const parts = parsed.value.split('::');
            if (parts.length === 2) {
                newWorld.rituals.push({
                    section: currentSection,
                    name: parts[0].trim(),
                    steps: parts[1].split('>').map(s => s.trim())
                });
            }
        }
        if (parsed.type === 'EXAM') {
            const parts = splitPromptAnswer(parsed.value);
            if (parts.prompt && parts.answer) newWorld.exams.push({ section: currentSection, question: parts.prompt, answer: parts.answer });
        }
        if (parsed.type === 'TASK') {
            newWorld.tasks.push({ section: currentSection, text: parsed.value, completed: parsed.isCompleted });
        }
        if (parsed.type === 'GAME') {
            newWorld.miniGames.push({ section: currentSection, name: parsed.value.trim() });
        }
    });

    newWorld.sections = Array.from(newWorld.sections);
    const repairReport = normalizeAndRepairWorld(newWorld);
    if (newWorld._normalizedCommands) {
        repairReport.normalizedCommands = newWorld._normalizedCommands;
        repairReport.totalFixes += newWorld._normalizedCommands;
    }
    newWorld.importRepairReport = repairReport;
    return newWorld;
}
function loadFileToEditor() {
    const file = fileInput.files[0];
    if (!file) return alert("Please select a file first!");
    setEditorMode('create');
    tempFilename = file.name.replace(/\.[^/.]+$/, "");
    const reader = new FileReader();
    reader.onload = function(event) {
        editor.value = event.target.result;
        fileInput.value = '';
        hubScreen.classList.add('hidden'); editorScreen.classList.remove('hidden');
    };
    reader.onerror = function() {
        fileInput.value = '';
    };
    reader.readAsText(file);
}

function cancelEdit() {
    setEditorMode('create');
    editor.value = ""; fileInput.value = "";
    editorScreen.classList.add('hidden'); hubScreen.classList.remove('hidden');
}

function saveAndProcessWorld() {
    const finalContent = editor.value;
    const newWorld = parseWorldFromSyntax(finalContent, tempFilename);
    const report = newWorld.importRepairReport;
    delete newWorld.importRepairReport;
    delete newWorld._normalizedCommands;
    
    const hub = appState.hubs[appState.currentHubIndex];
    if (editorMode === 'edit' && editTarget && appState.hubs[editTarget.hubIndex] && appState.hubs[editTarget.hubIndex].worlds[editTarget.worldIndex]) {
        const targetHub = appState.hubs[editTarget.hubIndex];
        const oldWorld = targetHub.worlds[editTarget.worldIndex];
        newWorld.name = oldWorld.name;
        mergeProgressData(oldWorld, newWorld);
        targetHub.worlds[editTarget.worldIndex] = newWorld;
        appState.currentHubIndex = editTarget.hubIndex;
        targetHub.currentWorldIndex = editTarget.worldIndex;
    } else {
        hub.worlds.push(newWorld);
        hub.currentWorldIndex = hub.worlds.length - 1;
    }

    saveToStorage(); cancelEdit();
    if(document.getElementById('training-card')) document.getElementById('training-card').classList.remove('locked');
    if(document.getElementById('vault-card')) document.getElementById('vault-card').classList.remove('locked');
    renderMap();

    if (report && report.totalFixes > 0) {
        alert(`Import audit complete: auto-fixed ${report.totalFixes} issue(s) so the world can run end-to-end.`);
    }
}

function createWorldFromSyntax(syntaxContent, worldName) {
    const newWorld = parseWorldFromSyntax(syntaxContent, worldName || 'Auto Forged World');
    const report = newWorld.importRepairReport;
    delete newWorld.importRepairReport;
    delete newWorld._normalizedCommands;
    const hub = appState.hubs[appState.currentHubIndex];
    hub.worlds.push(newWorld);
    hub.currentWorldIndex = hub.worlds.length - 1;

    saveToStorage();
    if(document.getElementById('training-card')) document.getElementById('training-card').classList.remove('locked');
    if(document.getElementById('vault-card')) document.getElementById('vault-card').classList.remove('locked');
    renderMap();

    if (report && report.totalFixes > 0) {
        console.info('Auto-forge import audit report', report);
    }
    return newWorld;
}

function openWorldInEditor(hubIndex, worldIndex) {
    const hub = appState.hubs[hubIndex];
    if (!hub || !hub.worlds || !hub.worlds[worldIndex]) return;

    const world = hub.worlds[worldIndex];
    appState.currentHubIndex = hubIndex;
    hub.currentWorldIndex = worldIndex;

    tempFilename = world.name || 'Edited World';
    setEditorMode('edit', { hubIndex, worldIndex });
    editor.value = worldToSyntax(world);
    hubScreen.classList.add('hidden');
    editorScreen.classList.remove('hidden');

    const owlPanelEl = document.getElementById('owl-panel');
    if (owlPanelEl) owlPanelEl.classList.add('hidden');
}

// --- MAIN HUB BOTTOM UPLOAD LOGIC ---
const mainHubUploadBtn = document.getElementById('main-hub-upload-world-btn');


if (mainHubUploadBtn && mainHubFileInput) {
    // 1. Clicking the button opens your computer's file explorer
    mainHubUploadBtn.addEventListener('click', () => {
        setEditorMode('create');
        mainHubFileInput.value = '';
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
            setEditorMode('create');
            
            // Switch screens
            document.getElementById('hub-screen').classList.add('hidden');
            document.getElementById('editor-screen').classList.remove('hidden');
            // Close owl panel so it doesn't cover the Save button
            const owlPanelEl = document.getElementById('owl-panel');
            if (owlPanelEl) owlPanelEl.classList.add('hidden');
            
            // Reset the input so you can upload the same file again later if needed
            mainHubFileInput.value = ''; 
        };
        reader.readAsText(file); // Reads the file as text
    });
}




export { loadFileToEditor, cancelEdit, saveAndProcessWorld, createWorldFromSyntax, openWorldInEditor };
