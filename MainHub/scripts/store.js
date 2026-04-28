import { appState, getSafeImageSrc } from './state.js';
import { awardGold, awardInk, awardPaper, updateEconomyUI } from './economy.js';
import { saveToStorage } from './storage.js';
import { getDesignSystemConfig } from './designSystem.js';
import {
  INK_TIERS,
  ensureRewardSystemState,
  buyInkWithGold,
  craftItem,
  getOrRefillOffers,
  buyShopOffer,
  claimUnlockedReward,
  getUploadGates,
  downloadBacklogCSV
} from './rewardSystem.js';

// ─── MODAL WIRING ──────────────────────────────────────────────────────────

const storeModal = document.getElementById('store-modal');
if(document.getElementById('btn-open-store')) {
    document.getElementById('btn-open-store').addEventListener('click', () => {
        renderStore();
        storeModal.classList.remove('hidden');
    });
}
if(document.getElementById('close-store')) document.getElementById('close-store').addEventListener('click', () => storeModal.classList.add('hidden'));

const storeSettingsModal = document.getElementById('store-settings-modal');
if(document.getElementById('open-store-settings-btn')) {
    document.getElementById('open-store-settings-btn').addEventListener('click', () => {
        storeSettingsModal.classList.remove('hidden');
    });
}
if(document.getElementById('close-store-settings')) {
    document.getElementById('close-store-settings').addEventListener('click', () => {
        storeSettingsModal.classList.add('hidden');
    });
}

// ─── LEGACY ITEM BUY ───────────────────────────────────────────────────────

export function buyItem(itemName, cost) {
    if (appState.gold >= cost) {
        if (appState.inventory.includes(itemName)) return alert('You already own this item!');
        appState.gold -= cost;
        appState.inventory.push(itemName);
        saveToStorage();
        alert(`Successfully purchased ${itemName}!`);
    } else {
        alert('Not enough Gold! Play more Mini-Games!');
    }
}

// ─── SPECIAL PAPER TRADE ───────────────────────────────────────────────────

export function tradeForSpecialPaper(specialPaperName, paperCost) {
    let totalPaper = 0;
    if (appState.paper) Object.values(appState.paper).forEach(count => totalPaper += count);

    if (totalPaper >= paperCost) {
        let paperToDeduct = paperCost;
        for (let paperName in appState.paper) {
            if (paperToDeduct <= 0) break;
            const available = appState.paper[paperName];
            if (available > 0) {
                const deduct = Math.min(available, paperToDeduct);
                appState.paper[paperName] -= deduct;
                paperToDeduct -= deduct;
            }
        }
        appState.paper[specialPaperName] = (appState.paper[specialPaperName] || 0) + 1;
        saveToStorage();
        alert(`🔥 Trade successful! You bound ${paperCost} basic parchments into 1 [${specialPaperName}]!`);
    } else {
        alert(`Not enough Paper! You need ${paperCost - totalPaper} more. Pass Quizzes and Exams to earn them!`);
    }
}

// ─── HELPER: SECTION HEADING ───────────────────────────────────────────────

function makeSectionHeading(emoji, title, subtitle) {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'margin: 18px 0 10px; border-bottom: 1px solid rgba(255,255,255,0.06); padding-bottom: 8px;';
    wrap.innerHTML = `<h3 style="margin:0;font-size:1.1em;color:#f5e9cf;">${emoji} ${title}</h3>`
        + (subtitle ? `<p style="margin:4px 0 0;font-size:0.82em;color:var(--muted);">${subtitle}</p>` : '');
    return wrap;
}

// ─── SECTION 1: INK EXCHANGE ───────────────────────────────────────────────

