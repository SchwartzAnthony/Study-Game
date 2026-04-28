/**
 * rewardSystem.js
 * Core reward engine: ink tiers, rarity rolls, shop offers,
 * crafting, upload gates, backlog generation and CSV export.
 */

import { appState } from './state.js';
import { saveToStorage } from './storage.js';
import { updateEconomyUI } from './economy.js';

// ─── INK TIER CONSTANTS ────────────────────────────────────────────────────

export const INK_TIERS = ['black', 'silver', 'gold', 'platinum', 'crimson', 'mythic'];

// Default weights used when config is not loaded yet
const DEFAULT_WEIGHTS = {
  black: 5500, silver: 2500, gold: 1200, platinum: 500, crimson: 299, mythic: 1
};

// ─── STATE GUARD ───────────────────────────────────────────────────────────

/**
 * Ensures appState.rewardSystem exists and is correctly shaped.
 * Called during app init alongside other ensureXxx guards.
 */
export function ensureRewardSystemState(state) {
  if (!state.rewardSystem || typeof state.rewardSystem !== 'object') {
    state.rewardSystem = {};
  }

  const rs = state.rewardSystem;

  // Ink balances
  if (!rs.ink || typeof rs.ink !== 'object') {
    rs.ink = { black: 0, silver: 0, gold: 0, platinum: 0, crimson: 0, mythic: 0 };
  }
  INK_TIERS.forEach(t => { if (typeof rs.ink[t] !== 'number') rs.ink[t] = 0; });

  // Daily ink purchase tracking  { date: 'YYYY-MM-DD', counts: { black: 0, … } }
  if (!rs.dailyInkPurchases || typeof rs.dailyInkPurchases !== 'object') {
    rs.dailyInkPurchases = { date: '', counts: {} };
  }

  // Current shop offers array
  if (!Array.isArray(rs.shopOffers)) rs.shopOffers = [];

  // Unlocked upload gates
  if (!rs.unlockedUploadTypes || typeof rs.unlockedUploadTypes !== 'object') {
    rs.unlockedUploadTypes = {
      image: false, icon: false, sound: false, music: false, housing: false
    };
  }

  // Claimed special rewards set (stored as array for JSON compat)
  if (!Array.isArray(rs.claimedRewardIds)) rs.claimedRewardIds = [];

  // Crafted item counts
  if (!rs.craftedItems || typeof rs.craftedItems !== 'object') {
    rs.craftedItems = {};
  }

  // Cumulative gold spent (for sound milestone tracking)
  if (typeof rs.cumulativeGoldSpent !== 'number') rs.cumulativeGoldSpent = 0;
}

// ─── SOUND MILESTONE CATALOG ─────────────────────────────────────────────

/**
 * Static catalog mapping reward IDs to display info.
 * Mirrors the soundMilestones block in reward-system.json.
 */
export const SOUND_REWARD_CATALOG = {
  light_scroll_sound:  { name: 'Echo of First Light',  file: 'assets/sounds/rewards/click2.ogg',    obtain: 'Craft 1 Light Scroll' },
  silver_scroll_sound: { name: 'Silver Resonance',     file: 'assets/sounds/rewards/switch12.ogg',  obtain: 'Craft 1 Silver Scroll' },
  gold_scroll_sound:   { name: 'Gilded Chime',         file: 'assets/sounds/rewards/switch30.ogg',  obtain: 'Craft 1 Gold Scroll' },
  gold_500_sound:      { name: "The Treasurer's Toll", file: 'assets/sounds/rewards/rollover6.ogg', obtain: 'Spend 500 Gold total (cumulative)' }
};

// Lazy-loaded earnReward to avoid circular imports
let _earnReward = null;
async function getEarnReward() {
  if (!_earnReward) {
    const mod = await import('./rewards-display.js');
    _earnReward = mod.earnReward;
  }
  return _earnReward;
}

/**
 * Check and grant sound rewards triggered by scroll crafting.
 * @param {string} recipeKey - the crafted recipe key
 */
