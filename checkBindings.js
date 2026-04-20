const fs = require('fs');
let appContent = fs.readFileSync('c:/Users/schwa/Desktop/Study Game/MainHub/app.js', 'utf8');

const regexMap = /\/\/ --- STATIC DOM EVENT BINDINGS ---[\s\S]*/;
let match = appContent.match(regexMap);
if (match) {
    console.log(match[0].substring(0, 1000));
}
