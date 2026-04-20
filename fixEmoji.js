const fs = require('fs');
let html = fs.readFileSync('c:/Users/schwa/Desktop/Study Game/MainHub/index.html', 'utf8');
html = html.replace('<button id="btn-open-library" class="btn-occult">???      \r\nLibrary</button>', '<button id="btn-open-library" class="btn-occult">🏛️ Library</button>');
html = html.replace('<button id="btn-open-library" class="btn-occult">???', '<button id="btn-open-library" class="btn-occult">🏛️'); // backup
fs.writeFileSync('c:/Users/schwa/Desktop/Study Game/MainHub/index.html', html);
