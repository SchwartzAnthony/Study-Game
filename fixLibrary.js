const fs = require('fs');
const path = 'c:/Users/schwa/Desktop/Study Game/MainHub/index.html';
let html = fs.readFileSync(path, 'utf8');

// The regex matches the card we mistakenly added and removes it
const badCardRegex = /\s*<div class="card" id="library-card">[\s\S]*?<\/div>[\s\S]*?<\/section>/;
html = html.replace(badCardRegex, '\n            </section>');

// Construct the new card block with proper indent and correct emoji
const libraryCardBlock = `
                <div class="card" id="library-card">
                    <h3>Athenaeum Library</h3>
                    <p>Access your personal collection of uploaded worlds and modules.</p>
                    <button id="btn-open-library" class="btn-primary">🏛️ Open Library</button>
                </div>
            </section>`;

// Now safely target specifically the SECONd </section> tag (the actions section)
// We look for the Global Training and Vault cards, then replace the </section> trailing that.
html = html.replace(/<button id="btn-open-vault">Open Vault<\/button>\s*<\/div>\s*<\/section>/, 
    `<button id="btn-open-vault">Open Vault</button>\n                </div>${libraryCardBlock}`);

fs.writeFileSync(path, html);
console.log("Fixed Library card placement!");
