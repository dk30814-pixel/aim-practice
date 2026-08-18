import * as THREE from "https://unpkg.com/three@0.160.0/build/three.module.js";
import { OBJLoader } from "https://unpkg.com/three@0.160.0/examples/jsm/loaders/OBJLoader.js";

const canvas = document.querySelector("#game");
const scoreEl = document.querySelector("#score");
const accuracyEl = document.querySelector("#accuracy");
const timerEl = document.querySelector("#timer");
const weaponNameEl = document.querySelector("#weaponName");
const startBtn = document.querySelector("#startBtn");
const resetBtn = document.querySelector("#resetBtn");
const speedSlider = document.querySelector("#speedSlider");

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xd7b07a);
scene.fog = new THREE.Fog(0xd0a46f, 42, 130);

const camera = new THREE.PerspectiveCamera(74, window.innerWidth / window.innerHeight, 0.1, 260);
camera.position.set(0, 1.72, 13);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const clock = new THREE.Clock();
const raycaster = new THREE.Raycaster();
const shootRay = new THREE.Vector2(0, 0);
const velocity = new THREE.Vector3();
const direction = new THREE.Vector3();
const cameraForward = new THREE.Vector3();
const cameraRight = new THREE.Vector3();

const arenaSize = 56;
const keys = new Set();
const targets = [];
const bullets = [];
const interactables = [];
const modelCache = new Map();
const textureLoader = new THREE.TextureLoader();
const objLoader = new OBJLoader();
const targetZone = {
  minX: -18,
  maxX: 18,
  minY: 1.8,
  maxY: 4.8,
  minZ: -26.5,
  maxZ: -12
};
const targetSpawnSlots = [
  new THREE.Vector3(-15, 2.2, -22),
  new THREE.Vector3(-8, 3.6, -26),
  new THREE.Vector3(0, 2.4, -25),
  new THREE.Vector3(8, 4.1, -26),
  new THREE.Vector3(15, 2.7, -23),
  new THREE.Vector3(-17, 3.4, -14),
  new THREE.Vector3(17, 3.4, -14)
];

const weapons = [
  {
    name: "Pistol",
    key: "1",
    model: "./textures/guns/Pistol/Gun.obj",
    texture: "./textures/guns/Pistol/Gun.png",
    fireRate: 0.28,
    damage: 1,
    spread: 0.003,
    recoil: 0.012,
    viewScale: 0.38,
    rackScale: 0.48,
    viewRotation: new THREE.Euler(0.08, Math.PI * 0.98, 0.02),
    rackRotation: new THREE.Euler(0, Math.PI * 0.5, 0)
  },
  {
    name: "SMG",
    key: "2",
    model: "./textures/guns/SMG/MP5K.obj",
    texture: "./textures/guns/SMG/MP5K.png",
    fireRate: 0.085,
    damage: 1,
    spread: 0.012,
    recoil: 0.018,
    viewScale: 0.18,
    rackScale: 0.24,
    viewRotation: new THREE.Euler(0.03, Math.PI * 0.52, 0),
    rackRotation: new THREE.Euler(0, Math.PI * 0.5, 0)
  },
  {
    name: "Rifle",
    key: "3",
    model: "./textures/guns/Rifle/M4A1.obj",
    texture: "./textures/guns/Rifle/Chasieboy317.jpg",
    automatic: true,
    fireRate: 0.055,
    damage: 1,
    spread: 0.008,
    recoil: 0.014,
    viewScale: 0.1,
    rackScale: 0.14,
    viewRotation: new THREE.Euler(0.02, Math.PI * 0.5, 0),
    rackRotation: new THREE.Euler(0, Math.PI * 0.5, 0)
  }
];

const state = {
  active: false,
  score: 0,
  shots: 0,
  hits: 0,
  timeLeft: 60,
  yaw: 0,
  pitch: 0,
  selectedWeapon: 0,
  nextShotAt: 0,
  triggerHeld: false,
  spawnTimer: 0,
  targetSpeed: Number(speedSlider.value)
};

