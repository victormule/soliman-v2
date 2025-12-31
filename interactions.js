// interactions.js
import * as THREE from 'three';

const IS_MOBILE = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

import { setPlaneSprite, setPlaneSpriteFrame } from './scenePlanes.js';

/**
 * Gestion des interactions décor <-> personnage pour les plantes / végétation.
 *
 * Séquence pour "student" :
 *  - grasse1 : animée tant qu'elle est l'élément "actif" à tirer,
 *  - quand grasse1 est complètement tirée → image fixe,
 *    et plante2 devient l'élément actif donc animée,
 *  - quand plante2 est complètement tirée → image fixe.
 *
 * Si on redescend plante2 en bas → elle redevient l'élément actif donc animée.
 * Si on redescend ensuite grasse1 → plante2 reste fixe et grasse1 redevient animée.
 *
 * Le changement de personnage déclenche un rembobinage séquentiel et on arrête
 * toute animation sur l'ancien personnage.
 */

// =========================
// CONFIG PAR PERSONNAGE
// =========================

const characterInteractionsConfig = {
  student: {
    sequence: [
      {
        id: 'rideau',
        type: 'curtain',           // <– nouveau type
        dragPixelsForFull: 250,    // course horizontale (à ajuster)

        staticSprite: 'images/rideau.png',    // image fixe quand inactif
        staticFrames: 1,
        staticFps: 0,

        animSprite: 'images/spritesheetR.png', // spritesheet 17 frames
        animFrames: 17,
        animFps: 0,                             // ⚠️ pas d’anim automatique
        endSprite: 'images/rideauEnd.png'      // quand rideau est “au bout”
      },
      {
        id: 'grasse1',
        type: 'pullUp',
        maxOffset: 4.3,
        dragPixelsForFull: 150,

        staticSprite: 'images/grasse.png',
        staticFrames: 1,
        staticFps: 0,

        animSprite: 'images/grasseAnim.png',
        animFrames: 8,
        animFps: 8
      },
      {
        id: 'plante2',
        type: 'pullUp',
        maxOffset: 4.1,
        dragPixelsForFull: 150,

        staticSprite: 'images/planteText.png',
        staticFrames: 1,
        staticFps: 0,

        animSprite: 'images/planteTextAnim.png',
        animFrames: 8,
        animFps: 8
      }
    ]
  }
};

// =========================
//  ÉTAT INTERNE
// =========================

let coreRef = null;
let domElementRef = null;

const raycaster = new THREE.Raycaster();
const pointerNDC = new THREE.Vector2();

// characterStates[charName] = { steps: [ { config, mesh?, baseY?, progress, isAnimated } ] }
const characterStates = {};

let activeCharacterName = null;

// Changement de perso → fermeture auto de l'ancien, ouverture du nouveau
let autoClosing = false;
let autoClosingCharacterName = null;
let pendingCharacterName = null;

// Quand un perso vient d'être activé, on initialise sa séquence
let characterJustActivatedName = null;

// Drag
let dragging = false;
let dragStep = null;
let dragStartY = 0;
let dragStartX = 0; 
let dragStartProgress = 0;

// Vitesse de fermeture auto (progress/seconde)
const AUTO_CLOSE_SPEED = 2.0;

// =========================
//  INIT
// =========================

export function initInteractions(core, domElement) {
  coreRef = core;
  domElementRef = domElement;

  Object.keys(characterInteractionsConfig).forEach((charName) => {
    const cfg = characterInteractionsConfig[charName];
    const steps = cfg.sequence.map((stepCfg) => ({
      config: stepCfg,
      mesh: null,
      baseY: null,
      progress: 0,
      isAnimated: false
    }));

    characterStates[charName] = { steps };
  });
}

// =========================
//  UTILITAIRES MESH
// =========================

function findMeshByNameFlexible(id) {
  if (!coreRef || !coreRef.scene) return null;

  const target = id.toLowerCase();
  let found = null;

  coreRef.scene.traverse((obj) => {
    if (found) return;
    if (!obj.name) return;
    const n = obj.name.toLowerCase();
    if (n === target || n.includes(target)) {
      found = obj;
    }
  });

  if (!found) {
    console.warn(`[Interactions] Aucun mesh trouvé pour id "${id}" dans la scène.`);
  } else {
    console.log(`[Interactions] Mesh trouvé pour "${id}" :`, found.name);
  }

  return found;
}

