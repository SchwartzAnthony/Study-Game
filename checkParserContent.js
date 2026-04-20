const fs = require('fs');
const appJsPath = 'c:/Users/schwa/Desktop/Study Game/MainHub/app.js';
let content = fs.readFileSync(appJsPath, 'utf8');

const regex = /\/\/ --- FILE UPLOAD & EDITOR LOGIC ---.*?(?=\/\/ --- MAP LOGIC ---)/s;
const match = content.match(regex);
console.log(match[0].substring(0, 500));
console.log("...snip...");
console.log(match[0].substring(match[0].length - 500));

