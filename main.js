// main.js

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

// =========================
//  ÉTAT GLOBAL
// =========================

const appState = {
  isStarted: false,
  hasShownUI: false,
  mouseX: 0,
  mouseY: 0,
  progress: 0,
  uiPanel: null,
  overlay: null,

  // transition entre personnages (zoom / dézoom + rembobinage décor)
  cameraSwitchPending: false,          // une transition est en cours
  cameraSwitchTargetZ: null,           // z de zoom-in (zoomé)
  cameraSwitchTargetCharacter: null,   // nom du prochain perso
  cameraSwitchZoomOutDone: false,      // la caméra a fini de dézoomer
  decorClosingDoneForSwitch: false,    // le décor a fini de se rembobiner pour ce switch
  applySelectionForCamera: null        // sera rempli dans ui.js
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

// UI : overlay + boutons + souris (et liaison avec core pour le zoom caméra)
const canvas = core.renderer.domElement;
initUI(appState, canvas, core);

// interactions décor (plantes de scene.glb)
initInteractions(core, canvas);

// drag sur le décor interactif (plantes)
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

  // Animation des personnages 2D (spritesheets)
  updateCharacters(deltaMs, appState.isStarted);

  // Animation de l’oiseau sur le tas d’os
  updateBonesBird(deltaMs, appState.isStarted);

  // Animation des spritesheets de la végétation (grasseAnim, planteTextAnim, etc.)
  updateScenePlanes(deltaMs);

  // Logique d’interactions décor (grasse1 / plante2, rembobinage, etc.)
  updateInteractions(deltaMs, appState);

  // =========================
  //  COORDINATION DÉZOOM + REMBOBINAGE + SWITCH PERSO
  // =========================
  if (
    appState.cameraSwitchPending &&
    appState.cameraSwitchZoomOutDone &&
    appState.decorClosingDoneForSwitch &&
    appState.cameraSwitchTargetCharacter &&
    typeof appState.applySelectionForCamera === 'function'
  ) {
    // 1) on applique enfin le nouveau personnage (personnages + décor)
    appState.applySelectionForCamera(appState.cameraSwitchTargetCharacter);

    // 2) on lance le zoom AVANT (caméra vers la position "zoomée")
    core.targetPosition.z = appState.cameraSwitchTargetZ ?? core.zoomedTargetZ;

    // 3) on reset tous les flags de transition
    appState.cameraSwitchPending         = false;
    appState.cameraSwitchTargetZ         = null;
    appState.cameraSwitchTargetCharacter = null;
    appState.cameraSwitchZoomOutDone     = false;
    appState.decorClosingDoneForSwitch   = false;
  }

  // Apparition du panneau UI quand le zoom d’intro est terminé
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

