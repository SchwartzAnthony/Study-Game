import { awardGold } from './economy.js';
import { saveToStorage } from './storage.js';
import { getActiveWorld } from '../app.js';
import { renderMathString, setRenderedText } from './mathRenderer.js';

const minigameBoard = document.getElementById('minigame-board');

// --- Arcane Defense Game ---
function launchArcaneDefenseGame(sectionCards, sectionName, gameName) {
    const minigameBoard = document.getElementById('minigame-board');
    if (!minigameBoard) return;

    // Shuffle and pull up to 10 flashcards for the wave
    let deck = [...sectionCards].sort(() => 0.5 - Math.random()).slice(0, 10);
    
    if (deck.length < 1) return alert("You need at least 1 flashcard to defend the circle!");

    let currentIndex = 0;
    let score = 0;
    let lives = 3;
    let currentAnimation;

    // Build the battleground UI using your dark theme colors
    minigameBoard.innerHTML = `
        <div id="arcane-defense-container" class="arcane-defense-container">
    <div id="ad-stats" class="ad-stats">
        Spirits Banished: <span id="ad-score" class="ad-score-text">0</span> / \ <br>
        Circle Integrity: <span id="ad-lives">?????????</span>
    </div>
    <div id="magic-circle" class="magic-circle">
        <span class="magic-circle-icon">?????</span>
    </div>
    <div id="anomaly" class="anomaly-box">
        <span id="anomaly-text" class="anomaly-text-inner">Question goes here</span>
    </div>
    <input type="text" id="incantation-input" class="incantation-input-box" placeholder="Type the incantation (answer) here..." autocomplete="off">
</div>
    `;

    const anomalyElement = document.getElementById('anomaly');
    const anomalyText = document.getElementById('anomaly-text');
    const incantationInput = document.getElementById('incantation-input');
    const scoreEl = document.getElementById('ad-score');
    const livesEl = document.getElementById('ad-lives');
    const magicCircle = document.getElementById('magic-circle');

    // Slide up the input box dramatically to start
    setTimeout(() => { 
        incantationInput.style.bottom = '15px'; 
        incantationInput.focus(); 
    }, 200);

    function spawnNextAnomaly() {
        if (lives <= 0) {
            endGame("Your protective circle collapsed!", false);
            return;
        }

        if (currentIndex >= deck.length) {
            endGame("All spirits banished! The circle holds!", true);
            return;
        }

        let currentCard = deck[currentIndex];
        anomalyText.innerHTML = renderMathString(currentCard.question, { preferMath: !!currentCard.isMath });
        incantationInput.value = '';
        incantationInput.focus();

        // Reset Anomaly position
        let positionY = -80;
        anomalyElement.style.top = positionY + 'px';
        anomalyElement.style.transform = "scale(1)";
        anomalyElement.style.opacity = "1";
        
        // Speed scaling (base speed gets slightly faster each round)
        let speed = 0.4 + (currentIndex * 0.08); 

        function animateAnomaly() {
            positionY += speed;
            anomalyElement.style.top = positionY + 'px';

            // Strike zone: If the spirit breaches the circle (approx Y = 250px down)
            if (positionY > 250) { 
                lives--;
                updateLivesUI();
                cancelAnimationFrame(currentAnimation);
                
                // Circle damage visual effect
                magicCircle.style.borderColor = "#ff3333";
                magicCircle.style.boxShadow = "0 0 30px rgba(255, 51, 51, 0.8)";
                minigameBoard.querySelector('#arcane-defense-container').style.boxShadow = "inset 0 0 50px rgba(255, 51, 51, 0.6)";
                
                setTimeout(() => {
                    magicCircle.style.borderColor = "#ffd700";
                    magicCircle.style.boxShadow = "0 0 20px rgba(255, 215, 0, 0.4)";
                    minigameBoard.querySelector('#arcane-defense-container').style.boxShadow = "inset 0 0 20px rgba(0,0,0,0.5)";
                    currentIndex++;
                    spawnNextAnomaly();
                }, 500);
                return;
            }
            currentAnimation = requestAnimationFrame(animateAnomaly);
        }
        currentAnimation = requestAnimationFrame(animateAnomaly);
    }

    function updateLivesUI() {
        let shields = "";
        for(let i=0; i<lives; i++) shields += "🛡️";
        for(let i=lives; i<3; i++) shields += "💀";
        livesEl.innerText = shields;
    }

    // Listen for the "Enter" key to cast the spell
    incantationInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            let typed = incantationInput.value.trim().toLowerCase();
            let correct = deck[currentIndex].answer.trim().toLowerCase();

            if (typed === correct) {
                // Banished successfully!
                cancelAnimationFrame(currentAnimation);
                score++;
                scoreEl.innerText = score;
                awardGold(2); 
                
                // Banish animation
                anomalyElement.style.transform = "scale(1.2) translateY(-20px)";
                anomalyElement.style.opacity = "0";
                
                // Flash input green
                incantationInput.style.borderColor = '#4cd137';
                
                setTimeout(() => {
                    incantationInput.style.borderColor = '#e94560';
                    currentIndex++;
                    spawnNextAnomaly();
                }, 400);
            } else {
                // Wrong incantation! Flash input red
                incantationInput.style.borderColor = '#ff3333';
                setTimeout(() => incantationInput.style.borderColor = '#e94560', 300);
            }
        }
    });

    function endGame(message, isVictory) {
        cancelAnimationFrame(currentAnimation);
        let goldEarned = score * 3; 
        if (isVictory) goldEarned += 15; // Bonus for surviving the entire wave
        
        // Save the cooldown logic to match your other games
        const world = getActiveWorld();
        if (world && world.progress && world.progress[sectionName] && world.progress[sectionName].gameCooldowns) {
            world.progress[sectionName].gameCooldowns[gameName] = Date.now() + (2 * 60 * 60 * 1000);
            saveToStorage();
        }

        minigameBoard.innerHTML = `
            <div class="minigame-victory-card ${isVictory ? 'victory' : ''}">
                <h2 class="minigame-victory-title ${isVictory ? 'victory' : ''}">${message}</h2>
                <p class="minigame-victory-stats">Spirits Banished: ${score} / ${deck.length}</p>
                <p class="minigame-victory-reward">Gold Earned: ${goldEarned} 🪙</p>
            </div>
        `;
        awardGold(goldEarned);
    }

    // Begin the trial
    spawnNextAnomaly();
}