async function checkScrollMilestoneRewards(recipeKey) {
  const earn = await getEarnReward();
  const earned = appState.earnedRewards;
  if (!earned) return;

  const scrollMap = {
    lightScroll:  'light_scroll_sound',
    silverScroll: 'silver_scroll_sound',
    goldScroll:   'gold_scroll_sound'
  };

  const rewardId = scrollMap[recipeKey];
  if (!rewardId) return;

  if (!earned.sounds.includes(rewardId)) {
    earn('sounds', rewardId);
    saveToStorage();
    _playMilestoneSound(SOUND_REWARD_CATALOG[rewardId].file);
  }
}

/**
 * Check and grant gold-spend sound reward.
 * @param {number} goldAmount - amount of gold just spent
 */
async function checkGoldSpentMilestones(goldAmount) {
  const rs = appState.rewardSystem;
  if (!rs) return;
  rs.cumulativeGoldSpent = (rs.cumulativeGoldSpent || 0) + goldAmount;

  const earn = await getEarnReward();
  const earned = appState.earnedRewards;
  if (!earned) return;

  if (rs.cumulativeGoldSpent >= 500 && !earned.sounds.includes('gold_500_sound')) {
    earn('sounds', 'gold_500_sound');
    saveToStorage();
    _playMilestoneSound(SOUND_REWARD_CATALOG.gold_500_sound.file);
  }
}

/**
 * Play a brief milestone unlock sound effect.
 * @param {string} filePath - relative path from app root
 */
function _playMilestoneSound(filePath) {
  try {
    const audio = new Audio(filePath);
    audio.volume = 0.5;
    audio.play().catch(() => {});
  } catch (_) {}
}

// ─── RARITY ROLL ──────────────────────────────────────────────────────────

/**
 * Rolls a rarity tier using weighted random selection.
 * @param {object} config - reward-system config (inkTiers property)
 * @returns {string} tier key
 */
export function rollRarity(config) {
  const tiers = (config && config.inkTiers) ? config.inkTiers : null;
  const totalWeight = (config && config.rarityTotalWeight) ? config.rarityTotalWeight : 10000;

  let roll = Math.random() * totalWeight;
  for (const tier of INK_TIERS) {
    const weight = tiers ? (tiers[tier]?.rarityWeight ?? DEFAULT_WEIGHTS[tier]) : DEFAULT_WEIGHTS[tier];
    roll -= weight;
    if (roll <= 0) return tier;
  }
  return 'black'; // fallback
}

// ─── DAILY LIMIT HELPERS ──────────────────────────────────────────────────

function getTodayDateString() {
  return new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD'
}

function getDailyCount(rs, tier) {
  const today = getTodayDateString();
  if (rs.dailyInkPurchases.date !== today) {
    rs.dailyInkPurchases = { date: today, counts: {} };
  }
  return rs.dailyInkPurchases.counts[tier] || 0;
}

function incrementDailyCount(rs, tier) {
  const today = getTodayDateString();
  if (rs.dailyInkPurchases.date !== today) {
    rs.dailyInkPurchases = { date: today, counts: {} };
  }
  rs.dailyInkPurchases.counts[tier] = (rs.dailyInkPurchases.counts[tier] || 0) + 1;
}

// ─── INK EXCHANGE ─────────────────────────────────────────────────────────

/**
 * Purchase one unit of a given ink tier with gold.
 * Enforces daily limits. Returns { ok, message }.
 */
export function buyInkWithGold(tier, config) {
  const rs = appState.rewardSystem;
  if (!rs) return { ok: false, message: 'Reward system not initialized.' };

  const tierCfg = config?.inkTiers?.[tier];
  const goldCost = tierCfg?.goldCost ?? 999;
  const dailyLimit = tierCfg?.dailyLimit ?? 1;

  if (appState.gold < goldCost) {
    return { ok: false, message: `Not enough Gold! You need ${goldCost} 🪙 but have ${appState.gold}.` };
  }

  const usedToday = getDailyCount(rs, tier);
  if (usedToday >= dailyLimit) {
    return { ok: false, message: `Daily limit reached for ${tier} ink (${dailyLimit}/day). Come back tomorrow.` };
  }

  appState.gold -= goldCost;
  rs.ink[tier] = (rs.ink[tier] || 0) + 1;
  incrementDailyCount(rs, tier);
  saveToStorage();
  updateEconomyUI();

  // Track gold spent for milestone rewards
  checkGoldSpentMilestones(goldCost);

  return { ok: true, message: `Purchased 1 ${tierCfg?.label ?? tier} ink for ${goldCost} 🪙.` };
}

