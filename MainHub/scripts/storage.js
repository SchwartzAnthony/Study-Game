import { appState } from './state.js';
import { updateEconomyUI } from './economy.js';

export function saveToStorage() {
    localStorage.setItem('studyQuestData', JSON.stringify(appState));
    updateEconomyUI();
}

// Ensure the module is available to window if necessary or to other modules
