import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { ARButton } from 'https://unpkg.com/three@0.160.0/examples/jsm/webxr/ARButton.js';

const apiBase = 'http://127.0.0.1:5000';

function getQueryParam(name){ const u=new URL(window.location.href); return u.searchParams.get(name); }

async function fetchProduct(productId) {
    const res = await fetch(`${apiBase}/product/${productId}`);
    const data = await res.json();
    if (!data.success) throw new Error('Product not found');
    return data.product;
}

async function createFallbackViewer(textureUrl, titleText) {
    document.getElementById('hint').textContent = 'Drag to move • Pinch to zoom • Use +/- buttons';
    const canvas = document.getElementById('fallback');
    const video = document.getElementById('cameraFeed');
    // try to start rear camera
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
        video.srcObject = stream;
        video.style.display = 'block';
    } catch (e) {
        // fallback to default camera
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
            video.srcObject = stream;
            video.style.display = 'block';
        } catch (err) {
            console.warn('Camera not available:', err);
        }
    }

    canvas.style.display = 'block';
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);

    const scene = new THREE.Scene();
    scene.background = null; // transparent over camera
    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(0, 0, 2);
    const light = new THREE.DirectionalLight(0xffffff, 1.2);
    light.position.set(1, 1, 2);
    scene.add(light);
    scene.add(new THREE.AmbientLight(0xffffff, 0.6));

    const loader = new THREE.TextureLoader();
    let mesh = null;
    let isDragging = false;
    const raycaster = new THREE.Raycaster();
    const movePlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 1.5);
    
    const getNDC = (x, y) => ({ x: (x / window.innerWidth) * 2 - 1, y: -(y / window.innerHeight) * 2 + 1 });
    
    loader.load(textureUrl, (tex) => {
        const aspect = tex.image.width / tex.image.height;
        const height = 1.0;
        const width = height * aspect;
        const geom = new THREE.PlaneGeometry(width, height);
        const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true });
        mesh = new THREE.Mesh(geom, mat);
        mesh.position.set(0, 0, -1.5);
        scene.add(mesh);
        
        // Set up drag controls after mesh is created
        setupDragControls();
    });

    function setupDragControls() {
        let lastMouseX = 0, lastMouseY = 0;
        
        window.addEventListener('pointerdown', (ev) => { 
            if (mesh) {
                isDragging = true;
                lastMouseX = ev.clientX;
                lastMouseY = ev.clientY;
                ev.preventDefault();
            }
        });
        window.addEventListener('pointerup', () => { 
            isDragging = false; 
        });
        window.addEventListener('pointermove', (ev) => {
            if (!mesh || !isDragging) return;
            ev.preventDefault();
            
            // Simple drag: convert screen movement to world movement
            const deltaX = (ev.clientX - lastMouseX) / window.innerWidth * 2;
            const deltaY = -(ev.clientY - lastMouseY) / window.innerHeight * 2;
            
            mesh.position.x += deltaX * 2; // Scale factor for sensitivity
            mesh.position.y += deltaY * 2;
            
            // Keep within reasonable bounds
            mesh.position.x = Math.max(-3, Math.min(3, mesh.position.x));
            mesh.position.y = Math.max(-2, Math.min(2, mesh.position.y));
            
            lastMouseX = ev.clientX;
            lastMouseY = ev.clientY;
        });
    }

    // Pinch to zoom (fallback)
    let pinchInitial = null; let startScale = 1;
    window.addEventListener('touchstart', (e) => {
        if (e.touches && e.touches.length === 2) {
            pinchInitial = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
            if (mesh) startScale = mesh.scale.x;
        }
    }, { passive: true });
    window.addEventListener('touchmove', (e) => {
        if (mesh && e.touches && e.touches.length === 2 && pinchInitial) {
            const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
            const factor = d / pinchInitial;
            const s = Math.min(4, Math.max(0.25, startScale * factor));
            mesh.scale.set(s, s, s);
        }
    }, { passive: true });
    window.addEventListener('touchend', () => { pinchInitial = null; }, { passive: true });

    // Buttons (fallback)
    const zoomInBtn = document.getElementById('zoomIn');
    const zoomOutBtn = document.getElementById('zoomOut');
    const resetBtn = document.getElementById('reset');
    const applyScale = (mult) => { if (mesh) { const s = Math.min(4, Math.max(0.25, (mesh.scale.x || 1) * mult)); mesh.scale.set(s, s, s);} };
    zoomInBtn && zoomInBtn.addEventListener('click', () => applyScale(1.2));
    zoomOutBtn && zoomOutBtn.addEventListener('click', () => applyScale(0.8333));
    resetBtn && resetBtn.addEventListener('click', () => { if (mesh) { mesh.scale.set(1,1,1); mesh.position.set(0,0,-1.5); } });

    function onResize() {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    }
    window.addEventListener('resize', onResize);

    (function animate(){
        requestAnimationFrame(animate);
        renderer.render(scene, camera);
    })();
}

