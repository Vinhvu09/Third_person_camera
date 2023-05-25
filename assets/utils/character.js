import * as THREE from "three";

export default class CharacterControl {
  constructor(
    model,
    mixer,
    orbitControl,
    camera,
    animations = [],
    currentAction
  ) {
    this.model = model;
    this.currentAction = currentAction;
    this.mixer = mixer;
    this.orbitControl = orbitControl;
    this.camera = camera;
    this.animations = animations;
    this.toggleRun = false;

    this.walkDirection = new THREE.Vector3();
    this.rotateAngle = new THREE.Vector3(0, 1, 0);
    this.rotateQuarternion = new THREE.Quaternion();
    this.cameraTarget = new THREE.Vector3();

    this.fadeDuration = 0.2;
    this.runVelocity = 5;
    this.walkVelocity = 2;

    this.animations.forEach((value, key) => {
      if (key === currentAction) {
        value.play();
      }
    });
  }

  switchRunToggle(isRun = false) {
    this.toggleRun = isRun;
  }

  update(delta, keysPressed) {
    const isDirectionPressed = ["w", "s", "d", "a"].some(
      (key) => keysPressed[key] === true
    );

    let action = "Idle";
    if (isDirectionPressed) {
      action = "Walk";

      if (this.toggleRun) {
        action = "Run";
      }
    }

    if (this.currentAction !== action) {
      const prevAction = this.animations.get(this.currentAction);
      const currentAction = this.animations.get(action);

      prevAction.fadeOut(this.fadeDuration);
      currentAction.reset().fadeIn(this.fadeDuration).play();
      this.currentAction = action;
    }
    this.mixer.update(delta);

    if (this.currentAction !== "Idle") {
      // calculate toward camera direction
      let angleYCameraDirection = Math.atan2(
        this.camera.position.x - this.model.position.x,
        this.camera.position.z - this.model.position.z
      );

      // diagonal movement angle offset
      let directionOffset = this.directionOffset(keysPressed);

      // rotate model
      this.rotateQuarternion.setFromAxisAngle(
        this.rotateAngle,
        angleYCameraDirection + directionOffset
      );

      // this.model.quaternion.rotateTowards(this.rotateQuarternion, 0.15); // For mesh THREEJS
      this.model.quaternion.copy(this.rotateQuarternion, 0.1); // For body CANNONES

      // calculate direction
      this.camera.getWorldDirection(this.walkDirection);
      this.walkDirection.y = 0;
      this.walkDirection.normalize();
      this.walkDirection.applyAxisAngle(this.rotateAngle, directionOffset);

      // run/walk velocity
      const velocity =
        this.currentAction == "Run" ? this.runVelocity : this.walkVelocity;

      // move model & camera
      const moveX = this.walkDirection.x * velocity * delta;
      const moveZ = this.walkDirection.z * velocity * delta;
      this.model.position.x += moveX;
      this.model.position.z += moveZ;
      this.updateCameraTarget(moveX, moveZ);
    }
  }

  updateCameraTarget(moveX, moveZ) {
    // move camera
    this.camera.position.x += moveX;
    this.camera.position.z += moveZ;
    // this.camera.position.y = 0.5;

    // update camera target
    this.cameraTarget.x = this.model.position.x;
    this.cameraTarget.y = this.model.position.y;
    this.cameraTarget.z = this.model.position.z;
    this.orbitControl.target = this.cameraTarget;
  }

  directionOffset(keysPressed) {
    let directionOffset = 0; // w

    if (keysPressed["w"]) {
      if (keysPressed["a"]) {
        directionOffset = Math.PI / 4; // w+a
      } else if (keysPressed["d"]) {
        directionOffset = -Math.PI / 4; // w+d
      }
    } else if (keysPressed["s"]) {
      if (keysPressed["a"]) {
        directionOffset = Math.PI / 4 + Math.PI / 2; // s+a
      } else if (keysPressed["d"]) {
        directionOffset = -Math.PI / 4 - Math.PI / 2; // s+d
      } else {
        directionOffset = Math.PI; // s
      }
    } else if (keysPressed["a"]) {
      directionOffset = Math.PI / 2; // a
    } else if (keysPressed["d"]) {
      directionOffset = -Math.PI / 2; // d
    }

    return directionOffset;
  }
}
