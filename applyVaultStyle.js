const fs = require('fs');
let html = fs.readFileSync('c:/Users/schwa/Desktop/Study Game/MainHub/index.html', 'utf8');

// Update the vault modal to use the new CSS class
html = html.replace(
    '<div class="modal-content section-content" style="max-width: 650px; text-align: left;">\r\n            <span id="close-vault" class="close-btn">&times;</span>\r\n            <h2 style="text-align: center;">Flashcard Vault</h2>',
    '<div class="modal-content section-content vault-style" style="max-width: 650px; text-align: left;">\r\n            <span id="close-vault" class="close-btn" style="z-index: 10;">&times;</span>\r\n            <h2 style="text-align: center;">Flashcard Vault</h2>'
);

// Fallback for different spacing
if (!html.includes('vault-style')) {
    html = html.replace(
        /<div class="modal-content section-content" style="max-width: 650px; text-align: left;">/g, 
        '<div class="modal-content section-content vault-style" style="max-width: 650px; text-align: left;">'
    );
     html = html.replace(
        /<span id="close-vault" class="close-btn">/g, 
        '<span id="close-vault" class="close-btn" style="z-index: 10;">'
    );
}

fs.writeFileSync('c:/Users/schwa/Desktop/Study Game/MainHub/index.html', html);
console.log("Vault styled!");
