import * as CANNON from "cannon-es";
import * as THREE from "three";
import WebGL from "three/addons/capabilities/WebGL.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import CharacterControl from "./assets/utils/character";
import CannonDebugger from "cannon-es-debugger";
import { animateScale } from "./assets/utils/animation";
import { createGUI } from "./assets/utils/gui";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

import {
  MeshBVH,
  StaticGeometryGenerator,
  MeshBVHVisualizer,
} from "three-mesh-bvh";
import * as BufferGeometryUtils from "three/addons/utils/BufferGeometryUtils.js";

// SETUP
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  65,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.y = 2;
camera.position.z = 5;
camera.position.x = 0;
const renderer = new THREE.WebGL1Renderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
const control = new OrbitControls(camera, renderer.domElement);
control.enableDamping = false;
control.enablePan = false;
control.update();
//this line is unnecessary if you are re-rendering within the animation loop
//controls.addEventListener("change", () => renderer.render(scene, camera));

// DECLARE
const clock = new THREE.Clock();
const gltfLoader = new GLTFLoader();

let playerVelocity = new THREE.Vector3();
let upVector = new THREE.Vector3(0, 1, 0);
let tempVector = new THREE.Vector3();
let tempVector2 = new THREE.Vector3();
let tempBox = new THREE.Box3();
let tempMat = new THREE.Matrix4();
let tempSegment = new THREE.Line3();
let playerIsOnGround = false;
let player;

let characterControl;
const keysPressed = {};
let collider;

// RUN HANDLER
initActionKeyboard();

// LIGHT
const light = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(light);

// RENDER MODELS
// Render character
gltfLoader.load("./assets/data/Soldier.glb", (gltf) => {
  const model = gltf.scene;
  player = model;
  player.add(new THREE.AxesHelper(2));
  scene.add(player);

  const mixer = new THREE.AnimationMixer(model);
  const animations = new Map();
  gltf.animations.forEach((a) => {
    if (a.name !== "TPose") {
      animations.set(a.name, mixer.clipAction(a));
    }
  });

  characterControl = new CharacterControl(
    model,
    mixer,
    control,
    camera,
    animations,
    "Idle"
  );
});

// Render map
gltfLoader.load("./assets/data/damned_soul_purgatory.glb", (gltf) => {
  const model = gltf.scene;
  // const box = new THREE.Box3();
  // box.setFromObject(model);
  // box.getCenter(model.position).negate();
  // model.position.y = 0;
  model.updateMatrixWorld(true);
  scene.add(model);

  const toMerge = {};
  model.traverse((c) => {
    if (c.isMesh) {
      const hex = c.material.color.getHex();
      toMerge[hex] = toMerge[hex] || [];
      toMerge[hex].push(c);
    }
  });

  const environment = new THREE.Group();
  for (const hex in toMerge) {
    const arr = toMerge[hex];
    const visualGeometries = {};
    arr.forEach((mesh) => {
      if (mesh.isMesh) {
        const key =
          mesh.name.split("_")[2] +
          Object.keys(mesh.geometry.attributes).length;
        visualGeometries[key] = visualGeometries[key] || [];
        const geom = mesh.geometry.clone();
        geom.applyMatrix4(mesh.matrixWorld);
        visualGeometries[key].push(geom);
      }
    });

    for (const key in visualGeometries) {
      // Merges a set of geometries into a single instance. All geometries must have compatible attributes
      try {
        const newGeom = BufferGeometryUtils.mergeGeometries(
          visualGeometries[key]
        );
        const newMesh = new THREE.Mesh(
          newGeom,
          new THREE.MeshStandardMaterial({
            color: parseInt(hex),
            shadowSide: 2,
          })
        );

        environment.add(newMesh);
      } catch (error) {
        console.log(key);
      }
    }

    // A utility class for taking a set of SkinnedMeshes or morph target geometry and baking it into a single, static geometry that a BVH can be generated for.
    const staticGenerator = new StaticGeometryGenerator(environment);
    staticGenerator.attributes = ["position"];

    const mergedGeometry = staticGenerator.generate();
    mergedGeometry.boundsTree = new MeshBVH(mergedGeometry, {
      lazyGeneration: false,
    });

    collider = new THREE.Mesh(mergedGeometry);
    collider.material.wireframe = true;
    collider.material.opacity = 0.5;
    collider.material.transparent = true;

    const visualizer = new MeshBVHVisualizer(collider);

    // scene.add(visualizer);
    scene.add(collider);
    // scene.add(environment);
  }
});

// FUNCTION HANDLER
function initActionKeyboard() {
  const onKeyDown = function (event) {
    characterControl?.switchRunToggle(event.shiftKey);
    if (event.code === "Space") {
      if (playerIsOnGround) {
        playerVelocity.y = 10;
        playerIsOnGround = false;
      }
    }
    keysPressed[event.key.toLowerCase()] = true;
  };

  const onKeyUp = function (event) {
    characterControl?.switchRunToggle(event.shiftKey);
    keysPressed[event.key.toLowerCase()] = false;
  };

  function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.render(scene, camera);
  }

  window.addEventListener("resize", onWindowResize);
  document.addEventListener("keydown", onKeyDown);
  document.addEventListener("keyup", onKeyUp);
}