// ─── CRAFTING ─────────────────────────────────────────────────────────────

/**
 * Attempt to craft an item from a recipe key.
 * Returns { ok, message }.
 */
export function craftItem(recipeKey, config) {
  const rs = appState.rewardSystem;
  if (!rs) return { ok: false, message: 'Reward system not initialized.' };

  const recipe = config?.craftingRecipes?.[recipeKey];
  if (!recipe) return { ok: false, message: `Unknown recipe: ${recipeKey}` };

  // Check materials
  const missing = [];
  const mats = recipe.materials || {};

  for (const [matKey, required] of Object.entries(mats)) {
    let have = 0;
    if (matKey === 'pages') {
      have = appState.crafting?.pages ?? 0;
    } else if (matKey.endsWith('Ink')) {
      const inkTier = matKey.replace('Ink', '').toLowerCase();
      have = rs.ink?.[inkTier] ?? 0;
    }
    if (have < required) {
      missing.push(`${required} ${matKey} (have ${have})`);
    }
  }

  if (missing.length > 0) {
    return { ok: false, message: `Missing materials: ${missing.join(', ')}` };
  }

  // Deduct materials
  for (const [matKey, required] of Object.entries(mats)) {
    if (matKey === 'pages') {
      appState.crafting.pages -= required;
    } else if (matKey.endsWith('Ink')) {
      const inkTier = matKey.replace('Ink', '').toLowerCase();
      rs.ink[inkTier] -= required;
    }
  }

  // Award output
  const output = recipe.output || {};
  if (output.scrolls) {
    // Store scrolls in appState.paper (using rarity as key)
    const scrollKey = `${output.scrollRarity || 'light'}Scroll`;
    appState.paper = appState.paper || {};
    appState.paper[scrollKey] = (appState.paper[scrollKey] || 0) + output.scrolls;
  }
  if (output.books) {
    const rarity = output.bookRarity || 'common';
    appState.crafting = appState.crafting || {};
    appState.crafting.books = appState.crafting.books || {};
    appState.crafting.books[rarity] = (appState.crafting.books[rarity] || 0) + output.books;
    appState.crafting.inscriptionsCompleted = (appState.crafting.inscriptionsCompleted || 0) + 1;
  }

  // Track crafted item
  rs.craftedItems[recipeKey] = (rs.craftedItems[recipeKey] || 0) + 1;

  saveToStorage();
  updateEconomyUI();

  // Check for sound milestone rewards
  checkScrollMilestoneRewards(recipeKey);

  return { ok: true, message: `${recipe.emoji ?? '✅'} Crafted: ${recipe.label}!` };
}

// ─── SHOP OFFERS ──────────────────────────────────────────────────────────

// Internal cache so we don't regenerate on every render call
let _backlogCache = null;

/**
 * Generates the full 1000-item backlog from config templates.
 */
export function generateBacklog(config) {
  if (_backlogCache) return _backlogCache;

  const templates = config?.backlogItemTemplates ?? [
    { type: 'cosmetic', namePrefix: 'Arcane Sigil', descPrefix: 'A rare cosmetic glyph', baseCost: 50 }
  ];
  const count = config?.backlogCount ?? 1000;
  const backlog = [];

  for (let i = 0; i < count; i++) {
    const template = templates[i % templates.length];
    const num = i + 1;
    // Rarity-influenced cost variation
    const roll = rollRarity(config);
    const rarityMultiplier = { black: 1, silver: 1.5, gold: 2.5, platinum: 4, crimson: 7, mythic: 20 }[roll] ?? 1;
    const finalCost = Math.round(template.baseCost * rarityMultiplier);

    backlog.push({
      id: `backlog_${i}`,
      name: `${template.namePrefix} #${num}`,
      description: `${template.descPrefix} of ${roll} rarity.`,
      type: template.type,
      rarity: roll,
      cost: finalCost,
      currency: 'gold'
    });
  }

  _backlogCache = backlog;
  return backlog;
}

