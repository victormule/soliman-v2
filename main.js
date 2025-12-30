import { initCore, updateCameraAndPlants } from './core.js';
import {
  initCharacters,
  updateCharacters,
  initBonesBird,
  updateBonesBird
} from './characters.js';
import { initUI } from './ui.js';
import {
  initInteractions,
  updateInteractions,
  handlePointerDown,
  handlePointerMove,
  handlePointerUp
} from './interactions.js';
import { updateScenePlanes } from './scenePlanes.js';

// état global simple
const appState = {
  isStarted: false,
  hasShownUI: false,
  mouseX: 0,
  mouseY: 0,
  progress: 0,
  uiPanel: null,
  overlay: null,

  // zoom perso
  characterZoom: 0,           // valeur actuelle (0 = pas de zoom, 1 = zoom max)
  characterZoomTarget: 0,     // valeur souhaitée
  characterZoomAfterOut: false, // si true : après être revenu à 0, on repartira vers 1
  cameraSwitchPending: false,
  cameraSwitchTargetZ: null
};

// =========================
//  INIT SCÈNE / PERSONNAGES / UI / INTERACTIONS
// =========================

// initialisation de la scène / caméra / renderer / décor
const core = initCore();

// chargement des personnages (4 versions de Soliman)
initCharacters(core.scene);

// tas d’os + oiseau
initBonesBird(core.scene);

// UI : overlay + boutons + souris
const canvas = core.renderer.domElement;
initUI(appState, core.renderer.domElement, core);

// interactions décor (plantes de scene.glb)
initInteractions(core, canvas);

// drag sur le décor interactif
canvas.addEventListener('pointerdown', handlePointerDown);
window.addEventListener('pointermove', handlePointerMove);
window.addEventListener('pointerup', handlePointerUp);

// =========================
//  BOUCLE D'ANIMATION
// =========================

let lastTime = 0;

function animate(time) {
  requestAnimationFrame(animate);

  if (!lastTime) {
    lastTime = time || 0;
  }
  const now = time || 0;
  const deltaMs = now - lastTime;
  lastTime = now;

  // Caméra + mouvement "vent" sur certaines plantes
  updateCameraAndPlants(now, deltaMs, core, appState);

  // Animation des personnages 2D (spritesheet)
  updateCharacters(deltaMs, appState.isStarted);

  // Animation de l’oiseau sur le tas d’os
  updateBonesBird(deltaMs, appState.isStarted);

  // Animation des spritesheets de la végétation (grasseAnim, planteTextAnim, etc.)
  updateScenePlanes(deltaMs);

  // Logique d’interactions décor (grasse1 / plante2, rembobinage, etc.)
  updateInteractions(deltaMs);

  // Apparition du panneau UI quand le zoom est terminé
  if (appState.isStarted && !appState.hasShownUI && appState.progress >= 1) {
    appState.hasShownUI = true;
    if (appState.uiPanel) {
      appState.uiPanel.style.opacity = '1';
      appState.uiPanel.style.pointerEvents = 'auto';
    }
  }

  if (core.controls) core.controls.update();
  core.renderer.render(core.scene, core.camera);
}

animate();

// =========================
//  RESIZE
// =========================

window.addEventListener('resize', () => {
  core.camera.aspect = window.innerWidth / window.innerHeight;
  core.camera.updateProjectionMatrix();
  core.renderer.setSize(window.innerWidth, window.innerHeight);
});
