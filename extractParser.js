const fs = require('fs');
const appJsPath = 'c:/Users/schwa/Desktop/Study Game/MainHub/app.js';
let appContent = fs.readFileSync(appJsPath, 'utf8');

const regexEditor = /\/\/ --- FILE UPLOAD & EDITOR LOGIC ---[\s\S]*?(?=\/\/ --- MAP LOGIC ---)/;
const regexExcel = /\/\/ --- Excel Reward Parser ---[\s\S]*?(?=\/\/ --- HUB SWITCHER LOGIC ---)/;

const editorMatch = appContent.match(regexEditor);
const excelMatch = appContent.match(regexExcel);

let parserJsContent = `import { appState } from './state.js';
import { saveToStorage } from './storage.js';
import { getActiveWorld, renderMap, checkGlobalDueCards } from '../app.js';

// DOM Elements Required
const editor = document.getElementById('markdown-editor');
const fileInput = document.getElementById('file-upload');
const mainHubFileInput = document.getElementById('main-hub-file-upload');
const editorScreen = document.getElementById('editor-screen');
const hubScreen = document.getElementById('hub-screen');

${excelMatch[0].trim()}

${editorMatch[0].trim()}

export { processExcelUpload, loadFileToEditor, cancelEdit, saveAndProcessWorld, loadMainHubFileToEditor };
`;

fs.writeFileSync('c:/Users/schwa/Desktop/Study Game/MainHub/scripts/parser.js', parserJsContent);

appContent = appContent.replace(editorMatch[0], "");
appContent = appContent.replace(excelMatch[0], "");

const importStatement = `import { processExcelUpload, loadFileToEditor, cancelEdit, saveAndProcessWorld, loadMainHubFileToEditor } from './scripts/parser.js';\n`;
appContent = appContent.replace(/(import \{ renderStore .*?\n)/, `$1${importStatement}`);

if(!appContent.includes('export { renderMap, checkGlobalDueCards }')) {
    appContent += `\nexport { renderMap, checkGlobalDueCards };\n`;
}

fs.writeFileSync(appJsPath, appContent);

console.log("Extracted Parser Logic to parser.js");
