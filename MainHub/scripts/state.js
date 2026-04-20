// Upgraded Game State with Hubs & Magician Economy
export const appState = {
    hubs: [],
    currentHubIndex: 0,
    gold: 0,
    ink: 0,
    paper: {},
    library: [],
    inventory: [],
    customRewards: [] // New field for uploaded rewards
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