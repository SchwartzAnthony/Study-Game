const fs = require('fs');
let appContent = fs.readFileSync('c:/Users/schwa/Desktop/Study Game/MainHub/app.js', 'utf8');
const regex = /\/\/ --- FILE UPLOAD & EDITOR LOGIC ---[\s\S]*?(?=\/\/ --- MAP LOGIC ---)/;
console.log(appContent.match(regex)[0].substring(0, 1000));
