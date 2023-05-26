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

let tempVector2 = new THREE.Vector3();
let tempBox = new THREE.Box3();
let tempMat = new THREE.Matrix4();
let tempSegment = new THREE.Line3();

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
  if (characterControl && collider) {
    tempBox.makeEmpty();
    tempMat.copy(collider.matrixWorld).invert();
    tempSegment.copy(
      new THREE.Line3(new THREE.Vector3(), new THREE.Vector3(0, -1.0, 0.0))
    );

    tempSegment.start
      .applyMatrix4(characterControl.model.matrixWorld)
      .applyMatrix4(tempMat);
    tempSegment.end
      .applyMatrix4(characterControl.model.matrixWorld)
      .applyMatrix4(tempMat);

    tempBox.expandByPoint(tempSegment.start);
    tempBox.expandByPoint(tempSegment.end);

    tempBox.min.addScalar(-1);
    tempBox.max.addScalar(1);

    collider.geometry.boundsTree.shapecast({
      intersectsBounds: (box) => box.intersectsBox(tempBox),

      intersectsTriangle: (tri) => {
        // check if the triangle is intersecting the capsule and adjust the
        // capsule position if it is.
        const triPoint = characterControl.walkDirection;
        const capsulePoint = tempVector2;

        const distance = tri.closestPointToSegment(
          tempSegment,
          triPoint,
          capsulePoint
        );
        if (distance < 1) {
          const depth = 1 - distance;
          const direction = capsulePoint.sub(triPoint).normalize();

          tempSegment.start.addScaledVector(direction, depth);
          tempSegment.end.addScaledVector(direction, depth);
        }
      },
    });

    const newPosition = characterControl.walkDirection;
    newPosition.copy(tempSegment.start).applyMatrix4(collider.matrixWorld);

    const deltaVector = tempVector2;
    deltaVector.subVectors(newPosition, characterControl.model.position);
    // if the player was primarily adjusted vertically we assume it's on something we should consider ground
    // characterControl.playerIsOnGround =
    //   deltaVector.y >
    //   Math.abs(deltaTime * characterControl.jumpVelocity.y * 0.25);

    const offset = Math.max(0.0, deltaVector.length() - 1e-5);
    deltaVector.normalize().multiplyScalar(offset);
    characterControl.model.position.add(deltaVector.position);

    // if (!characterControl.playerIsOnGround) {
    //   deltaVector.normalize();
    //   playerVelocity.addScaledVector(
    //     deltaVector,
    //     -deltaVector.dot(playerVelocity)
    //   );
    // } else {
    //   playerVelocity.set(0, 0, 0);
    // }

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