const materials = {
  floor: new THREE.MeshStandardMaterial({ color: 0xb98755, roughness: 0.88, metalness: 0.02 }),
  wall: new THREE.MeshStandardMaterial({ color: 0xc19a68, roughness: 0.82 }),
  trim: new THREE.MeshStandardMaterial({ color: 0xd6c2a2, roughness: 0.68, metalness: 0.04 }),
  pad: new THREE.MeshStandardMaterial({ color: 0x151a21, roughness: 0.75 }),
  target: new THREE.MeshStandardMaterial({ color: 0xf8f8f8, roughness: 0.5 }),
  targetRing: new THREE.MeshStandardMaterial({ color: 0xd13f3f, roughness: 0.55 }),
  bull: new THREE.MeshStandardMaterial({ color: 0x20242b, roughness: 0.55 }),
  bullet: new THREE.MeshBasicMaterial({ color: 0xfff1a6 })
};

const playerRig = new THREE.Group();
playerRig.position.copy(camera.position);
playerRig.add(camera);
scene.add(playerRig);

const weaponAnchor = new THREE.Group();
weaponAnchor.position.set(0.42, -0.38, -0.72);
camera.add(weaponAnchor);

let weaponModel = null;
let weaponLoadToken = 0;
buildWorld();
selectWeapon(0);
resetPractice();
animate();

function buildWorld() {
  applyProceduralTextures();
  createBackdrop();
  scene.add(new THREE.HemisphereLight(0xffefd4, 0xb6804c, 1.85));

  const sun = new THREE.DirectionalLight(0xffe2b0, 2.6);
  sun.position.set(20, 28, 16);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -45;
  sun.shadow.camera.right = 45;
  sun.shadow.camera.top = 45;
  sun.shadow.camera.bottom = -45;
  scene.add(sun);

  const floor = new THREE.Mesh(new THREE.BoxGeometry(arenaSize, 0.35, arenaSize), materials.floor);
  floor.position.y = -0.18;
  floor.receiveShadow = true;
  scene.add(floor);

  const grid = new THREE.GridHelper(arenaSize, 28, 0xd9b783, 0xb88c5a);
  grid.position.y = 0.02;
  scene.add(grid);

  addWall(0, 2.5, -arenaSize / 2, arenaSize, 5, 0.8);
  addWall(-arenaSize / 2, 2.5, 0, 0.8, 5, arenaSize);
  addWall(arenaSize / 2, 2.5, 0, 0.8, 5, arenaSize);

  const backWall = new THREE.Mesh(new THREE.BoxGeometry(18, 4.2, 0.7), materials.wall);
  backWall.position.set(0, 2.1, arenaSize / 2);
  backWall.castShadow = true;
  backWall.receiveShadow = true;
  scene.add(backWall);

  createRangeButtons();
  createGunRack();
  createCoverBlocks();
}

function applyProceduralTextures() {
  const sand = makeNoiseTexture({
    base: "#ba8755",
    flecks: ["#d3aa73", "#96683e", "#e5c28d"],
    size: 256,
    density: 900
  });
  sand.wrapS = THREE.RepeatWrapping;
  sand.wrapT = THREE.RepeatWrapping;
  sand.repeat.set(12, 12);
  materials.floor.map = sand;
  materials.floor.needsUpdate = true;

  const plaster = makeNoiseTexture({
    base: "#c29a68",
    flecks: ["#d8b982", "#a97748", "#e4c993"],
    size: 256,
    density: 520
  });
  plaster.wrapS = THREE.RepeatWrapping;
  plaster.wrapT = THREE.RepeatWrapping;
  plaster.repeat.set(4, 2);
  materials.wall.map = plaster;
  materials.wall.needsUpdate = true;

  const paleStone = makeNoiseTexture({
    base: "#d6c2a2",
    flecks: ["#b89c74", "#f0dfbd", "#9f835d"],
    size: 256,
    density: 420
  });
  paleStone.wrapS = THREE.RepeatWrapping;
  paleStone.wrapT = THREE.RepeatWrapping;
  paleStone.repeat.set(2, 2);
  materials.trim.map = paleStone;
  materials.trim.needsUpdate = true;
}