function ensureStepMesh(step) {
  if (step.mesh && step.baseY !== null) return;
  if (!coreRef || !coreRef.scene) return;

  const id = step.config.id;
  const mesh = findMeshByNameFlexible(id);
  if (!mesh) return;

  step.mesh = mesh;
  step.baseY = mesh.position.y;
}

// =========================
//  SPRITES POUR UN STEP
// =========================

function setStepSprite(step, animated) {
  ensureStepMesh(step);
  if (!step.mesh) return;

  // éviter de recharger la même texture si l'état ne change pas
  if (step.isAnimated === animated) return;

  const cfg = step.config;

  if (animated && cfg.animSprite) {
    setPlaneSprite(
      step.mesh,
      cfg.animSprite,
      cfg.animFrames || 1,
      cfg.animFps || 0
    );
  } else if (cfg.staticSprite) {
    setPlaneSprite(
      step.mesh,
      cfg.staticSprite,
      cfg.staticFrames || 1,
      cfg.staticFps || 0
    );
  }

  step.isAnimated = animated;
}

// =========================
//  CHANGEMENT DE PERSONNAGE
// =========================

// =========================
//  CHANGEMENT DE PERSONNAGE
// =========================

export function setActiveCharacter(charName) {
  // 0) Aucun changement demandé : on ne touche à rien
  //    (important pour le cas applySelection() après un switch)
  if (charName === activeCharacterName) {
    return;
  }

  // 1) On désactive explicitement le décor interactif
  //    (re-clic sur le même bouton → interactions OFF)
  if (!charName) {
    // s'il n'y a déjà aucun personnage actif → reset global (sécurité)
    if (!activeCharacterName) {
      Object.values(characterStates).forEach((state) => {
        state.steps.forEach((step) => {
          ensureStepMesh(step);
          step.progress = 0;
          step.isAnimated = false;
          step.curtainRewindStarted = false;
          applyStepTransform(step);
          setStepSprite(step, false); // image fixe (rideau.png pour le rideau)
        });
      });

      activeCharacterName = null;
      autoClosing = false;
      autoClosingCharacterName = null;
      pendingCharacterName = null;
      characterJustActivatedName = null;
      return;
    }

    // il y a un personnage actif → on lance le rembobinage de celui-ci
    autoClosing = true;
    autoClosingCharacterName = activeCharacterName;
    pendingCharacterName = null; // aucun nouveau perso à activer ensuite
    return;
  }

  // 2) Aucun personnage actif → on active directement ce personnage
  if (!activeCharacterName) {
    activeCharacterName = charName;
    autoClosing = false;
    autoClosingCharacterName = null;
    pendingCharacterName = null;
    characterJustActivatedName = charName;
    return;
  }

  // 3) On passe d'un personnage A (actif) à un autre B
  //    → rembobinage de A, puis B sera activé quand tout est fermé
  autoClosing = true;
  autoClosingCharacterName = activeCharacterName;
  pendingCharacterName = charName;
}



function isCharacterClosed(charName, epsilon = 0.01) {
  const state = characterStates[charName];
  if (!state) return true;
  return state.steps.every((s) => s.progress <= epsilon);
}

// =========================
//  LOGIQUE DE SÉQUENCE
// =========================

function getNextOpenableStep(steps, threshold = 0.98) {
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];

    // si ce step est déjà ouvert (ou presque), on passe au suivant
    if (step.progress >= threshold) continue;

    // tous les précédents doivent être ouverts (ou presque)
    let allPrevOpen = true;
    for (let j = 0; j < i; j++) {
      if (steps[j].progress < threshold) {
        allPrevOpen = false;
        break;
      }
    }
    if (allPrevOpen) return step;
  }
  return null;
}

function getLastClosableStep(steps, threshold = 0.02) {
  let last = null;
  for (let i = 0; i < steps.length; i++) {
    if (steps[i].progress > threshold) {
      last = steps[i];
    }
  }
  return last;
}

function initSequenceForCharacter(charName) {
  const state = characterStates[charName];
  if (!state) return;

  state.steps.forEach((step) => {
    ensureStepMesh(step);
    step.progress = 0;
    step.isAnimated = false;
    step.curtainRewindStarted = false;
    applyStepTransform(step);
    setStepSprite(step, false); // tous statiques
  });

  // La première updateInteractions appellera updateStepAnimations,
  // qui animera automatiquement le premier step.
}

// =========================
//  DRAG
// =========================

