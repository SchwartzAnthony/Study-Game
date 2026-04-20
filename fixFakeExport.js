const fs = require('fs');

let parserStr = fs.readFileSync('c:/Users/schwa/Desktop/Study Game/MainHub/scripts/parser.js', 'utf8');
parserStr = parserStr.replace(/processExcelUpload, /g, "");
fs.writeFileSync('c:/Users/schwa/Desktop/Study Game/MainHub/scripts/parser.js', parserStr);

let appStr = fs.readFileSync('c:/Users/schwa/Desktop/Study Game/MainHub/app.js', 'utf8');
appStr = appStr.replace(/processExcelUpload, /g, "");
fs.writeFileSync('c:/Users/schwa/Desktop/Study Game/MainHub/app.js', appStr);

console.log("Removed processExcelUpload from export and import");
