const fs = require('fs');
let appContent = fs.readFileSync('c:/Users/schwa/Desktop/Study Game/MainHub/app.js', 'utf8');

const regexMap = /\/\/ --- MAP LOGIC ---[\s\S]*?(?=\/\/ --- MODALS & EXTRAS ---)/;
let match = appContent.match(regexMap);
if (match) {
    console.log(match[0].substring(0, 1000));
    console.log("Lines: " + match[0].split('\n').length);
}