export function handlePointerDown(event) {
  if (!coreRef || !domElementRef) return;
  if (!activeCharacterName) return;

  const state = characterStates[activeCharacterName];
  if (!state) return;

  const steps = state.steps;
  if (!steps.length) return;

  const rect = domElementRef.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  pointerNDC.set(x, y);
  raycaster.setFromCamera(pointerNDC, coreRef.camera);

  const openable = getNextOpenableStep(steps);
  const closable = getLastClosableStep(steps);

  const candidates = [];
  if (openable) {
    ensureStepMesh(openable);
    if (openable.mesh) candidates.push(openable.mesh);
  }
  if (closable && closable !== openable) {
    ensureStepMesh(closable);
    if (closable.mesh) candidates.push(closable.mesh);
  }

  if (!candidates.length) return;

  const intersects = raycaster.intersectObjects(candidates, false);
  if (!intersects.length) return;

  const intersectedMesh = intersects[0].object;
  const step = steps.find((s) => s.mesh === intersectedMesh);
  if (!step) return;

  dragging = true;
  dragStep = step;
  dragStartY = event.clientY;
  dragStartX = event.clientX;
  dragStartProgress = step.progress;
}

export function handlePointerMove(event) {
  if (!dragging || !dragStep) return;

  const cfg = dragStep.config;
  const basePixelsForFull = cfg.dragPixelsForFull || 150;
  const pixelsForFull = IS_MOBILE ? basePixelsForFull * 0.6 : basePixelsForFull;

  let deltaProgress = 0;

  if (cfg.type === 'curtain') {
    // drag vers la droite = fermeture
    const deltaPixels = event.clientX - dragStartX;
    deltaProgress = deltaPixels / pixelsForFull;
  } else {
    // comportement actuel pour 'pullUp'
    const deltaPixels = dragStartY - event.clientY; // vers le haut = +
    deltaProgress = deltaPixels / pixelsForFull;
  }

  let targetProgress = dragStartProgress + deltaProgress;
  targetProgress = Math.max(0, Math.min(1, targetProgress));

  const SMOOTH = IS_MOBILE ? 0.35 : 0.25;
  dragStep.progress = THREE.MathUtils.lerp(dragStep.progress, targetProgress, SMOOTH);

  applyStepTransform(dragStep); // fera rien pour 'curtain' (voir 3.3)

  // pour le rideau, on met à jour la frame de la spritesheet
  if (cfg.type === 'curtain' && cfg.animFrames && dragStep.mesh) {
    const frame = dragStep.progress * (cfg.animFrames - 1);
    setPlaneSpriteFrame(dragStep.mesh, frame);
  }
}



export function handlePointerUp() {
  if (!dragging || !dragStep) return;

  const step = dragStep;

  // on arrête le drag
  dragging = false;
  dragStep = null;

  // on garde la position atteinte par le drag,
  // on se contente de la "clamp" proprement entre 0 et 1
  step.progress = Math.max(0, Math.min(1, step.progress));
  applyStepTransform(step);

  // aucune logique de snap ici :
  // updateStepAnimations() décidera automatiquement
  // quel step doit être animé en fonction de la nouvelle valeur de progress.
}


// =========================
//  TRANSFORM
// =========================

function applyStepTransform(step) {
  ensureStepMesh(step);
  if (!step.mesh || step.baseY === null) return;

  const mesh = step.mesh;
  const cfg = step.config;

  if (cfg.type === 'pullUp' || !cfg.type) {
    const baseY = step.baseY;
    const maxOffset = cfg.maxOffset || 0;
    mesh.position.y = baseY + step.progress * maxOffset;
  }
  // type 'curtain' : pas de modification de position
}


// =========================
//  ANIMATIONS DES SPRITES
// =========================
function updateStepAnimations() {
  if (!activeCharacterName) return;

  // 1) Cas rembobinage automatique du personnage actif
if (autoClosing && autoClosingCharacterName === activeCharacterName) {
  const closingState = characterStates[activeCharacterName];
  if (closingState) {
    closingState.steps.forEach((step) => {
      const cfg = step.config;
      if (cfg.type !== 'curtain') {
        // les autres steps sont figés
        setStepSprite(step, false);
      }
      // pour le rideau : NE RIEN FAIRE ici.
      // sa texture/spritesheet est gérée dans updateInteractions
    });
  }
  return;
}


  // 2) Cas normal (pas de rembobinage)
  const state = characterStates[activeCharacterName];
  if (!state) return;

  const steps = state.steps;
  const openable = getNextOpenableStep(steps);

  steps.forEach((step) => {
    const cfg = step.config;

    if (step === openable) {
      // Élément interactif courant
      if (cfg.type === 'curtain') {
        // Rideau : on passe sur la spritesheetR (fps=0, animé par le drag)
        setStepSprite(step, true);
      } else {
        setStepSprite(step, true); // comportement actuel
      }
    } else {
      // Pas l'élément actif
      if (cfg.endSprite && step.progress >= 0.98) {
        // Rideau complètement fermé → image finale rideauEnd
        setPlaneSprite(step.mesh, cfg.endSprite, 1, 0);
        step.isAnimated = false;
      } else {
        setStepSprite(step, false);
      }
    }
  });
}


