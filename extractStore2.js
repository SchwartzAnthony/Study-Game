const fs = require('fs');
const appJsPath = 'c:/Users/schwa/Desktop/Study Game/MainHub/app.js';
const storeJsPath = 'c:/Users/schwa/Desktop/Study Game/MainHub/scripts/store.js';
let content = fs.readFileSync(appJsPath, 'utf8');

const storeBlockRegex = /\/\/ --- STORE LOGIC ---.*?(?=\/\/ --- FILE UPLOAD & EDITOR LOGIC ---)/s;
const match = content.match(storeBlockRegex);

if (match) {
    let storeContent = match[0];
    
    // Remove from app.js
    let newAppJs = content.replace(storeContent, '');
    
    // Add imports to app.js
    const importStatement = `import { renderStore, renderUploadedRewards, deleteUploadedReward, buyCustomReward } from './scripts/store.js';\n`;
    newAppJs = newAppJs.replace(/(import \{ launchArcaneDefenseGame .*?\n)/, `$1${importStatement}`);
    
    if(!newAppJs.includes('export { buyItem }')) {
        newAppJs += `\nexport { buyItem };\n`;
    }

    fs.writeFileSync(appJsPath, newAppJs);

    // Create store.js
    const storeJsContent = `import { appState, getSafeImageSrc } from './state.js';
import { awardGold, awardInk, awardPaper, updateEconomyUI } from './economy.js';
import { saveToStorage } from './storage.js';
import { buyItem } from '../app.js';

` + storeContent + `
export { renderStore, renderUploadedRewards, deleteUploadedReward, buyCustomReward };
`;

    fs.writeFileSync(storeJsPath, storeJsContent);
    console.log("Store Extraction successful!");
} else { console.log("Store block not found."); }