async function init() {
    try {
        const productId = getQueryParam('product_id');
        if (!productId) throw new Error('Missing product_id');
        const product = await fetchProduct(productId);
        const title = document.getElementById('title');
        title.textContent = product.name || 'Product';

        const textureUrl = product.ar_image_url || product.image_url;
        if (!textureUrl) throw new Error('No image available for AR');

        // If WebXR not available, fallback to simple viewer
        if (!navigator.xr || !(await navigator.xr.isSessionSupported?.('immersive-ar').catch(() => false))) {
            createFallbackViewer(textureUrl, product.name);
            return;
        }

        // WebXR AR scene
        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.xr.enabled = true;
        document.body.appendChild(renderer.domElement);

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera();

        const light = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1);
        scene.add(light);

        // Reticle for placement
        const reticle = new THREE.Mesh(
            new THREE.RingGeometry(0.07, 0.09, 32).rotateX(-Math.PI / 2),
            new THREE.MeshBasicMaterial({ color: 0xD2794D })
        );
        reticle.matrixAutoUpdate = false;
        reticle.visible = false;
        scene.add(reticle);

        let placedMesh = null;
        const texLoader = new THREE.TextureLoader();
        const texture = await new Promise((resolve, reject) => {
            texLoader.load(textureUrl, resolve, undefined, reject);
        });

        const planeFromAspect = (aspect) => {
            const width = 0.4; // meters (approx width)
            const height = width / (aspect || 1);
            const geom = new THREE.PlaneGeometry(width, height);
            const mat = new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide });
            const mesh = new THREE.Mesh(geom, mat);
            return mesh;
        };

        const aspect = (texture.image && texture.image.width && texture.image.height)
            ? texture.image.width / texture.image.height : 1;

        // AR Button
        const arButton = ARButton.createButton(renderer, {
            requiredFeatures: ['hit-test']
        });
        document.body.appendChild(arButton);

        let hitTestSource = null;
        let localSpace = null;
        let session = null;

        renderer.xr.addEventListener('sessionstart', async () => {
            session = renderer.xr.getSession();
            const viewerSpace = await session.requestReferenceSpace('viewer');
            hitTestSource = await session.requestHitTestSource({ space: viewerSpace });
            localSpace = await session.requestReferenceSpace('local');

            // tap to place/move
            const onSelect = () => {
                if (reticle.visible) {
                    if (!placedMesh) {
                        placedMesh = planeFromAspect(aspect);
                        placedMesh.position.setFromMatrixPosition(reticle.matrix);
                        placedMesh.quaternion.setFromRotationMatrix(reticle.matrix);
                        scene.add(placedMesh);
                        document.getElementById('hint').textContent = 'Tap again to move';
                    } else {
                        placedMesh.position.setFromMatrixPosition(reticle.matrix);
                        placedMesh.quaternion.setFromRotationMatrix(reticle.matrix);
                    }
                }
            };
            const controller = renderer.xr.getController(0);
            controller.addEventListener('select', onSelect);
            scene.add(controller);
        });

        renderer.xr.addEventListener('sessionend', () => {
            hitTestSource = null; localSpace = null; session = null;
        });

        // Pinch-to-zoom for WebXR placed plane and UI buttons
        let pinchInitialDistance = null;
        let initialScale = 1;
        const onTouchStart = (ev) => {
            if (ev.touches && ev.touches.length === 2) {
                pinchInitialDistance = Math.hypot(
                    ev.touches[0].clientX - ev.touches[1].clientX,
                    ev.touches[0].clientY - ev.touches[1].clientY
                );
                if (placedMesh) initialScale = placedMesh.scale.x;
            }
        };
        const onTouchMove = (ev) => {
            if (ev.touches && ev.touches.length === 2 && pinchInitialDistance && placedMesh) {
                const dist = Math.hypot(
                    ev.touches[0].clientX - ev.touches[1].clientX,
                    ev.touches[0].clientY - ev.touches[1].clientY
                );
                const factor = dist / pinchInitialDistance;
                const s = Math.min(4, Math.max(0.25, initialScale * factor));
                placedMesh.scale.set(s, s, s);
            }
        };
        const onTouchEnd = () => { pinchInitialDistance = null; };
        document.addEventListener('touchstart', onTouchStart, { passive: true });
        document.addEventListener('touchmove', onTouchMove, { passive: true });
        document.addEventListener('touchend', onTouchEnd, { passive: true });

        const zoomInBtnAR = document.getElementById('zoomIn');
        const zoomOutBtnAR = document.getElementById('zoomOut');
        const resetBtnAR = document.getElementById('reset');
        const applyScaleAR = (mult) => {
            if (!placedMesh) return;
            const s = Math.min(4, Math.max(0.25, (placedMesh.scale.x || 1) * mult));
            placedMesh.scale.set(s, s, s);
        };
        zoomInBtnAR && zoomInBtnAR.addEventListener('click', () => applyScaleAR(1.2));
        zoomOutBtnAR && zoomOutBtnAR.addEventListener('click', () => applyScaleAR(0.8333));
        resetBtnAR && resetBtnAR.addEventListener('click', () => { if (placedMesh) placedMesh.scale.set(1,1,1); });

        function onWindowResize() {
            renderer.setSize(window.innerWidth, window.innerHeight);
        }
        window.addEventListener('resize', onWindowResize);

        renderer.setAnimationLoop((timestamp, frame) => {
            if (frame && hitTestSource && localSpace) {
                const hitTestResults = frame.getHitTestResults(hitTestSource);
                if (hitTestResults.length) {
                    const hit = hitTestResults[0];
                    const pose = hit.getPose(localSpace);
                    reticle.visible = true;
                    reticle.matrix.fromArray(pose.transform.matrix);
                } else {
                    reticle.visible = false;
                }
            }
            renderer.render(scene, camera);
        });
    } catch (e) {
        console.error(e);
        alert('Failed to load AR viewer: ' + e.message);
    }
}

init();