function renderInkExchange(container, config) {
    const rs = appState.rewardSystem || {};
    const inkTiersCfg = config && config.rewardSystem && config.rewardSystem.inkTiers ? config.rewardSystem.inkTiers : {};
    const inkBalances = rs.ink || {};

    const today = new Date().toISOString().slice(0, 10);
    const daily = (rs.dailyInkPurchases && rs.dailyInkPurchases.date === today) ? (rs.dailyInkPurchases.counts || {}) : {};

    container.appendChild(makeSectionHeading('🖋️', 'Ink Exchange', 'Spend Gold to acquire ink vials. Each tier has a daily purchase limit.'));

    const grid = document.createElement('div');
    grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px;';

    INK_TIERS.forEach(tier => {
        const tierCfg = inkTiersCfg[tier] || {};
        const label = tierCfg.label || tier;
        const emoji = tierCfg.emoji || '🖋️';
        const goldCost = tierCfg.goldCost !== undefined ? tierCfg.goldCost : '?';
        const dailyLimit = tierCfg.dailyLimit !== undefined ? tierCfg.dailyLimit : 1;
        const usedToday = daily[tier] || 0;
        const balance = inkBalances[tier] || 0;
        const atLimit = usedToday >= dailyLimit;

        const card = document.createElement('div');
        card.style.cssText = 'background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:10px;padding:12px;display:flex;flex-direction:column;gap:6px;';
        card.innerHTML = `
            <div style="font-size:1.6em;text-align:center;">${emoji}</div>
            <div style="font-weight:700;color:#f5e9cf;text-align:center;font-size:0.9em;">${label}</div>
            <div style="font-size:0.78em;color:var(--muted);text-align:center;">Balance: ${balance}</div>
            <div style="font-size:0.78em;color:var(--muted);text-align:center;">Cost: ${goldCost} 🪙</div>
            <div style="font-size:0.75em;color:${atLimit ? '#e74c3c' : 'var(--muted)'};text-align:center;">Today: ${usedToday}/${dailyLimit}</div>
        `;
        const btn = document.createElement('button');
        btn.className = 'btn-primary';
        btn.style.cssText = 'margin-top:4px;font-size:0.8em;padding:6px 0;';
        btn.textContent = atLimit ? 'Limit Reached' : `Buy (${goldCost} 🪙)`;
        btn.disabled = atLimit;
        btn.onclick = () => {
            const rsCfg = config && config.rewardSystem ? config.rewardSystem : null;
            const result = buyInkWithGold(tier, rsCfg);
            alert(result.message);
            if (result.ok) renderStore();
        };
        card.appendChild(btn);
        grid.appendChild(card);
    });

    container.appendChild(grid);
}

// ─── SECTION 2: INSCRIPTION FORGE ─────────────────────────────────────────

function renderInscriptionForge(container, config) {
    const rs = appState.rewardSystem || {};
    const recipes = config && config.rewardSystem && config.rewardSystem.craftingRecipes ? config.rewardSystem.craftingRecipes : {};
    const inkBalances = rs.ink || {};

    container.appendChild(makeSectionHeading('⚒️', 'Inscription Forge', 'Combine inks and pages to craft scrolls, books, and legendary tomes.'));

    if (Object.keys(recipes).length === 0) {
        const note = document.createElement('p');
        note.style.cssText = 'color:var(--muted);font-size:0.85em;';
        note.textContent = 'No recipes loaded. Check config/reward-system.json.';
        container.appendChild(note);
        return;
    }

    const grid = document.createElement('div');
    grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px;';

    Object.entries(recipes).forEach(([key, recipe]) => {
        const mats = recipe.materials || {};
        const card = document.createElement('div');
        card.style.cssText = 'background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:10px;padding:12px;display:flex;flex-direction:column;gap:6px;';

        let matsHtml = '';
        let canCraft = true;
        Object.entries(mats).forEach(([matKey, req]) => {
            let have = 0;
            if (matKey === 'pages') have = (appState.crafting && appState.crafting.pages) ? appState.crafting.pages : 0;
            else if (matKey.endsWith('Ink')) have = (inkBalances[matKey.replace('Ink', '').toLowerCase()] || 0);
            const ok = have >= req;
            if (!ok) canCraft = false;
            matsHtml += `<div style="font-size:0.75em;color:${ok ? '#2ecc71' : '#e74c3c'};">${matKey}: ${have}/${req}</div>`;
        });

        card.innerHTML = `
            <div style="font-size:1.4em;text-align:center;">${recipe.emoji || '📜'}</div>
            <div style="font-weight:700;color:#f5e9cf;text-align:center;font-size:0.9em;">${recipe.label || key}</div>
            <div style="font-size:0.78em;color:var(--muted);">${recipe.description || ''}</div>
            <div style="border-top:1px solid rgba(255,255,255,0.05);padding-top:4px;">${matsHtml}</div>
        `;
        const btn = document.createElement('button');
        btn.className = canCraft ? 'btn-primary' : 'btn-secondary';
        btn.style.cssText = 'margin-top:4px;font-size:0.8em;padding:6px 0;';
        btn.textContent = canCraft ? 'Craft' : 'Need Materials';
        btn.disabled = !canCraft;
        btn.onclick = () => {
            const rsCfg = config && config.rewardSystem ? config.rewardSystem : null;
            const result = craftItem(key, rsCfg);
            alert(result.message);
            if (result.ok) renderStore();
        };
        card.appendChild(btn);
        grid.appendChild(card);
    });

    container.appendChild(grid);
}

