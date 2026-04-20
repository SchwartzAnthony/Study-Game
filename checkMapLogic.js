const fs = require('fs');
let appContent = fs.readFileSync('c:/Users/schwa/Desktop/Study Game/MainHub/app.js', 'utf8');

const regexMap = /\/\/ --- MAP LOGIC ---[\s\S]*?(?=\/\/ --- SECTION LEVEL MENU LOGIC ---)/;
let match = appContent.match(regexMap);
if (match) {
    console.log("Map Logic lines: " + match[0].split('\n').length);
}
