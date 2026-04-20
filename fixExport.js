const fs = require('fs');

let appContent = fs.readFileSync('c:/Users/schwa/Desktop/Study Game/MainHub/app.js', 'utf8');
appContent = appContent.replace(/export \{ renderMap, checkGlobalDueCards \};\r?\n?/, "export { renderMap };\n");
fs.writeFileSync('c:/Users/schwa/Desktop/Study Game/MainHub/app.js', appContent);

let parserContent = fs.readFileSync('c:/Users/schwa/Desktop/Study Game/MainHub/scripts/parser.js', 'utf8');
parserContent = parserContent.replace(/import \{ getActiveWorld, renderMap, checkGlobalDueCards \} from '\.\.\/app\.js';/, "import { getActiveWorld, renderMap } from '../app.js';");
fs.writeFileSync('c:/Users/schwa/Desktop/Study Game/MainHub/scripts/parser.js', parserContent);

console.log("Fixed unused export checkGlobalDueCards");
