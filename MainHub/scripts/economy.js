import { appState } from './state.js';
import { saveToStorage } from './storage.js';

export function updateEconomyUI() {
    if(document.getElementById('gold-count'))
        document.getElementById('gold-count').innerText = appState.gold || 0;
    if(document.getElementById('ink-count'))
        document.getElementById('ink-count').innerText = appState.ink || 0;

    let totalPaper = 0;
    if (appState.paper) Object.values(appState.paper).forEach(count => totalPaper += count);
    if(document.getElementById('paper-count'))
        document.getElementById('paper-count').innerText = totalPaper;
}

export function awardGold(amount) { 
    appState.gold = (appState.gold || 0) + amount; 
    saveToStorage(); 
}

export function awardInk(amount) { 
    appState.ink = (appState.ink || 0) + amount; 
    saveToStorage(); 
}

export function awardPaper(paperName) {
    if(!appState.paper) appState.paper = {};
    appState.paper[paperName] = (appState.paper[paperName] || 0) + 1;
    saveToStorage();
    alert(`?? Arcane Discovery! You found a [${paperName}]!`);
}
