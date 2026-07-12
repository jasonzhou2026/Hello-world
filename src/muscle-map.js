import * as THREE from "./vendor/three.module.min.js";

let activeCleanup = null;

const STATE_COLORS = {
  recent: 0xe8503f,
  warm: 0xf29b38,
  attention: 0x315d91,
  neutral: 0xc9a68b
};

export function mountMuscleMap(canvas, { muscleStates = {}, view = "front" } = {}) {
  activeCleanup?.();
  if (!canvas) return () => {};

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  } catch {
    canvas.parentElement?.classList.add("is-unavailable");
    return () => {};
  }

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  camera.position.set(0, 0.05, 12.8);

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;

  scene.add(new THREE.HemisphereLight(0xdcecff, 0x182b46, 2.5));
  const keyLight = new THREE.DirectionalLight(0xffffff, 3.4);
  keyLight.position.set(3, 5, 5);
  scene.add(keyLight);
  const rimLight = new THREE.DirectionalLight(0x73a7df, 2.2);
  rimLight.position.set(-4, 2, -4);
  scene.add(rimLight);

  const body = buildBody(muscleStates);
  body.rotation.y = view === "back" ? Math.PI : 0;
  scene.add(body);

  let targetRotation = body.rotation.y;
  let dragging = false;
  let previousX = 0;
  const onPointerDown = (event) => {
    dragging = true;
    previousX = event.clientX;
    canvas.setPointerCapture?.(event.pointerId);
  };
  const onPointerMove = (event) => {
    if (!dragging) return;
    targetRotation += (event.clientX - previousX) * 0.012;
    previousX = event.clientX;
  };
  const onPointerUp = () => {
    dragging = false;
  };
  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointercancel", onPointerUp);

  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas);
  resize();

  let frameId = 0;
  let start = performance.now();
  const render = (time) => {
    body.rotation.y += (targetRotation - body.rotation.y) * 0.1;
    body.position.y = Math.sin((time - start) * 0.0012) * 0.025;
    renderer.render(scene, camera);
    frameId = requestAnimationFrame(render);
  };
  frameId = requestAnimationFrame(render);

  activeCleanup = () => {
    cancelAnimationFrame(frameId);
    resizeObserver.disconnect();
    canvas.removeEventListener("pointerdown", onPointerDown);
    canvas.removeEventListener("pointermove", onPointerMove);
    canvas.removeEventListener("pointerup", onPointerUp);
    canvas.removeEventListener("pointercancel", onPointerUp);
    scene.traverse((object) => {
      object.geometry?.dispose?.();
      if (Array.isArray(object.material)) object.material.forEach((material) => material.dispose());
      else object.material?.dispose?.();
    });
    renderer.dispose();
    activeCleanup = null;
  };
  return activeCleanup;
}

export function disposeMuscleMap() {
  activeCleanup?.();
}

