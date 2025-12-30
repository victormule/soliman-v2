import * as THREE from 'three';
import { OrbitControls } from 'OrbitControls';
import { Sky } from 'Sky';
import { GLTFLoader } from 'GLTFLoader';
import { initScenePlanes } from './scenePlanes.js';
export const DEBUG_CAMERA = false;

// initialisation de la scène, du renderer, de la caméra, du sol, du ciel, des plantes…
export function initCore() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf0f0f0);
  scene.fog = new THREE.Fog(0x5f3d3f, 25, 90);

  const camera = new THREE.PerspectiveCamera(
    45,
    window.innerWidth / window.innerHeight,
    0.1,
    200
  );
  const startPosition = new THREE.Vector3(-5, 5, 70);

  const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  // position "loin" par défaut
  const targetPosition = new THREE.Vector3(0, 1.5, isMobile ? 16.5 : 17.5);

  // on mémorise les deux distances pour pouvoir les réutiliser côté UI
  const defaultTargetZ = targetPosition.z;                 // 16.5 ou 17.5
  const zoomedTargetZ  = isMobile ? 15.5 : 17.1;           // 16.0 ou 17.0


  camera.position.copy(startPosition);
  camera.lookAt(0, 1.5, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);

  // ==== SHADOW MAP ====
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  document.body.appendChild(renderer.domElement);

  let controls = null;
  if (DEBUG_CAMERA) {
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
  }

  // ==== LUMIÈRES ====
  const light = new THREE.DirectionalLight(0xffffff, 2.5);
  light.position.set(45, 10, 30);
  light.castShadow = true;

  // résolution plus fine du shadow map
  light.shadow.mapSize.set(4096, 4096);

  // on resserre un peu la caméra d’ombre autour de la scène utile
  light.shadow.camera.left   = -30;
  light.shadow.camera.right  =  30;
  light.shadow.camera.top    =  30;
  light.shadow.camera.bottom = -30;
  light.shadow.camera.near   =   2;
  light.shadow.camera.far    =  80;

  // réduisent fortement les rayures / aliasing sur les surfaces planes
  light.shadow.bias = -0.0003;
  light.shadow.normalBias = 0.02;

  scene.add(light);

  const ambient = new THREE.AmbientLight(0xffffff, 0.2);
  scene.add(ambient);

  // ==== SOL RÉALISTE (sable ondulé) ====
  const textureLoader = new THREE.TextureLoader();

  const groundTexture = textureLoader.load('images/ground.jpg');
  groundTexture.wrapS = THREE.RepeatWrapping;
  groundTexture.wrapT = THREE.RepeatWrapping;
  groundTexture.repeat.set(20, 20);
  groundTexture.offset.set(0.25, 0.1);
  groundTexture.anisotropy = 8;

  const groundMaterial = new THREE.MeshStandardMaterial({
    map: groundTexture,
    roughness: 1.0,
    metalness: 0.0,
    side: THREE.FrontSide // pas besoin du dessous, évite des soucis d'ombre
  });

  const groundGeometry = new THREE.PlaneGeometry(400, 400, 200, 200);
  const pos = groundGeometry.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);

    const wave1 = Math.sin(x * 10.05) * 0.4;
    const wave2 = Math.cos(y * 10.04) * 0.3;
    const noise = Math.sin((x + y) * 0.1) * 0.15;

    const height = (wave1 + wave2 + noise) * 0.35;
    pos.setZ(i, height);
  }
  pos.needsUpdate = true;
  groundGeometry.computeVertexNormals();

  const ground = new THREE.Mesh(groundGeometry, groundMaterial);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.75;
  ground.receiveShadow = true;
  ground.renderOrder = -1;
  scene.add(ground);

  // ==== CIEL ====
  const sky = new Sky();
  sky.scale.setScalar(450000);
  scene.add(sky);
  const skyUniforms = sky.material.uniforms;
  skyUniforms['turbidity'].value = 8;
  skyUniforms['rayleigh'].value = 2.5;
  skyUniforms['mieCoefficient'].value = 0.005;
  skyUniforms['mieDirectionalG'].value = 0.9;

  const sunPosition = new THREE.Vector3();
  const inclination = 0.5;
  const azimuth     = 0.5;
  const theta = Math.PI * (inclination - 0.5);
  const phi   = 2 * Math.PI * (azimuth - 0.5);
  sunPosition.x = Math.cos(phi);
  sunPosition.y = Math.sin(theta);
  sunPosition.z = Math.sin(phi);
  skyUniforms['sunPosition'].value.copy(sunPosition);

  // ==== PLANTES ANIMÉES + SCÈNE PRINCIPALE ====
  const animatedPlants = [];
  const animNames = new Set([
    'palm1','palm2','palm3','palm4','palm5','palm6','palm7','palm8','palm9','palm10','palm11','palm12',
    'plante1','plante2','plante3','plante4','plante5','plante6','plante7','plante8','plante9',
    'tree1','tree2','tree3','tree4','tree5','tree6','tree7','tree8','tree9','tree10','tree11','tree12','tree13'
  ]);

  const loader = new GLTFLoader();