// =========================
//  AUTO CLOSE + UPDATE
// =========================

export function updateInteractions(deltaMs, appState) {
  const dt = deltaMs / 1000;

  // 1) fermeture auto quand on change de perso
if (autoClosing && autoClosingCharacterName) {
  const state = characterStates[autoClosingCharacterName];
  if (state) {
    const closingStep = getLastClosableStep(state.steps, 0.001);
if (closingStep && closingStep.progress > 0) {
  const cfg = closingStep.config;

  if (cfg.type === 'curtain') {
    // 1) Premier passage : on bascule la texture du rideau sur la spritesheet
    //    en respectant sa progress actuelle
    if (!closingStep.curtainRewindStarted) {
      closingStep.curtainRewindStarted = true;

      // passer sur spritesheetR
      setPlaneSprite(
        closingStep.mesh,
        cfg.animSprite,
        cfg.animFrames,
        0 // fps=0 : pas d'anim auto
      );

      // placer directement la bonne frame (en général la dernière)
      const startFrame = closingStep.progress * (cfg.animFrames - 1);
      setPlaneSpriteFrame(closingStep.mesh, startFrame);
    }

    // 2) Maintenant on décrémente la progress
    closingStep.progress -= AUTO_CLOSE_SPEED * dt;
    if (closingStep.progress < 0) closingStep.progress = 0;

    // pas de déplacement en Y pour le rideau
    // (si ton applyStepTransform gère déjà ce cas, tu peux le laisser)
    applyStepTransform(closingStep);

    // 3) Et on met la frame qui correspond à la nouvelle progress
    if (cfg.animFrames && closingStep.mesh) {
      const frame = closingStep.progress * (cfg.animFrames - 1);
      setPlaneSpriteFrame(closingStep.mesh, frame);
    }
  } else {
    // comportement actuel pour les autres steps (plantes)
    closingStep.progress -= AUTO_CLOSE_SPEED * dt;
    if (closingStep.progress < 0) closingStep.progress = 0;
    applyStepTransform(closingStep);
  }
}

  }

    // quand tout est fermé → on peut activer le nouveau personnage
    // quand tout est fermé → on termine le rembobinage
    // quand tout est fermé → on peut activer le nouveau personnage
    // quand tout est fermé → on termine le rembobinage
    if (!state || isCharacterClosed(autoClosingCharacterName)) {
      // NEW : on remet tous les steps du perso fermé dans leur état de base
      const closedState = characterStates[autoClosingCharacterName];
      if (closedState) {
        closedState.steps.forEach((step) => {
          ensureStepMesh(step);
          step.progress = 0;
          applyStepTransform(step);
          step.isAnimated = false;
          // reviennent à leur staticSprite (rideau.png pour le rideau)
          setStepSprite(step, false);
        });
      }

      autoClosing = false;
      autoClosingCharacterName = null;
      

      if (pendingCharacterName) {
        // cas "changer de personnage" : on active le nouveau
        activeCharacterName = pendingCharacterName;
        pendingCharacterName = null;
        characterJustActivatedName = activeCharacterName;

        // on signale à l'extérieur que le décor est totalement rembobiné
        // pour ce switch de personnage
        if (appState && appState.cameraSwitchPending) {
          appState.decorClosingDoneForSwitch = true;
        }
      } else {
        // cas "setActiveCharacter(null)" :
        // on n'a pas de nouveau perso à activer → on désactive tout
        activeCharacterName = null;
      }
    }
  }

  // 2) si un perso vient d'être activé → on initialise sa séquence
  if (characterJustActivatedName) {
    initSequenceForCharacter(characterJustActivatedName);
    characterJustActivatedName = null;
  }

  // 3) mise à jour des sprites animés du perso actif
  updateStepAnimations();
}