function makeNoiseTexture({ base, flecks, size, density }) {
  const textureCanvas = document.createElement("canvas");
  textureCanvas.width = size;
  textureCanvas.height = size;
  const ctx = textureCanvas.getContext("2d");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < density; i += 1) {
    ctx.fillStyle = flecks[Math.floor(Math.random() * flecks.length)];
    ctx.globalAlpha = THREE.MathUtils.randFloat(0.08, 0.22);
    const x = Math.random() * size;
    const y = Math.random() * size;
    const w = THREE.MathUtils.randFloat(0.8, 4.5);
    const h = THREE.MathUtils.randFloat(0.5, 2.8);
    ctx.fillRect(x, y, w, h);
  }

  ctx.globalAlpha = 1;
  const texture = new THREE.CanvasTexture(textureCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createBackdrop() {
  const skyCanvas = document.createElement("canvas");
  skyCanvas.width = 2048;
  skyCanvas.height = 512;
  const ctx = skyCanvas.getContext("2d");
  const sky = ctx.createLinearGradient(0, 0, 0, skyCanvas.height);
  sky.addColorStop(0, "#72a6d6");
  sky.addColorStop(0.58, "#e6c087");
  sky.addColorStop(1, "#b77e48");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, skyCanvas.width, skyCanvas.height);

  ctx.fillStyle = "rgba(128, 89, 52, 0.62)";
  drawDistantRidge(ctx, skyCanvas.width, 310, 70, 0.65);
  ctx.fillStyle = "rgba(189, 136, 78, 0.86)";
  drawDistantRidge(ctx, skyCanvas.width, 360, 95, 0.95);

  const texture = new THREE.CanvasTexture(skyCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const backdrop = new THREE.Mesh(
    new THREE.CylinderGeometry(112, 112, 45, 64, 1, true),
    new THREE.MeshBasicMaterial({ map: texture, side: THREE.BackSide })
  );
  backdrop.position.y = 15;
  scene.add(backdrop);
}

function drawDistantRidge(ctx, width, baseline, height, roughness) {
  ctx.beginPath();
  ctx.moveTo(0, 512);
  ctx.lineTo(0, baseline);
  for (let x = 0; x <= width; x += 85) {
    const y = baseline - Math.sin(x * 0.01 * roughness) * height * 0.35 - Math.random() * height;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(width, 512);
  ctx.closePath();
  ctx.fill();
}

function addWall(x, y, z, w, h, d) {
  const wall = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), materials.wall);
  wall.position.set(x, y, z);
  wall.castShadow = true;
  wall.receiveShadow = true;
  scene.add(wall);
}

function createRangeButtons() {
  const labels = [
    ["START", -5.2, startPractice],
    ["RESET", 0, resetPractice],
    ["SPEED", 5.2, cycleSpeed]
  ];

  labels.forEach(([label, x, action]) => {
    const button = new THREE.Group();
    button.position.set(x, 0.15, 20.8);
    button.userData.action = action;
    button.userData.isInteractable = true;
    button.userData.label = label;

    const base = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.3, 2), materials.pad);
    const top = new THREE.Mesh(
      new THREE.CylinderGeometry(0.68, 0.78, 0.32, 40),
      new THREE.MeshStandardMaterial({ color: label === "START" ? 0x67d68a : label === "RESET" ? 0xf06b5d : 0x61a8ff })
    );
    top.position.y = 0.34;
    top.rotation.x = Math.PI / 2;

    const text = makeTextSprite(label);
    text.position.set(0, 1.1, 0);
    text.scale.set(2.3, 0.72, 1);

    button.add(base, top, text);
    interactables.push(button);
    scene.add(button);
  });
}

