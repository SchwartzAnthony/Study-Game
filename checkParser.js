const fs = require('fs');
const appJsPath = 'c:/Users/schwa/Desktop/Study Game/MainHub/app.js';
let content = fs.readFileSync(appJsPath, 'utf8');

const regex = /\/\/ --- FILE UPLOAD & EDITOR LOGIC ---.*?(?=\/\/ --- MAP LOGIC ---)/s;
const match = content.match(regex);
if (match) {
    console.log("Lines in parser logic: " + match[0].split('\n').length);
} else {
    console.log("Not found.");
}
