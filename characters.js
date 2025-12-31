import * as THREE from 'three';
import { GLTFLoader } from 'GLTFLoader';

// ========================
//  CONFIG PERSONNAGES 2D
// ========================

const loader = new GLTFLoader();
const textureLoader = new THREE.TextureLoader();

// définition des personnages + FPS
const characters = {
  student: {
    path: 'model/soliman-student.glb',
    sprite: 'images/spritesheet1.png',
    totalFrames: 23,
    fps: 3,
    model: null,
    mesh: null,
    texture: null,
    currentFrame: 0,
    accumulatedTime: 0
  },
  assassin: {
    path: 'model/soliman-assassin.glb',
    sprite: 'images/spritesheet2.png',
    totalFrames: 12,
    fps: 3,
    model: null,
    mesh: null,
    texture: null,
    currentFrame: 0,
    accumulatedTime: 0
  },
  martyr: {
    path: 'model/soliman-martyr.glb',
    sprite: 'images/spritesheet3.png',
    totalFrames: 8,
    fps: 3,
    model: null,
    mesh: null,
    texture: null,
    currentFrame: 0,
    accumulatedTime: 0
  },
  hero: {
    path: 'model/soliman-hero.glb',
    sprite: 'images/spritesheet4.png',
    totalFrames: 8,
    fps: 6, // plus rapide
    model: null,
    mesh: null,
    texture: null,
    currentFrame: 0,
    accumulatedTime: 0
  },
  body: {
    path: 'model/soliman-corps.glb',
    sprite: 'images/spritesheet5.png',
    totalFrames: 30,
    fps: 3,
    model: null,
    mesh: null,
    texture: null,
    currentFrame: 0,
    accumulatedTime: 0
  },
    
  museum: {
    path: 'model/soliman-musée.glb',        // vérifie bien le nom exact du fichier
    sprite: 'images/spritesheet7.png',
    totalFrames: 4,                         // tu l'as indiqué
    fps: 3,                                 // comme les autres (tu peux changer si besoin)
    model: null,
    mesh: null,
    texture: null,
    currentFrame: 0,
    accumulatedTime: 0
    
  }
};



// correspondance key → nom de plane dans Blender
const meshNameByKey = {
  student:  ['spriteplane_student', 'spriteplane'],
  assassin: ['spriteplane_assassin', 'spriteplane'],
  martyr:   ['spriteplane_martyr',   'spriteplane'],
  hero:     ['spriteplane_hero',     'spriteplane'],
  body:     ['spriteplane_body',     'spriteplane'],
  museum:   ['spriteplane_musee',    'spriteplane']
};

// ========================
//  INIT PERSONNAGES
// ========================

export function initCharacters(scene) {
  Object.keys(characters).forEach((key) => {
    const c = characters[key];

    loader.load(c.path, (gltf) => {
      c.model = gltf.scene;
      c.model.scale.set(1, 1, 1);
      c.model.position.set(0, 0, 0);
      c.model.visible = false;

      c.model.traverse((child) => {
        if (!child.isMesh) return;

        child.castShadow = true;
        child.receiveShadow = true;

        const name = (child.name || '').toLowerCase();
        const validNames = meshNameByKey[key] || [];

        if (validNames.includes(name)) {
          c.mesh = child;
        }
      });

      if (c.mesh) {
        c.texture = textureLoader.load(
          c.sprite,
          () => {
            c.texture.wrapS = THREE.RepeatWrapping;
            c.texture.wrapT = THREE.RepeatWrapping;
            c.texture.repeat.set(1 / c.totalFrames, 1);
            c.texture.flipY = false;
            c.texture.minFilter = THREE.NearestFilter;
            c.texture.magFilter = THREE.NearestFilter;

            c.mesh.material = new THREE.MeshStandardMaterial({
              map: c.texture,
              transparent: true,
              alphaTest: 0.5,
              side: THREE.DoubleSide,
              metalness: 0.0,
              roughness: 1.0
            });
            c.mesh.material.needsUpdate = true;
          }
        );
      }

      scene.add(c.model);
    });
  });
}