function createGunRack() {
  const rack = new THREE.Group();
  rack.position.set(-17.5, 1.1, 20.4);

  const shelf = new THREE.Mesh(new THREE.BoxGeometry(11, 0.26, 1), materials.pad);
  shelf.position.y = -0.6;
  rack.add(shelf);

  weapons.forEach((weapon, index) => {
    const pickup = new THREE.Group();
    pickup.position.set(index * 2.65 - 4, 0, 0);
    pickup.rotation.copy(weapon.rackRotation);
    pickup.userData.weaponIndex = index;
    pickup.userData.isPickup = true;
    pickup.userData.isInteractable = true;
    rack.add(pickup);
    interactables.push(pickup);
    addWeaponAssetToGroup(pickup, weapon, weapon.rackScale);

    const label = makeTextSprite(`${weapon.key} ${weapon.name}`);
    label.position.set(index * 2.65 - 4, -1.1, 0);
    label.scale.set(1.6, 0.42, 1);
    rack.add(label);
  });

  scene.add(rack);
}

function createCoverBlocks() {
  [
    [-11, 1, 3, 6, 2, 2],
    [12, 1.4, -1, 2.5, 2.8, 6],
    [0, 0.75, 8, 7, 1.5, 1.8]
  ].forEach(([x, y, z, w, h, d]) => {
    const block = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), materials.wall);
    block.position.set(x, y, z);
    block.castShadow = true;
    block.receiveShadow = true;
    scene.add(block);
  });
}

async function addWeaponAssetToGroup(group, weapon, scale) {
  try {
    const clone = await createWeaponInstance(weapon, scale);
    group.add(clone);
    return clone;
  } catch (error) {
    console.warn(`Could not load ${weapon.name} model`, error);
    const label = makeTextSprite(weapon.name);
    label.scale.set(1.4, 0.4, 1);
    group.add(label);
    return label;
  }
}

async function createWeaponInstance(weapon, scale) {
  const model = await loadWeaponModel(weapon);
  const clone = model.clone(true);
  clone.scale.setScalar(scale);
  clone.userData.weaponMesh = true;
  return clone;
}

function loadWeaponModel(weapon) {
  if (!modelCache.has(weapon.name)) {
    modelCache.set(
      weapon.name,
      Promise.all([loadObj(weapon.model), loadTexture(weapon.texture)]).then(([object, texture]) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        const material = new THREE.MeshStandardMaterial({
          map: texture,
          color: 0xffffff,
          roughness: 0.5,
          metalness: 0.22
        });
        normalizeModel(object);
        object.traverse((child) => {
          if (child.isMesh) {
            child.material = material;
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });
        return object;
      })
    );
  }

  return modelCache.get(weapon.name);
}

function loadObj(path) {
  return new Promise((resolve, reject) => {
    objLoader.load(path, resolve, undefined, reject);
  });
}

function loadTexture(path) {
  return new Promise((resolve, reject) => {
    textureLoader.load(path, resolve, undefined, reject);
  });
}

function normalizeModel(object) {
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const longestSide = Math.max(size.x, size.y, size.z) || 1;

  object.position.sub(center);
  object.scale.multiplyScalar(2.6 / longestSide);
}

function makeTextSprite(text) {
  const textCanvas = document.createElement("canvas");
  textCanvas.width = 512;
  textCanvas.height = 160;
  const ctx = textCanvas.getContext("2d");
  ctx.clearRect(0, 0, textCanvas.width, textCanvas.height);
  ctx.fillStyle = "rgba(9, 12, 16, 0.72)";
  ctx.fillRect(0, 0, textCanvas.width, textCanvas.height);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.38)";
  ctx.lineWidth = 8;
  ctx.strokeRect(4, 4, textCanvas.width - 8, textCanvas.height - 8);
  ctx.fillStyle = "#ffffff";
  ctx.font = "700 54px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, textCanvas.width / 2, textCanvas.height / 2);

  const texture = new THREE.CanvasTexture(textCanvas);
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
  return new THREE.Sprite(material);
}

