const fs = require('fs');
let html = fs.readFileSync('c:/Users/schwa/Desktop/Study Game/MainHub/index.html', 'utf8');
const match = html.match(/<button id="btn-open-library" class="btn-primary">(.*?) Open Library<\/button>/);
console.log(match ? match[1] : "Not found");
