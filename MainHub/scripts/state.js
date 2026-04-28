// Upgraded Game State with Hubs & Magician Economy
export const appState = {
    hubs: [],
    currentHubIndex: 0,
    gold: 0,
    ink: 0,
    paper: {},
    library: [],
    inventory: [],
    customRewards: [], // New field for uploaded rewards
    streak: 0,           // Days in a row with at least one flashcard review
    lastReviewDate: null,  // Last date a review was completed (toDateString())
    scholarXP: 0,        // Total words read across all sessions
    scholarLevel: 1,     // Derived from scholarXP; displayed as a badge
    owlMentor: { tips: [], tipIndex: 0, lastWorldName: null },
    crafting: {
        pages: 0,
        books: { common: 0, rare: 0, legendary: 0 },
        inscriptionsCompleted: 0
    },
    housing: {
        selectedTheme: 'obsidian-ritual',
        slotCapacity: 8,
        slotsUsed: 0,
        styleScore: 0,
        unlockTier: 1,
        ownedDecorIds: [],
        placedDecor: []
    },
    progression: {
        dayTrack: 1,
        milestonesClaimed: [],
        loops: {
            voidScrolledLifetime: 0,
            booksCraftedLifetime: 0,
            housingPurchasesLifetime: 0
        }
    },
    reminderSettings: {
        enabled: true,
        dailyLimit: 12,
        randomFactor: 0.65,
        burnThreshold: 8
    },
    reminderRuntime: {
        dailyShown: {},
        voidProgress: { scrolledCount: 0 }
    },
    assetLibrary: {
        // Extracted individual sprites from uploaded sprite sheets
        sprites: [],
        // Uploaded sprite sheet metadata (original image + detected grid)
        spriteSheets: [],
        // Uploaded temple/room wallpapers for housing backgrounds
        wallpapers: [],
        // Uploaded PNG images linked to one or many game reward entries
        imageRewards: [],
        // Uploaded sound effects (base64 audio files)
        soundRewards: [],
        // Uploaded music tracks (base64 audio files)
        musicRewards: [],
        // Achievement definitions
        achievements: []
    },
    earnedRewards: {
        // Reward IDs earned by the user
        sounds: [],
        music: [],
        temples: [],
        buttons: [],
        wallpapers: [],
        objects: []
    },
    earnedAchievements: {
        // Achievement IDs completed by the user
        completed: [],
        // Achievement IDs not yet completed
        available: []
    }
};

// Image sanitizer helper (global) — strips whitespace, validates base64 payloads and allows http/relative paths
export function getSafeImageSrc(img) {
    if (!img) return null;
    try {
        let s = String(img).trim();
        s = s.replace(/\s+/g, '');
        const dataUrlMatch = s.match(/^data:image\/[a-zA-Z0-9.+-]+;base64,(.+)$/);
        if (dataUrlMatch) {
            const payload = dataUrlMatch[1];
            if (!/^[A-Za-z0-9+/=]+$/.test(payload)) return null;
            return 'data:' + s.split(',')[0] + ',' + payload;
        }
        if (/^https?:\/\//i.test(s) || /^\//.test(s) || /^\.\//.test(s)) return s;
    } catch (e) {
        return null;
    }
    return null;
}