const segment = new THREE.Line3(
  new THREE.Vector3(),
  new THREE.Vector3(0, 1, 0)
);

const radius = 0.5;
const gravity = -30;
const playerSpeed = 10;

// ANIMATION
function animate() {
  requestAnimationFrame(animate);

  const deltaTime = clock.getDelta();

  // // update postion character when keys pressed
  if (player && collider) {
    if (playerIsOnGround) {
      playerVelocity.y = deltaTime * gravity;
    } else {
      playerVelocity.y += deltaTime * gravity;
    }
    player.position.addScaledVector(playerVelocity, deltaTime);

    // move the player
    const angle = control.getAzimuthalAngle();
    if (keysPressed["w"]) {
      tempVector.set(0, 0, -1).applyAxisAngle(upVector, angle);
      player.position.addScaledVector(tempVector, playerSpeed * deltaTime);
    }

    if (keysPressed["s"]) {
      tempVector.set(0, 0, 1).applyAxisAngle(upVector, angle);
      player.position.addScaledVector(tempVector, playerSpeed * deltaTime);
    }

    if (keysPressed["a"]) {
      tempVector.set(-1, 0, 0).applyAxisAngle(upVector, angle);
      player.position.addScaledVector(tempVector, playerSpeed * deltaTime);
    }

    if (keysPressed["d"]) {
      tempVector.set(1, 0, 0).applyAxisAngle(upVector, angle);
      player.position.addScaledVector(tempVector, playerSpeed * deltaTime);
    }

    player.updateMatrixWorld();
    tempBox.makeEmpty();
    tempMat.copy(collider.matrixWorld).invert();
    tempSegment.copy(segment);

    tempSegment.start.applyMatrix4(player.matrixWorld).applyMatrix4(tempMat);
    tempSegment.end.applyMatrix4(player.matrixWorld).applyMatrix4(tempMat);

    tempBox.expandByPoint(tempSegment.start);
    tempBox.expandByPoint(tempSegment.end);

    tempBox.min.addScalar(-radius);
    tempBox.max.addScalar(radius);

    collider.geometry.boundsTree.shapecast({
      intersectsBounds: (box) => box.intersectsBox(tempBox),
      intersectsTriangle: (tri) => {
        // check if the triangle is intersecting the capsule and adjust the
        // capsule position if it is.
        const triPoint = tempVector;
        const capsulePoint = tempVector2;

        const distance = tri.closestPointToSegment(
          tempSegment,
          triPoint,
          capsulePoint
        );

        if (distance < radius) {
          const depth = radius - distance;
          const direction = capsulePoint.sub(triPoint).normalize();

          tempSegment.start.addScaledVector(direction, depth);
          tempSegment.end.addScaledVector(direction, depth);
        }
      },
    });

    const newPosition = tempVector;
    newPosition.copy(tempSegment.start).applyMatrix4(collider.matrixWorld);

    const deltaVector = tempVector2;
    deltaVector.subVectors(newPosition, player.position);

    playerIsOnGround =
      deltaVector.y > Math.abs(deltaTime * playerVelocity.y * 0.25);

    const offset = Math.max(0.0, deltaVector.length() - 1e-5);
    deltaVector.normalize().multiplyScalar(offset);
    player.position.add(deltaVector);

    // Ensure player is always on the ground
    if (playerIsOnGround) {
      player.position.y = Math.max(
        player.position.y,
        collider.position.y + radius
      );
    }

    if (!playerIsOnGround) {
      deltaVector.normalize();
      playerVelocity.addScaledVector(
        deltaVector,
        -deltaVector.dot(playerVelocity)
      );
    } else {
      playerVelocity.set(0, 0, 0);
    }

    characterControl.update(deltaTime, keysPressed);

    // if the player has fallen too far below the level reset their position to the start
    if (player.position.y < -10) {
      playerVelocity.set(0, 0, 0);
      player.position.set(radius, radius, 0);
      camera.position.sub(control.target);
      control.target.copy(player.position);
      camera.position.add(player.position);
    }

    // adjust the camera
    camera.position.sub(control.target);
    control.target.copy(player.position);
    camera.position.add(player.position);
  }

  if (false) {
    control.maxPolarAngle = Math.PI;
    control.minDistance = 1e-4;
    control.maxDistance = 1e-4;
  } else {
    control.maxPolarAngle = Math.PI / 2;
    control.minDistance = 1;
    control.maxDistance = 20;
  }

  // UPDATE ANIMATON
  control.update();
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.render(scene, camera);
}

// Check whether the browser has support WebGL
if (WebGL.isWebGLAvailable()) {
  // Initiate function or other initializations here
  document.getElementById("container").appendChild(renderer.domElement);
  animate();
} else {
  const warning = WebGL.getWebGLErrorMessage();
  document.getElementById("container").appendChild(warning);
}