// ========================
//  VISIBILITÉ PERSONNAGES
// ========================

export function showCharacter(name) {
  Object.values(characters).forEach((c) => {
    if (c.model) c.model.visible = false;
  });
  const c = characters[name];
  if (c && c.model) c.model.visible = true;
}

export function hideAllCharacters() {
  Object.values(characters).forEach((c) => {
    if (c.model) c.model.visible = false;
  });
}

// ========================
//  UPDATE PERSONNAGES
// ========================

export function updateCharacters(deltaMs, isStarted) {
  if (!isStarted) return;

  Object.values(characters).forEach((c) => {
    if (!c.texture || !c.mesh || !c.model?.visible) return;

    const frameDurationMs = 1000 / c.fps;
    c.accumulatedTime += deltaMs;

    if (c.accumulatedTime >= frameDurationMs) {
      c.accumulatedTime -= frameDurationMs;
      c.currentFrame = (c.currentFrame + 1) % c.totalFrames;
      const uOffset = c.currentFrame / c.totalFrames;
      c.texture.offset.set(uOffset, 0);
    }
  });
}

// ========================
//  TAS D’OS + OISEAU
//  (pour "Reste humain")
// ========================

export const bonesBird = {
  model: null,
  bonesMesh: null,
  birdMesh: null,
  birdTexture: null,

  totalFrames: 77,   // nb de frames dans spritesheet6
  fps: 10,           // images/seconde

  // horloge du cycle (pour ce hover)
  time: 0,
  isActive: false
};

const bonesLoader = new GLTFLoader();

// ------------------------
//  INIT BONES + BIRD
// ------------------------
export function initBonesBird(scene) {
  bonesLoader.load('model/soliman-bones-bird.glb', (gltf) => {
    bonesBird.model = gltf.scene;
    bonesBird.model.visible = false;

    bonesBird.model.traverse((child) => {
      if (!child.isMesh) return;

      child.castShadow = true;
      child.receiveShadow = true;

      const name = (child.name || '').toLowerCase();
      if (name === 'bones_plane') bonesBird.bonesMesh = child;
      if (name === 'bird_plane')  bonesBird.birdMesh  = child;
    });

    // matériau du tas d’ossements (image fixe)
    if (bonesBird.bonesMesh) {
      const texBones = textureLoader.load('images/ossement.png');
      texBones.flipY = false;

      bonesBird.bonesMesh.material = new THREE.MeshStandardMaterial({
        map: texBones,
        transparent: true,
        alphaTest: 0.5,
        side: THREE.DoubleSide,
        metalness: 0,
        roughness: 1
      });
    }

    // spritesheet de l’oiseau
    if (bonesBird.birdMesh) {
      bonesBird.birdTexture = textureLoader.load(
        'images/spritesheet6.png',
        () => {
          bonesBird.birdTexture.wrapS = THREE.RepeatWrapping;
          bonesBird.birdTexture.wrapT = THREE.RepeatWrapping;
          bonesBird.birdTexture.repeat.set(1 / bonesBird.totalFrames, 1);
          bonesBird.birdTexture.flipY = false;
          bonesBird.birdTexture.minFilter = THREE.NearestFilter;
          bonesBird.birdTexture.magFilter = THREE.NearestFilter;

bonesBird.birdTexture.premultiplyAlpha = true; // optionnel, à tester
          bonesBird.birdMesh.material = new THREE.MeshStandardMaterial({
            map: bonesBird.birdTexture,
            transparent: false,
            alphaTest: 0.9,
            side: THREE.DoubleSide,
            metalness: 0.8,
            roughness: 0
          });
          bonesBird.birdMesh.material.needsUpdate = true;
        }
      );
    }

    scene.add(bonesBird.model);
  });
}

// ------------------------
//  CONTROLE START / STOP
// ------------------------