/**
 * Generate N random shop offers from the backlog.
 */
function generateShopOffers(config) {
  const backlog = generateBacklog(config);
  const count = config?.shopOfferCount ?? 6;
  const shuffled = backlog.slice().sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

/**
 * Returns current shop offers; auto-refills instantly when empty.
 */
export function getOrRefillOffers(config) {
  const rs = appState.rewardSystem;
  if (!rs) return [];

  if (!rs.shopOffers || rs.shopOffers.length === 0) {
    rs.shopOffers = generateShopOffers(config);
    saveToStorage();
  }
  return rs.shopOffers;
}

/**
 * Buy a random shop offer by its id.
 * Returns { ok, message }.
 */
export function buyShopOffer(offerId, config) {
  const rs = appState.rewardSystem;
  if (!rs) return { ok: false, message: 'Reward system not initialized.' };

  const offers = rs.shopOffers || [];
  const idx = offers.findIndex(o => o.id === offerId);
  if (idx === -1) return { ok: false, message: 'Offer not found.' };

  const offer = offers[idx];

  if (appState.gold < offer.cost) {
    return { ok: false, message: `Not enough Gold! Need ${offer.cost} 🪙.` };
  }

  appState.gold -= offer.cost;
  appState.inventory = appState.inventory || [];
  appState.inventory.push(offer.name);

  // Remove purchased offer — triggers instant refill on next render
  rs.shopOffers.splice(idx, 1);
  saveToStorage();
  updateEconomyUI();

  // Track gold spent for milestone rewards
  checkGoldSpentMilestones(offer.cost);

  return { ok: true, message: `Purchased: ${offer.name}!` };
}

// ─── UPLOAD GATES ─────────────────────────────────────────────────────────

/**
 * Claim a special reward that unlocks an upload type.
 * @param {string} rewardId  - e.g. 'upload_image_gate'
 * @param {object} config    - reward-system config
 */
export function claimUnlockedReward(rewardId, config) {
  const rs = appState.rewardSystem;
  if (!rs) return { ok: false, message: 'Reward system not initialized.' };

  if (rs.claimedRewardIds.includes(rewardId)) {
    return { ok: false, message: 'Already claimed.' };
  }

  rs.claimedRewardIds.push(rewardId);

  // Map reward id to upload type
  const uploadTypes = config?.uploadTypes ?? {};
  for (const [typeKey, typeCfg] of Object.entries(uploadTypes)) {
    if (typeCfg.unlockRewardId === rewardId) {
      rs.unlockedUploadTypes[typeKey] = true;
    }
  }

  saveToStorage();
  return { ok: true, message: `Upload gate unlocked: ${rewardId}` };
}

/**
 * Returns the current upload gate status map.
 * e.g. { image: true, icon: false, sound: false, music: false, housing: true }
 */
export function getUploadGates() {
  const rs = appState.rewardSystem;
  if (!rs || !rs.unlockedUploadTypes) {
    return { image: false, icon: false, sound: false, music: false, housing: false };
  }
  return { ...rs.unlockedUploadTypes };
}

// ─── CSV EXPORT ───────────────────────────────────────────────────────────

/**
 * Generate the full backlog and trigger a CSV download in the browser.
 */
export function downloadBacklogCSV(config) {
  const backlog = generateBacklog(config);

  const header = ['id', 'name', 'description', 'type', 'rarity', 'cost', 'currency'];
  const rows = backlog.map(item =>
    header.map(col => {
      const val = String(item[col] ?? '');
      // Escape double-quotes per CSV spec
      return `"${val.replace(/"/g, '""')}"`;
    }).join(',')
  );

  const csv = [header.join(','), ...rows].join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'reward-backlog.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
