// --- UNIQUE MAP PATH GENERATOR ---
export function generateMapCoordinates(numNodes) {
    let coords = []; let currentX = 50; let currentY = 50;
    let safeZone = Math.max(6, 18 - (numNodes * 0.3));

    for (let i = 0; i < numNodes; i++) {
        let nextX, nextY, validSpot = false, attempts = 0;
        while (!validSpot && attempts < 1000) {
            let angle = Math.random() * Math.PI * 2;
            let jump = (attempts < 100) ? (15 + Math.random() * 15) : (20 + Math.random() * 30);
            let baseX = currentX, baseY = currentY;
            if (attempts > 300 && coords.length > 0) {
                let randomPastNode = coords[Math.floor(Math.random() * coords.length)];
                baseX = randomPastNode.x; baseY = randomPastNode.y;
            }
            nextX = baseX + Math.cos(angle) * jump; nextY = baseY + Math.sin(angle) * jump;

            if (nextX < 10) nextX = 10 + Math.random() * 5; if (nextX > 90) nextX = 90 - Math.random() * 5;
            if (nextY < 10) nextY = 10 + Math.random() * 5; if (nextY > 90) nextY = 90 - Math.random() * 5;

            validSpot = true;
            for (let j = 0; j < coords.length; j++) {
                let dist = Math.sqrt(Math.pow(nextX - coords[j].x, 2) + Math.pow(nextY - coords[j].y, 2));
                if (dist < safeZone) { validSpot = false; break; }
            }
            attempts++;
        }
        if (!validSpot) { nextX = Math.random() * 80 + 10; nextY = Math.random() * 80 + 10; }
        coords.push({ x: nextX, y: nextY });
        currentX = nextX; currentY = nextY;
    }
    return coords;
}