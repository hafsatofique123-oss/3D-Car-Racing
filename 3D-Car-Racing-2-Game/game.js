/**
 * 3D Speed Racer — Nitro Realistic Edition
 * Built with Three.js and Anime.js
 */

(function () {
  'use strict';

  // Ensure Three.js is loaded
  if (typeof THREE === 'undefined') {
    console.error('Three.js is not loaded. Please ensure assets/three.min.js is present.');
    return;
  }

  /* ==========================================================================
     GAME CONFIGURATION & STATE
     ========================================================================== */
  const CONFIG = {
    roadWidth: 14.5,
    lanes: [-4.6, -1.55, 1.55, 4.6],
    trackLength: 260,
    baseSpeed: 24,       // ~86 km/h
    normalMaxSpeed: 42,  // ~151 km/h
    nitroMaxSpeed: 76,   // ~274 km/h
    accel: 22,
    nitroAccel: 48,
    brakeDecel: 38,
    friction: 6.5,
    nitroDrainRate: 20,  // % per second (~5s total continuous boost)
    nitroRechargeRate: 6,// % per second cruising safely
    nearMissBonus: 22    // % instant nitro gained per near miss
  };

  const state = {
    running: false,
    speed: CONFIG.baseSpeed,
    topSpeed: 0,
    distance: 0,
    score: 0,
    nearMisses: 0,
    nitro: 100,
    isBoosting: false,
    selectedColor: 0xe52d27,
    soundEnabled: true,
    lastTime: 0,
    spawnTimer: 0,
    gear: 1
  };

  const keys = {
    left: false,
    right: false,
    gas: false,
    brake: false,
    nitro: false
  };

  /* ==========================================================================
     DOM ELEMENTS
     ========================================================================== */
  const mount = document.getElementById('game');
  const distanceEl = document.getElementById('distance');
  const scoreEl = document.getElementById('score');
  const nearMissesEl = document.getElementById('nearMisses');
  const speedEl = document.getElementById('speed');
  const gearEl = document.getElementById('gear');
  const nitroPercentEl = document.getElementById('nitroPercent');
  const nitroFillEl = document.getElementById('nitroFill');
  const nitroClusterEl = document.getElementById('nitroCluster');
  const nitroVignetteEl = document.getElementById('nitroVignette');
  const gaugeNeedleEl = document.getElementById('gaugeNeedle');
  const gaugeActiveArcEl = document.getElementById('gaugeActiveArc');
  const comboBannerEl = document.getElementById('comboBanner');
  const countdownOverlayEl = document.getElementById('countdownOverlay');
  const countdownTextEl = document.getElementById('countdownText');
  const messageEl = document.getElementById('message');
  const soundBtn = document.getElementById('soundBtn');

  /* ==========================================================================
     PROCEDURAL TEXTURE GENERATORS (Zero-CORS, Works Offline & over file://)
     ========================================================================== */
  
  // 1. Realistic Road Asphalt Texture
  function createRoadTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');

    // Asphalt dark stone base
    ctx.fillStyle = '#26282e';
    ctx.fillRect(0, 0, 1024, 1024);

    // Stone aggregate speckles & grain noise
    const imgData = ctx.getImageData(0, 0, 1024, 1024);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
      const noise = (Math.random() - 0.5) * 32;
      data[i] = Math.min(255, Math.max(0, data[i] + noise));
      data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + noise));
      data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + noise));
    }
    ctx.putImageData(imgData, 0, 0);

    // Asphalt variation patches
    ctx.fillStyle = 'rgba(20, 22, 26, 0.35)';
    for (let j = 0; j < 30; j++) {
      ctx.beginPath();
      ctx.arc(Math.random() * 1024, Math.random() * 1024, Math.random() * 80 + 30, 0, Math.PI * 2);
      ctx.fill();
    }

    // Tire skid rubber streaks
    ctx.strokeStyle = 'rgba(15, 16, 20, 0.45)';
    ctx.lineWidth = 14;
    for (const sx of [280, 480, 560, 760]) {
      ctx.beginPath();
      ctx.moveTo(sx, 0);
      ctx.lineTo(sx + (Math.random() - 0.5) * 20, 1024);
      ctx.stroke();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(2, 24);

    // Also attempt loading external asset safely if running on web server
    if (typeof location !== 'undefined' && location.protocol.startsWith('http')) {
      const loader = new THREE.TextureLoader();
      loader.load('assets/asphalt.jpg', realTex => {
        realTex.wrapS = THREE.RepeatWrapping;
        realTex.wrapT = THREE.RepeatWrapping;
        realTex.repeat.set(2, 24);
        roadMat.map = realTex;
        roadMat.needsUpdate = true;
      }, undefined, () => {});
    }

    return tex;
  }

  // 2. Realistic Sky Panorama Texture
  function createSkyTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 2048;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');

    // Sky atmospheric gradient
    const skyGrad = ctx.createLinearGradient(0, 0, 0, 1024);
    skyGrad.addColorStop(0, '#10223d');    // Deep zenith blue
    skyGrad.addColorStop(0.35, '#2b588e'); // Mid sky blue
    skyGrad.addColorStop(0.65, '#5c8bb8'); // Lower sky
    skyGrad.addColorStop(0.85, '#e09867'); // Horizon golden glow
    skyGrad.addColorStop(0.92, '#f6ba84'); // Warm horizon rim
    skyGrad.addColorStop(1.0, '#384656');  // Ground transition
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, 2048, 1024);

    // Glowing sun flare
    const sunGrad = ctx.createRadialGradient(850, 720, 10, 850, 720, 380);
    sunGrad.addColorStop(0, 'rgba(255, 255, 245, 1)');
    sunGrad.addColorStop(0.2, 'rgba(255, 225, 170, 0.75)');
    sunGrad.addColorStop(0.6, 'rgba(255, 180, 120, 0.25)');
    sunGrad.addColorStop(1, 'rgba(255, 160, 100, 0)');
    ctx.fillStyle = sunGrad;
    ctx.fillRect(0, 340, 2048, 684);

    // Distant mountain ranges along the horizon
    function drawMountains(baseY, height, color, frequency, roughness) {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(0, 1024);
      ctx.lineTo(0, baseY);
      for (let x = 0; x <= 2048; x += 16) {
        const y = baseY - Math.sin(x * frequency) * height - Math.cos(x * frequency * 2.3) * (height * 0.4) - (Math.random() - 0.5) * roughness;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(2048, 1024);
      ctx.closePath();
      ctx.fill();
    }

    drawMountains(820, 130, 'rgba(65, 82, 110, 0.65)', 0.0035, 8); // Back mountains
    drawMountains(860, 95, 'rgba(42, 56, 78, 0.85)', 0.006, 6);   // Mid ridge
    drawMountains(910, 55, 'rgba(28, 38, 54, 0.96)', 0.012, 4);   // Foreground foothills

    // Soft cumulus clouds
    ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
    for (let c = 0; c < 24; c++) {
      const cx = (c * 95 + Math.random() * 40) % 2048;
      const cy = 380 + Math.random() * 220;
      const cr = 45 + Math.random() * 65;
      ctx.beginPath();
      ctx.arc(cx, cy, cr, 0, Math.PI * 2);
      ctx.arc(cx + cr * 0.7, cy - 10, cr * 0.8, 0, Math.PI * 2);
      ctx.arc(cx - cr * 0.6, cy + 5, cr * 0.65, 0, Math.PI * 2);
      ctx.fill();
    }

    const tex = new THREE.CanvasTexture(canvas);

    // Also attempt loading external asset safely if running on web server
    if (typeof location !== 'undefined' && location.protocol.startsWith('http')) {
      const loader = new THREE.TextureLoader();
      loader.load('assets/sky.jpg', realTex => {
        skyMat.map = realTex;
        skyMat.needsUpdate = true;
      }, undefined, () => {});
    }

    return tex;
  }

  // 3. Realistic Grass & Terrain Texture
  function createGrassTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#4c6c42';
    ctx.fillRect(0, 0, 512, 512);

    // Noise variation
    const imgData = ctx.getImageData(0, 0, 512, 512);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
      const noise = (Math.random() - 0.5) * 40;
      data[i] = Math.min(255, Math.max(0, data[i] + noise * 0.7));
      data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + noise));
      data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + noise * 0.5));
    }
    ctx.putImageData(imgData, 0, 0);

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(16, 32);

    if (typeof location !== 'undefined' && location.protocol.startsWith('http')) {
      const loader = new THREE.TextureLoader();
      loader.load('assets/grass.jpg', realTex => {
        realTex.wrapS = THREE.RepeatWrapping;
        realTex.wrapT = THREE.RepeatWrapping;
        realTex.repeat.set(16, 32);
        groundMat.map = realTex;
        groundMat.needsUpdate = true;
      }, undefined, () => {});
    }

    return tex;
  }

  // 4. Procedural Carbon Fiber Texture
  function createCarbonTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#161616';
    ctx.fillRect(0, 0, 64, 64);

    ctx.fillStyle = '#282828';
    for (let y = 0; y < 64; y += 8) {
      for (let x = 0; x < 64; x += 8) {
        if ((x + y) % 16 === 0) {
          ctx.fillRect(x, y, 8, 8);
        }
      }
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(6, 6);
    return tex;
  }

  // 5. Procedural Trackside Racing Billboards
  function createBillboardTextures() {
    const configs = [
      {
        bg: '#0e1726',
        stripe: '#e52d27',
        title: 'ITALIAN GT RACER',
        sub: '458 V8 COMPETIZIONE',
        badge: 'SCUDERIA'
      },
      {
        bg: '#1b170e',
        stripe: '#ffb300',
        title: 'PIRELLI P-ZERO',
        sub: 'ULTRA HIGH PERFORMANCE GRIP',
        badge: 'MOTORSPORT'
      },
      {
        bg: '#091c2b',
        stripe: '#00e5ff',
        title: 'NITRO BOOST HYPER',
        sub: 'HOLD SPACE FOR HIGH-OCTANE SPEED',
        badge: 'NOS 100%'
      },
      {
        bg: '#1f0d14',
        stripe: '#ff3366',
        title: 'SHELL V-POWER RACE',
        sub: 'UNLEASH PEAK TURBOCHARGED POWER',
        badge: 'CIRCUIT TECH'
      }
    ];

    const textures = configs.map((cfg, idx) => {
      const canvas = document.createElement('canvas');
      canvas.width = 1024;
      canvas.height = 512;
      const ctx = canvas.getContext('2d');

      // Card Background
      ctx.fillStyle = cfg.bg;
      ctx.fillRect(0, 0, 1024, 512);

      // Accent diagonal racing stripes
      ctx.fillStyle = cfg.stripe;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(260, 0);
      ctx.lineTo(140, 512);
      ctx.lineTo(0, 512);
      ctx.fill();

      ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.fillRect(0, 470, 1024, 42);

      // Badge tag
      ctx.fillStyle = cfg.stripe;
      ctx.fillRect(320, 85, 180, 42);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 22px Arial, sans-serif';
      ctx.fillText(cfg.badge, 335, 114);

      // Main Title
      ctx.fillStyle = '#ffffff';
      ctx.font = '900 68px Arial, sans-serif';
      ctx.fillText(cfg.title, 320, 215);

      // Subtitle
      ctx.fillStyle = '#9cb6d5';
      ctx.font = 'bold 30px Arial, sans-serif';
      ctx.fillText(cfg.sub, 320, 280);

      // Border outline
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.lineWidth = 14;
      ctx.strokeRect(7, 7, 1010, 498);

      const tex = new THREE.CanvasTexture(canvas);

      // Try loading real image asset if running on http server
      if (typeof location !== 'undefined' && location.protocol.startsWith('http')) {
        const loader = new THREE.TextureLoader();
        loader.load(`assets/billboard${idx + 1}.jpg`, realTex => {
          tex.image = realTex.image;
          tex.needsUpdate = true;
        }, undefined, () => {});
      }

      return tex;
    });

    return textures;
  }

  /* ==========================================================================
     AUDIO SYNTHESIZER (Web Audio API - Dynamic RPM, Nitro, Screech & Crash)
     ========================================================================== */
  class SoundEngine {
    constructor() {
      this.ctx = null;
      this.master = null;
      this.engineOsc = null;
      this.engineGain = null;
      this.nitroGain = null;
      this.nitroFilter = null;
      this.screechGain = null;
      this.screechFilter = null;
      this.initialized = false;
    }

    init() {
      if (this.initialized) return;
      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioCtx();

        this.master = this.ctx.createGain();
        this.master.gain.value = 0.5;
        this.master.connect(this.ctx.destination);

        // 1. Engine Oscillator (Sawtooth simulating multi-cylinder firing)
        this.engineOsc = this.ctx.createOscillator();
        this.engineOsc.type = 'sawtooth';
        this.engineFilter = this.ctx.createBiquadFilter();
        this.engineFilter.type = 'lowpass';
        this.engineFilter.frequency.value = 400;
        this.engineGain = this.ctx.createGain();
        this.engineGain.gain.value = 0.16;

        this.engineOsc.connect(this.engineFilter);
        this.engineFilter.connect(this.engineGain);
        this.engineGain.connect(this.master);
        this.engineOsc.start();

        // 2. White Noise Source (for Nitro blast & tire screech)
        const bufferSize = this.ctx.sampleRate * 2;
        const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          output[i] = Math.random() * 2 - 1;
        }

        const noiseNode = this.ctx.createBufferSource();
        noiseNode.buffer = noiseBuffer;
        noiseNode.loop = true;

        // Nitro Jet Path
        this.nitroFilter = this.ctx.createBiquadFilter();
        this.nitroFilter.type = 'bandpass';
        this.nitroFilter.frequency.value = 750;
        this.nitroFilter.Q.value = 1.3;
        this.nitroGain = this.ctx.createGain();
        this.nitroGain.gain.value = 0;

        // Screech Path
        this.screechFilter = this.ctx.createBiquadFilter();
        this.screechFilter.type = 'bandpass';
        this.screechFilter.frequency.value = 2400;
        this.screechFilter.Q.value = 4.0;
        this.screechGain = this.ctx.createGain();
        this.screechGain.gain.value = 0;

        noiseNode.connect(this.nitroFilter);
        this.nitroFilter.connect(this.nitroGain);
        this.nitroGain.connect(this.master);

        noiseNode.connect(this.screechFilter);
        this.screechFilter.connect(this.screechGain);
        this.screechGain.connect(this.master);

        noiseNode.start();
        this.initialized = true;
      } catch (e) {
        console.warn('Web Audio not available or blocked:', e);
      }
    }

    update(speedKmh, isBoosting, isTurning) {
      if (!this.initialized || !state.soundEnabled || !this.ctx || this.ctx.state !== 'running') return;
      try {
        const baseFreq = 55 + (speedKmh % 52) * 2.4 + (state.gear * 14);
        this.engineOsc.frequency.setTargetAtTime(baseFreq, this.ctx.currentTime, 0.05);
        this.engineFilter.frequency.setTargetAtTime(320 + speedKmh * 8.5, this.ctx.currentTime, 0.05);

        const targetNitro = isBoosting ? 0.38 : 0;
        this.nitroGain.gain.setTargetAtTime(targetNitro, this.ctx.currentTime, 0.08);

        const targetScreech = (isTurning && speedKmh > 95) ? 0.16 : 0;
        this.screechGain.gain.setTargetAtTime(targetScreech, this.ctx.currentTime, 0.06);
      } catch (e) {}
    }

    playNearMiss() {
      if (!this.initialized || !state.soundEnabled || !this.ctx) return;
      try {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(620, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1250, this.ctx.currentTime + 0.22);
        gain.gain.setValueAtTime(0.25, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.22);
        osc.connect(gain);
        gain.connect(this.master);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.23);
      } catch (e) {}
    }

    playCrash() {
      if (!this.initialized || !state.soundEnabled || !this.ctx) return;
      try {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(140, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(25, this.ctx.currentTime + 0.45);
        gain.gain.setValueAtTime(0.6, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.45);
        osc.connect(gain);
        gain.connect(this.master);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.46);
      } catch (e) {}
    }

    toggle() {
      state.soundEnabled = !state.soundEnabled;
      soundBtn.textContent = state.soundEnabled ? '🔊' : '🔇';
      if (this.master && this.ctx) {
        this.master.gain.setTargetAtTime(state.soundEnabled ? 0.5 : 0, this.ctx.currentTime, 0.05);
      }
    }

    resume() {
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
    }
  }
  const audio = new SoundEngine();

  /* ==========================================================================
     THREE.JS SCENE SETUP & ENVIRONMENT
     ========================================================================== */
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x8cb5df, 0.0072);

  const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 800);
  camera.position.set(0, 5.2, 11.5);
  camera.lookAt(0, 1.2, -6);

  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  if (THREE.SRGBColorSpace) renderer.outputColorSpace = THREE.SRGBColorSpace;
  else if (THREE.sRGBEncoding) renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  mount.appendChild(renderer.domElement);

  // Sunlight and ambient hemisphere lighting
  const hemiLight = new THREE.HemisphereLight(0xddeeff, 0x3d4936, 1.6);
  scene.add(hemiLight);

  const sun = new THREE.DirectionalLight(0xfff6ea, 2.4);
  sun.position.set(-30, 60, 25);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.near = 10;
  sun.shadow.camera.far = 180;
  sun.shadow.camera.left = -25;
  sun.shadow.camera.right = 25;
  sun.shadow.camera.top = 25;
  sun.shadow.camera.bottom = -25;
  scene.add(sun);

  // 1. Sky Dome Mesh
  const skyMat = new THREE.MeshBasicMaterial({
    map: createSkyTexture(),
    side: THREE.BackSide,
    fog: false
  });
  const skyDome = new THREE.Mesh(new THREE.SphereGeometry(450, 32, 24), skyMat);
  scene.add(skyDome);

  // 2. Highway Asphalt Surface
  const roadMat = new THREE.MeshStandardMaterial({
    map: createRoadTexture(),
    roughness: 0.85,
    metalness: 0.15,
    color: 0x484c54
  });
  const roadPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(CONFIG.roadWidth, CONFIG.trackLength),
    roadMat
  );
  roadPlane.rotation.x = -Math.PI / 2;
  roadPlane.position.set(0, 0, -CONFIG.trackLength / 2 + 30);
  roadPlane.receiveShadow = true;
  scene.add(roadPlane);

  // 3. Terrain / Grass flanking the highway
  const groundMat = new THREE.MeshStandardMaterial({
    map: createGrassTexture(),
    roughness: 0.95,
    metalness: 0.05,
    color: 0x5a7550
  });
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(360, CONFIG.trackLength * 1.5),
    groundMat
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -0.05, -CONFIG.trackLength / 2);
  ground.receiveShadow = true;
  scene.add(ground);

  // 4. Road Edge Lines & Center Dashes
  const edgeLineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const yellowLineMat = new THREE.MeshBasicMaterial({ color: 0xffcc00 });

  for (const x of [-CONFIG.roadWidth / 2 + 0.2, CONFIG.roadWidth / 2 - 0.2]) {
    const line = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, 0.04, CONFIG.trackLength),
      edgeLineMat
    );
    line.position.set(x, 0.02, -CONFIG.trackLength / 2 + 30);
    scene.add(line);
  }

  const laneMarks = [];
  for (let laneIdx = 1; laneIdx < CONFIG.lanes.length; laneIdx++) {
    const x = (CONFIG.lanes[laneIdx - 1] + CONFIG.lanes[laneIdx]) / 2;
    const isCenter = laneIdx === 2;
    const dashMat = isCenter ? yellowLineMat : edgeLineMat;

    for (let i = 0; i < 28; i++) {
      const dash = new THREE.Mesh(
        new THREE.BoxGeometry(0.14, 0.03, 3.6),
        dashMat
      );
      dash.position.set(x, 0.02, -i * 8.5 + 20);
      scene.add(dash);
      laneMarks.push(dash);
    }
  }

  // 5. Metallic Guardrails with Reflectors
  const guardrailMat = new THREE.MeshStandardMaterial({
    color: 0xa8b4c0,
    metalness: 0.85,
    roughness: 0.25
  });
  const postMat = new THREE.MeshStandardMaterial({ color: 0x333a42, roughness: 0.7 });
  const reflectorMat = new THREE.MeshBasicMaterial({ color: 0xff3300 });

  function buildGuardrails() {
    for (const side of [-1, 1]) {
      const x = side * (CONFIG.roadWidth / 2 + 0.6);
      const beam = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, 0.45, CONFIG.trackLength),
        guardrailMat
      );
      beam.position.set(x, 0.7, -CONFIG.trackLength / 2 + 30);
      beam.castShadow = true;
      scene.add(beam);

      for (let z = 20; z > -CONFIG.trackLength + 20; z -= 8) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.9, 0.15), postMat);
        post.position.set(x, 0.45, z);
        scene.add(post);

        const reflector = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.12, 0.12), reflectorMat);
        reflector.position.set(x - side * 0.08, 0.72, z);
        scene.add(reflector);
      }
    }
  }
  buildGuardrails();

  // 6. Trackside Billboards with Real/Procedural Imagery
  const billboardTextures = createBillboardTextures();
  const billboards = [];
  const trussMat = new THREE.MeshStandardMaterial({ color: 0x6e7b8c, metalness: 0.8, roughness: 0.3 });
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x1f242c, metalness: 0.6, roughness: 0.4 });

  function createBillboard(x, z, texIdx, side) {
    const group = new THREE.Group();

    const posterGeo = new THREE.PlaneGeometry(12, 6.5);
    const posterMat = new THREE.MeshStandardMaterial({
      map: billboardTextures[texIdx % billboardTextures.length],
      roughness: 0.4,
      metalness: 0.15
    });
    const poster = new THREE.Mesh(posterGeo, posterMat);
    poster.position.set(0, 7.8, 0);
    poster.rotation.y = side < 0 ? Math.PI / 12 : -Math.PI / 12;
    group.add(poster);

    const frame = new THREE.Mesh(new THREE.BoxGeometry(12.4, 6.9, 0.35), frameMat);
    frame.position.copy(poster.position);
    frame.position.z -= 0.2;
    frame.rotation.copy(poster.rotation);
    group.add(frame);

    for (const pOffset of [-3.8, 3.8]) {
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.3, 8.5, 8), trussMat);
      pillar.position.set(pOffset, 4.25, -0.28);
      pillar.castShadow = true;
      group.add(pillar);
    }

    group.position.set(x, 0, z);
    scene.add(group);
    billboards.push(group);
  }

  for (let i = 0; i < 8; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const x = side * (CONFIG.roadWidth / 2 + 7.5);
    createBillboard(x, -i * 32 - 15, i, side);
  }

  // 7. Overhead Highway Gantry Bridges
  const gantries = [];
  function createGantry(z) {
    const gantry = new THREE.Group();
    const span = CONFIG.roadWidth + 4;

    const beam = new THREE.Mesh(new THREE.BoxGeometry(span, 0.8, 1.2), trussMat);
    beam.position.set(0, 6.8, 0);
    beam.castShadow = true;
    gantry.add(beam);

    for (const side of [-1, 1]) {
      const col = new THREE.Mesh(new THREE.BoxGeometry(0.6, 7.2, 0.6), trussMat);
      col.position.set(side * (span / 2), 3.6, 0);
      gantry.add(col);
    }

    const signMat = new THREE.MeshBasicMaterial({ color: 0x004d26 });
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(8, 2.2), signMat);
    sign.position.set(0, 6.8, 0.62);
    gantry.add(sign);

    gantry.position.set(0, 0, z);
    scene.add(gantry);
    gantries.push(gantry);
  }
  for (let i = 0; i < 3; i++) {
    createGantry(-i * 85 - 40);
  }

  // 8. Roadside Street Lamps
  const streetLights = [];
  function createStreetLight(x, z, side) {
    const group = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 8, 8), trussMat);
    pole.position.y = 4;
    group.add(pole);

    const arm = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.12, 0.12), trussMat);
    arm.position.set(side * 1.1, 7.8, 0);
    group.add(arm);

    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.15, 0.3), new THREE.MeshBasicMaterial({ color: 0xffeedd }));
    lamp.position.set(side * 2.2, 7.7, 0);
    group.add(lamp);

    group.position.set(x, 0, z);
    scene.add(group);
    streetLights.push(group);
  }
  for (let i = 0; i < 12; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const x = side * (CONFIG.roadWidth / 2 + 1.8);
    createStreetLight(x, -i * 20 - 10, -side);
  }

  /* ==========================================================================
     SUPERCAR 3D MODELS (PBR Materials, Aerodynamics, Wheels & Exhaust)
     ========================================================================== */
  const carbonTex = createCarbonTexture();

  const carPaintMat = new THREE.MeshPhysicalMaterial({
    color: state.selectedColor,
    metalness: 0.88,
    roughness: 0.16,
    clearcoat: 1.0,
    clearcoatRoughness: 0.05
  });

  const rimMat = new THREE.MeshStandardMaterial({ color: 0xdddddd, metalness: 0.95, roughness: 0.2 });
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x181818, roughness: 0.9, metalness: 0.1 });
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x0a1018,
    metalness: 0.2,
    roughness: 0.05,
    transmission: 0.75,
    transparent: true,
    opacity: 0.9
  });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8, map: carbonTex });
  const headlightMat = new THREE.MeshBasicMaterial({ color: 0xddeeff });
  const taillightMat = new THREE.MeshBasicMaterial({ color: 0xff1122 });

  // Build authentic sports car mesh
  function buildSupercar(color = 0xe52d27) {
    const car = new THREE.Group();
    const paint = carPaintMat.clone();
    paint.color.setHex(color);

    // Sculpted aerodynamic chassis
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.95, 0.44, 4.4), paint);
    body.position.y = 0.52;
    body.castShadow = true;
    body.receiveShadow = true;
    car.add(body);

    // Front aerodynamic hood scoop
    const hoodScoop = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.08, 1.2), trimMat);
    hoodScoop.position.set(0, 0.76, -1.2);
    car.add(hoodScoop);

    // Cabin with tinted glass
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.48, 2.0), glassMat);
    cabin.position.set(0, 0.92, -0.2);
    cabin.castShadow = true;
    car.add(cabin);

    // Roof panel
    const roof = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.08, 1.3), paint);
    roof.position.set(0, 1.18, -0.2);
    roof.castShadow = true;
    car.add(roof);

    // Carbon fiber front splitter
    const splitter = new THREE.Mesh(new THREE.BoxGeometry(1.98, 0.12, 0.7), trimMat);
    splitter.position.set(0, 0.32, -2.15);
    car.add(splitter);

    // Rear diffuser
    const diffuser = new THREE.Mesh(new THREE.BoxGeometry(1.92, 0.16, 0.5), trimMat);
    diffuser.position.set(0, 0.34, 2.15);
    car.add(diffuser);

    // High-downforce GT rear wing
    const wing = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.08, 0.42), trimMat);
    wing.position.set(0, 1.15, 2.05);
    car.add(wing);

    for (const wOffset of [-0.6, 0.6]) {
      const support = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.32, 0.2), trimMat);
      support.position.set(wOffset, 0.98, 2.05);
      car.add(support);
    }

    // Glowing Xenon LED Headlights
    for (const side of [-1, 1]) {
      const hLight = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.14, 0.1), headlightMat);
      hLight.position.set(side * 0.72, 0.58, -2.18);
      car.add(hLight);
    }

    // Full-width rear glowing LED Taillights
    for (const side of [-1, 1]) {
      const tLight = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.12, 0.08), taillightMat);
      tLight.position.set(side * 0.68, 0.6, 2.2);
      car.add(tLight);
    }

    // Twin Polished Chrome Exhaust Pipes
    const exhaustMat = new THREE.MeshStandardMaterial({ color: 0xeeeeee, metalness: 0.98, roughness: 0.1 });
    const exhaustL = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.25, 12), exhaustMat);
    exhaustL.rotation.x = Math.PI / 2;
    exhaustL.position.set(-0.35, 0.42, 2.22);

    const exhaustR = exhaustL.clone();
    exhaustR.position.x = 0.35;
    car.add(exhaustL, exhaustR);

    // 4 High-Detail Alloy Wheels
    const wheels = [];
    const wheelPositions = [
      [-0.98, 0.38, -1.3],
      [0.98, 0.38, -1.3],
      [-0.98, 0.38, 1.35],
      [0.98, 0.38, 1.35]
    ];

    wheelPositions.forEach(([wx, wy, wz]) => {
      const wGroup = new THREE.Group();

      const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.28, 18), tireMat);
      tire.rotation.z = Math.PI / 2;
      tire.castShadow = true;
      wGroup.add(tire);

      const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.29, 14), rimMat);
      rim.rotation.z = Math.PI / 2;
      wGroup.add(rim);

      const caliper = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.16, 0.12), new THREE.MeshBasicMaterial({ color: 0xff2200 }));
      caliper.position.set(0, 0.12, 0);
      wGroup.add(caliper);

      wGroup.position.set(wx, wy, wz);
      car.add(wGroup);
      wheels.push(wGroup);
    });

    // Contact shadow beneath car
    const shadowMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(2.6, 4.8),
      new THREE.MeshBasicMaterial({ color: 0x05080c, transparent: true, opacity: 0.65 })
    );
    shadowMesh.rotation.x = -Math.PI / 2;
    shadowMesh.position.y = 0.02;
    car.add(shadowMesh);

    car.userData = { wheels, paintMat: paint };
    return car;
  }

  // Player Supercar Group
  const playerGroup = new THREE.Group();
  playerGroup.position.set(0, 0, 5);
  scene.add(playerGroup);

  const playerModel = buildSupercar(state.selectedColor);
  playerGroup.add(playerModel);

  // Headlight Spotlights illuminating the road
  const headLightL = new THREE.SpotLight(0xddeeff, 3.5, 60, Math.PI / 6, 0.35, 1.2);
  headLightL.position.set(-0.7, 0.6, -1.8);
  const headLightTargetL = new THREE.Object3D();
  headLightTargetL.position.set(-0.7, 0, -25);
  playerGroup.add(headLightL, headLightTargetL);
  headLightL.target = headLightTargetL;

  const headLightR = new THREE.SpotLight(0xddeeff, 3.5, 60, Math.PI / 6, 0.35, 1.2);
  headLightR.position.set(0.7, 0.6, -1.8);
  const headLightTargetR = new THREE.Object3D();
  headLightTargetR.position.set(0.7, 0, -25);
  playerGroup.add(headLightR, headLightTargetR);
  headLightR.target = headLightTargetR;

  /* ==========================================================================
     NITRO BOOST FLAMES & SPEED STREAKS
     ========================================================================== */
  const nitroGroup = new THREE.Group();
  playerGroup.add(nitroGroup);

  const flameInnerMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95 });
  const flameOuterMat = new THREE.MeshBasicMaterial({
    color: 0x00f0ff,
    transparent: true,
    opacity: 0.85,
    blending: THREE.AdditiveBlending
  });

  function createFlameCone() {
    const coneGroup = new THREE.Group();
    const outer = new THREE.Mesh(new THREE.ConeGeometry(0.18, 1.4, 8), flameOuterMat);
    outer.rotation.x = -Math.PI / 2;
    outer.position.z = 0.7;

    const inner = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.9, 8), flameInnerMat);
    inner.rotation.x = -Math.PI / 2;
    inner.position.z = 0.45;

    coneGroup.add(outer, inner);
    return coneGroup;
  }

  const flameL = createFlameCone();
  flameL.position.set(-0.35, 0.42, 2.25);
  const flameR = createFlameCone();
  flameR.position.set(0.35, 0.42, 2.25);
  nitroGroup.add(flameL, flameR);
  nitroGroup.visible = false;

  // 3D Speed Streaks / Wind particles
  const streakCount = 180;
  const streakGeo = new THREE.BufferGeometry();
  const streakPositions = new Float32Array(streakCount * 3);
  for (let i = 0; i < streakCount; i++) {
    streakPositions[i * 3] = (Math.random() - 0.5) * 16;
    streakPositions[i * 3 + 1] = Math.random() * 6 + 0.5;
    streakPositions[i * 3 + 2] = -Math.random() * 80;
  }
  streakGeo.setAttribute('position', new THREE.BufferAttribute(streakPositions, 3));
  const streakMat = new THREE.PointsMaterial({
    color: 0x00f0ff,
    size: 0.28,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending
  });
  const speedStreaks = new THREE.Points(streakGeo, streakMat);
  scene.add(speedStreaks);

  /* ==========================================================================
     TRAFFIC GENERATION
     ========================================================================== */
  const traffic = [];
  const trafficColors = [
    0x1e88e5, // Metallic Blue
    0xd81b60, // Ruby Red
    0xf4511e, // Sunset Orange
    0xffb300, // Speed Yellow
    0x7cb342, // Lime Green
    0x8e24aa, // Royal Purple
    0x37474f, // Gunmetal
    0xffffff  // Alpine White
  ];

  function addTraffic(z = -80) {
    const color = trafficColors[Math.floor(Math.random() * trafficColors.length)];
    const car = buildSupercar(color);
    const lane = CONFIG.lanes[Math.floor(Math.random() * CONFIG.lanes.length)];
    car.position.set(lane, 0, z);
    car.userData.speedOffset = (Math.random() - 0.5) * 6;
    car.userData.passed = false;
    scene.add(car);
    traffic.push(car);
  }

  for (let i = 0; i < 6; i++) {
    addTraffic(-35 - i * 32);
  }

  /* ==========================================================================
     CONTROLS & INPUT BINDINGS
     ========================================================================== */
  function setKey(code, down) {
    if (['ArrowLeft', 'KeyA'].includes(code)) keys.left = down;
    if (['ArrowRight', 'KeyD'].includes(code)) keys.right = down;
    if (['ArrowUp', 'KeyW'].includes(code)) keys.gas = down;
    if (['ArrowDown', 'KeyS'].includes(code)) keys.brake = down;
    if (['Space', 'ShiftLeft', 'ShiftRight', 'KeyN'].includes(code)) keys.nitro = down;
  }

  addEventListener('keydown', e => {
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(e.code)) {
      e.preventDefault();
    }
    audio.resume();
    setKey(e.code, true);
  });

  addEventListener('keyup', e => setKey(e.code, false));
  addEventListener('blur', () => Object.keys(keys).forEach(k => keys[k] = false));

  function bindTouchButton(id, key) {
    const el = document.getElementById(id);
    if (!el) return;
    const down = e => {
      e.preventDefault();
      audio.resume();
      keys[key] = true;
      el.classList.add('active');
    };
    const up = e => {
      e.preventDefault();
      keys[key] = false;
      el.classList.remove('active');
    };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointerleave', up);
    el.addEventListener('pointercancel', up);
  }

  bindTouchButton('leftBtn', 'left');
  bindTouchButton('rightBtn', 'right');
  bindTouchButton('gasBtn', 'gas');
  bindTouchButton('brakeBtn', 'brake');
  bindTouchButton('nitroBtn', 'nitro');

  soundBtn.addEventListener('click', () => audio.toggle());

  // Supercar Paint Selector
  document.querySelectorAll('.color-dot').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.color-dot').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.selectedColor = parseInt(btn.dataset.color, 16) || parseInt(btn.dataset.color);
      carPaintMat.color.setHex(state.selectedColor);
      if (playerModel.userData.paintMat) {
        playerModel.userData.paintMat.color.setHex(state.selectedColor);
      }
    });
  });

  /* ==========================================================================
     ANIME.JS HUD, GAUGES & COMBOS
     ========================================================================== */
  function showCombo(text, sub = '') {
    comboBannerEl.innerHTML = `<span>${text}</span> ${sub ? `<small>${sub}</small>` : ''}`;

    if (typeof anime !== 'undefined') {
      anime.remove(comboBannerEl);
      anime({
        targets: comboBannerEl,
        opacity: [0, 1, 1, 0],
        scale: [0.7, 1.15, 1.0, 0.9],
        translateY: [20, 0, 0, -25],
        duration: 1100,
        easing: 'easeOutBack'
      });
    } else {
      comboBannerEl.style.opacity = '1';
      setTimeout(() => { comboBannerEl.style.opacity = '0'; }, 900);
    }
  }

  function updateHUDGauges(speedKmh, dt) {
    speedEl.textContent = Math.round(speedKmh);

    // Automatic Gear Shifting
    let newGear = 1;
    if (speedKmh > 210) newGear = 6;
    else if (speedKmh > 165) newGear = 5;
    else if (speedKmh > 125) newGear = 4;
    else if (speedKmh > 85) newGear = 3;
    else if (speedKmh > 45) newGear = 2;

    if (newGear !== state.gear) {
      state.gear = newGear;
      gearEl.textContent = 'D' + state.gear;
      if (typeof anime !== 'undefined') {
        anime({
          targets: gearEl,
          scale: [1.35, 1],
          duration: 220,
          easing: 'easeOutBack'
        });
      }
    }

    // Analog Speedometer Needle (-120deg to 120deg)
    const maxSpeedGauge = 300;
    const speedRatio = Math.min(speedKmh / maxSpeedGauge, 1);
    const needleAngle = -120 + speedRatio * 240;
    gaugeNeedleEl.style.transform = `rotate(${needleAngle}deg)`;

    // Active SVG Arc Stroke
    const totalArcLength = 204.2;
    const dashOffset = totalArcLength - (speedRatio * totalArcLength);
    gaugeActiveArcEl.style.strokeDashoffset = dashOffset;

    // Nitro Tank Fill
    nitroFillEl.style.width = `${Math.max(0, state.nitro)}%`;
    nitroPercentEl.textContent = `${Math.round(state.nitro)}%`;

    if (state.isBoosting) {
      nitroClusterEl.classList.add('boosting');
      nitroVignetteEl.classList.add('active');
    } else {
      nitroClusterEl.classList.remove('boosting');
      nitroVignetteEl.classList.remove('active');
    }
  }

  /* ==========================================================================
     GAME LIFECYCLE (Countdown, Start, End, Reset)
     ========================================================================== */
  function startCountdown(onComplete) {
    const steps = ['3', '2', '1', 'GO!'];
    let stepIdx = 0;
    countdownOverlayEl.style.display = 'flex';

    function advance() {
      if (stepIdx >= steps.length) {
        countdownOverlayEl.style.display = 'none';
        countdownTextEl.textContent = '';
        if (onComplete) onComplete();
        return;
      }

      const txt = steps[stepIdx++];
      countdownTextEl.textContent = txt;
      countdownTextEl.style.color = (txt === 'GO!') ? '#00e5ff' : '#ffffff';
      countdownTextEl.style.opacity = '1';
      countdownTextEl.style.transform = 'scale(0.5)';

      let advanced = false;
      const safeAdvance = () => {
        if (!advanced) {
          advanced = true;
          advance();
        }
      };

      if (typeof anime !== 'undefined') {
        anime({
          targets: countdownTextEl,
          scale: [
            { value: 1.25, duration: 250, easing: 'easeOutBack' },
            { value: 1.6, duration: 250, delay: 120, easing: 'easeInQuad' }
          ],
          opacity: [
            { value: 1, duration: 150 },
            { value: 0, duration: 250, delay: 220 }
          ],
          complete: safeAdvance
        });
        setTimeout(safeAdvance, 680);
      } else {
        setTimeout(safeAdvance, 520);
      }
    }

    advance();
  }

  function resetGame() {
    audio.init();
    audio.resume();

    state.speed = CONFIG.baseSpeed;
    state.topSpeed = 0;
    state.distance = 0;
    state.score = 0;
    state.nearMisses = 0;
    state.nitro = 100;
    state.isBoosting = false;
    state.gear = 1;
    state.spawnTimer = 0;

    playerGroup.position.set(0, 0, 5);
    playerGroup.rotation.set(0, 0, 0);

    traffic.forEach((car, i) => {
      car.position.set(CONFIG.lanes[i % CONFIG.lanes.length], 0, -35 - i * 32);
      car.userData.passed = false;
    });

    Object.keys(keys).forEach(k => keys[k] = false);
    messageEl.style.display = 'none';

    startCountdown(() => {
      state.running = true;
      showCombo('RACE STARTED!', 'FLOOR IT');
    });
  }

  function endGame() {
    state.running = false;
    state.isBoosting = false;
    nitroGroup.visible = false;
    audio.playCrash();

    // Camera impact shake
    if (typeof anime !== 'undefined') {
      anime({
        targets: camera.position,
        x: [camera.position.x - 0.4, camera.position.x + 0.4, camera.position.x],
        y: [camera.position.y + 0.3, camera.position.y - 0.2, camera.position.y],
        duration: 380,
        easing: 'easeInOutQuad'
      });
    }

    const finalDistance = Math.floor(state.distance);
    const finalTopSpeed = Math.round(state.topSpeed * 3.6);
    const finalScore = state.score;
    const finalNearMisses = state.nearMisses;

    messageEl.innerHTML = `
      <div class="dialog" id="dialogContent">
        <div class="badge-tag" style="border-color:#ff3366;color:#ff3366;">CRASH! RACE FINISHED</div>
        <h1 class="dialog-title" style="background:linear-gradient(135deg, #ff3366, #ff9900);-webkit-background-clip:text;">RACE SUMMARY</h1>
        
        <div class="game-over-stats">
          <div class="stat-box highlight-box">
            <div class="stat-label">FINAL SCORE</div>
            <div class="stat-val" id="endScore">0</div>
          </div>
          <div class="stat-box">
            <div class="stat-label">DISTANCE</div>
            <div class="stat-val"><span id="endDist">0</span> <small style="font-size:12px;color:#8da4be;">M</small></div>
          </div>
          <div class="stat-box">
            <div class="stat-label">TOP SPEED</div>
            <div class="stat-val"><span id="endSpeed">0</span> <small style="font-size:12px;color:#8da4be;">KM/H</small></div>
          </div>
          <div class="stat-box" style="grid-column: span 2;">
            <div class="stat-label">NEAR MISS OVERTAKES</div>
            <div class="stat-val" style="color:#00e5ff;" id="endNearMiss">0</div>
          </div>
        </div>

        <button id="restartBtn" class="cta-btn">RACE AGAIN</button>
      </div>
    `;
    messageEl.style.display = 'grid';

    // Rolling number animation
    if (typeof anime !== 'undefined') {
      anime({
        targets: { dist: 0, spd: 0, scr: 0, nm: 0 },
        dist: finalDistance,
        spd: finalTopSpeed,
        scr: finalScore,
        nm: finalNearMisses,
        duration: 1200,
        easing: 'easeOutExpo',
        update: anim => {
          const cur = anim.animatables[0].target;
          const eDist = document.getElementById('endDist');
          const eSpd = document.getElementById('endSpeed');
          const eScr = document.getElementById('endScore');
          const eNm = document.getElementById('endNearMiss');
          if (eDist) eDist.textContent = Math.round(cur.dist);
          if (eSpd) eSpd.textContent = Math.round(cur.spd);
          if (eScr) eScr.textContent = Math.round(cur.scr);
          if (eNm) eNm.textContent = Math.round(cur.nm);
        }
      });

      anime({
        targets: '#dialogContent',
        scale: [0.85, 1],
        opacity: [0, 1],
        duration: 400,
        easing: 'easeOutBack'
      });
    } else {
      document.getElementById('endDist').textContent = finalDistance;
      document.getElementById('endSpeed').textContent = finalTopSpeed;
      document.getElementById('endScore').textContent = finalScore;
      document.getElementById('endNearMiss').textContent = finalNearMisses;
    }

    document.getElementById('restartBtn').addEventListener('click', resetGame);
  }

  document.getElementById('startBtn').addEventListener('click', resetGame);

  /* ==========================================================================
     PHYSICS & MAIN LOOP
     ========================================================================== */
  function update(dt) {
    // 1. Nitros Boost Handling
    const wantsNitro = keys.nitro && state.nitro > 0;
    if (wantsNitro) {
      state.isBoosting = true;
      state.nitro = Math.max(0, state.nitro - CONFIG.nitroDrainRate * dt);
      state.speed = Math.min(CONFIG.nitroMaxSpeed, state.speed + CONFIG.nitroAccel * dt);
    } else {
      state.isBoosting = false;
      if (state.nitro < 100) {
        state.nitro = Math.min(100, state.nitro + CONFIG.nitroRechargeRate * dt);
      }
      if (keys.gas) {
        state.speed = Math.min(CONFIG.normalMaxSpeed, state.speed + CONFIG.accel * dt);
      } else if (state.speed > CONFIG.normalMaxSpeed) {
        state.speed = Math.max(CONFIG.normalMaxSpeed, state.speed - 16 * dt);
      } else {
        state.speed = Math.max(CONFIG.baseSpeed, state.speed - CONFIG.friction * dt);
      }
    }

    if (keys.brake) {
      state.speed = Math.max(12, state.speed - CONFIG.brakeDecel * dt);
    }

    if (state.speed > state.topSpeed) {
      state.topSpeed = state.speed;
    }

    const speedKmh = state.speed * 3.6;

    // 2. Steering & Chassis Roll
    const steering = (keys.left ? -1 : 0) + (keys.right ? 1 : 0);
    const steerVelocity = steering * (6.5 + state.speed * 0.055) * dt;
    playerGroup.position.x += steerVelocity;
    playerGroup.position.x = THREE.MathUtils.clamp(
      playerGroup.position.x,
      -CONFIG.roadWidth / 2 + 1.2,
      CONFIG.roadWidth / 2 - 1.2
    );

    playerGroup.rotation.z = THREE.MathUtils.lerp(playerGroup.rotation.z, -steering * 0.08, 9 * dt);
    playerGroup.rotation.y = THREE.MathUtils.lerp(playerGroup.rotation.y, -steering * 0.06, 9 * dt);

    // Dynamic wheel spin and front wheel turn
    const wheelTurnAngle = -steering * 0.32;
    const wheelRollDelta = (state.speed * dt) / 0.38;

    if (playerModel.userData.wheels) {
      playerModel.userData.wheels.forEach((w, idx) => {
        if (idx < 2) {
          w.rotation.y = THREE.MathUtils.lerp(w.rotation.y, wheelTurnAngle, 12 * dt);
        }
        w.rotation.x -= wheelRollDelta;
      });
    }

    // 3. Nitro Visuals: Exhaust Flames & Camera Warp
    if (state.isBoosting) {
      nitroGroup.visible = true;
      const pulse = 1.0 + Math.sin(performance.now() * 0.04) * 0.25 + (Math.random() - 0.5) * 0.15;
      flameL.scale.set(pulse, pulse, pulse * 1.3);
      flameR.scale.set(pulse, pulse, pulse * 1.3);

      camera.fov = THREE.MathUtils.lerp(camera.fov, 78, 6 * dt);
      streakMat.opacity = THREE.MathUtils.lerp(streakMat.opacity, 0.75, 8 * dt);
    } else {
      nitroGroup.visible = false;
      camera.fov = THREE.MathUtils.lerp(camera.fov, 62, 4 * dt);
      streakMat.opacity = THREE.MathUtils.lerp(streakMat.opacity, 0, 6 * dt);
    }
    camera.updateProjectionMatrix();

    if (speedKmh > 180) {
      const shake = (speedKmh - 180) * 0.0003;
      camera.position.x += (Math.random() - 0.5) * shake;
      camera.position.y += (Math.random() - 0.5) * shake;
    }

    // 4. World Movement & Scrolling
    const movement = state.speed * dt;
    state.distance += movement;
    state.score += Math.floor(movement * (state.isBoosting ? 3 : 1.5));

    distanceEl.textContent = Math.floor(state.distance);
    scoreEl.textContent = state.score;
    nearMissesEl.textContent = state.nearMisses;

    laneMarks.forEach(dash => {
      dash.position.z += movement;
      if (dash.position.z > 25) dash.position.z -= CONFIG.trackLength;
    });

    billboards.forEach(b => {
      b.position.z += movement;
      if (b.position.z > 35) b.position.z -= 256;
    });

    gantries.forEach(g => {
      g.position.z += movement;
      if (g.position.z > 35) g.position.z -= 255;
    });

    streetLights.forEach(sl => {
      sl.position.z += movement;
      if (sl.position.z > 35) sl.position.z -= 240;
    });

    // Speed Streaks
    const positions = speedStreaks.geometry.attributes.position.array;
    for (let i = 0; i < streakCount; i++) {
      positions[i * 3 + 2] += movement * 1.8;
      if (positions[i * 3 + 2] > 15) {
        positions[i * 3 + 2] = -90 - Math.random() * 40;
        positions[i * 3] = (Math.random() - 0.5) * 16;
        positions[i * 3 + 1] = Math.random() * 6 + 0.5;
      }
    }
    speedStreaks.geometry.attributes.position.needsUpdate = true;

    // 5. Traffic AI & Collision Detection
    state.spawnTimer += dt;
    if (state.spawnTimer > Math.max(0.65, 2.0 - state.speed / 50)) {
      state.spawnTimer = 0;
      const farthest = Math.min(...traffic.map(c => c.position.z));
      if (farthest > -130) addTraffic(-145);
    }

    for (const car of traffic) {
      const trafficSpeed = (CONFIG.baseSpeed * 0.65 + car.userData.speedOffset) * dt;
      car.position.z += (movement - trafficSpeed);

      if (car.userData.wheels) {
        car.userData.wheels.forEach(w => {
          w.rotation.x -= trafficSpeed / 0.38;
        });
      }

      if (car.position.z > 25) {
        car.position.z = -140 - Math.random() * 40;
        car.position.x = CONFIG.lanes[Math.floor(Math.random() * CONFIG.lanes.length)];
        car.userData.passed = false;
      }

      const deltaZ = Math.abs(car.position.z - playerGroup.position.z);
      const deltaX = Math.abs(car.position.x - playerGroup.position.x);

      // Crash collision
      if (deltaZ < 3.2 && deltaX < 1.7) {
        endGame();
        break;
      }

      // Near Miss close pass bonus
      if (!car.userData.passed && deltaZ < 2.5 && deltaX >= 1.7 && deltaX < 2.6) {
        car.userData.passed = true;
        state.nearMisses++;
        state.score += 150;
        state.nitro = Math.min(100, state.nitro + CONFIG.nearMissBonus);
        audio.playNearMiss();
        showCombo('+150 NEAR MISS!', '+20% NITRO');
      }
    }

    // 6. Camera Follow
    camera.position.x = THREE.MathUtils.lerp(camera.position.x, playerGroup.position.x * 0.35, 4 * dt);
    camera.lookAt(playerGroup.position.x * 0.25, 1.2, -6);

    // 7. Update HUD Gauges & Audio
    updateHUDGauges(speedKmh, dt);
    audio.update(speedKmh, state.isBoosting, Math.abs(steering) > 0.1);
  }

  function animate(time) {
    requestAnimationFrame(animate);
    const dt = Math.min((time - (state.lastTime || time)) / 1000, 0.04);
    state.lastTime = time;

    if (state.running) {
      update(dt);
    }

    renderer.render(scene, camera);
  }
  animate(0);

  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });

})();
