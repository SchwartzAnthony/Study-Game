const fs = require('fs');
const appJsPath = 'c:/Users/schwa/Desktop/Study Game/MainHub/app.js';
const minigamesJsPath = 'c:/Users/schwa/Desktop/Study Game/MainHub/scripts/minigames.js';
let content = fs.readFileSync(appJsPath, 'utf8');

const minigamesBlockRegex = /\/\/ --- Arcane Defense Game ---.*?(\/\/ --- ASSESSMENT ENGINE \(Rewards PAPER\) ---)/s;
const match = content.match(minigamesBlockRegex);

if (match) {
    let minigamesContent = match[0].replace('// --- ASSESSMENT ENGINE (Rewards PAPER) ---', '');
    
    // Remove from app.js
    let newAppJs = content.replace(minigamesContent, '');
    
    // Add imports to app.js
    const importStatement = `import { launchArcaneDefenseGame, launchTriviaGame, launchMemoryGame, startFlashMatchGame, launchSpellweaverGame, launchRitualAlignmentGame } from './scripts/minigames.js';\n`;
    newAppJs = newAppJs.replace(/(import \{ generateMapCoordinates .*?\n)/, `$1${importStatement}`);
    
    // Add getActiveWorld export if not present
    if (!newAppJs.includes('export { getActiveWorld }')) {
        newAppJs += `\nexport { getActiveWorld };\n`;
    }

    fs.writeFileSync(appJsPath, newAppJs);

    // Create minigames.js
    const minigamesJsContent = `import { awardGold } from './economy.js';
import { saveToStorage } from './storage.js';
import { getActiveWorld } from '../app.js';

const minigameBoard = document.getElementById('minigame-board');

` + minigamesContent + `
export { launchArcaneDefenseGame, launchTriviaGame, launchMemoryGame, startFlashMatchGame, launchSpellweaverGame, launchRitualAlignmentGame };
`;

    fs.writeFileSync(minigamesJsPath, minigamesJsContent);
    console.log("Extraction successful!");
} else {
    console.log("Minigames block not found.");
}
