/**
 * rewards-display.js
 * Manages the Achievements & Rewards modal accessible from the header.
 * 
 * Displays:
 * - Buttons for earned rewards by type (Sounds, Music, Temple, Buttons, Wallpaper, Objects)
 * - List of achievements (completed and available)
 */

import { appState } from './state.js';
import { SOUND_REWARD_CATALOG } from './rewardSystem.js';

/**
 * Initialize the Achievements & Rewards modal from the header.
 * Wires up all reward type view buttons and modal controls.
 */
export function initRewardsDisplay() {
    const headerBtn = document.getElementById('btn-open-achievements');
    const modal     = document.getElementById('achievements-rewards-modal');
    const closeBtn  = document.getElementById('close-achievements-rewards');
    const closeBtnAlt = document.getElementById('btn-close-achievements-rewards');

    if (headerBtn)   headerBtn.onclick   = openAchievementsModal;
    if (closeBtn)    closeBtn.onclick    = closeAchievementsModal;
    if (closeBtnAlt) closeBtnAlt.onclick = closeAchievementsModal;

    const soundBtn    = document.getElementById('btn-view-sound-rewards');
    const musicBtn    = document.getElementById('btn-view-music-rewards');
    const templeBtn   = document.getElementById('btn-view-temple-rewards');
    const buttonBtn   = document.getElementById('btn-view-button-rewards');
    const wallpaperBtn = document.getElementById('btn-view-wallpaper-rewards');
    const objectBtn   = document.getElementById('btn-view-object-rewards');

    if (soundBtn)    soundBtn.onclick    = () => showRewardModal('sounds', 'Sound Rewards');
    if (musicBtn)    musicBtn.onclick    = () => showRewardModal('music', 'Music Rewards');
    if (templeBtn)   templeBtn.onclick   = () => showRewardModal('temples', 'Temple Rewards');
    if (buttonBtn)   buttonBtn.onclick   = () => showRewardModal('buttons', 'Button Rewards');
    if (wallpaperBtn) wallpaperBtn.onclick = () => showRewardModal('wallpapers', 'Wallpaper Rewards');
    if (objectBtn)   objectBtn.onclick   = () => showRewardModal('objects', 'Object Rewards');

    // Close modal when clicking outside of it
    if (modal) {
        modal.onclick = e => { if (e.target === modal) closeAchievementsModal(); };
    }

    // Initial render
    renderRewardsPanel();
}

function openAchievementsModal() {
    const modal = document.getElementById('achievements-rewards-modal');
    if (modal) {
        modal.classList.remove('hidden');
        renderRewardsPanel();
    }
}

function closeAchievementsModal() {
    const modal = document.getElementById('achievements-rewards-modal');
    if (modal) modal.classList.add('hidden');
}

/**
 * Refresh the Achievements & Rewards modal display.
 * Shows counts of earned rewards and lists achievements.
 */
function renderRewardsPanel() {
    const earnedRewards = appState.earnedRewards || {
        sounds: [], music: [], temples: [], buttons: [], wallpapers: [], objects: []
    };

    // Update reward counts
    updateCount('sound-rewards', earnedRewards.sounds.length);
    updateCount('music-rewards', earnedRewards.music.length);
    updateCount('temple-rewards', earnedRewards.temples.length);
    updateCount('button-rewards', earnedRewards.buttons.length);
    updateCount('wallpaper-rewards', earnedRewards.wallpapers.length);
    updateCount('object-rewards', earnedRewards.objects.length);

    renderAchievementsList();
}

/**
 * Update a reward count badge.
 */
function updateCount(rewardType, count) {
    const el = document.getElementById(`count-${rewardType}`);
    if (el) el.textContent = count;
}

/**
 * Render the achievements list (completed and available).
 */
function renderAchievementsList() {
    const listEl = document.getElementById('achievements-list');
    if (!listEl) return;

    const earnedAchievements = appState.earnedAchievements || { completed: [], available: [] };
    const achievements = appState.assetLibrary?.achievements || [];

    if (!achievements.length && !earnedAchievements.completed.length) {
        listEl.innerHTML = '<p style="color: #bfd2c5; font-size: 0.85em; margin: 0;">No achievements yet. Complete tasks to earn them!</p>';
        return;
    }

    const html = [];

    // Completed achievements
    earnedAchievements.completed.forEach(achId => {
        const ach = achievements.find(a => a.id === achId);
        if (ach) {
            html.push(`
                <div style="display: flex; align-items: center; gap: 8px; padding: 4px 8px; background: rgba(39, 174, 96, 0.15); border-radius: 6px; border-left: 3px solid #27ae60;">
                    <span style="font-size: 1.2em;">${ach.icon || '🏆'}</span>
                    <div>
                        <div style="color: #27ae60; font-weight: 700; font-size: 0.85em;">${ach.name}</div>
                        <div style="color: #adc5a0; font-size: 0.75em;">${ach.description}</div>
                    </div>
                </div>
            `);
        }
    });

    // Available achievements (not yet completed)
    earnedAchievements.available.forEach(achId => {
        const ach = achievements.find(a => a.id === achId);
        if (ach) {
            html.push(`
                <div style="display: flex; align-items: center; gap: 8px; padding: 4px 8px; background: rgba(100, 100, 100, 0.15); border-radius: 6px; border-left: 3px solid #7f8c8d; opacity: 0.75;">
                    <span style="font-size: 1.2em; filter: grayscale(0.8);">${ach.icon || '🏆'}</span>
                    <div>
                        <div style="color: #95a5a6; font-weight: 700; font-size: 0.85em;">${ach.name}</div>
                        <div style="color: #7f8c8d; font-size: 0.75em;">${ach.description}</div>
                    </div>
                </div>
            `);
        }
    });

    if (html.length === 0) {
        listEl.innerHTML = '<p style="color: #bfd2c5; font-size: 0.85em; margin: 0;">No achievements yet. Complete tasks to earn them!</p>';
    } else {
        listEl.innerHTML = html.join('');
    }
}