// ─── SECTION 3: RANDOM ARCANUM OFFERS ─────────────────────────────────────

const RARITY_COLORS = {
    black: '#aaa', silver: '#c0c0c0', gold: '#ffd700',
    platinum: '#e0e0ff', crimson: '#e74c3c', mythic: '#9b59b6'
};

function renderArcanumOffers(container, config) {
    container.appendChild(makeSectionHeading('🎲', 'Random Arcanum Offers', 'Limited random rewards. Board refills instantly when empty.'));

    const rsCfg = config && config.rewardSystem ? config.rewardSystem : null;
    const offers = getOrRefillOffers(rsCfg);

    if (offers.length === 0) {
        const note = document.createElement('p');
        note.style.cssText = 'color:var(--muted);font-size:0.85em;';
        note.textContent = 'No offers available. Reload to refresh.';
        container.appendChild(note);
        return;
    }

    const grid = document.createElement('div');
    grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:10px;';

    offers.forEach(offer => {
        const rarityColor = RARITY_COLORS[offer.rarity] || '#aaa';
        const card = document.createElement('div');
        card.style.cssText = `background:rgba(255,255,255,0.03);border:1px solid ${rarityColor}44;border-radius:10px;padding:12px;display:flex;flex-direction:column;gap:6px;`;
        card.innerHTML = `
            <div style="font-size:0.65em;text-transform:uppercase;letter-spacing:1px;color:${rarityColor};font-weight:700;">${offer.rarity}</div>
            <div style="font-weight:700;color:#f5e9cf;font-size:0.88em;">${offer.name}</div>
            <div style="font-size:0.75em;color:var(--muted);">${offer.description || ''}</div>
            <div style="font-size:0.8em;color:#ffb86b;font-weight:700;margin-top:auto;">${offer.cost} 🪙</div>
        `;
        const btn = document.createElement('button');
        btn.className = 'btn-primary';
        btn.style.cssText = 'font-size:0.8em;padding:6px 0;';
        btn.textContent = 'Buy';
        btn.onclick = () => {
            const result = buyShopOffer(offer.id, rsCfg);
            alert(result.message);
            if (result.ok) renderStore();
        };
        card.appendChild(btn);
        grid.appendChild(card);
    });

    container.appendChild(grid);
}

// ─── SECTION 4: BACKLOG EXPORT ─────────────────────────────────────────────

function renderBacklogExport(container, config) {
    container.appendChild(makeSectionHeading('📦', 'Reward Backlog', 'Generate and download the full 1000-item reward catalog as CSV.'));

    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;align-items:center;gap:12px;flex-wrap:wrap;';

    const rsCfg = config && config.rewardSystem ? config.rewardSystem : null;
    const count = rsCfg && rsCfg.backlogCount ? rsCfg.backlogCount : 1000;

    const info = document.createElement('p');
    info.style.cssText = 'color:var(--muted);font-size:0.82em;margin:0;';
    info.textContent = `${count} items across all rarity tiers, ready for CSV export.`;

    const btn = document.createElement('button');
    btn.className = 'btn-primary';
    btn.style.cssText = 'padding:8px 20px;';
    btn.textContent = '⬇️ Download Backlog CSV';
    btn.onclick = () => downloadBacklogCSV(rsCfg);

    wrap.appendChild(info);
    wrap.appendChild(btn);
    container.appendChild(wrap);
}

// ─── SECTION 5: CREATOR FORGE (UPLOAD GATES) ─────────────────────────────

