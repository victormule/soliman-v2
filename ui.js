import { showCharacter, hideAllCharacters, startBonesBird, stopBonesBird } from './characters.js';
import { setActiveCharacter } from './interactions.js';


export function initUI(appState, canvas, core) {
  const overlay  = document.getElementById('overlay');
  const startBtn = document.getElementById('startButton');
  const uiPanel  = document.getElementById('uiPanel');

  appState.overlay = overlay;
  appState.uiPanel = uiPanel;
  const defaultTargetZ = core.defaultTargetZ;
  const zoomedTargetZ  = core.zoomedTargetZ;


  // =========================
  //  HELPERS FULLSCREEN / DEVICE
  // =========================

  function isMobile() {
    return /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  }

  function isFullscreen() {
    return !!(
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.msFullscreenElement
    );
  }

  async function enterFullscreenAndLock() {
    const elem = document.documentElement;

    try {
      if (elem.requestFullscreen) {
        await elem.requestFullscreen();
      } else if (elem.webkitRequestFullscreen) {
        await elem.webkitRequestFullscreen();
      } else if (elem.msRequestFullscreen) {
        await elem.msRequestFullscreen();
      }
    } catch (e) {
      console.warn('Fullscreen error:', e);
    }

    try {
      if (screen.orientation && screen.orientation.lock) {
        await screen.orientation.lock('landscape');
      }
    } catch (e) {
      console.warn('Orientation lock failed:', e);
    }
  }

  async function exitFullscreen() {
    try {
      if (document.exitFullscreen) {
        await document.exitFullscreen();
      } else if (document.webkitExitFullscreen) {
        await document.webkitExitFullscreen();
      } else if (document.msExitFullscreen) {
        await document.msExitFullscreen();
      }
    } catch (e) {
      console.warn('Exit fullscreen error:', e);
    }
  }

  async function toggleFullscreen() {
    if (isFullscreen()) {
      await exitFullscreen();
    } else {
      await enterFullscreenAndLock();
    }
  }

  // =========================
  //  BOUTON TOGGLE FULLSCREEN
  // =========================

  let fullscreenBtn = null;

  function updateFullscreenButton() {
    if (!fullscreenBtn) return;
    const fs = isFullscreen();
    fullscreenBtn.setAttribute('aria-pressed', fs ? 'true' : 'false');
    fullscreenBtn.classList.toggle('fs-active', fs);
  }

  function createFullscreenButton() {
    if (fullscreenBtn) return;

    fullscreenBtn = document.createElement('button');
    fullscreenBtn.id = 'fullscreenToggle';
    fullscreenBtn.type = 'button';

    const positions = ['tl', 'tr', 'bl', 'br'];
    positions.forEach((pos) => {
      const span = document.createElement('span');
      span.classList.add('fs-corner', `fs-${pos}`);
      fullscreenBtn.appendChild(span);
    });

    fullscreenBtn.style.display = 'none'; // on affichera après le start

    document.body.appendChild(fullscreenBtn);

    fullscreenBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleFullscreen().then(updateFullscreenButton);
    });

    document.addEventListener('fullscreenchange', updateFullscreenButton);
  }

  createFullscreenButton();

  // =========================
  //  AVERTISSEMENT PAYSAGE
  // =========================

  function handleOrientationWarning() {
    const isPortrait = window.innerHeight > window.innerWidth;
    document.body.classList.toggle(
      'force-landscape-warning',
      isPortrait && isMobile()
    );
  }

  window.addEventListener('orientationchange', handleOrientationWarning);
  window.addEventListener('resize', handleOrientationWarning);
  handleOrientationWarning();

  // =========================
  //  START
  // =========================

  if (startBtn && overlay && canvas) {
    startBtn.addEventListener('click', async () => {
      appState.isStarted = true;
      appState.progress = 0;

      canvas.classList.add('started');
      overlay.style.opacity = '0';
      overlay.style.pointerEvents = 'none';

      // son d'ambiance
      const audio = new Audio('sound/desert-ambiance.mp3');
      audio.loop = true;
      audio.volume = 0.4;
      audio.play().catch(() => {});

      // musique 2
      const music2 = new Audio('sound/music1.mp3');
      music2.loop = true;
      music2.volume = 0.2;
      music2.play().catch(() => {});

      if (isMobile() && !isFullscreen()) {
        await enterFullscreenAndLock();
      }

      if (fullscreenBtn) {
        fullscreenBtn.style.display = 'flex';
        updateFullscreenButton();
      }

      setTimeout(() => {
        if (overlay && overlay.parentNode) {
          overlay.parentNode.removeChild(overlay);
        }
      }, 700);
    });
  }

  // =========================
  //  POSITION SOURIS
  // =========================

  window.addEventListener('mousemove', (e) => {
    appState.mouseX = (e.clientX / window.innerWidth) * 2 - 1;
    appState.mouseY = (e.clientY / window.innerHeight) * 2 - 1;
  });

  // =========================
  //  SONS UI
  // =========================

  const HOVER_SOUND_SRC = 'sound/hover-title.mp3';
  const PRESS_SOUND_SRC = 'sound/press-title.mp3';

  function playHover() {
    const s = new Audio(HOVER_SOUND_SRC);
    s.volume = 0.01;
    s.play().catch(() => {});
  }

  function playPress() {
    const s = new Audio(PRESS_SOUND_SRC);
    s.volume = 0.2;
    s.play().catch(() => {});
  }

  // =========================
  //  BOUTONS DU PANEL
  // =========================

  const btnElHalaby = document.getElementById('btn-elhalaby');
  const btnAssassin = document.getElementById('btn-assassin');
  const btnMartyr   = document.getElementById('btn-martyr');
  const btnHero     = document.getElementById('btn-hero');
  const btnBody     = document.getElementById('btn-body');
  const btnHuman    = document.getElementById('btn-human');
  const btnMuseum   = document.getElementById('btn-museum');

  let activeButton = null;
  let activeName   = null;

  // =========================
  //  LOGIQUE PERSONNAGES / DÉCOR
  // =========================

  // Sélection "fixée" par clic
