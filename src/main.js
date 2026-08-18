import * as THREE from "https://unpkg.com/three@0.160.0/build/three.module.js";

const canvas = document.querySelector("#game");
const scoreEl = document.querySelector("#score");
const accuracyEl = document.querySelector("#accuracy");
const timerEl = document.querySelector("#timer");
const weaponNameEl = document.querySelector("#weaponName");
const startBtn = document.querySelector("#startBtn");
const resetBtn = document.querySelector("#resetBtn");
const speedSlider = document.querySelector("#speedSlider");

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x11151b);
scene.fog = new THREE.Fog(0x11151b, 32, 105);

const camera = new THREE.PerspectiveCamera(74, window.innerWidth / window.innerHeight, 0.1, 260);
camera.position.set(0, 1.72, 13);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
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
const targetSpawnSlots = [
  new THREE.Vector3(-16, 2.2, -22),
  new THREE.Vector3(-8, 3.6, -28),
  new THREE.Vector3(0, 2.4, -25),
  new THREE.Vector3(8, 4.1, -30),
  new THREE.Vector3(16, 2.7, -23),
  new THREE.Vector3(-21, 3.4, -12),
  new THREE.Vector3(21, 3.4, -12)
];

const weapons = [
  { name: "Pistol", key: "1", color: 0x88929e, accent: 0x20252d, fireRate: 0.28, damage: 1, spread: 0.003, recoil: 0.012 },
  { name: "SMG", key: "2", color: 0x1f2933, accent: 0x49a3ff, fireRate: 0.085, damage: 1, spread: 0.012, recoil: 0.018 },
  { name: "Rifle", key: "3", color: 0x394b3c, accent: 0xe0b15e, fireRate: 0.15, damage: 2, spread: 0.006, recoil: 0.02 },
  { name: "Shotgun", key: "4", color: 0x453233, accent: 0xf07057, fireRate: 0.7, damage: 1, spread: 0.055, recoil: 0.035, pellets: 7 }
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
  spawnTimer: 0,
  targetSpeed: Number(speedSlider.value)
};

const materials = {
  floor: new THREE.MeshStandardMaterial({ color: 0x2a3038, roughness: 0.78, metalness: 0.08 }),
  wall: new THREE.MeshStandardMaterial({ color: 0x38424c, roughness: 0.72 }),
  trim: new THREE.MeshStandardMaterial({ color: 0xd7dde4, roughness: 0.42, metalness: 0.2 }),
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
buildWorld();
selectWeapon(0);
resetPractice();
animate();

function buildWorld() {
  scene.add(new THREE.HemisphereLight(0xc9d8ff, 0x384048, 1.7));

  const sun = new THREE.DirectionalLight(0xffffff, 2.4);
  sun.position.set(14, 24, 12);
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

  const grid = new THREE.GridHelper(arenaSize, 28, 0x59616b, 0x3e4650);
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
    const pickup = makeGunModel(weapon, 0.78);
    pickup.position.set(index * 2.65 - 4, 0, 0);
    pickup.rotation.set(0, Math.PI / 2, 0);
    pickup.userData.weaponIndex = index;
    pickup.userData.isPickup = true;
    pickup.userData.isInteractable = true;
    rack.add(pickup);
    interactables.push(pickup);

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

function makeGunModel(weapon, scale = 1) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: weapon.color, roughness: 0.48, metalness: 0.42 });
  const accentMat = new THREE.MeshStandardMaterial({ color: weapon.accent, roughness: 0.55, metalness: 0.25 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.24, 1.3), bodyMat);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 1.05, 18), bodyMat);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.05, -0.94);

  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.58, 0.28), accentMat);
  grip.position.set(0.05, -0.38, 0.34);
  grip.rotation.x = -0.3;

  const sight = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.08, 0.22), accentMat);
  sight.position.set(0, 0.2, -0.22);

  const magazine = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.56, 0.28), accentMat);
  magazine.position.set(0, -0.35, -0.12);
  magazine.rotation.x = 0.12;

  group.add(body, barrel, grip, sight, magazine);

  if (weapon.name === "Shotgun" || weapon.name === "Rifle") {
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.22, 0.72), accentMat);
    stock.position.set(0, -0.02, 0.92);
    group.add(stock);
  }

  if (weapon.name === "SMG") {
    const foregrip = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.48, 0.18), accentMat);
    foregrip.position.set(0, -0.32, -0.58);
    group.add(foregrip);
  }

  group.scale.setScalar(scale);
  group.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
  return group;
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
  slot.x += THREE.MathUtils.randFloatSpread(3.5);
  slot.y += THREE.MathUtils.randFloatSpread(1.1);
  slot.z += THREE.MathUtils.randFloatSpread(2);

  const target = new THREE.Group();
  target.position.copy(slot);
  target.userData.health = 2;
  target.userData.baseY = slot.y;
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

  if (weaponModel) {
    weaponAnchor.remove(weaponModel);
  }

  weaponModel = makeGunModel(weapons[index], 0.52);
  weaponModel.rotation.set(-0.05, -0.12, 0);
  weaponAnchor.add(weaponModel);
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
  state.shots += 1;

  const pellets = weapon.pellets ?? 1;
  let landedHit = false;
  for (let i = 0; i < pellets; i += 1) {
    raycaster.setFromCamera(
      {
        x: shootRay.x + THREE.MathUtils.randFloatSpread(weapon.spread),
        y: shootRay.y + THREE.MathUtils.randFloatSpread(weapon.spread)
      },
      camera
    );

    const meshes = targets.flatMap((target) => target.children.filter((child) => child.isMesh));
    const hits = raycaster.intersectObjects(meshes, false);
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

  addBulletTracer();
  state.pitch += weapon.recoil;
  updateHud();
}

function useFocusedObject() {
  raycaster.setFromCamera(shootRay, camera);
  const meshes = interactables.flatMap((item) => {
    const children = [];
    item.traverse((child) => {
      if (child.isMesh) children.push(child);
    });
    return children;
  });
  const hits = raycaster.intersectObjects(meshes, false);
  if (hits.length === 0 || hits[0].distance > 8) return;

  const item = findInteractableGroup(hits[0].object);
  if (!item) return;

  if (item.userData.isPickup) {
    selectWeapon(item.userData.weaponIndex);
  }

  if (item.userData.action) {
    item.userData.action();
  }
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
      target.position.x += Math.cos(phase) * delta * state.targetSpeed * 2.7;
    } else {
      target.position.y = target.userData.baseY + amount * 0.22;
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
  if (event.button === 0 && document.pointerLockElement === canvas) {
    shoot();
  }
});
window.addEventListener("mousemove", (event) => {
  if (document.pointerLockElement !== canvas) return;
  state.yaw -= event.movementX * 0.0022;
  state.pitch -= event.movementY * 0.0022;
  state.pitch = THREE.MathUtils.clamp(state.pitch, -1.36, 1.24);
});