// --- TRIVIA SHOWDOWN LOGIC ---
function launchTriviaGame(sectionFlashcards, allWorldFlashcards, sectionName, gameName) {
    if(!minigameBoard) return;
    
    let shuffledDeck = [...sectionFlashcards].sort(() => 0.5 - Math.random());
    let questionsToPlay = shuffledDeck.slice(0, 10); 
    
    let currentIndex = 0;
    let score = 0;
    
    if(document.getElementById('minigame-stats')) document.getElementById('minigame-stats').innerText = `Score: 0 / ${questionsToPlay.length}`;
    
    function loadNextQuestion() {
        if (currentIndex >= questionsToPlay.length) {
            let goldEarned = score * 3; 
            minigameBoard.innerHTML = `
                <div class="minigame-victory-card">
                    <h2 class="minigame-victory-title">Round Complete!</h2>
                    <p class="minigame-victory-stats">You scored ${score} out of ${questionsToPlay.length}.</p>
                    <p class="minigame-victory-reward">Earned: ${goldEarned} 🪙</p>
                </div>
            `;
            awardGold(goldEarned);
            
            const world = getActiveWorld();
            world.progress[sectionName].gameCooldowns[gameName] = Date.now() + (2 * 60 * 60 * 1000);
            saveToStorage();
            return;
        }

        let currentCard = questionsToPlay[currentIndex];
        
        let decoyPool = allWorldFlashcards.filter(fc => fc.answer !== currentCard.answer);
        decoyPool.sort(() => 0.5 - Math.random());
        let decoys = decoyPool.slice(0, 3).map(fc => fc.answer);
        
        while (decoys.length < 3) { decoys.push("Incorrect Data Anomaly " + (decoys.length + 1)); }

        let options = [currentCard.answer, ...decoys];
        options.sort(() => 0.5 - Math.random()); 
        
        minigameBoard.innerHTML = `
            <div style="width: 100%; padding: 10px;">
                <div class="trivia-question">${currentCard.question}</div>
                <div class="trivia-grid">
                    ${options.map(opt => `<button class="trivia-btn" data-answer="${opt.replace(/"/g, '&quot;')}">${renderMathString(opt, { preferMath: !!currentCard.isMath })}</button>`).join('')}
                </div>
            </div>
        `;
        const triviaQuestion = minigameBoard.querySelector('.trivia-question');
        if (triviaQuestion) triviaQuestion.innerHTML = renderMathString(currentCard.question, { preferMath: !!currentCard.isMath });
        
        let buttons = minigameBoard.querySelectorAll('.trivia-btn');
        let answered = false;
        
        buttons.forEach(btn => {
            btn.addEventListener('click', () => {
                if (answered) return;
                answered = true;
                
                let clickedAnswer = btn.getAttribute('data-answer');
                if (clickedAnswer === currentCard.answer) {
                    btn.classList.add('correct'); score++;
                    if(document.getElementById('minigame-stats')) document.getElementById('minigame-stats').innerText = `Score: ${score} / ${questionsToPlay.length}`;
                } else {
                    btn.classList.add('wrong');
                    buttons.forEach(b => { if (b.getAttribute('data-answer') === currentCard.answer) b.classList.add('correct'); });
                }
                setTimeout(() => { currentIndex++; loadNextQuestion(); }, 1500); 
            });
        });
    }
    loadNextQuestion(); 
}

// --- MEMORY MATCH LOGIC ---
function launchMemoryGame(flashcards, sectionName, gameName) {
    if(!minigameBoard) return;
    minigameBoard.innerHTML = '';
    let shuffledDeck = [...flashcards].sort(() => 0.5 - Math.random()).slice(0, 6);
    let memoryCards = [];

    shuffledDeck.forEach((fc, index) => {
        memoryCards.push({ text: fc.question, id: index }); memoryCards.push({ text: fc.answer, id: index });
    });
    memoryCards.sort(() => 0.5 - Math.random());

    const grid = document.createElement('div'); grid.className = 'memory-grid';
    let flippedCards = []; let matchedPairs = 0; let lockBoard = false;

    if(document.getElementById('minigame-stats')) document.getElementById('minigame-stats').innerText = `Matches: 0 / ${shuffledDeck.length}`;

    memoryCards.forEach(data => {
        const card = document.createElement('div'); card.className = 'memory-card';
        card.innerHTML = `<div class="memory-card-inner"><div class="memory-card-front">❓</div><div class="memory-card-back">${renderMathString(data.text, { preferMath: false })}</div></div>`;

        card.addEventListener('click', () => {
            if (lockBoard || card === flippedCards[0] || card.classList.contains('is-matched')) return;
            card.classList.add('is-flipped'); flippedCards.push({ element: card, id: data.id });

            if (flippedCards.length === 2) {
                lockBoard = true;
                if (flippedCards[0].id === flippedCards[1].id) {
                    setTimeout(() => {
                        flippedCards[0].element.classList.add('is-matched'); flippedCards[1].element.classList.add('is-matched');
                        matchedPairs++;
                        if(document.getElementById('minigame-stats')) document.getElementById('minigame-stats').innerText = `Matches: ${matchedPairs} / ${shuffledDeck.length}`;
                        awardGold(5);
                        
                        if (matchedPairs === shuffledDeck.length) { 
                            setTimeout(() => alert("Victory! Bonus Gold awarded!"), 500); 
                            awardGold(25); 
                            
                            const world = getActiveWorld();
                            world.progress[sectionName].gameCooldowns[gameName] = Date.now() + (2 * 60 * 60 * 1000);
                            saveToStorage();
                        }
                        
                        flippedCards = []; lockBoard = false;
                    }, 600);
                } else {
                    setTimeout(() => {
                        flippedCards[0].element.classList.remove('is-flipped'); flippedCards[1].element.classList.remove('is-flipped');
                        flippedCards = []; lockBoard = false;
                    }, 1200);
                }
            }
        });
        grid.appendChild(card);
    });
    minigameBoard.appendChild(grid);
}

// --- Flash Match Game ---
function startFlashMatchGame(sectionName, gameName) {
    const world = getActiveWorld();
    const sectionCards = world.flashcards.filter(fc => fc.section === sectionName);

    // Wir brauchen mindestens 2-3 Karten, damit das Mischen Sinn macht
    if (sectionCards.length < 3) {
        return alert("You need at least 3 flashcards in this section to play Flash Match!");
    }

    // Wähle bis zu 6 zufällige Karten für das Match-Spiel aus
    let pool = [...sectionCards].sort(() => 0.5 - Math.random()).slice(0, 6);
    let tilesData = [];

    // Teile jede Karteikarte in zwei Kacheln auf: Frage (Q) und Antwort (A)
    pool.forEach((card, index) => {
        tilesData.push({ text: card.question, type: 'Q', id: index });
        tilesData.push({ text: card.answer, type: 'A', id: index });
    });

    // Mische alle Kacheln kräftig durch
    tilesData.sort(() => 0.5 - Math.random());

    const minigameBoard = document.getElementById('minigame-board');
    minigameBoard.innerHTML = '';

    // UI-Setup für den Timer und die verbleibenden Paare
    const statsEl = document.getElementById('minigame-stats');
    let matchesMade = 0;
    const totalPairs = pool.length;
    let startTime = Date.now();
    let timerInterval;

    if (statsEl) {
        statsEl.innerText = `Verbleibende Paare: ${totalPairs} | Zeit: 0s`;
        
        timerInterval = setInterval(() => {
            let elapsed = Math.floor((Date.now() - startTime) / 1000);
            statsEl.innerText = `Verbleibende Paare: ${totalPairs - matchesMade} | Zeit: ${elapsed}s`;
        }, 1000);
    }

    // Container für die Kacheln (Grid)
    const grid = document.createElement('div');
    grid.style.display = 'grid';
    grid.style.gridTemplateColumns = 'repeat(auto-fit, minmax(130px, 1fr))';
    grid.style.gap = '15px';
    grid.style.width = '100%';
    grid.style.maxWidth = '750px';
    grid.style.margin = '0 auto';

    let selectedTile = null;
    let isProcessing = false;

    tilesData.forEach((data) => {
        const tile = document.createElement('div');
        tile.className = 'match-tile';
        tile.innerHTML = renderMathString(data.text, { preferMath: false });
        
        // Versteckte Daten für den Abgleich
        tile.dataset.id = data.id;
        tile.dataset.type = data.type;

        tile.addEventListener('click', () => {
            // Ignoriere Klicks, wenn Animationen laufen, die Kachel schon gematched oder bereits ausgewählt ist
            if (isProcessing || tile.classList.contains('matched') || tile === selectedTile) return;

            // Kachel auswählen
            tile.classList.add('selected');

            if (!selectedTile) {
                // Erster Klick: Kachel merken
                selectedTile = tile;
            } else {
                // Zweiter Klick: Kacheln abgleichen
                isProcessing = true;
                const id1 = selectedTile.dataset.id;
                const id2 = tile.dataset.id;
                const type1 = selectedTile.dataset.type;
                const type2 = tile.dataset.type;

                // Match-Logik: Gleiche ID, aber unterschiedlicher Typ (Q und A)
                if (id1 === id2 && type1 !== type2) {
                    // Match gefunden!
                    setTimeout(() => {
                        tile.classList.remove('selected');
                        selectedTile.classList.remove('selected');
                        tile.classList.add('matched');
                        selectedTile.classList.add('matched');
                        
                        // Sound-Effekt oder Gold-Logik (Optional)
                        awardGold(2); 

                        matchesMade++;
                        selectedTile = null;
                        isProcessing = false;

                        // Sieg-Logik
                        if (matchesMade === totalPairs) {
                            clearInterval(timerInterval);
                            let timeTaken = Math.floor((Date.now() - startTime) / 1000);
                            let bonusGold = Math.max(10, 40 - timeTaken); // Schneller = mehr Gold!
                            
                            setTimeout(() => {
                                minigameBoard.innerHTML = `
                                    <div class="minigame-victory-card">
    <h2 class="minigame-victory-title">Ritual abgeschlossen!</h2>
    <p class="minigame-victory-stats">Ben�tigte Zeit: \ Sekunden.</p>
    <p class="minigame-victory-reward">Verdientes Gold: \ ??</p>
