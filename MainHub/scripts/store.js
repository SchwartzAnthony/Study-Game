import { appState, getSafeImageSrc } from './state.js';
import { awardGold, awardInk, awardPaper, updateEconomyUI } from './economy.js';
import { saveToStorage } from './storage.js';

// --- STORE LOGIC ---
const storeModal = document.getElementById('store-modal');
// Update this line in your app.js
if(document.getElementById('btn-open-store')) {
    document.getElementById('btn-open-store').addEventListener('click', () => {
        renderStore(); // <--- Add this call here
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

function buyItem(itemName, cost) {
    if (appState.gold >= cost) {
        if (appState.inventory.includes(itemName)) return alert("You already own this item!");
        appState.gold -= cost; appState.inventory.push(itemName); saveToStorage(); alert(`Successfully purchased ${itemName}!`);
    } else alert(`Not enough Gold! Play more Mini-Games!`);
}

function tradeForSpecialPaper(specialPaperName, paperCost) {
    let totalPaper = 0;
    if (appState.paper) Object.values(appState.paper).forEach(count => totalPaper += count);
    
    if (totalPaper >= paperCost) {
        let paperToDeduct = paperCost;
        for (let paperName in appState.paper) {
            if (paperToDeduct <= 0) break;
            let available = appState.paper[paperName];
            if (available > 0) {
                let deduct = Math.min(available, paperToDeduct);
                appState.paper[paperName] -= deduct; paperToDeduct -= deduct;
            }
        }
        appState.paper[specialPaperName] = (appState.paper[specialPaperName] || 0) + 1;
        saveToStorage(); alert(`🔥 Trade successful! You bound ${paperCost} basic parchments into 1 [${specialPaperName}]!`);
    } else alert(`Not enough Paper! You need ${paperCost - totalPaper} more. Pass Quizzes and Exams to earn them!`);
}

// --- ADDED CUSTOM REWARD RENDERING ---
function renderStore() {
    // Note: Ensure you have an element with this ID in your index.html store modal
    const storeContainer = document.getElementById('store-items-container');
    if (!storeContainer) return;

    // Optional: Clear container if you want to re-render from scratch
    storeContainer.innerHTML = '';

    // Small default catalog so the store never looks empty
    const defaultCatalog = [
        { name: 'Space Map Background', cost: 200, description: 'A starry background to make your map feel cosmic.', image: null },
        { name: 'Level Up Chime', cost: 80, description: 'A subtle chime when you level up.', image: null },
        { name: 'Rare Parchment Pack', cost: 120, description: 'A pack of mysterious parchment for rituals.', image: null }
    ];

    function getSafeImageSrc(img) {
        if (!img) return null;
        try {
            let s = String(img).trim();
            // remove any internal whitespace/newlines which break data URLs
            s = s.replace(/\s+/g, '');
            // data URL with explicit base64
            const dataUrlMatch = s.match(/^data:image\/[a-zA-Z0-9.+-]+;base64,(.+)$/);
            if (dataUrlMatch) {
                const payload = dataUrlMatch[1];
                if (!/^[A-Za-z0-9+/=]+$/.test(payload)) return null;
                return 'data:' + s.split(',')[0] + ',' + payload;
            }
            // http(s) or relative path
            if (/^https?:\/\//i.test(s) || /^\//.test(s) || /^\.\//.test(s)) return s;
        } catch (e) {
            return null;
        }
        return null;
    }

    function makeCard(item, isCustom=false, idx=null) {
        const card = document.createElement('div');
        card.className = 'store-card';
        const safeSrc = getSafeImageSrc(item.image);
        card.innerHTML = `
            <div style="flex: 0 0 64px; display:flex; align-items:center; justify-content:center;">
                ${ safeSrc ? `<img src="${safeSrc}" alt="${item.name}" style=\"width:56px;height:56px;border-radius:8px;object-fit:contain;background:rgba(255,255,255,0.02)\"/>` : `<img src=\"assets/gift.svg\" alt=\"${item.name}\" style=\"width:56px;height:56px;border-radius:8px;object-fit:contain;background:rgba(255,255,255,0.02)\"/>` }
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
            // small remove control for custom uploads
            const removeBtn = document.createElement('button');
            removeBtn.className = 'btn-secondary';
            removeBtn.style.marginTop = '8px';
            removeBtn.innerText = 'Remove';
            removeBtn.onclick = () => { if (confirm('Remove this uploaded reward?')) { appState.customRewards.splice(idx,1); saveToStorage(); renderStore(); renderUploadedRewards(); } };
            card.querySelector('.actions').appendChild(removeBtn);
        }
        return card;
    }

    // Render default catalog
    defaultCatalog.forEach(item => storeContainer.appendChild(makeCard(item, false, null)));

    // Divider
    const divider = document.createElement('hr'); divider.style.borderColor = 'rgba(255,255,255,0.03)'; divider.style.margin = '12px 0';
    storeContainer.appendChild(divider);

    // Render custom rewards (uploaded)
    appState.customRewards = appState.customRewards || [];
    appState.customRewards.forEach((reward, idx) => {
        storeContainer.appendChild(makeCard(reward, true, idx));
    });
}

// Render uploaded rewards list (right-side panel)
function renderUploadedRewards() {
    const list = document.getElementById('uploaded-rewards-list');
    if (!list) return;
    list.innerHTML = '';
    appState.customRewards = appState.customRewards || [];
    if (appState.customRewards.length === 0) {
        list.innerHTML = '<div style="color: var(--muted);">No uploaded rewards yet.</div>';
        return;
    }

    appState.customRewards.forEach((r, i) => {
        const item = document.createElement('div'); item.className = 'uploaded-item';
        const safeSrc = (typeof getSafeImageSrc === 'function') ? getSafeImageSrc(r.image) : null;
        item.innerHTML = `
            ${ safeSrc ? `<img src="${safeSrc}" alt="${r.name}" style=\"width:40px;height:40px;border-radius:6px;object-fit:contain;\"/>` : `<img src=\"assets/parchment.svg\" alt=\"${r.name}\" style=\"width:40px;height:40px;border-radius:6px;object-fit:contain;\"/>` }
            <div style="flex:1;">
                <div style="font-weight:700;color:#f5e9cf">${r.name}</div>
                <div style="font-size:0.85em;color:var(--muted)">${r.description || ''}</div>
            </div>
            <div style="display:flex;flex-direction:column;gap:6px;align-items:flex-end;">
                <div style="color: #ffb86b; font-weight:800;">${r.cost} 🪙</div>
                <div style="display:flex;gap:6px;">
                    <button class="btn-primary custom-buy-btn" data-index="${i}">Buy</button><button class="btn-secondary custom-del-btn" data-index="${i}">Del</button>
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

function deleteUploadedReward(index) {
    if (!appState.customRewards || !appState.customRewards[index]) return;
    if (!confirm('Permanently delete this uploaded reward?')) return;
    appState.customRewards.splice(index, 1);
    saveToStorage(); renderUploadedRewards(); renderStore();
}

function buyCustomReward(name, cost) {
    if (appState.gold >= cost) {
        appState.gold -= cost;
        appState.inventory.push(name);
        saveToStorage();
        alert(`Successfully purchased: ${name}!`);
        updateEconomyUI();
    } else {
        alert("Not enough Gold! Complete more tasks to earn rewards.");
    }
}


export { buyItem, renderStore, renderUploadedRewards, deleteUploadedReward, buyCustomReward };