function renderCreatorForge(container, config) {
    const gates = getUploadGates();
    const rsCfg = config && config.rewardSystem ? config.rewardSystem : {};
    const uploadTypes = rsCfg.uploadTypes || {};

    container.appendChild(makeSectionHeading('🔓', 'Creator Forge', 'Upload custom content once the corresponding gate is unlocked via the Arcanum.'));

    const allLocked = Object.values(gates).every(v => !v);
    if (allLocked && Object.keys(uploadTypes).length > 0) {
        const note = document.createElement('p');
        note.style.cssText = 'color:var(--muted);font-size:0.82em;';
        note.textContent = 'All upload types are locked. Purchase unlock rewards from the Arcanum Offers to gain access.';
        container.appendChild(note);

        const grid = document.createElement('div');
        grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;margin-top:10px;';
        Object.entries(uploadTypes).forEach(([key, typeCfg]) => {
            const card = document.createElement('div');
            card.style.cssText = 'background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.05);border-radius:10px;padding:12px;text-align:center;opacity:0.5;';
            card.innerHTML = `<div style="font-size:1.5em;">${typeCfg.emoji || '🔒'}</div><div style="font-size:0.8em;color:var(--muted);margin-top:4px;">${typeCfg.label || key}</div><div style="font-size:0.7em;color:#e74c3c;margin-top:4px;">Locked</div>`;
            grid.appendChild(card);
        });
        container.appendChild(grid);
        return;
    }

    const grid = document.createElement('div');
    grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:10px;';

    Object.entries(uploadTypes).forEach(([key, typeCfg]) => {
        const unlocked = gates[key] === true;
        const card = document.createElement('div');
        card.style.cssText = `background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,${unlocked ? '0.12' : '0.04'});border-radius:10px;padding:12px;display:flex;flex-direction:column;gap:6px;opacity:${unlocked ? '1' : '0.45'};`;
        card.innerHTML = `
            <div style="font-size:1.5em;text-align:center;">${typeCfg.emoji || '📁'}</div>
            <div style="font-weight:700;color:#f5e9cf;text-align:center;font-size:0.88em;">${typeCfg.label || key}</div>
            <div style="font-size:0.72em;color:${unlocked ? '#2ecc71' : '#e74c3c'};text-align:center;">${unlocked ? '✅ Unlocked' : '🔒 Locked'}</div>
        `;
        if (unlocked) {
            const acceptMap = { image: 'image/*', icon: 'image/*', sound: 'audio/*', music: 'audio/*', housing: 'image/*,application/json' };
            const fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.accept = acceptMap[key] || '*/*';
            fileInput.style.cssText = 'font-size:0.75em;color:var(--muted);cursor:pointer;';
            fileInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (!file) return;
                handleCreatorUpload(key, file);
            });
            card.appendChild(fileInput);
        }
        grid.appendChild(card);
    });

    container.appendChild(grid);
}

function handleCreatorUpload(type, file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        const data = e.target.result;
        appState.customRewards = appState.customRewards || [];
        const name = `[${type.toUpperCase()}] ${file.name}`;
        appState.customRewards.push({
            name,
            cost: 100,
            description: `Custom ${type} uploaded by creator.`,
            image: (type === 'image' || type === 'icon') ? data : null,
            fileType: type,
            fileName: file.name
        });
        saveToStorage();
        alert(`Uploaded: ${file.name}`);
        renderUploadedRewards();
        renderStore();
    };
    reader.readAsDataURL(file);
}

// ─── CARD BUILDER ──────────────────────────────────────────────────────────

function makeCard(item, isCustom, idx) {
    const card = document.createElement('div');
    card.className = 'store-card';
    const safeSrc = getSafeImageSrc(item.image);
    card.innerHTML = `
        <div style="flex: 0 0 64px; display:flex; align-items:center; justify-content:center;">
            ${safeSrc
                ? `<img src="${safeSrc}" alt="${item.name}" style="width:56px;height:56px;border-radius:8px;object-fit:contain;background:rgba(255,255,255,0.02)"/>`
                : `<img src="assets/gift.svg" alt="${item.name}" style="width:56px;height:56px;border-radius:8px;object-fit:contain;background:rgba(255,255,255,0.02)"/>`}
        </div>
        <div class="meta">
            <h4>${item.name}</h4>
            <p>${item.description || ''}</p>
        </div>
        <div class="actions">
            <div class="price">${item.cost} 🪙</div>
        </div>
    `;
    const buyBtn = document.createElement('button');
    buyBtn.className = 'btn-primary';
    buyBtn.textContent = 'Buy';
    buyBtn.onclick = () => { isCustom ? buyCustomReward(item.name, item.cost) : buyItem(item.name, item.cost); };
    card.querySelector('.actions').appendChild(buyBtn);

    if (isCustom && typeof idx === 'number') {
        const removeBtn = document.createElement('button');
        removeBtn.className = 'btn-secondary';
        removeBtn.style.marginTop = '8px';
        removeBtn.innerText = 'Remove';
        removeBtn.onclick = () => {
            if (confirm('Remove this uploaded reward?')) {
                appState.customRewards.splice(idx, 1);
                saveToStorage();
                renderStore();
                renderUploadedRewards();
            }
        };
        card.querySelector('.actions').appendChild(removeBtn);
    }
    return card;
}

// ─── MAIN RENDER STORE ─────────────────────────────────────────────────────

