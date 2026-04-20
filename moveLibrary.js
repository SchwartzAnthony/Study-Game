const fs = require('fs');
const path = 'c:/Users/schwa/Desktop/Study Game/MainHub/index.html';
let html = fs.readFileSync(path, 'utf8');

// 1. Remove the old button from the header
html = html.replace(/[ \t]*<button id="btn-open-library".*?<\/button>\r?\n?/g, '');

// 2. Create the new card layout for the library
const libraryCard = `
                <div class="card" id="library-card">
                    <h3>Athenaeum Library</h3>
                    <p>Enter your personal library to access and manage your worlds.</p>
                    <button id="btn-open-library" class="btn-primary">🏛️ Open Library</button>
                </div>
            </section>`;

// 3. Insert the new card into the .actions section
html = html.replace(/<\/section>/, libraryCard);

fs.writeFileSync(path, html);
console.log("Library button moved to a card successfully!");
