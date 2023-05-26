import * as CANNON from "cannon-es";
import * as THREE from "three";
import WebGL from "three/addons/capabilities/WebGL.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import CharacterControl from "./assets/utils/character";
import CannonDebugger from "cannon-es-debugger";
import { animateScale } from "./assets/utils/animation";
import { createGUI } from "./assets/utils/gui";
import {
  MeshBVH,
  acceleratedRaycast,
  StaticGeometryGenerator,
  MeshBVHVisualizer,
} from "three-mesh-bvh";
import * as BufferGeometryUtils from "three/addons/utils/BufferGeometryUtils.js";

// SETUP
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  75,
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
THREE.Mesh.prototype.raycast = acceleratedRaycast;

const actionModels = new Map();
const collisionModel = new Map();
let characterControl;
const keysPressed = {};
let collider;

// View angle
if (false) {
  control.maxPolarAngle = Math.PI;
  control.minDistance = 1e-4;
  control.maxDistance = 1e-4;
} else {
  // control.maxPolarAngle = Math.PI / 2 - 0.05;
  // control.minDistance = 1;
  // control.maxDistance = 10;
}

// RUN HANDLER
initActionKeyboard();

// LIGHT
const light = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(light);

// RENDER MODELS
// Render character
gltfLoader.load("./assets/data/Soldier.glb", (gltf) => {
  const model = gltf.scene;
  model.traverse((obj) => {
    if (obj.isMesh) obj.castShadow = true;
  });
  model.scale.set(0.7, 0.7, 0.7);
  scene.add(model);

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
gltfLoader.load("./assets/data/5v5_game_map.glb", (gltf) => {
  const model = gltf.scene;
  model.scale.setScalar(0.002);

  const box = new THREE.Box3();
  box.setFromObject(model);
  box.getCenter(model.position).negate();
  model.position.y = 0;
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

// const plane = new THREE.Mesh(
//   new THREE.PlaneGeometry(50, 50),
//   new THREE.MeshBasicMaterial({ color: "gray" })
// );
// plane.rotation.set(-Math.PI / 2, 0, 0);
// scene.add(plane);

// function randomCycle(x, z, key) {
//   const cycle = new THREE.Mesh(
//     new THREE.TorusGeometry(0.5, 0.01, 2, 100),
//     new THREE.MeshBasicMaterial({ color: "#FFFFFF" })
//   );
//   cycle.position.set(x, 0.01, z);
//   cycle.rotation.set(Math.PI / 2, 0, 0);
//   scene.add(cycle);
//   collisionModel.set(key, cycle);
// }

// for (let index = 0; index < 20; index++) {
//   let sub = 1;
//   if (index > 10) {
//     sub = -1;
//   }

//   randomCycle(
//     (sub * Math.random() * 45) / 2,
//     (sub * Math.random() * 45) / 2,
//     `cycle_${index}`
//   );
// }

// FUNCTION HANDLER
function initActionKeyboard() {
  const onKeyDown = function (event) {
    characterControl?.switchRunToggle(event.shiftKey);
    if (event.code === "Space") {
      characterControl?.jumpAction();
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

// ANIMATION
function animate() {
  requestAnimationFrame(animate);

  const deltaTime = clock.getDelta();

  // update postion character when keys pressed
  if (characterControl) {
    characterControl.update(deltaTime, keysPressed);
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
