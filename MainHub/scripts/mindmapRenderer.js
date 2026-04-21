export function initMindMap(appState) {
    const canvas = document.getElementById('mindmap-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    // Resize handling
    function resizeCanvas() {
        const parent = canvas.parentElement || document.body;
        canvas.width = parent.clientWidth || window.innerWidth;
        canvas.height = parent.clientHeight || window.innerHeight;
    }
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    // Data structures
    let nodes = [];
    let links = [];
    let camera = { x: 0, y: 0, zoom: 1 };

    // Build the graph
    function buildGraph() {
        let initialZoom = window.innerWidth <= 768 ? 0.45 : 1;
        camera = { 
            zoom: initialZoom, 
            x: (canvas.width / 2) * (1 - initialZoom), 
            y: (canvas.height / 2) * (1 - initialZoom) 
        };
        nodes = [];
        links = [];
        const root = { id: 'root', label: 'Self', x: canvas.width / 2, y: canvas.height / 2, vx: 0, vy: 0, radius: 35, mass: 2, color: '#f39c12', fixed: true };
        nodes.push(root);

        if (appState && appState.hubs) {
            appState.hubs.forEach((hub, hIndex) => {
                const hubId = `hub_${hIndex}`;
                // randomize start slightly around center
                const hNode = { 
                    id: hubId, label: hub.name || 'Athenaeum',
                    x: (canvas.width / 2) + (Math.random() * 200 - 100), 
                    y: (canvas.height / 2) + (Math.random() * 200 - 100),
                    vx: 0, vy: 0, radius: 20, mass: 1.5, color: '#8e44ad', fixed: false,
                    hubIndex: hIndex
                };
                nodes.push(hNode);
                links.push({ source: root, target: hNode, idealLength: 180 });

                if (hub.worlds) {
                    hub.worlds.forEach((world, wIndex) => {
                        const worldId = `world_${hIndex}_${wIndex}`;
                        const wNode = {
                            id: worldId, label: world.name || world.title || 'World',
                            x: hNode.x + (Math.random() * 100 - 50),
                            y: hNode.y + (Math.random() * 100 - 50),
                            vx: 0, vy: 0, radius: 15, mass: 1, color: '#2980b9', fixed: false,
                            hubIndex: hIndex, worldIndex: wIndex
                        };
                        nodes.push(wNode);
                        links.push({ source: hNode, target: wNode, idealLength: 120 });
                    });
                }
            });
        }
    }
    
    buildGraph();

    // Physics parameters
    const K = 0.05; // spring constant
    const REPULSION = 8000;
    const DAMPING = 0.85; // friction

    function applyPhysics() {
        // Repulsion
        for (let i = 0; i < nodes.length; i++) {
            for (let j = i + 1; j < nodes.length; j++) {
                const n1 = nodes[i];
                const n2 = nodes[j];
                const dx = n1.x - n2.x;
                const dy = n1.y - n2.y;
                let distSq = dx * dx + dy * dy;
                if (distSq === 0) distSq = 1;
                const dist = Math.sqrt(distSq);
                
                // Repulsive force proportional to 1/dist^2
                const force = REPULSION / distSq;
                
                const fx = (force * dx) / dist;
                const fy = (force * dy) / dist;

                n1.vx += fx / n1.mass;
                n1.vy += fy / n1.mass;
                n2.vx -= fx / n2.mass;
                n2.vy -= fy / n2.mass;
            }
        }

        // Attraction (Springs)
        links.forEach(link => {
            const n1 = link.source;
            const n2 = link.target;
            const dx = n2.x - n1.x;
            const dy = n2.y - n1.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            
            // Hooke's Law: F = K * (dist - idealLength)
            const force = K * (dist - link.idealLength);
            
            const fx = (force * dx) / dist;
            const fy = (force * dy) / dist;

            n1.vx += fx / n1.mass;
            n1.vy += fy / n1.mass;
            n2.vx -= fx / n2.mass;
            n2.vy -= fy / n2.mass;
        });

        // Update positions & apply center gravity to prevent drifting too far
        const rootNode = nodes.find(n => n.id === 'root');
        const cx = rootNode ? rootNode.x : canvas.width / 2;
        const cy = rootNode ? rootNode.y : canvas.height / 2;
        
        nodes.forEach(n => {
            // weak center gravity
            const dx = cx - n.x;
            const dy = cy - n.y;
            n.vx += (dx * 0.005);
            n.vy += (dy * 0.005);

            n.vx *= DAMPING;
            n.vy *= DAMPING;

            if (!n.fixed) {
                n.x += n.vx;
                n.y += n.vy;
            }
        });
    }

    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.save();
        ctx.translate(camera.x, camera.y);
        ctx.scale(camera.zoom, camera.zoom);

        // Draw links
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#aaaaaa';
        links.forEach(link => {
            ctx.beginPath();
            ctx.moveTo(link.source.x, link.source.y);
            ctx.lineTo(link.target.x, link.target.y);
            ctx.stroke();
        });

        // Draw nodes
        nodes.forEach(n => {
            if (n.id === 'root') {
                // Draw a Star
                const spikes = 5;
                const outerRadius = n.radius;
                const innerRadius = n.radius / 2;
                let rot = Math.PI / 2 * 3;
                const step = Math.PI / spikes;

                ctx.beginPath();
                ctx.moveTo(n.x, n.y - outerRadius);
                for (let i = 0; i < spikes; i++) {
                    ctx.lineTo(n.x + Math.cos(rot) * outerRadius, n.y + Math.sin(rot) * outerRadius);
                    rot += step;
                    ctx.lineTo(n.x + Math.cos(rot) * innerRadius, n.y + Math.sin(rot) * innerRadius);
                    rot += step;
                }
                ctx.lineTo(n.x, n.y - outerRadius);
                ctx.closePath();
                ctx.fillStyle = n.color;
                ctx.fill();
                ctx.lineWidth = 2;
                ctx.strokeStyle = '#fbbf24'; // Glowy edge
                ctx.stroke();
            } else {
                // Draw an upright Book
                const width = n.radius * 1.5;
                const height = n.radius * 2;
                const bx = n.x - width / 2;
                const by = n.y - height / 2;

                ctx.beginPath();
                ctx.rect(bx, by, width, height);
                ctx.fillStyle = n.color;
                ctx.fill();

                // Book borders and pages definition
                ctx.lineWidth = 2;
                ctx.strokeStyle = '#222';
                ctx.strokeRect(bx, by, width, height);
                
                // Pages effect on the right side
                ctx.fillStyle = '#f0e6d2'; // offwhite
                ctx.fillRect(bx + width - 6, by + 2, 6, height - 4);
                
                // Spine details on the left
                ctx.beginPath();
                ctx.moveTo(bx + 4, by);
                ctx.lineTo(bx + 4, by + height);
                ctx.strokeStyle = 'rgba(0,0,0,0.5)';
                ctx.stroke();
            }

            // Label
            ctx.fillStyle = '#ffffff';
            ctx.font = '14px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            // truncate label if too long
            const label = n.label.length > 15 ? n.label.substring(0, 12) + '...' : n.label;
            ctx.fillText(label, n.x, n.y + n.radius + 15);
        });

        ctx.restore();
    }

    // Interaction
    let draggedNode = null;
    let hoveredNode = null;
    let isDragging = false;
    let isPanning = false;
    let startX, startY;
    let lastPanX, lastPanY;

    function toWorld(screenX, screenY) {
        return {
            x: (screenX - camera.x) / camera.zoom,
            y: (screenY - camera.y) / camera.zoom
        };
    }

    canvas.addEventListener('pointerdown', (e) => {
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const worldPos = toWorld(mouseX, mouseY);

        draggedNode = null;
        for (let i = nodes.length - 1; i >= 0; i--) {
            const n = nodes[i];
            const dx = worldPos.x - n.x;
            const dy = worldPos.y - n.y;
            const hitRadius = n.radius * 1.5;
            if (dx * dx + dy * dy < hitRadius * hitRadius) {
                draggedNode = n;
                isDragging = true;
                n.fixed = true;
                startX = e.clientX;
                startY = e.clientY;
                document.body.style.cursor = 'grabbing';
                break;
            }
        }
        
        if (!draggedNode) {
            isPanning = true;
            lastPanX = mouseX;
            lastPanY = mouseY;
            document.body.style.cursor = 'move';
        }
    });

    canvas.addEventListener('pointermove', (e) => {
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const worldPos = toWorld(mouseX, mouseY);

        // Find hovered node
        hoveredNode = null;
        for (let i = nodes.length - 1; i >= 0; i--) {
            const n = nodes[i];
            const dx = worldPos.x - n.x;
            const dy = worldPos.y - n.y;
            const hitRadius = n.radius * 1.5;
            if (dx * dx + dy * dy < hitRadius * hitRadius) {
                hoveredNode = n;
                break;
            }
        }

        if (isDragging && draggedNode) {
            document.body.style.cursor = 'grabbing';
            draggedNode.x = worldPos.x;
            draggedNode.y = worldPos.y;
            draggedNode.vx = 0;
            draggedNode.vy = 0;
        } else if (isPanning && !initialPinchDistance) {
            document.body.style.cursor = 'move';
            camera.x += (mouseX - lastPanX);
            camera.y += (mouseY - lastPanY);
            lastPanX = mouseX;
            lastPanY = mouseY;
        } else {
            document.body.style.cursor = hoveredNode ? 'pointer' : 'default';
        }
    });

    window.addEventListener('pointerup', (e) => {
        if (draggedNode) {
            if (draggedNode.id !== 'root') draggedNode.fixed = false;
            let dist = Math.abs(e.clientX - startX) + Math.abs(e.clientY - startY);
            if (dist < 5 && draggedNode) {
                if (window.navigateToMindmapNode) window.navigateToMindmapNode(draggedNode);
            }
            draggedNode = null;
        }
        isDragging = false;
        isPanning = false;
        document.body.style.cursor = hoveredNode ? 'pointer' : 'default';
    });
    
    canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const zoomDelta = e.deltaY > 0 ? 0.9 : 1.1;
        let newZoom = camera.zoom * zoomDelta;
        newZoom = Math.max(0.15, Math.min(newZoom, 4.0));
        
        // Keep point under mouse fixed
        const zoomRatio = newZoom / camera.zoom;
        camera.x = mouseX - (mouseX - camera.x) * zoomRatio;
        camera.y = mouseY - (mouseY - camera.y) * zoomRatio;
        camera.zoom = newZoom;
    }, { passive: false });

    // NATIVE SAFARI GESTURE SUPPORT (iOS PWA)
    let gestureInitialZoom = 1;
    canvas.addEventListener('gesturestart', function(e) {
        e.preventDefault();
        gestureInitialZoom = camera.zoom;
        isPanning = false;
        isDragging = false;
    });

    canvas.addEventListener('gesturechange', function(e) {
        e.preventDefault();
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        let newZoom = gestureInitialZoom * e.scale;
        newZoom = Math.max(0.15, Math.min(newZoom, 4.0));
        
        const zoomRatio = newZoom / camera.zoom;
        camera.x = mouseX - (mouseX - camera.x) * zoomRatio;
        camera.y = mouseY - (mouseY - camera.y) * zoomRatio;
        camera.zoom = newZoom;
    });

    canvas.addEventListener('gestureend', function(e) {
        e.preventDefault();
    });

    // PINCH TO ZOOM SUPPORT (Android/Other touches)
    let initialPinchDistance = null;
    let initialPinchZoom = null;

    canvas.addEventListener('touchstart', (e) => {
        if (e.touches.length === 2) {
            e.preventDefault();
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            initialPinchDistance = Math.sqrt(dx * dx + dy * dy);
            initialPinchZoom = camera.zoom;
            isPanning = false; // Disable panning if we're zooming
            isDragging = false;
        }
    }, { passive: false });

    canvas.addEventListener('touchmove', (e) => {
        if (e.touches.length === 2 && initialPinchDistance) {
            e.preventDefault();
            const rect = canvas.getBoundingClientRect();
            
            // Calculate center of the pinch
            const centerClientX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
            const centerClientY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
            const mouseX = centerClientX - rect.left;
            const mouseY = centerClientY - rect.top;

            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            const currentDistance = Math.sqrt(dx * dx + dy * dy);
            
            let newZoom = initialPinchZoom * (currentDistance / initialPinchDistance);
            newZoom = Math.max(0.15, Math.min(newZoom, 4.0));
            
            const zoomRatio = newZoom / camera.zoom;
            camera.x = mouseX - (mouseX - camera.x) * zoomRatio;
            camera.y = mouseY - (mouseY - camera.y) * zoomRatio;
            camera.zoom = newZoom;
        }
    }, { passive: false });

    canvas.addEventListener('touchend', (e) => {
        if (e.touches.length < 2) {
            initialPinchDistance = null;
        }
    });

    // Animation loop
    const homeScreen = document.getElementById('home-screen');

    function loop() {
        // Only compute physics and draw if home-screen is visible
        if (homeScreen && !homeScreen.classList.contains('hidden')) {
            applyPhysics();
            draw();
        }
        requestAnimationFrame(loop);
    }

    loop();
    
    return { buildGraph, rebuild: buildGraph };
}