/**
 * Show a modal with earned rewards of a specific type.
 */
function showRewardModal(rewardType, title) {
    const earnedRewards = appState.earnedRewards || {
        sounds: [], music: [], temples: [], buttons: [], wallpapers: [], objects: []
    };

    const earnedIds = earnedRewards[rewardType] || [];

    // Create a simple modal overlay
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.zIndex = '1000';

    const content = document.createElement('div');
    content.className = 'modal-content section-content occult-modal';
    content.style.cssText = 'max-width:600px;max-height:80vh;overflow-y:auto;';

    const closeBtn = document.createElement('span');
    closeBtn.className = 'close-btn';
    closeBtn.textContent = '×';
    closeBtn.onclick = () => modal.remove();

    const heading = document.createElement('h2');
    heading.className = 'occult-title';
    heading.style.color = '#d7a7ff';
    heading.textContent = title;

    const body = document.createElement('div');
    body.style.cssText = 'display: flex; flex-direction: column; gap: 8px;';

    if (rewardType === 'sounds') {
        // Show all catalog entries with locked/unlocked state
        const allSoundIds = Object.keys(SOUND_REWARD_CATALOG);
        if (allSoundIds.length === 0) {
            body.innerHTML = `<p style="color: #bfd2c5;">No sound rewards defined yet.</p>`;
        } else {
            allSoundIds.forEach(rewardId => {
                const catalog = SOUND_REWARD_CATALOG[rewardId];
                const isEarned = earnedIds.includes(rewardId);
                const item = document.createElement('div');
                const borderColor = isEarned ? '#9b59b6' : '#4a4a6a';
                const bgColor = isEarned ? 'rgba(155, 89, 182, 0.1)' : 'rgba(60, 60, 90, 0.08)';
                item.style.cssText = `padding: 10px; background: ${bgColor}; border-radius: 6px; border-left: 3px solid ${borderColor}; color: #d7a7ff; opacity: ${isEarned ? '1' : '0.55'};`;

                const uploaded = appState.assetLibrary?.soundRewards?.find(s => s.id === rewardId);
                const src = uploaded?.data ?? (isEarned ? catalog.file : null);

                let audioHtml = '';
                if (isEarned && src) {
                    audioHtml = `<audio controls style="width:100%;margin-top:6px;" src="${src}"></audio>`;
                } else if (!isEarned) {
                    audioHtml = `<span style="font-size:0.75em;color:#7f8c8d;">🔒 Not yet earned</span>`;
                }

                item.innerHTML = `
                    <div style="display:flex;align-items:center;gap:8px;">
                        <span style="font-size:1.4em;">${isEarned ? '🔊' : '🔕'}</span>
                        <div style="flex:1;">
                            <div style="font-weight:700;font-size:0.9em;">${catalog.name}</div>
                            <div style="font-size:0.73em;color:#9b8ea0;margin-top:2px;">${catalog.obtain}</div>
                            ${audioHtml}
                        </div>
                    </div>
                `;
                body.appendChild(item);
            });
        }
    } else if (earnedIds.length === 0) {
        body.innerHTML = `<p style="color: #bfd2c5;">You haven't earned any ${title.toLowerCase()} yet.</p>`;
    } else {
        earnedIds.forEach(rewardId => {
            const item = document.createElement('div');
            item.style.cssText = 'padding: 10px; background: rgba(155, 89, 182, 0.1); border-radius: 6px; border-left: 3px solid #9b59b6; color: #d7a7ff;';
            item.textContent = rewardId || 'Unnamed Reward';
            body.appendChild(item);
        });
    }

    content.appendChild(closeBtn);
    content.appendChild(heading);
    content.appendChild(body);
    modal.appendChild(content);
    document.body.appendChild(modal);

    modal.onclick = e => { if (e.target === modal) modal.remove(); };
}

/**
 * Mark an achievement as completed.
 */
export function completeAchievement(achievementId) {
    if (!appState.earnedAchievements) {
        appState.earnedAchievements = { completed: [], available: [] };
    }

    const idx = appState.earnedAchievements.available.indexOf(achievementId);
    if (idx !== -1) {
        appState.earnedAchievements.available.splice(idx, 1);
        appState.earnedAchievements.completed.push(achievementId);
        renderRewardsPanel();
    }
}

/**
 * Earn a reward of a specific type.
 */
export function earnReward(rewardType, rewardId) {
    if (!appState.earnedRewards) {
        appState.earnedRewards = {
            sounds: [], music: [], temples: [], buttons: [], wallpapers: [], objects: []
        };
    }

    const list = appState.earnedRewards[rewardType];
    if (list && !list.includes(rewardId)) {
        list.push(rewardId);
        renderRewardsPanel();
    }
}

/**
 * Export function for rendering from elsewhere.
 */
export function updateRewardsDisplay() {
    renderRewardsPanel();
}