function applySelection(name) {
  hideAllCharacters();
  stopBonesBird();

  // décor interactif (plantes) piloté par interactions.js
  setActiveCharacter(name || null);

  if (!name) return;

  if (name === 'bones') {
    startBonesBird();
  } else {
    showCharacter(name);
  }
}
  // permet au main.js de déclencher un changement de personnage
  // au bon moment (fin de dézoom + fin de rembobinage)
  appState.applySelectionForCamera = applySelection;



  // Preview au hover : personnages uniquement, pas de décor
  function previewCharacter(name) {
    hideAllCharacters();
    stopBonesBird();

    if (!name) return;

    if (name === 'bones') {
      startBonesBird();
    } else {
      showCharacter(name);
    }
  }

  // =========================
  //  HOVER
  // =========================

  function addHover(btn, name) {
    if (!btn) return;

    btn.addEventListener('mouseenter', () => {
      playHover();

      // si un bouton est déjà activé en clic, pas de preview
      if (activeName) return;

      previewCharacter(name);
    });

    btn.addEventListener('mouseleave', () => {
      if (activeName) return;
      previewCharacter(null);
    });
  }

  // =========================
  //  CLICK
  // =========================

function addClick(btn, name) {
  if (!btn) return;

  btn.addEventListener('click', () => {
    // son de clic
    playPress();

    const isSameButton = (activeButton === btn);
    const hadActive    = !!activeButton;

    // =========================
    //  LOGIQUE ZOOM / DÉZOOM
    // =========================

    if (isSameButton) {
      // re-clic sur le même personnage :
      // on sort du mode "lock" → caméra en arrière
      core.targetPosition.z           = defaultTargetZ;
      appState.cameraSwitchPending    = false;
      appState.cameraSwitchTargetZ    = null;
      appState.cameraSwitchTargetCharacter = null;
      appState.cameraSwitchZoomOutDone     = false;
      appState.decorClosingDoneForSwitch   = false;
    } else {
      if (hadActive) {
        // on change de personnage :
        // 1) on demande un dézoom vers la position "loin"
        core.targetPosition.z            = defaultTargetZ;
        // 2) on prépare une transition "dézoom → (fin rembobinage) → re-zoom"
        appState.cameraSwitchPending     = true;
        appState.cameraSwitchTargetZ     = zoomedTargetZ;
        appState.cameraSwitchTargetCharacter = name;
        appState.cameraSwitchZoomOutDone     = false;
        appState.decorClosingDoneForSwitch   = false;
      } else {
        // premier personnage sélectionné :
        // zoom direct
        core.targetPosition.z            = zoomedTargetZ;
        appState.cameraSwitchPending     = false;
        appState.cameraSwitchTargetZ     = null;
        appState.cameraSwitchTargetCharacter = null;
        appState.cameraSwitchZoomOutDone     = false;
        appState.decorClosingDoneForSwitch   = false;
      }
    }

    // =========================
    //  LOGIQUE PERSONNAGE / DÉCOR
    // =========================

    if (isSameButton) {
      // re-clic sur le même bouton => on désactive le "lock"
      btn.classList.remove('active');
      activeButton = null;
      activeName   = null;

      // rembobinage du décor (interactions.js gère l'autoClosing sur null)
      setActiveCharacter(null);

      // le personnage reste visible tant que la souris est sur le bouton ;
      // le mouseleave s'occupera de le cacher.
      return;
    }

    // nouveau bouton sélectionné
    if (activeButton) {
      activeButton.classList.remove('active');
    }

    activeButton = btn;
    activeName   = name;
    btn.classList.add('active');

    if (!hadActive) {
      // 1er personnage choisi : on applique tout de suite
      applySelection(name);
    } else {
      // changement de personnage :
      // on lance seulement le rembobinage de l'ancien via interactions,
      // le vrai changement (applySelection) sera déclenché plus tard
      // par main.js quand :
      //  - dézoom terminé
      //  - rembobinage terminé
      setActiveCharacter(name);
    }
  });
}

  // =========================
  //  ASSIGNATION DES BOUTONS
  // =========================

  addHover(btnElHalaby, 'student');
  addClick(btnElHalaby, 'student');

  addHover(btnAssassin, 'assassin');
  addClick(btnAssassin, 'assassin');

  addHover(btnMartyr, 'martyr');
  addClick(btnMartyr, 'martyr');

  addHover(btnHero, 'hero');
  addClick(btnHero, 'hero');

  addHover(btnBody, 'body');
  addClick(btnBody, 'body');

  addHover(btnHuman, 'bones');
  addClick(btnHuman, 'bones');

  addHover(btnMuseum, 'museum');
  addClick(btnMuseum, 'museum');
}
