const fs = require('fs');

let parserContent = fs.readFileSync('c:/Users/schwa/Desktop/Study Game/MainHub/scripts/parser.js', 'utf8');
parserContent = parserContent.replace(/const mainHubFileInput = document.getElementById\('main-hub-file-upload'\);/g, (match, offset) => {
    return offset > 1000 ? "" : match;
});
fs.writeFileSync('c:/Users/schwa/Desktop/Study Game/MainHub/scripts/parser.js', parserContent);

