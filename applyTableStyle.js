const fs = require('fs');
let html = fs.readFileSync('c:/Users/schwa/Desktop/Study Game/MainHub/index.html', 'utf8');

// Find the precise old styling to replace
const oldDivStr = '<div class="modal-content section-content" style="max-width: 800px; text-align: center; background: #0b0b14; border: 4px solid #6c5ce7; box-shadow: 0 0 30px rgba(108, 92, 231, 0.4);">';

const newDivStr = '<div class="modal-content section-content library-table-style" style="text-align: center;">';

html = html.replace(oldDivStr, newDivStr);

// Let's modify the <h2> inline styles to rely entirely on our CSS class
html = html.replace(
    '<h2 style="color: #a29bfe; font-size: 2.5em; margin-bottom: 5px; font-family: serif;">The Occult Library</h2>',
    '<h2>The Occult Library</h2>'
);

// We'll also drop the old inline <p> styles so that it uses our new class `table-desc`
html = html.replace(
    '<p style="color: #a8b2d1; margin-bottom: 20px;">Bind magical Parchment from Exams, scribe them with Ink from Flashcards, and complete ancient Grimoires!</p>',
    '<p class="table-desc">Bind magical Parchment, scribe them with Ink, and complete ancient Grimoires!</p>'
);

// Close button adjustment so it doesn't get hidden behind the table's leather mat pseudo-element
html = html.replace(
    '<span id="close-library" class="close-btn">&times;</span>',
    '<span id="close-library" class="close-btn" style="z-index: 10; color: #ffd700; text-shadow: 0 0 5px #000;">&times;</span>'
);

// Write changes back
fs.writeFileSync('c:/Users/schwa/Desktop/Study Game/MainHub/index.html', html);
console.log("Replaced Occult Library styles with Top-Down Table aesthetic")
