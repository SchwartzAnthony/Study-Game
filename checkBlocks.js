const fs = require('fs');
let appContent = fs.readFileSync('c:/Users/schwa/Desktop/Study Game/MainHub/app.js', 'utf8');
const lines = appContent.split('\n');

let blockName = '';
let currentBlock = [];
for (let i =0; i < lines.length; i++) {
    if (lines[i].startsWith('// ---') && lines[i].endsWith('---')) {
        if (blockName) {
            console.log(`${blockName}: ${currentBlock.length} lines`);
        }
        blockName = lines[i].trim();
        currentBlock = [lines[i]];
    } else if (lines[i].startsWith('// ---')) {
        if (blockName) {
            console.log(`${blockName}: ${currentBlock.length} lines`);
        }
        blockName = lines[i].trim();
        currentBlock = [lines[i]];
    } else {
        currentBlock.push(lines[i]);
    }
}
if (blockName) console.log(`${blockName}: ${currentBlock.length} lines`);