</div>
                                `;
                                awardGold(bonusGold);
                                
                                // Cooldown aktivieren (falls in deinem System vorgesehen)
                                if (gameName) {
                                    world.progress[sectionName].gameCooldowns[gameName] = Date.now() + (2 * 60 * 60 * 1000); // 2 Stunden Cooldown
                                    saveToStorage();
                                }
                            }, 600);
                        }
                    }, 400);

                } else {
                    // Falsches Match
                    tile.style.backgroundColor = '#e84118'; // Fehler-Rot
                    tile.style.borderColor = '#c23616';
                    selectedTile.style.backgroundColor = '#e84118';
                    selectedTile.style.borderColor = '#c23616';

                    setTimeout(() => {
                        // Zurücksetzen
                        tile.style.backgroundColor = '';
                        tile.style.borderColor = '';
                        selectedTile.style.backgroundColor = '';
                        selectedTile.style.borderColor = '';
                        
                        tile.classList.remove('selected');
                        selectedTile.classList.remove('selected');
                        
                        selectedTile = null;
                        isProcessing = false;
                    }, 800);
                }
            }
        });

        grid.appendChild(tile);
    });

    minigameBoard.appendChild(grid);
}

// --- SPELLWEAVER LOGIC ---
function launchSpellweaverGame(flashcards, sectionName, gameName) {
    if (!minigameBoard) return;

    const deck = [...flashcards]
        .filter(fc => fc && String(fc.answer || '').trim().length > 0)
        .sort(() => 0.5 - Math.random())
        .slice(0, 5);

    if (deck.length < 1) {
        minigameBoard.innerHTML = '<div class="minigame-victory-card"><p class="minigame-victory-stats">No valid answer text found for Spellweaver.</p></div>';
        return;
    }

    let currentIndex = 0;
    let score = 0;

    function updateStats() {
        const stats = document.getElementById('minigame-stats');
        if (stats) stats.innerText = `Incantations: ${score} / ${deck.length}`;
    }

    function finalizeGame() {
        const goldEarned = score * 5;
        minigameBoard.innerHTML = `
            <div class="minigame-victory-card">
                <h2 class="minigame-victory-title">Grimoire Scribed!</h2>
                <p class="minigame-victory-stats">You wove ${score} out of ${deck.length} spells correctly.</p>
                <p class="minigame-victory-reward">Earned: ${goldEarned} 🪙</p>
            </div>
        `;

        awardGold(goldEarned);

        const world = getActiveWorld();
        if (world && world.progress && world.progress[sectionName] && world.progress[sectionName].gameCooldowns) {
            world.progress[sectionName].gameCooldowns[gameName] = Date.now() + (2 * 60 * 60 * 1000);
            saveToStorage();
        }
    }

    function loadNextSpell() {
        if (currentIndex >= deck.length) {
            finalizeGame();
            return;
        }

        const currentCard = deck[currentIndex];
        const targetWords = String(currentCard.answer || '').match(/\S+/g) || [];

        if (targetWords.length < 1) {
            currentIndex++;
            loadNextSpell();
            return;
        }

        const scrambledWords = targetWords
            .map((word, idx) => ({ word, idx }))
            .sort(() => 0.5 - Math.random());

        minigameBoard.innerHTML = `
            <div class="spellweaver-container">
                <div style="font-size:0.85em;color:#8a9bcf;letter-spacing:1px;text-align:center;">Decipher this prompt:</div>
                <div id="spellweaver-prompt" style="font-size:1.05em;color:#d8ddf5;text-align:center;max-width:840px;line-height:1.5;">${renderMathString(currentCard.question || 'Spell Prompt', { preferMath: !!currentCard.isMath })}</div>
                <div id="incantation-bar" class="incantation-bar"><span style="opacity:0.5;">Select runes to weave the spell...</span></div>
                <div id="spellweaver-runes" class="rune-grid">
                    ${scrambledWords.map(item => `<button class="rune-btn" data-word="${item.word.replace(/"/g, '&quot;')}" data-idx="${item.idx}">${item.word}</button>`).join('')}
                </div>
            </div>
        `;

        const incantationBar = document.getElementById('incantation-bar');
        const runes = Array.from(document.querySelectorAll('.rune-btn'));
        let selectedWords = [];
        let failed = false;

        function updateBar() {
            if (!incantationBar) return;
            if (selectedWords.length === 0) {
                incantationBar.innerHTML = '<span style="opacity:0.5;">Select runes to weave the spell...</span>';
            } else {
                incantationBar.innerHTML = selectedWords
                    .map(sw => `<span style="color:white;font-weight:bold;">${sw.word}</span>`)
                    .join(' ');
            }
        }

        runes.forEach(rune => {
            rune.addEventListener('click', () => {
                if (failed || rune.classList.contains('used')) return;

                const word = rune.getAttribute('data-word') || '';
                const expectedWord = targetWords[selectedWords.length] || '';

                if (word === expectedWord) {
                    rune.classList.add('used');
                    selectedWords.push({ word, element: rune });
                    updateBar();

                    if (selectedWords.length === targetWords.length) {
                        if (incantationBar) {
                            incantationBar.style.borderColor = '#4cd137';
                            incantationBar.style.color = '#4cd137';
                        }
                        score++;
                        updateStats();
                        setTimeout(() => {
                            currentIndex++;
                            loadNextSpell();
                        }, 900);
                    }
                } else {
                    failed = true;
                    rune.style.backgroundColor = '#ff4757';
                    rune.style.borderColor = '#ff4757';
                    if (incantationBar) incantationBar.style.borderColor = '#ff4757';

                    setTimeout(() => {
                        selectedWords.forEach(sw => sw.element.classList.remove('used'));
                        selectedWords = [];
                        rune.style.backgroundColor = '';
                        rune.style.borderColor = '';
                        if (incantationBar) {
                            incantationBar.style.borderColor = '#6c5ce7';
                            incantationBar.style.color = '#a29bfe';
                        }
                        failed = false;
                        updateBar();
                    }, 800);
                }
            });
        });
    }

    updateStats();
    loadNextSpell();
}


// --- Ritual Alignment Game ---
function launchRitualAlignmentGame(sectionName, gameName) {
    const world = getActiveWorld();
    if (!world.rituals) world.rituals = []; // Failsafe for older worlds
    const sectionRituals = world.rituals.filter(r => r.section === sectionName);
    
    if (sectionRituals.length < 1) return alert("You need at least 1 !RITUAL! in this section to play Ritual Alignment!");

    const minigameBoard = document.getElementById('minigame-board');
    if (!minigameBoard) return;

    let deck = [...sectionRituals].sort(() => 0.5 - Math.random());
    let currentIndex = 0;
    let score = 0;
    let lives = 3;
    
    function loadRitual() {
        if (lives <= 0) {
            endGame("The ritual circle shattered!", false);
            return;
        }
        if (currentIndex >= deck.length) {
            endGame("All rituals perfectly aligned!", true);
            return;
        }

        let currentRitual = deck[currentIndex];
        let correctSteps = currentRitual.steps;
        // Scramble the steps but keep their original index (ID) to check the answer later
        let scrambledSteps = [...correctSteps].map((text, id) => ({text, id})).sort(() => 0.5 - Math.random());
        let slotted = new Array(correctSteps.length).fill(null);
        
        minigameBoard.innerHTML = `
            <div id="ritual-container" class="ritual-container">
    <div class="ritual-stats">
        <span>Rituals Aligned: <span class="ritual-score-text">${score}</span> / ${deck.length}</span>
        <span>Integrity: ${"???".repeat(lives)}${"??".repeat(3-lives)}</span>
    </div>

    <h2 class="ritual-title">${currentRitual.name}</h2>
    <p class="ritual-desc">Click the runes below to arrange them in the exact order.</p>

    <div id="ritual-slots" class="ritual-slots-container">
        ${correctSteps.map((_, i) => `<div class="rune-slot" data-index="${i}"></div>`).join('')}
    </div>

    <div id="rune-pool" class="rune-pool">
        ${scrambledSteps.map(step => `<div class="rune-stone" data-id="${step.id}">${step.text}</div>`).join('')}
    </div>

    <button id="cast-ritual-btn" class="btn-occult cast-ritual-btn hidden">? Cast Ritual ?</button>
