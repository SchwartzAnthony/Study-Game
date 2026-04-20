const fs = require('fs');
let appContent = fs.readFileSync('c:/Users/schwa/Desktop/Study Game/MainHub/app.js', 'utf8');

const missingImports = `
import { launchArcaneDefenseGame, launchTriviaGame, launchMemoryGame, startFlashMatchGame, launchSpellweaverGame, launchRitualAlignmentGame } from './scripts/minigames.js';
import { buyItem, renderStore, renderUploadedRewards, deleteUploadedReward, buyCustomReward } from './scripts/store.js';
import { processExcelUpload, loadFileToEditor, cancelEdit, saveAndProcessWorld } from './scripts/parser.js';
`;

appContent = appContent.replace(
    "import { generateMapCoordinates } from './scripts/mapRenderer.js';",
    "import { generateMapCoordinates } from './scripts/mapRenderer.js';" + missingImports
);

fs.writeFileSync('c:/Users/schwa/Desktop/Study Game/MainHub/app.js', appContent);
console.log("Imports added.");
