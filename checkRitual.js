const fs = require('fs');
let content = fs.readFileSync('c:/Users/schwa/Desktop/Study Game/MainHub/app.js', 'utf8');

const regex = /\/\/ --- Ritual Alignment Game ---.*?(?=\/\/ --- STATIC DOM EVENT BINDINGS ---)/s;
const match = content.match(regex);
if (match) {
    console.log("Lines: " + match[0].split('\n').length);
} else {
    console.log("Not found.");
}