</div>
        `;
        const slots = document.querySelectorAll('.rune-slot');
        const runes = document.querySelectorAll('.rune-stone');
        const castBtn = document.getElementById('cast-ritual-btn');
        const container = document.getElementById('ritual-container');

        // Logic for clicking runes in the pool
        runes.forEach(rune => {
            rune.addEventListener('click', () => {
                let firstEmptySlot = slotted.findIndex(s => s === null);
                if (firstEmptySlot !== -1 && rune.parentElement.id === 'rune-pool') {
                    slotted[firstEmptySlot] = { id: rune.dataset.id, text: rune.innerText, element: rune };
                    slots[firstEmptySlot].appendChild(rune);
                    rune.style.margin = "0"; 
                    rune.style.width = "100%"; 
                    checkFull();
                }
            });
        });

        // Logic for clicking a filled slot (returns rune to pool)
        slots.forEach((slot, index) => {
            slot.addEventListener('click', () => {
                if (slotted[index] !== null) {
                    let rune = slotted[index].element;
                    rune.style.width = "auto";
                    document.getElementById('rune-pool').appendChild(rune);
                    slotted[index] = null;
                    castBtn.classList.add('hidden'); // Hide cast button if a slot is emptied
                }
            });
        });

        function checkFull() {
            if (!slotted.includes(null)) castBtn.classList.remove('hidden');
        }

        castBtn.addEventListener('click', () => {
            let isCorrect = true;
            for (let i = 0; i < correctSteps.length; i++) {
                if (parseInt(slotted[i].id) !== i) {
                    isCorrect = false;
                    break;
                }
            }

            if (isCorrect) {
                score++;
                container.style.boxShadow = "inset 0 0 30px rgba(76, 209, 55, 0.6)";
                container.style.borderColor = "#4cd137";
                awardGold(3); 
                awardInk(1);  
                setTimeout(() => {
                    currentIndex++;
                    loadRitual();
                }, 800);
            } else {
                lives--;
                container.style.boxShadow = "inset 0 0 30px rgba(233, 69, 96, 0.6)";
                container.style.borderColor = "#e94560";
                setTimeout(() => {
                    if (lives <= 0) loadRitual();
                    else {
                        container.style.boxShadow = "none";
                        container.style.borderColor = "#6c5ce7";
                        slotted.fill(null);
                        runes.forEach(rune => {
                            rune.style.width = "auto";
                            document.getElementById('rune-pool').appendChild(rune);
                        });
                        castBtn.classList.add('hidden');
                    }
                }, 800);
            }
        });
    }

    function endGame(message, isVictory) {
        let goldEarned = score * 5;
        let inkEarned = score * 2;
        if (isVictory) { goldEarned += 20; inkEarned += 5; } // Survival bonus

        if (world && world.progress && world.progress[sectionName] && world.progress[sectionName].gameCooldowns) {
            world.progress[sectionName].gameCooldowns[gameName] = Date.now() + (2 * 60 * 60 * 1000);
            saveToStorage();
        }

        minigameBoard.innerHTML = `
            <div class="minigame-victory-card ${isVictory ? 'victory' : ''}">
                <h2 class="minigame-victory-title ${isVictory ? 'victory' : ''}">${message}</h2>
                <p class="minigame-victory-stats">Rituals Aligned: ${score}</p>
                <p class="minigame-victory-reward">Gold Earned: ${goldEarned} 🪙</p>
                <p class="minigame-victory-reward" style="color: var(--accent-blue);">Ink Harvested: ${inkEarned} 🖋️</p>
            </div>
        `;
        awardGold(goldEarned);
        awardInk(inkEarned);
    }

    loadRitual();
}

// =====================================================================
// --- CLOZE FILL-IN-THE-BLANK GAME ---
// Show the question as context, blank a key word from the answer.
// =====================================================================
function launchClozeGame(flashcards, sectionName, gameName) {
    if (!minigameBoard) return;

    let deck = [...flashcards].sort(() => 0.5 - Math.random()).slice(0, 10);
    if (deck.length < 1) return alert("You need at least 1 flashcard to play the Cloze Trial!");

    let currentIndex = 0;
    let score = 0;

    function pickBlankWord(answer) {
        const words = answer.split(/\s+/).filter(w => w.length > 1);
        if (words.length === 0) return { before: '', blank: answer, after: '' };
        words.sort((a, b) => b.length - a.length);
        const chosen = words[0];
        const idx = answer.indexOf(chosen);
        return {
            before: answer.substring(0, idx),
            blank: chosen,
            after: answer.substring(idx + chosen.length)
        };
    }

    function loadNext() {
        if (currentIndex >= deck.length) {
            const goldEarned = score * 8;
            minigameBoard.innerHTML = `
                <div class="minigame-victory-card victory">
                    <h2 class="minigame-victory-title victory">Cloze Trial Complete!</h2>
                    <p class="minigame-victory-stats">You recalled ${score} of ${deck.length} passages correctly.</p>
                    <p class="minigame-victory-reward">Gold Earned: ${goldEarned} 🪙</p>
                </div>`;
            awardGold(goldEarned);
            const world = getActiveWorld();
            if (world && world.progress[sectionName]) {
                world.progress[sectionName].gameCooldowns[gameName] = Date.now() + (2 * 60 * 60 * 1000);
                saveToStorage();
            }
            return;
        }

        const card = deck[currentIndex];
        const { before, blank, after } = pickBlankWord(card.answer);
        const statsEl = document.getElementById('minigame-stats');
        if (statsEl) statsEl.innerText = `Passages: ${currentIndex + 1} / ${deck.length}  |  Correct: ${score}`;

        minigameBoard.innerHTML = `
            <div class="cloze-game-container">
                <p class="cloze-game-context">${renderMathString(card.question, { preferMath: !!card.isMath })}</p>
                <div class="cloze-game-answer-display">
                    ${renderMathString(before, { preserveLineBreaks: true })}<input type="text" id="cloze-game-input" class="cloze-answer-blank" autocomplete="off" spellcheck="false" placeholder="?">${renderMathString(after, { preserveLineBreaks: true })}
                </div>
                <button id="cloze-submit-btn" class="btn-primary" style="padding: 12px 30px; font-family: 'Cinzel', serif; letter-spacing: 1px;">Submit</button>
                <p id="cloze-feedback" style="min-height: 24px; font-size: 1em; margin-top: 8px;"></p>
            </div>`;

        const input = document.getElementById('cloze-game-input');
        const submitBtn = document.getElementById('cloze-submit-btn');
        const feedback = document.getElementById('cloze-feedback');
        input.focus();

        function checkAnswer() {
            const given = input.value.trim().toLowerCase();
            const expected = blank.toLowerCase();
            submitBtn.disabled = true;
            input.disabled = true;
            if (given === expected) {
                score++;
                input.style.borderBottomColor = '#4cd137';
                input.style.color = '#4cd137';
                feedback.style.color = '#4cd137';
                feedback.innerText = '✔ Correct!';
                awardGold(5);
            } else {
                input.style.borderBottomColor = '#ff4757';
                input.style.color = '#ff4757';
                feedback.style.color = '#ff4757';
                feedback.innerText = `✘ The word was: "${blank}"`;
            }
            setTimeout(() => { currentIndex++; loadNext(); }, 1400);
        }

        submitBtn.onclick = checkAnswer;
        input.addEventListener('keydown', (e) => { if (e.key === 'Enter') checkAnswer(); });
    }

    loadNext();
}

// =====================================================================
// --- TRUE / FALSE BLITZ ---
// Is this the correct answer to the question? A timed True/False judgment.
// =====================================================================
function launchTrueFalseBlitz(flashcards, sectionName, gameName) {
    if (!minigameBoard) return;
    if (flashcards.length < 2) return alert("You need at least 2 flashcards to play True/False Blitz!");

    const deck = [...flashcards].sort(() => 0.5 - Math.random()).slice(0, 12);
    let currentIndex = 0;
    let score = 0;
    let lives = 3;
    let timerInterval = null;
    const TIME_LIMIT = 5;

    function buildQuestion() {
        const card = deck[currentIndex];
        const isTrue = Math.random() > 0.45;
        let shownAnswer;
        if (isTrue) {
            shownAnswer = card.answer;
        } else {
            const others = deck.filter((_, i) => i !== currentIndex);
            const wrong = others[Math.floor(Math.random() * others.length)];
            shownAnswer = wrong.answer;
        }
        return { card, shownAnswer, isTrue };
    }

    function loadNext() {
        if (lives <= 0) { endGame(false); return; }
        if (currentIndex >= deck.length) { endGame(true); return; }

        const { card, shownAnswer, isTrue } = buildQuestion();
        const statsEl = document.getElementById('minigame-stats');
        if (statsEl) statsEl.innerText = `Score: ${score} / ${deck.length}  |  Lives: ${'❤️'.repeat(lives)}${'🖤'.repeat(3 - lives)}`;

        minigameBoard.innerHTML = `
            <div class="tf-container">
                <div class="tf-stats">${score} Correct &nbsp;|&nbsp; ${'❤️'.repeat(lives)}${'🖤'.repeat(3 - lives)}</div>
                <div class="tf-timer-track"><div class="tf-timer-fill" id="tf-timer-fill" style="width:100%;"></div></div>
                <p class="tf-statement-label">IS THIS THE CORRECT ANSWER?</p>
                <div class="tf-question-box">
                    <div>
                        <span style="color: #a29bfe; font-family: 'Cinzel', serif; font-size: 0.8em; display: block; margin-bottom: 10px; letter-spacing: 1px;">${renderMathString(card.question, { preferMath: !!card.isMath })}</span>
                        <span style="font-size: 1.2em; color: #fff; font-weight: bold;">${renderMathString('"' + shownAnswer + '"', { preferMath: !!card.isMath })}</span>
                    </div>
                </div>
                <div class="tf-buttons">
                    <button class="tf-btn tf-btn-true" id="tf-true-btn">TRUE</button>
                    <button class="tf-btn tf-btn-false" id="tf-false-btn">FALSE</button>
                </div>
                <p id="tf-feedback" style="min-height: 20px; font-size: 1em; color: #a29bfe; font-family: 'Cinzel', serif; letter-spacing: 1px;"></p>
            </div>`;

        let timeLeft = TIME_LIMIT;
        const fill = document.getElementById('tf-timer-fill');
        if (timerInterval) clearInterval(timerInterval);
        timerInterval = setInterval(() => {
            timeLeft -= 0.1;
            const pct = (timeLeft / TIME_LIMIT) * 100;
            if (fill) fill.style.width = Math.max(0, pct) + '%';
            if (timeLeft <= 0) {
                clearInterval(timerInterval);
                handleAnswer(null, isTrue);
            }
        }, 100);

        function handleAnswer(playerSaysTrue, isCorrectTrue) {
            clearInterval(timerInterval);
            const trueBtn = document.getElementById('tf-true-btn');
            const falseBtn = document.getElementById('tf-false-btn');
            const feedback = document.getElementById('tf-feedback');
            if (trueBtn) trueBtn.disabled = true;
            if (falseBtn) falseBtn.disabled = true;

            const isRight = playerSaysTrue !== null && (playerSaysTrue === isCorrectTrue);
            if (isRight) {
                score++;
                awardGold(3);
                if (feedback) { feedback.style.color = '#4cd137'; feedback.innerText = '✔ CORRECT'; }
            } else {
                lives--;
                if (feedback) {
                    feedback.style.color = '#ff4757';
                    feedback.innerText = playerSaysTrue === null
                        ? '⏰ TIME OUT — The answer was ' + (isCorrectTrue ? 'TRUE' : 'FALSE')
                        : '✘ WRONG — It was ' + (isCorrectTrue ? 'TRUE' : 'FALSE');
                }
            }
            currentIndex++;
            setTimeout(() => loadNext(), 1300);
        }

        document.getElementById('tf-true-btn').onclick = () => handleAnswer(true, isTrue);
        document.getElementById('tf-false-btn').onclick = () => handleAnswer(false, isTrue);
    }

    function endGame(isVictory) {
        if (timerInterval) clearInterval(timerInterval);
        const goldEarned = score * 4 + (isVictory ? 15 : 0);
        awardGold(goldEarned);
        minigameBoard.innerHTML = `
            <div class="minigame-victory-card ${isVictory ? 'victory' : ''}">
                <h2 class="minigame-victory-title ${isVictory ? 'victory' : ''}">${isVictory ? 'Blitz Complete!' : 'The flame was extinguished!'}</h2>
                <p class="minigame-victory-stats">Correct Judgments: ${score} / ${deck.length}</p>
                <p class="minigame-victory-reward">Gold Earned: ${goldEarned} 🪙</p>
            </div>`;
        const world = getActiveWorld();
        if (world && world.progress[sectionName]) {
            world.progress[sectionName].gameCooldowns[gameName] = Date.now() + (2 * 60 * 60 * 1000);
            saveToStorage();
        }
    }

    loadNext();
}

// =====================================================================
// --- GLIMPSE & RECALL ---
// See the answer for a few seconds — then it vanishes. Type it from memory.
// =====================================================================
function launchGlimpseRecall(flashcards, sectionName, gameName) {
    if (!minigameBoard) return;
    if (flashcards.length < 1) return alert("You need at least 1 flashcard to play Glimpse & Recall!");

    const deck = [...flashcards].sort(() => 0.5 - Math.random()).slice(0, 10);
    let currentIndex = 0;
    let score = 0;
    const GLIMPSE_SECONDS = 3;

    function loadNext() {
        if (currentIndex >= deck.length) {
            const goldEarned = score * 10;
            awardGold(goldEarned);
            minigameBoard.innerHTML = `
                <div class="minigame-victory-card victory">
                    <h2 class="minigame-victory-title victory">Memory Sealed!</h2>
                    <p class="minigame-victory-stats">Recalled ${score} of ${deck.length} answers correctly.</p>
                    <p class="minigame-victory-reward">Gold Earned: ${goldEarned} 🪙</p>
                </div>`;
            const world = getActiveWorld();
            if (world && world.progress[sectionName]) {
                world.progress[sectionName].gameCooldowns[gameName] = Date.now() + (2 * 60 * 60 * 1000);
                saveToStorage();
            }
            return;
        }

        const card = deck[currentIndex];
        const statsEl = document.getElementById('minigame-stats');
        if (statsEl) statsEl.innerText = `Visions: ${currentIndex + 1} / ${deck.length}  |  Recalled: ${score}`;

        minigameBoard.innerHTML = `
            <div class="glimpse-container">
                <p style="color: #8a9bb5; font-family: 'Cinzel', serif; font-size: 0.85em; letter-spacing: 2px; margin: 0;">MEMORIZE THE ANSWER</p>
                <div class="glimpse-question-box">${renderMathString(card.question, { preferMath: !!card.isMath })}</div>
                <div class="glimpse-answer-flash" id="glimpse-answer-box" style="transition: opacity 0.5s, transform 0.5s;">${renderMathString(card.answer, { preferMath: !!card.isMath })}</div>
                <p id="glimpse-countdown-label" class="glimpse-countdown">${GLIMPSE_SECONDS}</p>
                <p style="color: #444; font-style: italic; font-size: 0.82em;">The vision will vanish...</p>
            </div>`;

        let countdown = GLIMPSE_SECONDS;
        const countdownEl = document.getElementById('glimpse-countdown-label');
        const answerBox = document.getElementById('glimpse-answer-box');

        const countInterval = setInterval(() => {
            countdown--;
            if (countdownEl) {
                countdownEl.innerText = countdown;
                if (countdown <= 1) countdownEl.style.color = '#ff4757';
            }
            if (countdown <= 0) {
                clearInterval(countInterval);
                if (answerBox) { answerBox.style.opacity = '0'; answerBox.style.transform = 'scale(0.85)'; }
                setTimeout(() => showRecallInput(card), 550);
            }
        }, 1000);
    }

    function showRecallInput(card) {
        minigameBoard.innerHTML = `
            <div class="glimpse-container">
                <p style="color: #8a9bb5; font-family: 'Cinzel', serif; font-size: 0.85em; letter-spacing: 2px; margin: 0;">RECALL THE VISION</p>
                <div class="glimpse-question-box">${renderMathString(card.question, { preferMath: !!card.isMath })}</div>
                <div class="glimpse-answer-flash" style="opacity: 0.07; font-size: 0.75em; letter-spacing: 8px; color: #555;">? ? ? ? ?</div>
                <input type="text" id="glimpse-input" class="glimpse-input" placeholder="What did you see?" autocomplete="off" spellcheck="false">
                <button id="glimpse-submit" class="btn-primary" style="padding: 12px 30px; font-family: 'Cinzel', serif; letter-spacing: 1px; margin-top: 4px;">Seal the Memory</button>
                <p id="glimpse-feedback" style="min-height: 22px; font-size: 1em; margin-top: 6px;"></p>
            </div>`;

        const input = document.getElementById('glimpse-input');
        const submitBtn = document.getElementById('glimpse-submit');
        const feedback = document.getElementById('glimpse-feedback');
        input.focus();

        function checkAnswer() {
            const given = input.value.trim().toLowerCase();
            const expected = card.answer.trim().toLowerCase();
            submitBtn.disabled = true;
            input.disabled = true;

            // Exact match
            if (given === expected) {
                score++;
                awardGold(8);
                input.style.borderColor = '#4cd137';
                feedback.style.color = '#4cd137';
                feedback.innerText = '✔ Perfect recall!';
            // Generous partial: answer contains input and input is at least 60% as long
            } else if (given.length > 0 && expected.includes(given) && given.length >= expected.length * 0.6) {
                score++;
                awardGold(4);
                input.style.borderColor = '#ffd700';
                feedback.style.color = '#ffd700';
                feedback.innerHTML = `✔ Close enough! The vision was: "${renderMathString(card.answer, { preferMath: !!card.isMath })}"`;
            } else {
                input.style.borderColor = '#ff4757';
                feedback.style.color = '#ff4757';
                feedback.innerHTML = `✘ The vision was: "${renderMathString(card.answer, { preferMath: !!card.isMath })}"`;
            }
            currentIndex++;
            setTimeout(() => loadNext(), 1700);
        }

        submitBtn.onclick = checkAnswer;
        input.addEventListener('keydown', (e) => { if (e.key === 'Enter') checkAnswer(); });
    }

    loadNext();
}

export { launchArcaneDefenseGame, launchTriviaGame, launchMemoryGame, startFlashMatchGame, launchSpellweaverGame, launchRitualAlignmentGame, launchClozeGame, launchTrueFalseBlitz, launchGlimpseRecall };