function buildBody(muscleStates) {
  const group = new THREE.Group();
  group.scale.setScalar(1);
  const bone = material(0xe8dfd1, 0.68);
  const joint = material(0xcab6a2, 0.76);

  addPart(group, new THREE.SphereGeometry(0.38, 24, 18), bone, [0, 2.42, 0], [0.86, 1.08, 0.82]);
  addPart(group, new THREE.CapsuleGeometry(0.12, 0.32, 8, 14), bone, [0, 1.93, 0]);
  addBoneBetween(group, [0, 1.78, -0.08], [0, -0.56, -0.08], 0.055, bone);
  for (let index = 0; index < 12; index += 1) {
    addPart(group, new THREE.CylinderGeometry(0.09, 0.1, 0.105, 14), joint, [0, 1.66 - index * 0.18, -0.02], [1, 1, 0.72]);
  }

  addBoneBetween(group, [-0.05, 1.58, 0.08], [-0.69, 1.42, 0.04], 0.045, bone);
  addBoneBetween(group, [0.05, 1.58, 0.08], [0.69, 1.42, 0.04], 0.045, bone);
  for (let index = 0; index < 6; index += 1) {
    const width = 0.62 - index * 0.035;
    const rib = addPart(group, new THREE.TorusGeometry(1, 0.025, 8, 36), bone, [0, 1.34 - index * 0.19, -0.02], [width, 0.31, 0.72]);
    rib.rotation.x = 0.05;
  }
  addBoneBetween(group, [0, 1.56, 0.1], [0, 0.47, 0.1], 0.045, bone);

  addPart(group, new THREE.SphereGeometry(0.34, 22, 14), joint, [-0.26, -0.52, 0], [1.18, 0.7, 0.52]);
  addPart(group, new THREE.SphereGeometry(0.34, 22, 14), joint, [0.26, -0.52, 0], [1.18, 0.7, 0.52]);
  addBoneBetween(group, [-0.38, -0.47, 0], [0, -0.72, 0.02], 0.065, bone);
  addBoneBetween(group, [0.38, -0.47, 0], [0, -0.72, 0.02], 0.065, bone);

  const limbBones = [
    [[-0.68, 1.39, 0], [-0.93, 0.42, 0]], [[0.68, 1.39, 0], [0.93, 0.42, 0]],
    [[-0.93, 0.38, 0], [-1.07, -0.58, 0]], [[0.93, 0.38, 0], [1.07, -0.58, 0]],
    [[-0.28, -0.57, 0], [-0.35, -2.04, 0]], [[0.28, -0.57, 0], [0.35, -2.04, 0]],
    [[-0.35, -2.04, 0], [-0.38, -3.34, 0.02]], [[0.35, -2.04, 0], [0.38, -3.34, 0.02]]
  ];
  limbBones.forEach(([start, end], index) => addBoneBetween(group, start, end, index < 4 ? 0.065 : 0.09, bone));
  [[-0.68, 1.39], [0.68, 1.39], [-0.93, 0.4], [0.93, 0.4], [-1.07, -0.6], [1.07, -0.6], [-0.3, -0.58], [0.3, -0.58], [-0.35, -2.05], [0.35, -2.05]].forEach(([x, y]) => {
    addPart(group, new THREE.SphereGeometry(0.1, 14, 10), joint, [x, y, 0]);
  });
  addPart(group, new THREE.SphereGeometry(0.18, 18, 12), bone, [-0.38, -3.45, 0.12], [0.88, 0.34, 1.46]);
  addPart(group, new THREE.SphereGeometry(0.18, 18, 12), bone, [0.38, -3.45, 0.12], [0.88, 0.34, 1.46]);
  addMuscles(group, muscleStates);
  return group;
}

function addMuscles(group, states) {
  const muscleMaterial = (name) => {
    const color = STATE_COLORS[states[name]?.state] || STATE_COLORS.neutral;
    return material(color, 0.62);
  };
  const paired = (geometry, name, positions, scales = [1, 1, 1]) => {
    for (const position of positions) addPart(group, geometry, muscleMaterial(name), position, scales);
  };

  addMirroredMuscle(group, chestShape(), muscleMaterial("chest"), 0.16, 0.15);
  addMirroredMuscle(group, shoulderShape(), muscleMaterial("shoulders"), 0.08, 0.18);
  addMirroredMuscle(group, upperArmShape(), muscleMaterial("biceps"), 0.12, 0.14);
  addMirroredMuscle(group, forearmShape(), muscleMaterial("biceps"), 0.1, 0.12);
  paired(new THREE.SphereGeometry(0.34, 22, 14), "back", [[-0.32, 1.15, -0.3], [0.32, 1.15, -0.3]], [0.92, 1.26, 0.22]);
  paired(new THREE.SphereGeometry(0.22, 18, 12), "back", [[-0.22, 1.65, -0.26], [0.22, 1.65, -0.26]], [1.16, 0.5, 0.22]);
  paired(new THREE.CapsuleGeometry(0.095, 0.52, 6, 10), "triceps", [[-0.91, 0.68, -0.15], [0.91, 0.68, -0.15]], [0.86, 1, 0.58]);
  paired(new THREE.SphereGeometry(0.14, 16, 10), "core", [[-0.15, 0.76, 0.3], [0.15, 0.76, 0.3], [-0.14, 0.43, 0.31], [0.14, 0.43, 0.31], [-0.13, 0.12, 0.28], [0.13, 0.12, 0.28]], [0.82, 0.78, 0.18]);
  paired(new THREE.CapsuleGeometry(0.075, 0.58, 6, 10), "core", [[-0.34, 0.36, 0.22], [0.34, 0.36, 0.22]], [0.7, 1, 0.42]);
  paired(new THREE.SphereGeometry(0.28, 18, 12), "glutes", [[-0.29, -0.45, -0.29], [0.29, -0.45, -0.29]], [1.02, 0.8, 0.42]);
  paired(new THREE.CapsuleGeometry(0.14, 0.74, 6, 10), "quads", [[-0.35, -1.42, 0.2], [0.35, -1.42, 0.2]], [0.88, 1, 0.52]);
  paired(new THREE.CapsuleGeometry(0.13, 0.76, 6, 10), "hamstrings", [[-0.35, -1.44, -0.2], [0.35, -1.44, -0.2]], [0.88, 1, 0.52]);
  paired(new THREE.CapsuleGeometry(0.1, 0.56, 6, 10), "calves", [[-0.38, -2.72, -0.13], [0.38, -2.72, -0.13]], [0.86, 1, 0.54]);
  paired(new THREE.CapsuleGeometry(0.075, 0.62, 6, 10), "calves", [[-0.38, -2.72, 0.14], [0.38, -2.72, 0.14]], [0.7, 1, 0.44]);
}

