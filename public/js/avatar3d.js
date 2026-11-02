// Xem trước nhân vật 3D vào một canvas 2D (dùng chung một WebGL renderer ẩn).
import { THREE, makeCharacter, poseCharacter } from './char3d.js';

let renderer, scene, camera, current, currentKey;
function init() {
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight('#ffffff', '#b08a6a', 1.4));
  const d = new THREE.DirectionalLight('#fff1d6', 2.2);
  d.position.set(2, 4, 5);
  scene.add(d);
  camera = new THREE.PerspectiveCamera(26, 0.8, 0.1, 50);
}
const DIRS = { down: 0.35, left: -Math.PI / 2, up: Math.PI, right: Math.PI / 2 };

export function drawAvatar3D(canvas, av, dir = 'down') {
  if (!renderer) init();
  const key = JSON.stringify(av);
  if (key !== currentKey) {
    if (current) scene.remove(current);
    current = makeCharacter(av);
    poseCharacter(current, 0, {});
    scene.add(current);
    currentKey = key;
  }
  current.rotation.y = DIRS[dir] ?? 0.35;
  const w = canvas.width, h = canvas.height;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.position.set(0, 1.35, 6.2);
  camera.lookAt(0, 1.05, 0);
  camera.updateProjectionMatrix();
  renderer.render(scene, camera);
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(renderer.domElement, 0, 0, w, h);
}
