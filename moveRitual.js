const fs = require('fs');
const appJsPath = 'c:/Users/schwa/Desktop/Study Game/MainHub/app.js';
const minigamesJsPath = 'c:/Users/schwa/Desktop/Study Game/MainHub/scripts/minigames.js';

let appContent = fs.readFileSync(appJsPath, 'utf8');
let miniContent = fs.readFileSync(minigamesJsPath, 'utf8');

const regex = /\/\/ --- Ritual Alignment Game ---.*?\}\r?\n(?=\/\/ --- STATIC DOM EVENT BINDINGS ---)/s;
const match = appContent.match(regex);
if (match) {
    let ritualContent = match[0];
    appContent = appContent.replace(ritualContent, '');
    
    // Add to minigames.js before the export statement
    miniContent = miniContent.replace(/export { launchArcaneDefenseGame/, "\n" + ritualContent + "\nexport { launchArcaneDefenseGame");
    
    fs.writeFileSync(appJsPath, appContent);
    fs.writeFileSync(minigamesJsPath, miniContent);
    console.log("Moved Ritual Alignment to minigames.js");
} else {
    console.log("Not found.");
}
