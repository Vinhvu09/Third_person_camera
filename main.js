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

class Model3D {
  constructor() {
    this.init();
    this.responsive();
    this.play();
  }

  init() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      65,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    this.renderer = new THREE.WebGL1Renderer({ antialias: true });
    this.control = new OrbitControls(this.camera, this.renderer.domElement);
    this.clock = new THREE.Clock();
    this.gltfLoader = new GLTFLoader();

    this.playerVelocity = new THREE.Vector3();
    this.upVector = new THREE.Vector3(0, 1, 0);
    this.tempVector = new THREE.Vector3();
    this.tempVector2 = new THREE.Vector3();
    this.tempBox = new THREE.Box3();
    this.tempMat = new THREE.Matrix4();
    this.tempSegment = new THREE.Line3();
    this.playerIsOnGround = false;
    this.player;

    this.segment = new THREE.Line3(
      new THREE.Vector3(),
      new THREE.Vector3(0, 1, 0)
    );

    this.radius = 0.45;
    this.gravity = -50;
    this.playerSpeed = 10;

    this.colliderMap = new Map();
    this.animationsMap = new Map();
  }

  initLight() {
    const light = new THREE.AmbientLight(0xffffff, 0.3);
    this.scene.add(light);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(1, 1, 1); // Direction
    this.scene.add(directionalLight);

    const pointLight = new THREE.PointLight(0xffffff, 1);
    pointLight.position.set(0, 3, 0); // Position
    this.scene.add(pointLight);
  }

  play() {
    // Check whether the browser has support WebGL
    if (WebGL.isWebGLAvailable()) {
      // Initiate function or other initializations here
      document
        .getElementById("container")
        .appendChild(this.renderer.domElement);
      this.animate();
    } else {
      const warning = WebGL.getWebGLErrorMessage();
      document.getElementById("container").appendChild(warning);
    }
  }

  loadModelGLTF(url) {
    return new Promise((resolve, reject) => {
      this.gltfLoader.load(
        url,
        (gltf) => {
          const model = gltf.scene;
          const animations = new Map();

          if (gltf.animations.length !== 0) {
            const mixer = new THREE.AnimationMixer(model);
            gltf.animations.forEach((a) => {
              animations.set(a.name, mixer.clipAction(a));
            });
          }

          resolve({
            model,
            animations,
          });
        },
        undefined,
        (error) => {
          reject(error);
        }
      );
    });
  }

  initBVHCollider(model, options = {}) {
    model.updateMatrixWorld(true);

    const meshes = [];
    const environment = new THREE.Group();
    const visualGeometries = {};

    model.traverse((c) => {
      if (c.isMesh) {
        meshes.push(c);
      }
    });

    meshes.forEach((mesh) => {
      let key = options.isGroupKeyByName
        ? mesh.name
        : mesh.name.split("_")[2] +
          Object.keys(mesh.geometry.attributes).length;

      visualGeometries[key] = visualGeometries[key] || [];
      const geom = mesh.geometry.clone();
      geom.applyMatrix4(mesh.matrixWorld);
      visualGeometries[key].push(geom);
    });

    for (const key in visualGeometries) {
      // Merges a set of geometries into a single instance.
      // All geometries must have compatible attributes
      try {
        const newGeom = BufferGeometryUtils.mergeGeometries(
          visualGeometries[key]
        );
        const newMesh = new THREE.Mesh(
          newGeom,
          new THREE.MeshStandardMaterial({
            color: 0xf33333,
            shadowSide: 2,
          })
        );

        environment.add(newMesh);
      } catch (error) {
        console.log(key);
      }
    }

    // A utility class for taking a set of SkinnedMeshes or morph target geometry and baking it into a single,
    // static geometry that a BVH can be generated for.
    const staticGenerator = new StaticGeometryGenerator(environment);
    staticGenerator.attributes = ["position"];

    const mergedGeometry = staticGenerator.generate();
    mergedGeometry.boundsTree = new MeshBVH(mergedGeometry, {
      lazyGeneration: false,
    });

    const collider = new THREE.Mesh(mergedGeometry);
    collider.material.wireframe = true;
    const visualizer = new MeshBVHVisualizer(collider);

    return {
      collider,
      visualizer,
      environment,
    };
  }

  responsive() {
    window.addEventListener("resize", this.onWindowResize.bind(this));
  }

  onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.render(scene, camera);
  }

  animate() {
    requestAnimationFrame(this.animate.bind(this));
    const deltaTime = this.clock.getDelta();

    return;
    // // update postion character when keys pressed
    if (player && colliderMap.has("map")) {
      const matrixWorld = colliderMap.get("map").matrixWorld;
      // Create box into radius and matrix player(include: position, scale, rotation)
      // Box preresent for player to check collision with geometries map
      tempBox.makeEmpty();

      tempMat.copy(matrixWorld).invert();
      tempSegment.copy(segment);
      tempSegment.start.applyMatrix4(player.matrixWorld).applyMatrix4(tempMat);
      tempSegment.end.applyMatrix4(player.matrixWorld).applyMatrix4(tempMat);

      tempBox.expandByPoint(tempSegment.start);
      tempBox.expandByPoint(tempSegment.end);
      tempBox.min.addScalar(-radius);
      tempBox.max.addScalar(radius);

      colliderMap.forEach((collider, key) => {
        if (/circle/.test(key)) {
          const k = key.split("-")[0];
          const box = colliderMap.get(`${k}-box`);
          let isCollider = false;

          collider.geometry.boundsTree.shapecast({
            intersectsBounds: (box) => box.intersectsBox(tempBox),
            intersectsTriangle: (tri) => {
              const distance = tri.closestPointToSegment(
                tempSegment,
                tempVector,
                tempVector2
              );

              isCollider = distance > radius;
            },
          });

          const boxHeight = box.geometry.parameters.height;

          if (isCollider) {
            box.position.y = Math.max(box.position.y - 0.01, -boxHeight);
          } else {
            box.position.y = Math.min(box.position.y + 0.01, 0);
          }

          return;
        }

        collider.geometry.boundsTree.shapecast({
          intersectsBounds: (box) => {
            return box.intersectsBox(tempBox);
          },
          intersectsTriangle: (tri) => {
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
      });

      const newPosition = tempVector;
      newPosition.copy(tempSegment.start).applyMatrix4(matrixWorld);

      const deltaVector = tempVector2;
      deltaVector.subVectors(newPosition, player.position);
      playerIsOnGround =
        deltaVector.y > Math.abs(deltaTime * playerVelocity.y * 0.25);

      const offset = Math.max(0.0, deltaVector.length() - 1e-5);
      deltaVector.normalize().multiplyScalar(offset);
      player.position.add(deltaVector);

      if (playerIsOnGround) {
        playerVelocity.set(0, 0, 0);
      } else {
        deltaVector.normalize();
        playerVelocity.addScaledVector(
          deltaVector,
          -deltaVector.dot(playerVelocity)
        );
      }

      characterControl.update(deltaTime, keysPressed);

      // if the player has fallen too far below the level reset their position to the start
      if (player.position.y < -30) {
        playerVelocity.set(0, 0, 0);
        player.position.set(1, radius, 0);
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
      control.maxDistance = 50;
    }

    // UPDATE ANIMATON
    control.update();
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.render(scene, camera);
  }
}

// new Model3D();

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

const segment = new THREE.Line3(
  new THREE.Vector3(),
  new THREE.Vector3(0, 1, 0)
);

const radius = 0.45;
const gravity = -50;
const playerSpeed = 10;

const colliderMap = new Map();
const animationsMap = new Map();

// RUN HANDLER
initActionKeyboard();

// LIGHT
const light = new THREE.AmbientLight(0xffffff, 0.3);
scene.add(light);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1); // Color, Intensity
directionalLight.position.set(1, 1, 1); // Direction
scene.add(directionalLight);

const pointLight = new THREE.PointLight(0xffffff, 1); // Color, Intensity
pointLight.position.set(0, 3, 0); // Position
scene.add(pointLight);

// const spotLight = new THREE.SpotLight(0xffffff, 1); // Color, Intensity
// spotLight.position.set(30, 2, 0); // Position
// spotLight.target.position.set(0, 0, 0); // Target position
// scene.add(spotLight);
// scene.add(spotLight.target);

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
  model.updateMatrixWorld(true);
  model.position.y = radius;
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

    const collider = new THREE.Mesh(mergedGeometry);
    collider.material.wireframe = true;
    collider.material.opacity = 0.5;
    collider.material.transparent = true;

    colliderMap.set("map", collider);

    const visualizer = new MeshBVHVisualizer(collider);

    // scene.add(visualizer);
    scene.add(collider);
    // scene.add(environment);
  }
});