export function renderStore() {
    const storeContainer = document.getElementById('store-items-container');
    if (!storeContainer) return;
    storeContainer.innerHTML = '';

    ensureRewardSystemState(appState);
    const config = getDesignSystemConfig();

    renderInkExchange(storeContainer, config);
    renderInscriptionForge(storeContainer, config);
    renderArcanumOffers(storeContainer, config);
    renderBacklogExport(storeContainer, config);
    renderCreatorForge(storeContainer, config);

    const divider = document.createElement('hr');
    divider.style.cssText = 'border:none;border-top:1px solid rgba(255,255,255,0.04);margin:18px 0;';
    storeContainer.appendChild(divider);

    const defaultCatalog = [
        { name: 'Space Map Background', cost: 200, description: 'A starry background to make your map feel cosmic.', image: null },
        { name: 'Level Up Chime', cost: 80, description: 'A subtle chime when you level up.', image: null },
        { name: 'Rare Parchment Pack', cost: 120, description: 'A pack of mysterious parchment for rituals.', image: null }
    ];
    storeContainer.appendChild(makeSectionHeading('🛒', 'Catalog', 'Classic store items.'));
    defaultCatalog.forEach(item => storeContainer.appendChild(makeCard(item, false, null)));

    appState.customRewards = appState.customRewards || [];
    if (appState.customRewards.length > 0) {
        const divider2 = document.createElement('hr');
        divider2.style.cssText = 'border:none;border-top:1px solid rgba(255,255,255,0.04);margin:18px 0;';
        storeContainer.appendChild(divider2);
        storeContainer.appendChild(makeSectionHeading('📋', 'Uploaded Rewards', 'Custom rewards imported from Excel.'));
        appState.customRewards.forEach((reward, idx) => storeContainer.appendChild(makeCard(reward, true, idx)));
    }
}

// ─── UPLOADED REWARDS PANEL ────────────────────────────────────────────────

export function renderUploadedRewards() {
    const list = document.getElementById('uploaded-rewards-list');
    if (!list) return;
    list.innerHTML = '';
    appState.customRewards = appState.customRewards || [];

    if (appState.customRewards.length === 0) {
        list.innerHTML = '<div style="color: var(--muted);">No uploaded rewards yet.</div>';
        return;
    }

    appState.customRewards.forEach((r, i) => {
        const item = document.createElement('div');
        item.className = 'uploaded-item';
        const safeSrc = getSafeImageSrc(r.image);
        item.innerHTML = `
            ${safeSrc
                ? `<img src="${safeSrc}" alt="${r.name}" style="width:40px;height:40px;border-radius:6px;object-fit:contain;"/>`
                : `<img src="assets/parchment.svg" alt="${r.name}" style="width:40px;height:40px;border-radius:6px;object-fit:contain;"/>`}
            <div style="flex:1;">
                <div style="font-weight:700;color:#f5e9cf">${r.name}</div>
                <div style="font-size:0.85em;color:var(--muted)">${r.description || ''}</div>
            </div>
            <div style="display:flex;flex-direction:column;gap:6px;align-items:flex-end;">
                <div style="color: #ffb86b; font-weight:800;">${r.cost} 🪙</div>
                <div style="display:flex;gap:6px;">
                    <button class="btn-primary custom-buy-btn" data-index="${i}">Buy</button>
                    <button class="btn-secondary custom-del-btn" data-index="${i}">Del</button>
                </div>
            </div>
        `;
        const buyBtn = item.querySelector('.custom-buy-btn');
        if (buyBtn) buyBtn.onclick = () => buyCustomReward(r.name, r.cost);
        const delBtn = item.querySelector('.custom-del-btn');
        if (delBtn) delBtn.onclick = () => deleteUploadedReward(i);
        list.appendChild(item);
    });
}

// ─── UPLOADED REWARD MANAGEMENT ────────────────────────────────────────────

export function deleteUploadedReward(index) {
    if (!appState.customRewards || !appState.customRewards[index]) return;
    if (!confirm('Permanently delete this uploaded reward?')) return;
    appState.customRewards.splice(index, 1);
    saveToStorage();
    renderUploadedRewards();
    renderStore();
}

export function buyCustomReward(name, cost) {
    if (appState.gold >= cost) {
        appState.gold -= cost;
        appState.inventory.push(name);
        saveToStorage();
        alert(`Successfully purchased: ${name}!`);
        updateEconomyUI();
    } else {
        alert('Not enough Gold! Complete more tasks to earn rewards.');
    }
}

