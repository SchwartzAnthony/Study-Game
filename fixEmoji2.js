const fs = require('fs');
let html = fs.readFileSync('c:/Users/schwa/Desktop/Study Game/MainHub/index.html', 'utf8');
html = html.replace(/<button id="btn-open-library" class="btn-occult">.*?<\/button>/s, '<button id="btn-open-library" class="btn-occult">🏛️ Library</button>');
fs.writeFileSync('c:/Users/schwa/Desktop/Study Game/MainHub/index.html', html);