function chestShape() {
  const shape = new THREE.Shape();
  shape.moveTo(0.045, 1.58);
  shape.bezierCurveTo(0.24, 1.66, 0.54, 1.61, 0.69, 1.43);
  shape.bezierCurveTo(0.68, 1.2, 0.53, 0.99, 0.12, 1.01);
  shape.bezierCurveTo(0.04, 1.17, 0.025, 1.4, 0.045, 1.58);
  return shape;
}

function shoulderShape() {
  const shape = new THREE.Shape();
  shape.moveTo(0.58, 1.56);
  shape.bezierCurveTo(0.77, 1.64, 0.91, 1.48, 0.91, 1.27);
  shape.bezierCurveTo(0.88, 1.09, 0.77, 0.98, 0.67, 0.99);
  shape.bezierCurveTo(0.58, 1.15, 0.54, 1.39, 0.58, 1.56);
  return shape;
}

function upperArmShape() {
  const shape = new THREE.Shape();
  shape.moveTo(0.76, 1.08);
  shape.bezierCurveTo(0.91, 1.02, 0.98, 0.8, 0.97, 0.57);
  shape.bezierCurveTo(0.96, 0.4, 0.9, 0.29, 0.84, 0.3);
  shape.bezierCurveTo(0.75, 0.5, 0.7, 0.84, 0.76, 1.08);
  return shape;
}

function forearmShape() {
  const shape = new THREE.Shape();
  shape.moveTo(0.9, 0.28);
  shape.bezierCurveTo(1.04, 0.23, 1.11, -0.09, 1.12, -0.38);
  shape.bezierCurveTo(1.12, -0.54, 1.08, -0.62, 1.03, -0.61);
  shape.bezierCurveTo(0.96, -0.39, 0.86, -0.02, 0.9, 0.28);
  return shape;
}

function addMirroredMuscle(group, shape, partMaterial, z, depth) {
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelSegments: 3,
    bevelSize: 0.025,
    bevelThickness: 0.025,
    curveSegments: 16,
    steps: 1
  });
  addPart(group, geometry, partMaterial, [0, 0, z]);
  addPart(group, geometry, partMaterial, [0, 0, z], [-1, 1, 1]);
}

function addBoneBetween(group, start, end, radius, partMaterial) {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const dz = end[2] - start[2];
  const length = Math.hypot(dx, dy, dz);
  const mesh = addPart(
    group,
    new THREE.CapsuleGeometry(radius, Math.max(0.02, length - radius * 2), 6, 12),
    partMaterial,
    [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2, (start[2] + end[2]) / 2]
  );
  mesh.rotation.z = -Math.atan2(dx, dy);
  return mesh;
}

function addPart(group, geometry, partMaterial, position, scale = [1, 1, 1], rotationZ = 0) {
  const mesh = new THREE.Mesh(geometry, partMaterial);
  mesh.position.set(...position);
  mesh.scale.set(...scale);
  mesh.rotation.z = rotationZ;
  group.add(mesh);
  return mesh;
}

function material(color, roughness) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness: 0.04 });
}