// appelé quand on survole "Reste humain"
export function startBonesBird() {
  if (!bonesBird.model) return;

  // nouveau cycle à chaque hover
  bonesBird.time = 0;
  bonesBird.isActive = true;
  bonesBird.model.visible = true;

  // place l’oiseau à sa position de départ + première frame
  if (bonesBird.birdMesh) {
    bonesBird.birdMesh.position.x = -8;
    bonesBird.birdMesh.position.y = 2;
  }
  if (bonesBird.birdTexture) {
    bonesBird.birdTexture.offset.set(0, 0);
  }
}

// appelé à la sortie du hover
export function stopBonesBird() {
  bonesBird.isActive = false;
  bonesBird.time = 0; // important : pour que le prochain hover recommence au début

  if (bonesBird.model) {
    bonesBird.model.visible = false;
  }
}

// ------------------------
//  UPDATE BONES + BIRD
// ------------------------

export function updateBonesBird(deltaMs, isStarted) {
  if (!isStarted || !bonesBird.isActive || !bonesBird.model) return;
  if (!bonesBird.birdMesh || !bonesBird.birdTexture) return;

  // durées en ms
  const animDuration  = (bonesBird.totalFrames / bonesBird.fps) * 1000; // durée animation
  const pauseDuration = 6000;                                           // pause après
  const startDelay    = 2000;                                           // délai au début

  const fullCycle = startDelay + animDuration + pauseDuration;

  // temps depuis le début du cycle ACTUEL (pour ce hover)
  bonesBird.time += deltaMs;
  if (bonesBird.time >= fullCycle) {
    // si on reste sur le bouton, on reboucle proprement
    bonesBird.time -= fullCycle;
  }

  const t = bonesBird.time;

  // ---------- PHASE 1 : DELAI INITIAL ----------
  if (t < startDelay) {
    // rien ne bouge — l’oiseau reste à la position de départ (fixée dans startBonesBird)
    return;
  }

  // ---------- PHASE 2 : ANIMATION ----------
  const tAnim = t - startDelay;

  if (tAnim < animDuration) {
    const tNorm = tAnim / animDuration; // 0 → 1 pendant l’anim

    // ===== SPRITESHEET =====
    const frameFloat = tNorm * bonesBird.totalFrames;
    const frameIndex = Math.floor(frameFloat) % bonesBird.totalFrames;
    const uOffset    = frameIndex / bonesBird.totalFrames;
    bonesBird.birdTexture.offset.set(uOffset, 0);

    // ===== TRAJECTOIRE =====
    // fraction de progression correspondant à certaines frames
    const approachEnd = 11 / bonesBird.totalFrames; // 0 → 10 ~ approche
    const perchEnd    = 60 / bonesBird.totalFrames; // 11 → 59 ~ posé

    const yHighIn  = 2;     // haut gauche
    const yPerch   = -0.14; // hauteur du tas d’os
    const yHighOut = 1.4;   // haut droite

    const smoothstep = (v) => v * v * (3 - 2 * v);

    let x, y;

    if (tNorm < approachEnd) {
      // arrive obliquement du haut gauche
      const tt = tNorm / approachEnd;
      const e  = smoothstep(tt);

      x = THREE.MathUtils.lerp(-8, 0, e);
      y = THREE.MathUtils.lerp(yHighIn, yPerch, e);

    } else if (tNorm < perchEnd) {
      // posé sur le tas d’os
      x = 0;
      y = yPerch;

    } else {
      // repart obliquement vers le haut à droite
      const tt = (tNorm - perchEnd) / (1 - perchEnd);
      const e  = smoothstep(tt);

      x = THREE.MathUtils.lerp(0, 8, e);
      y = THREE.MathUtils.lerp(yPerch, yHighOut, e);
    }

    bonesBird.birdMesh.position.x = x;
    bonesBird.birdMesh.position.y = y;

    return;
  }

  // ---------- PHASE 3 : PAUSE ----------
  // On ne touche plus à rien → dernière frame + dernière position figée pendant 6s
}

