const fs = require('fs');
const appJsPath = 'c:/Users/schwa/Desktop/Study Game/MainHub/app.js';
const parserJsPath = 'c:/Users/schwa/Desktop/Study Game/MainHub/scripts/parser.js';

let appContent = fs.readFileSync(appJsPath, 'utf8');
let parserContent = fs.readFileSync(parserJsPath, 'utf8');

const regexBottom = /\/\/ --- MAIN HUB BOTTOM UPLOAD LOGIC ---[\s\S]*?(?=\/\/ --- SAVE, LOAD & MIGRATE SYSTEM ---)/;

const bottomMatch = appContent.match(regexBottom);
if (bottomMatch) {
    appContent = appContent.replace(bottomMatch[0], "");
    
    // add it to the end of parser.js before the export statement
    parserContent = parserContent.replace(/export \{ processExcelUpload/, bottomMatch[0] + "\nexport { processExcelUpload");
    
    fs.writeFileSync(appJsPath, appContent);
    fs.writeFileSync(parserJsPath, parserContent);
    console.log("Extracted Bottom Upload Logic to parser.js");
} else {
    console.log("Not found.");
}