function startPractice() {
  state.active = true;
  state.timeLeft = 60;
  state.score = 0;
  state.shots = 0;
  state.hits = 0;
  state.spawnTimer = 0;
  clearTargets();
  spawnTarget();
  updateHud();
  canvas.requestPointerLock();
}

function resetPractice() {
  state.active = false;
  state.timeLeft = 60;
  state.score = 0;
  state.shots = 0;
  state.hits = 0;
  state.spawnTimer = 0;
  clearTargets();
  updateHud();
}

function cycleSpeed() {
  const values = [0.7, 1.2, 1.8, 2.5];
  const next = values.find((value) => value > state.targetSpeed + 0.05) ?? values[0];
  state.targetSpeed = next;
  speedSlider.value = String(next);
}

function clearTargets() {
  while (targets.length) {
    scene.remove(targets.pop());
  }
}

function spawnTarget() {
  const slot = targetSpawnSlots[Math.floor(Math.random() * targetSpawnSlots.length)].clone();
  slot.x = THREE.MathUtils.clamp(slot.x + THREE.MathUtils.randFloatSpread(2.4), targetZone.minX, targetZone.maxX);
  slot.y = THREE.MathUtils.clamp(slot.y + THREE.MathUtils.randFloatSpread(0.8), targetZone.minY, targetZone.maxY);
  slot.z = THREE.MathUtils.clamp(slot.z + THREE.MathUtils.randFloatSpread(1.4), targetZone.minZ, targetZone.maxZ);

  const target = new THREE.Group();
  target.position.copy(slot);
  target.userData.health = 2;
  target.userData.baseX = slot.x;
  target.userData.baseY = slot.y;
  target.userData.moveRange = THREE.MathUtils.randFloat(1.2, 2.7);
  target.userData.phase = Math.random() * Math.PI * 2;
  target.userData.moveAxis = Math.random() > 0.5 ? "x" : "y";

  const face = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.05, 0.12, 64), materials.target);
  face.rotation.x = Math.PI / 2;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.74, 0.075, 16, 64), materials.targetRing);
  const bull = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.23, 0.14, 40), materials.bull);
  ring.position.z = 0.08;
  bull.rotation.x = Math.PI / 2;
  bull.position.z = 0.1;

  const stem = new THREE.Mesh(new THREE.BoxGeometry(0.18, slot.y, 0.18), materials.trim);
  stem.position.y = -slot.y / 2;

  target.add(face, ring, bull, stem);
  target.lookAt(camera.position.x, target.position.y, camera.position.z);
  target.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });

  targets.push(target);
  scene.add(target);
}

function selectWeapon(index) {
  state.selectedWeapon = index;
  weaponNameEl.textContent = weapons[index].name;
  weaponLoadToken += 1;
  const token = weaponLoadToken;

  if (weaponModel) {
    weaponAnchor.remove(weaponModel);
    weaponModel = null;
  }

  createWeaponInstance(weapons[index], weapons[index].viewScale).then((model) => {
    if (token !== weaponLoadToken) return;
    weaponModel = model;
    weaponModel.rotation.copy(weapons[index].viewRotation);
    weaponAnchor.add(weaponModel);
  }).catch((error) => {
    console.warn(`Could not load ${weapons[index].name} model`, error);
    if (token !== weaponLoadToken) return;
    weaponModel = makeTextSprite(weapons[index].name);
    weaponModel.scale.set(1.4, 0.4, 1);
    weaponAnchor.add(weaponModel);
  });
}

function updateHud() {
  scoreEl.textContent = String(state.score);
  timerEl.textContent = String(Math.max(0, Math.ceil(state.timeLeft)));
  const accuracy = state.shots === 0 ? 100 : Math.round((state.hits / state.shots) * 100);
  accuracyEl.textContent = `${accuracy}%`;
}

