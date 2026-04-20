const fs = require('fs');
let content = fs.readFileSync('c:/Users/schwa/Desktop/Study Game/MainHub/app.js', 'utf8');

const regex = /\/\/ --- .*? ---/g;
let matches = content.match(regex);
if (matches) {
    matches.forEach(m => console.log(m));
}
