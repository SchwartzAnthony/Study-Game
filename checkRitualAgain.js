const fs = require('fs');
let appContent = fs.readFileSync('c:/Users/schwa/Desktop/Study Game/MainHub/app.js', 'utf8');

const regex = /\/\/ --- Ritual Alignment Game ---[\s\S]*?(?=\/\/ --- STATIC DOM EVENT BINDINGS ---)/;
const match = appContent.match(regex);
if (match) {
    console.log(match[0].substring(match[0].length - 300));
} else {
    console.log("Still not found.");
}