function shoot() {
  const now = clock.elapsedTime;
  const weapon = weapons[state.selectedWeapon];
  if (now < state.nextShotAt) return;
  state.nextShotAt = now + weapon.fireRate;

  const pellets = weapon.pellets ?? 1;
  let landedHit = false;
  let usedControl = false;
  for (let i = 0; i < pellets; i += 1) {
    raycaster.setFromCamera(
      {
        x: shootRay.x + THREE.MathUtils.randFloatSpread(weapon.spread),
        y: shootRay.y + THREE.MathUtils.randFloatSpread(weapon.spread)
      },
      camera
    );

    const targetMeshes = targets.flatMap((target) => target.children.filter((child) => child.isMesh));
    const controlMeshes = getInteractableMeshes();
    const controlHits = raycaster.intersectObjects(controlMeshes, false);
    const targetHits = raycaster.intersectObjects(targetMeshes, false);
    const firstControlHit = controlHits.find((hit) => hit.distance < 60);
    const firstTargetHit = targetHits[0];

    if (firstControlHit && (!firstTargetHit || firstControlHit.distance < firstTargetHit.distance)) {
      activateShotControl(firstControlHit.object);
      usedControl = true;
      break;
    }

    const hits = targetHits;
    if (hits.length > 0) {
      const target = findTargetGroup(hits[0].object);
      damageTarget(target, weapon.damage);
      landedHit = true;
      break;
    }
  }

  if (landedHit) {
    state.hits += 1;
  }
  if (!usedControl) {
    state.shots += 1;
  }

  addBulletTracer();
  state.pitch += weapon.recoil;
  updateHud();
}

function updateTriggerHold() {
  const weapon = weapons[state.selectedWeapon];
  if (state.triggerHeld && weapon.automatic && document.pointerLockElement === canvas) {
    shoot();
  }
}

function getInteractableMeshes() {
  return interactables.flatMap((item) => {
    const children = [];
    item.traverse((child) => {
      if (child.isMesh) children.push(child);
    });
    return children;
  });
}

function activateShotControl(object) {
  const item = findInteractableGroup(object);
  if (!item) return;

  if (item.userData.isPickup) {
    selectWeapon(item.userData.weaponIndex);
  }

  if (item.userData.action) {
    item.userData.action();
    pulseInteractable(item);
  }
}

function pulseInteractable(item) {
  item.scale.setScalar(0.92);
  setTimeout(() => item.scale.setScalar(1), 110);
}

function useFocusedObject() {
  raycaster.setFromCamera(shootRay, camera);
  const meshes = getInteractableMeshes();
  const hits = raycaster.intersectObjects(meshes, false);
  if (hits.length === 0 || hits[0].distance > 8) return;

  activateShotControl(hits[0].object);
}

function findInteractableGroup(object) {
  let current = object;
  while (current && !interactables.includes(current)) {
    current = current.parent;
  }
  return current;
}

function findTargetGroup(object) {
  let current = object;
  while (current && !targets.includes(current)) {
    current = current.parent;
  }
  return current;
}

function damageTarget(target, damage) {
  if (!target) return;
  target.userData.health -= damage;
  target.scale.multiplyScalar(0.94);

  if (target.userData.health <= 0) {
    state.score += 1;
    targets.splice(targets.indexOf(target), 1);
    scene.remove(target);
    spawnTarget();
  }
}

function addBulletTracer() {
  const geometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0.36, -0.22, -0.72),
    new THREE.Vector3(0.28, -0.18, -12)
  ]);
  const line = new THREE.Line(geometry, materials.bullet);
  line.userData.life = 0.055;
  camera.add(line);
  bullets.push(line);
}

function updateMovement(delta) {
  direction.set(0, 0, 0);
  if (keys.has("KeyW")) direction.z -= 1;
  if (keys.has("KeyS")) direction.z += 1;
  if (keys.has("KeyA")) direction.x -= 1;
  if (keys.has("KeyD")) direction.x += 1;
  direction.normalize();

  camera.getWorldDirection(cameraForward);
  cameraForward.y = 0;
  cameraForward.normalize();
  cameraRight.crossVectors(cameraForward, new THREE.Vector3(0, 1, 0)).normalize();

  velocity.set(0, 0, 0);
  velocity.addScaledVector(cameraForward, -direction.z);
  velocity.addScaledVector(cameraRight, direction.x);
  velocity.normalize().multiplyScalar(direction.length() > 0 ? 8.2 * delta : 0);

  playerRig.position.add(velocity);
  playerRig.position.x = THREE.MathUtils.clamp(playerRig.position.x, -arenaSize / 2 + 2, arenaSize / 2 - 2);
  playerRig.position.z = THREE.MathUtils.clamp(playerRig.position.z, -arenaSize / 2 + 2, arenaSize / 2 - 2);
}

