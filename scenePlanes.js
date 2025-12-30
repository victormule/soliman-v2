// scenePlanes.js
import * as THREE from 'three';

// Loader de textures partagé
const textureLoader = new THREE.TextureLoader();

/**
 * Idée générale :
 * - Chaque mesh de la scène (tree, plante, palm, décor…) a une texture de base
 *   avec 1 seule frame (image statique).
 * - On garde pour chaque mesh un petit état (texture, totalFrames, fps, frame courante…),
 *   exactement comme pour les personnages.
 * - Quand on veut animer (par ex. grasse1 avec grasseAnim.png), on appelle
 *   setPlaneSprite(mesh, 'images/grasseAnim.png', nbFrames, fps).
 * - Quand on veut revenir à une image fixe, on rappelle setPlaneSprite(mesh, 'images/grasse.png', 1, 0)
 *   voire resetPlaneSprite(mesh) si on veut la config "de base".
 */

// =========================
//  CONFIGS DE BASE
// =========================

// Config générique par "famille" de meshes
const planeConfigs = {
  tree: {
    sprite: 'images/tree.png',
    totalFrames: 1,
    fps: 0
  },
  plante: {
    sprite: 'images/plante.png',
    totalFrames: 1,
    fps: 0
  },
  palm: {
    sprite: 'images/palm.png',
    totalFrames: 1,
    fps: 0
  },
  decor1: {
    sprite: 'images/fond.png',
    totalFrames: 1,
    fps: 0
  },
  decor2: {
    sprite: 'images/face.png',
    totalFrames: 1,
    fps: 0
  }
};

// Exceptions par **nom exact** du mesh dans scene.glb
// (toujours UNE frame au départ : images statiques)
const specialConfigsByName = {
  palm2: {
    sprite: 'images/blurpalm.png',
    totalFrames: 1,
    fps: 0
  },
  plante2: {
    sprite: 'images/planteText.png', // image statique de base
    totalFrames: 1,
    fps: 0
  },
  plante3: {
    sprite: 'images/blurplante.png',
    totalFrames: 1,
    fps: 0
  },
  grasse1: {
    sprite: 'images/grasse.png', // image statique de base
    totalFrames: 1,
    fps: 0
  },
  decor3: {
    sprite: 'images/droite.png',
    totalFrames: 1,
    fps: 0
  },
  decor4: {
    sprite: 'images/droite.png',
    totalFrames: 1,
    fps: 0
  }
};

// Toutes les instances de "plans" que l'on gère
// (une entrée par mesh décor auquel on met une texture 2D)
const scenePlaneInstances = [];

// =========================
//  INIT
// =========================

/**
 * À appeler sur le modèle scène (gltf.scene)
 * Assigne les bons matériaux en fonction du nom des meshes
 * et installe la logique spritesheet.
 */
export function initScenePlanes(root) {
  root.traverse((child) => {
    if (!child.isMesh) return;

    const name = (child.name || '').toLowerCase();

    // 1) on commence par les exceptions
    let cfg = specialConfigsByName[name];

    // 2) sinon on utilise les règles génériques
    if (!cfg) {
      let key = null;

      if (name.startsWith('tree'))   key = 'tree';
      if (name.startsWith('plante')) key = 'plante';
      if (name.startsWith('palm'))   key = 'palm';

      if (name === 'decor1') key = 'decor1';
      if (name === 'decor2') key = 'decor2';

      if (!key) return;
      cfg = planeConfigs[key];
    }

    if (!cfg || !cfg.sprite) return;

    const instance = {
      mesh: child,
      texture: null,

      // config de base (image statique)
      baseSpritePath: cfg.sprite,
      baseTotalFrames: cfg.totalFrames || 1,
      baseFps: cfg.fps || 0,

      // config courante (peut être modifiée dynamiquement)
      currentSpritePath: cfg.sprite,
      totalFrames: cfg.totalFrames || 1,
      fps: cfg.fps || 0,
      currentFrame: 0,
      accumulatedTime: 0
    };

    // chargement texture de base
    instance.texture = textureLoader.load(
      cfg.sprite,
      () => {
        setupTextureForInstance(instance);

        child.material = new THREE.MeshStandardMaterial({
          map: instance.texture,
          transparent: true,
          alphaTest: 0.5,
          side: THREE.DoubleSide,
          metalness: 0.5,
          roughness: 1
        });

        child.castShadow = true;
        child.receiveShadow = true;
        child.material.needsUpdate = true;
      }
    );

    scenePlaneInstances.push(instance);
  });
}

// =========================
//  CONFIG TEXTURE / SPRITESHEET
// =========================

function setupTextureForInstance(instance) {
  const tex = instance.texture;
  if (!tex) return;

  const total = instance.totalFrames || 1;
  tex.flipY = false;

  if (total > 1) {
    // spritesheet horizontale (frames alignées sur X)
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(1 / total, 1);
    tex.offset.set(0, 0);
    tex.minFilter = THREE.NearestFilter;
    tex.magFilter = THREE.NearestFilter;
  } else {
    // image simple
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.repeat.set(1, 1);
    tex.offset.set(0, 0);
  }
}

// =========================
//  ANIMATION PAR FRAME
// =========================

/**
 * À appeler à chaque frame pour animer les spritesheets
 * (comme pour les personnages).
 */
export function updateScenePlanes(deltaMs) {
  scenePlaneInstances.forEach((p) => {
    if (!p.texture || !p.mesh) return;
    if (p.totalFrames <= 1 || p.fps <= 0) return;

    const frameDurationMs = 1000 / p.fps;
    p.accumulatedTime += deltaMs;

    while (p.accumulatedTime >= frameDurationMs) {
      p.accumulatedTime -= frameDurationMs;
      p.currentFrame = (p.currentFrame + 1) % p.totalFrames;
      const uOffset = p.currentFrame / p.totalFrames;
      p.texture.offset.set(uOffset, 0);
    }
  });
}

// =========================
//  API PUBLIQUE POUR LES INTERACTIONS
// =========================

/**
 * Change dynamiquement l'image + le nombre de frames d'un mesh décor.
 *
 * Exemple :
 *   // lancer l'anim de grasse1
 *   setPlaneSprite(mesh, 'images/grasseAnim.png', 8, 8);
 *
 *   // revenir à une image fixe
 *   setPlaneSprite(mesh, 'images/grasse.png', 1, 0);
 */
export function setPlaneSprite(mesh, spritePath, totalFrames = 1, fps = 0) {
  const instance = scenePlaneInstances.find((p) => p.mesh === mesh);
  if (!instance) return;

  instance.currentSpritePath = spritePath;
  instance.totalFrames = totalFrames || 1;
  instance.fps = fps || 0;
  instance.currentFrame = 0;
  instance.accumulatedTime = 0;

  instance.texture = textureLoader.load(spritePath, () => {
    setupTextureForInstance(instance);
    if (instance.mesh.material) {
      instance.mesh.material.map = instance.texture;
      instance.mesh.material.needsUpdate = true;
    }
  });
}

/**
 * Revient à l'image "de base" enregistrée lors de l'init.
 * (utile si un jour tu veux annuler toute anim sans savoir
 * exactement quelle image fixe utiliser)
 */
export function resetPlaneSprite(mesh) {
  const instance = scenePlaneInstances.find((p) => p.mesh === mesh);
  if (!instance) return;

  setPlaneSprite(
    mesh,
    instance.baseSpritePath,
    instance.baseTotalFrames,
    instance.baseFps
  );
}
