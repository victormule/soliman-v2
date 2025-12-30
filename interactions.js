// interactions.js
import * as THREE from 'three';
import { setPlaneSprite } from './scenePlanes.js';

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
        id: 'grasse1',
        type: 'pullUp',
        maxOffset: 4,
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
        maxOffset: 4.0,
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

export function setActiveCharacter(charName) {
  // CAS 1 : on demande "aucun personnage interactif"
  if (!charName) {
    // s'il n'y a déjà aucun personnage actif → reset direct (sécurité)
    if (!activeCharacterName) {
      Object.values(characterStates).forEach((state) => {
        state.steps.forEach((step) => {
          ensureStepMesh(step);
          step.progress = 0;
          step.isAnimated = false;
          applyStepTransform(step);
          setStepSprite(step, false); // image fixe, frame 1
        });
      });

      activeCharacterName = null;
      autoClosing = false;
      autoClosingCharacterName = null;
      pendingCharacterName = null;
      characterJustActivatedName = null;
      return;
    }

    // sinon, il y a un personnage actif → on veut le REMBOBINER
    const closingState = characterStates[activeCharacterName];
    if (closingState) {
      closingState.steps.forEach((step) => {
        ensureStepMesh(step);
        applyStepTransform(step);   // garde la position actuelle
        setStepSprite(step, false); // on fige en image fixe
        step.isAnimated = false;
      });
    }

    // on lance le rembobinage AUTO du perso courant
    autoClosing = true;
    autoClosingCharacterName = activeCharacterName;
    pendingCharacterName = null; // ← pas de nouveau personnage à activer après
    return;
  }

  // CAS 2 : pas de changement de personnage
  if (activeCharacterName === charName) return;

  // CAS 3 : aucun perso actif avant → on active directement celui-ci
  if (!activeCharacterName) {
    activeCharacterName = charName;
    autoClosing = false;
    autoClosingCharacterName = null;
    pendingCharacterName = null;
    characterJustActivatedName = charName;
    return;
  }

  // CAS 4 : on passe d'un personnage A à un autre B
  const closingState = characterStates[activeCharacterName];
  if (closingState) {
    closingState.steps.forEach((step) => {
      ensureStepMesh(step);
      applyStepTransform(step);
      setStepSprite(step, false);
      step.isAnimated = false;
    });
  }

  autoClosing = true;
  autoClosingCharacterName = activeCharacterName;
  pendingCharacterName = charName; // ← après rembobinage, on activera ce nouveau perso
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
  dragStartProgress = step.progress;
}

export function handlePointerMove(event) {
  if (!dragging || !dragStep) return;

  const cfg = dragStep.config;
  const pixelsForFull = cfg.dragPixelsForFull || 150;

  const deltaPixels = dragStartY - event.clientY; // vers le haut = positif
  const deltaProgress = deltaPixels / pixelsForFull;

  let newProgress = dragStartProgress + deltaProgress;
  newProgress = Math.max(0, Math.min(1, newProgress));

  dragStep.progress = newProgress;
  applyStepTransform(dragStep);
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
  const baseY = step.baseY;
  const maxOffset = cfg.maxOffset || 0;

  mesh.position.y = baseY + step.progress * maxOffset;
}

// =========================
//  ANIMATIONS DES SPRITES
// =========================

function updateStepAnimations() {
  if (!activeCharacterName) return;

  // Si on est en train de rembobiner ce personnage, aucune anim
  if (autoClosing && autoClosingCharacterName === activeCharacterName) {
    const closingState = characterStates[activeCharacterName];
    if (closingState) {
      closingState.steps.forEach((step) => {
        setStepSprite(step, false);
      });
    }
    return;
  }

  const state = characterStates[activeCharacterName];
  if (!state) return;

  const steps = state.steps;
  if (!steps.length) return;

  const openable = getNextOpenableStep(steps);

  steps.forEach((step) => {
    const shouldAnimate =
      openable &&
      step === openable &&
      step.progress < 0.999; // si déjà (quasi) totalement ouvert → statique

    setStepSprite(step, shouldAnimate);
  });
}

// =========================
//  AUTO CLOSE + UPDATE
// =========================

export function updateInteractions(deltaMs) {
  const dt = deltaMs / 1000;

  // 1) fermeture auto quand on change de perso
  if (autoClosing && autoClosingCharacterName) {
    const state = characterStates[autoClosingCharacterName];
    if (state) {
      // on ferme un step à la fois : le dernier ouvert
      const closingStep = getLastClosableStep(state.steps, 0.001);
      if (closingStep && closingStep.progress > 0) {
        closingStep.progress -= AUTO_CLOSE_SPEED * dt;
        if (closingStep.progress < 0) closingStep.progress = 0;
        applyStepTransform(closingStep);
      }
    }

    // quand tout est fermé → on peut activer le nouveau personnage
    // quand tout est fermé → on termine le rembobinage
    if (!state || isCharacterClosed(autoClosingCharacterName)) {
      autoClosing = false;
      autoClosingCharacterName = null;

      if (pendingCharacterName) {
        // cas "changer de personnage" : on active le nouveau
        activeCharacterName = pendingCharacterName;
        pendingCharacterName = null;
        characterJustActivatedName = activeCharacterName;
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
