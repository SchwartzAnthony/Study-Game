const DEFAULT_DESIGN_CONFIG = {
  economyRates: {
    version: 1,
    sources: {
      void: { goldPerScroll: 1, inkPerScrolls: 10, scrollPerScrolls: 20 },
      speedRead: { goldPerPages: 1, inkPerPages: 1, scrollPerPages: 1, wordsPerPage: 250 }
    },
    sinks: {
      housing: { slotUnlockBaseGold: 120, slotUnlockGrowth: 1.35, themeSwitchGold: 40 },
      crafting: { inkPerPageInscription: 1 }
    }
  },
  rewardTables: { version: 1, bookTradeIn: {}, milestoneRewards: {} },
  bookCrafting: { version: 1, pageSources: {}, tiers: {} },
  housingCatalog: { version: 1, themes: [], items: [] },
  milestones90Day: { version: 1, days: [] },
  rewardSystem: {
    version: 1,
    inkTiers: {},
    rarityTotalWeight: 10000,
    craftingRecipes: {},
    shopOfferCount: 6,
    backlogCount: 1000,
    uploadTypes: {},
    backlogItemTemplates: []
  }
};

const DESIGN_CONFIG_FILES = {
  economyRates: './config/economy-rates.json',
  rewardTables: './config/reward-tables.json',
  bookCrafting: './config/book-crafting.json',
  housingCatalog: './config/housing-catalog.json',
  milestones90Day: './config/milestones-90-day.json',
  rewardSystem: './config/reward-system.json'
};

let runtimeDesignConfig = JSON.parse(JSON.stringify(DEFAULT_DESIGN_CONFIG));

function deepMerge(target, source) {
  if (!source || typeof source !== 'object') return target;
  Object.keys(source).forEach((key) => {
    const sv = source[key];
    const tv = target[key];
    if (Array.isArray(sv)) {
      target[key] = sv.slice();
    } else if (sv && typeof sv === 'object') {
      target[key] = deepMerge(tv && typeof tv === 'object' ? tv : {}, sv);
    } else {
      target[key] = sv;
    }
  });
  return target;
}

function cloneDefaults() {
  return JSON.parse(JSON.stringify(DEFAULT_DESIGN_CONFIG));
}

export async function loadDesignSystemConfig() {
  const merged = cloneDefaults();

  await Promise.all(Object.entries(DESIGN_CONFIG_FILES).map(async ([key, path]) => {
    try {
      const response = await fetch(path + '?t=' + Date.now());
      if (!response.ok) return;
      const data = await response.json();
      merged[key] = deepMerge(merged[key] || {}, data || {});
    } catch (err) {
      console.warn('Design config load failed for', path, err);
    }
  }));

  runtimeDesignConfig = merged;
  return runtimeDesignConfig;
}

export function getDesignSystemConfig() {
  return runtimeDesignConfig;
}

export function ensureDesignSystemState(appState) {
  if (!appState.crafting || typeof appState.crafting !== 'object') {
    appState.crafting = {
      pages: 0,
      books: { common: 0, rare: 0, legendary: 0 },
      inscriptionsCompleted: 0
    };
  }

  if (!appState.crafting.books || typeof appState.crafting.books !== 'object') {
    appState.crafting.books = { common: 0, rare: 0, legendary: 0 };
  }

  if (!appState.housing || typeof appState.housing !== 'object') {
    appState.housing = {
      selectedTheme: 'obsidian-ritual',
      slotCapacity: 8,
      slotsUsed: 0,
      styleScore: 0,
      unlockTier: 1,
      ownedDecorIds: [],
      placedDecor: []
    };
  }

  if (!Array.isArray(appState.housing.ownedDecorIds)) appState.housing.ownedDecorIds = [];
  if (!Array.isArray(appState.housing.placedDecor)) appState.housing.placedDecor = [];

  if (!appState.progression || typeof appState.progression !== 'object') {
    appState.progression = {
      dayTrack: 1,
      milestonesClaimed: [],
      loops: {
        voidScrolledLifetime: 0,
        booksCraftedLifetime: 0,
        housingPurchasesLifetime: 0
      }
    };
  }

  if (!Array.isArray(appState.progression.milestonesClaimed)) appState.progression.milestonesClaimed = [];
  if (!appState.progression.loops || typeof appState.progression.loops !== 'object') {
    appState.progression.loops = {
      voidScrolledLifetime: 0,
      booksCraftedLifetime: 0,
      housingPurchasesLifetime: 0
    };
  }

  // Reward system state guard
  if (!appState.rewardSystem || typeof appState.rewardSystem !== 'object') {
    appState.rewardSystem = {};
  }
  const rs = appState.rewardSystem;
  const inkTiers = ['black', 'silver', 'gold', 'platinum', 'crimson', 'mythic'];
  if (!rs.ink || typeof rs.ink !== 'object') {
    rs.ink = { black: 0, silver: 0, gold: 0, platinum: 0, crimson: 0, mythic: 0 };
  }
  inkTiers.forEach(t => { if (typeof rs.ink[t] !== 'number') rs.ink[t] = 0; });
  if (!rs.dailyInkPurchases || typeof rs.dailyInkPurchases !== 'object') {
    rs.dailyInkPurchases = { date: '', counts: {} };
  }
  if (!Array.isArray(rs.shopOffers)) rs.shopOffers = [];
  if (!rs.unlockedUploadTypes || typeof rs.unlockedUploadTypes !== 'object') {
    rs.unlockedUploadTypes = { image: false, icon: false, sound: false, music: false, housing: false };
  }
  if (!Array.isArray(rs.claimedRewardIds)) rs.claimedRewardIds = [];
  if (!rs.craftedItems || typeof rs.craftedItems !== 'object') rs.craftedItems = {};

  // Asset library state guard
  if (!appState.assetLibrary || typeof appState.assetLibrary !== 'object') {
    appState.assetLibrary = {};
  }
  const al = appState.assetLibrary;
  if (!Array.isArray(al.sprites))      al.sprites      = [];
  if (!Array.isArray(al.spriteSheets)) al.spriteSheets = [];
  if (!Array.isArray(al.wallpapers))   al.wallpapers   = [];
  if (!Array.isArray(al.imageRewards)) al.imageRewards = [];
  if (!Array.isArray(al.soundRewards)) al.soundRewards = [];
  if (!Array.isArray(al.musicRewards)) al.musicRewards = [];
  if (!Array.isArray(al.achievements)) al.achievements = [];

  // Earned rewards state guard
  if (!appState.earnedRewards || typeof appState.earnedRewards !== 'object') {
    appState.earnedRewards = { sounds: [], music: [], temples: [], buttons: [], wallpapers: [], objects: [] };
  }
  const er = appState.earnedRewards;
  if (!Array.isArray(er.sounds))     er.sounds     = [];
  if (!Array.isArray(er.music))      er.music      = [];
  if (!Array.isArray(er.temples))    er.temples    = [];
  if (!Array.isArray(er.buttons))    er.buttons    = [];
  if (!Array.isArray(er.wallpapers)) er.wallpapers = [];
  if (!Array.isArray(er.objects))    er.objects    = [];

  // Earned achievements state guard
  if (!appState.earnedAchievements || typeof appState.earnedAchievements !== 'object') {
    appState.earnedAchievements = { completed: [], available: [] };
  }
  const ea = appState.earnedAchievements;
  if (!Array.isArray(ea.completed)) ea.completed = [];
  if (!Array.isArray(ea.available)) ea.available = [];
}
