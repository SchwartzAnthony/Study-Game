const fs = require('fs');
let parserContent = fs.readFileSync('c:/Users/schwa/Desktop/Study Game/MainHub/scripts/parser.js', 'utf8');

parserContent = parserContent.replace(/, loadMainHubFileToEditor/g, "");
fs.writeFileSync('c:/Users/schwa/Desktop/Study Game/MainHub/scripts/parser.js', parserContent);