function updateTargets(delta) {
  if (!state.active) return;

  state.timeLeft -= delta;
  state.spawnTimer -= delta;

  if (state.timeLeft <= 0) {
    state.active = false;
    document.exitPointerLock();
  }

  if (state.spawnTimer <= 0 && targets.length < 6) {
    spawnTarget();
    state.spawnTimer = Math.max(0.45, 1.35 / state.targetSpeed);
  }

  targets.forEach((target) => {
    const phase = clock.elapsedTime * state.targetSpeed + target.userData.phase;
    const amount = Math.sin(phase) * 2.2;
    if (target.userData.moveAxis === "x") {
      target.position.x = THREE.MathUtils.clamp(
        target.userData.baseX + Math.sin(phase) * target.userData.moveRange,
        targetZone.minX,
        targetZone.maxX
      );
    } else {
      target.position.y = THREE.MathUtils.clamp(
        target.userData.baseY + amount * 0.22,
        targetZone.minY,
        targetZone.maxY
      );
    }
    target.lookAt(camera.position.x, target.position.y, camera.position.z);
  });

  updateHud();
}

function updateBullets(delta) {
  for (let i = bullets.length - 1; i >= 0; i -= 1) {
    bullets[i].userData.life -= delta;
    if (bullets[i].userData.life <= 0) {
      camera.remove(bullets[i]);
      bullets.splice(i, 1);
    }
  }
}

function animate() {
  const delta = Math.min(clock.getDelta(), 0.05);
  requestAnimationFrame(animate);

  updateMovement(delta);
  updateTriggerHold();
  updateTargets(delta);
  updateBullets(delta);

  camera.rotation.order = "YXZ";
  camera.rotation.y = state.yaw;
  camera.rotation.x = state.pitch;
  weaponAnchor.position.y = -0.38 + Math.sin(clock.elapsedTime * 7) * 0.008;

  renderer.render(scene, camera);
}

function resize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

startBtn.addEventListener("click", startPractice);
resetBtn.addEventListener("click", resetPractice);
speedSlider.addEventListener("input", () => {
  state.targetSpeed = Number(speedSlider.value);
});

window.addEventListener("resize", resize);
window.addEventListener("keydown", (event) => {
  keys.add(event.code);
  const index = weapons.findIndex((weapon) => weapon.key === event.key);
  if (index !== -1) {
    selectWeapon(index);
  }
  if (event.code === "KeyE") {
    useFocusedObject();
  }
});
window.addEventListener("keyup", (event) => keys.delete(event.code));
window.addEventListener("mousedown", (event) => {
  if (event.button !== 0) return;
  if (event.target === canvas && document.pointerLockElement !== canvas) {
    canvas.requestPointerLock();
    return;
  }
  if (document.pointerLockElement === canvas) {
    state.triggerHeld = true;
    shoot();
  }
});
window.addEventListener("mouseup", (event) => {
  if (event.button === 0) {
    state.triggerHeld = false;
  }
});
window.addEventListener("blur", () => {
  state.triggerHeld = false;
});
document.addEventListener("pointerlockchange", () => {
  if (document.pointerLockElement !== canvas) {
    state.triggerHeld = false;
  }
});
window.addEventListener("mousemove", (event) => {
  if (document.pointerLockElement !== canvas) return;
  state.yaw -= event.movementX * 0.0022;
  state.pitch -= event.movementY * 0.0022;
  state.pitch = THREE.MathUtils.clamp(state.pitch, -1.36, 1.24);
});