loader.load('model/scene.glb', (gltf) => {
  const model = gltf.scene;
  model.scale.set(1, 1, 1);

  model.traverse((child) => {
    if (!child.isMesh) return;

    // on garde les ombres sur le décor principal
    child.castShadow = true;
    child.receiveShadow = true;

    const name = (child.name || '').toLowerCase();
    const parentName =
      child.parent && child.parent.name
        ? child.parent.name.toLowerCase()
        : '';

    if (animNames.has(name) || animNames.has(parentName)) {
      animatedPlants.push({
        mesh: child,
        baseRotation: child.rotation.clone(),
        offset: Math.random() * Math.PI * 2
      });
    }
  });

  // ⬅️ nouveau : on applique les textures (tree/plante/palm/decor1/decor2)
  initScenePlanes(model);

  scene.add(model);
});


  // paramètres caméra animée
  const lookTarget = new THREE.Vector3(0, 1.5, 0);
  const baseCamPos = new THREE.Vector3().copy(startPosition);
  const shakeAmp = 0.02;
  const speed = 0.008;

  return {
    scene,
    camera,
    renderer,
    controls,
    animatedPlants,
    startPosition,
    targetPosition,
    lookTarget,
    baseCamPos,
    shakeAmp,
    speed,
    defaultTargetZ,
    zoomedTargetZ
  };
}


// met à jour la caméra + les plantes qui bougent
export function updateCameraAndPlants(time, deltaMs, core, appState) {
  const t = (time || 0) * 0.001;

  if (!DEBUG_CAMERA && appState.isStarted) {
    // =========================
    //  INTRO : start → target
    // =========================
    if (appState.progress < 1) {
      appState.progress += core.speed;
      if (appState.progress > 1) appState.progress = 1;
    }

    if (appState.progress < 1) {
      // phase d'intro : on lerp entre start et target
      core.baseCamPos.lerpVectors(core.startPosition, core.targetPosition, appState.progress);
    } else {
      // =========================
      //  MOUVEMENTS DE ZOOM APRÈS INTRO
      // =========================
      const smoothFactor = 0.05; // plus petit = zoom/dézoom plus lent
      core.baseCamPos.lerp(core.targetPosition, smoothFactor);

      // si on a demandé "dézoom puis re-zoom" lors d'un changement de perso
      if (appState.cameraSwitchPending) {
        const dz = Math.abs(core.baseCamPos.z - core.targetPosition.z);

        // on considère qu'on a fini le dézoom quand on est très proche de defaultTargetZ
        if (dz < 0.2 && core.targetPosition.z === core.defaultTargetZ ) {
          // on déclenche la phase "zoom in" vers zoomedTargetZ
          core.targetPosition.z = appState.cameraSwitchTargetZ ?? core.zoomedTargetZ;
          appState.cameraSwitchPending = false;
          appState.cameraSwitchTargetZ = null;
        }
      }
    }

    // tremblement léger
    const shakeX = (Math.sin(t * 1.0) + Math.sin(t * 3.0 + 1.5)) * 0.5 * core.shakeAmp;
    const shakeY = Math.sin(t * 2.0 + 0.3) * core.shakeAmp;
    const shakeZ = Math.sin(t * 1.5 + 0.7) * core.shakeAmp;

    core.camera.position.set(
      core.baseCamPos.x + shakeX,
      core.baseCamPos.y + shakeY,
      core.baseCamPos.z + shakeZ
    );

    const desiredLook = new THREE.Vector3(
      0 + appState.mouseX * 0.5,
      1.5 + appState.mouseY * 0.3,
      0
    );
    core.lookTarget.lerp(desiredLook, 0.08);
    core.camera.lookAt(core.lookTarget);
  }

  if (appState.isStarted) {
    core.animatedPlants.forEach((item) => {
      const { mesh, baseRotation, offset } = item;
      const sway = Math.sin(t * 0.5 + offset) * 0.04;
      mesh.rotation.x = baseRotation.x + sway;
    });
  }
}