const statueNames = [
  // "bantuong.glb",
  // "face.glb",
  // "Lion.glb",
  // "Rong.glb",
  "SuTu.glb",
].forEach((name, idx) => {
  gltfLoader.load(`./assets/data/${name}`, (gltf) => {
    const model = gltf.scene;
    model.scale.set(6, 6, 6);
    model.position.x = 4;
    model.position.y = 2 + radius;
    model.rotation.y = Math.PI / 2;
    model.updateMatrixWorld(true);

    const geometry = new THREE.TorusGeometry(1, 0.1, 100, 100);
    const material = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const torus = new THREE.Mesh(geometry, material);
    torus.name = "circle";
    torus.rotation.set(Math.PI / 2, 0, 0);
    torus.position.copy(model.position).setY(radius).setX(2);
    torus.updateMatrixWorld(true);

    const box = new THREE.Box3().setFromObject(model);
    const newPosition = new THREE.Vector3();
    box.getCenter(newPosition);

    const boxGeometry = new THREE.BoxGeometry(2, 2, 3);
    const boxMesh = new THREE.Mesh(
      boxGeometry,
      new THREE.MeshBasicMaterial({
        color: "white",
        transparent: true,
        opacity: 0.3,
      })
    );
    boxMesh.name = "box";
    boxMesh.position.copy(newPosition);
    boxMesh.scale.addScalar(-0.01);
    boxMesh.visible = false;
    boxMesh.updateMatrixWorld(true);

    const statuePedestal = new THREE.Mesh(boxGeometry);
    statuePedestal.position.copy(newPosition).setY(1 + radius);
    statuePedestal.name = "statuePedestal";
    statuePedestal.updateMatrixWorld(true);

    const group = new THREE.Group();
    group.add(model);
    group.add(boxMesh);
    group.add(torus);
    group.add(statuePedestal);
    group.position.x = 40;
    group.updateMatrixWorld(true);

    scene.add(group);

    const mixer = new THREE.AnimationMixer(model);
    mixer.clipAction(gltf.animations[0]).play();

    const geometries = [];
    group.traverse((c) => {
      if (c.isMesh) {
        const geom = c.geometry.clone();
        geom.name = c.name;
        geom.applyMatrix4(c.matrixWorld);
        geometries.push(geom);
      }
    });

    geometries.forEach((geo) => {
      geo.boundsTree = new MeshBVH(geo);
      const collider = new THREE.Mesh(
        geo,
        new THREE.MeshBasicMaterial({ color: "red", wireframe: true })
      );

      if (geo.name === "box") {
        collider.material = new THREE.MeshBasicMaterial({
          color: "gray",
          transparent: true,
          opacity: 0.5,
        });

        scene.add(collider);
      }
      colliderMap.set(`${name}-${geo.name}`, collider);
    });
  });
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

// ANIMATION
function animate() {
  requestAnimationFrame(animate);

  const deltaTime = clock.getDelta();

  // // update postion character when keys pressed
  if (player && colliderMap.has("map")) {
    if (playerIsOnGround) {
      playerVelocity.y = deltaTime * gravity;
    } else {
      playerVelocity.y += deltaTime * gravity;
    }

    // console.log(playerVelocity);

    player.position.addScaledVector(playerVelocity, deltaTime);

    // move the player
    const angle = control.getAzimuthalAngle();
    if (keysPressed["w"]) {
      // applyAxisAngle: quay vector xung quanh một trục (0, 1, 0) => trục Y và góc quay đã cho => control.
      tempVector.set(0, 0, -1).applyAxisAngle(upVector, angle);
      console.log(angle);
      // Example addScaledVector
      // const v1 = new THREE.Vector3(1, 2, 3);
      // const v2 = new THREE.Vector3(4, 5, 6);
      // const s = 2;

      // v2.addScaledVector(v1, s);
      // v2 sẽ trở thành (6, 9, 12)
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

    const matrixWorld = colliderMap.get("map").matrixWorld;
    // Create box into radius and matrix player(include: position, scale, rotation)
    // Box preresent for player to check collision with geometries map
    tempBox.makeEmpty();

    tempMat.copy(matrixWorld).invert();
    tempSegment.copy(segment);
    tempSegment.start.applyMatrix4(player.matrixWorld).applyMatrix4(tempMat);
    tempSegment.end.applyMatrix4(player.matrixWorld).applyMatrix4(tempMat);

    tempBox.expandByPoint(tempSegment.start);
    tempBox.expandByPoint(tempSegment.end);
    tempBox.min.addScalar(-radius);
    tempBox.max.addScalar(radius);

    // Show tempbox to scene
    // const boxHelper = new THREE.Box3Helper(tempBox, 0xffff00);
    // scene.add(boxHelper);

    // Show tempSegment to scene
    // const geometry = new THREE.BufferGeometry().setFromPoints([
    //   tempSegment.start,
    //   tempSegment.end,
    // ]);
    // const material = new THREE.LineBasicMaterial({ color: 0xff0000 });
    // const lineObject = new THREE.Line(geometry, material);
    // scene.add(lineObject);

    colliderMap.forEach((collider, key) => {
      if (/circle/.test(key)) {
        const k = key.split("-")[0];
        const box = colliderMap.get(`${k}-box`);
        let isCollider = false;

        collider.geometry.boundsTree.shapecast({
          intersectsBounds: (box) => box.intersectsBox(tempBox),
          intersectsTriangle: (tri) => {
            const distance = tri.closestPointToSegment(
              tempSegment,
              tempVector,
              tempVector2
            );

            isCollider = distance > radius;
          },
        });

        const boxHeight = box.geometry.parameters.height;

        if (isCollider) {
          box.position.y = Math.max(box.position.y - 0.01, -boxHeight);
        } else {
          box.position.y = Math.min(box.position.y + 0.01, 0);
        }

        return;
      }

      collider.geometry.boundsTree.shapecast({
        intersectsBounds: (box) => {
          return box.intersectsBox(tempBox);
        },
        intersectsTriangle: (tri) => {
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
    });

    const newPosition = tempVector;
    newPosition.copy(tempSegment.start).applyMatrix4(matrixWorld);

    const deltaVector = tempVector2;
    deltaVector.subVectors(newPosition, player.position);
    playerIsOnGround =
      deltaVector.y > Math.abs(deltaTime * playerVelocity.y * 0.25);

    const offset = Math.max(0.0, deltaVector.length() - 1e-5);
    deltaVector.normalize().multiplyScalar(offset);
    player.position.add(deltaVector);

    if (playerIsOnGround) {
      playerVelocity.set(0, 0, 0);
    } else {
      deltaVector.normalize();
      playerVelocity.addScaledVector(
        deltaVector,
        -deltaVector.dot(playerVelocity)
      );
    }

    characterControl.update(deltaTime, keysPressed);

    // if the player has fallen too far below the level reset their position to the start
    if (player.position.y < -30) {
      playerVelocity.set(0, 0, 0);
      player.position.set(1, radius, 0);
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
    control.maxDistance = 50;
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
