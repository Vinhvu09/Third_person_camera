import * as THREE from "three";
import { ACTION_TYPE, JUMP_KEYS, MOVEMENT_KEYS } from "../constants/common";

export default class CharacterControl {
  constructor(
    model,
    mixer,
    orbitControl,
    camera,
    animations = [],
    currentAction
  ) {
    this.player = model;
    this.currentAction = currentAction;
    this.mixer = mixer;
    this.orbitControl = orbitControl;
    this.camera = camera;
    this.animations = animations;
    this.toggleRun = false;

    this.walkDirection = new THREE.Vector3();
    this.jumpVelocity = new THREE.Vector3();
    this.rotateAngle = new THREE.Vector3(0, 1, 0);
    this.rotateQuarternion = new THREE.Quaternion();
    this.cameraTarget = new THREE.Vector3();

    this.fadeDuration = 0.2;
    this.runVelocity = 10;
    this.walkVelocity = 2;
    this.gravity = -30;
    this.keysPressed = {};
    this.playerIsOnGround = false;

    this.animations.forEach((value, key) => {
      if (key === currentAction) {
        value.play();
      }
    });

    this.initActionKeyboard();
  }

  switchRunToggle(isRun = false) {
    this.toggleRun = isRun;
  }

  initActionKeyboard() {
    document.addEventListener("keydown", this.onKeyDown.bind(this));
    document.addEventListener("keyup", this.onKeyUp.bind(this));
  }

  onKeyUp(event) {
    this.switchRunToggle(event.shiftKey);
    if (event.code === "Space") {
      if (this.playerIsOnGround) {
        this.jumpVelocity.y = 10;
        this.playerIsOnGround = false;
      }
    }
    this.keysPressed[event.key.toLowerCase()] = false;
  }

  onKeyDown(event) {
    this.switchRunToggle(event.shiftKey);
    this.keysPressed[event.key.toLowerCase()] = true;
  }

  handleMovement(deltaTime) {
    if (this.playerIsOnGround) {
      this.jumpVelocity.y = deltaTime * this.gravity;
    } else {
      this.jumpVelocity.y += deltaTime * this.gravity;
    }

    this.player.position.addScaledVector(this.jumpVelocity, deltaTime);

    const velocity =
      this.currentAction == "Run" ? this.runVelocity : this.walkVelocity;
    const angle = this.orbitControl.getAzimuthalAngle();
    if (this.keysPressed[MOVEMENT_KEYS.up]) {
      // applyAxisAngle: quay vector xung quanh một trục (0, 1, 0) => trục Y và góc quay đã cho => control.
      this.walkDirection.set(0, 0, -1).applyAxisAngle(this.rotateAngle, angle);
      this.player.position.addScaledVector(
        this.walkDirection,
        velocity * deltaTime
      );
    }

    if (this.keysPressed[MOVEMENT_KEYS.down]) {
      this.walkDirection.set(0, 0, 1).applyAxisAngle(this.rotateAngle, angle);
      this.player.position.addScaledVector(
        this.walkDirection,
        velocity * deltaTime
      );
    }

    if (this.keysPressed[MOVEMENT_KEYS.left]) {
      this.walkDirection.set(-1, 0, 0).applyAxisAngle(this.rotateAngle, angle);
      this.player.position.addScaledVector(
        this.walkDirection,
        velocity * deltaTime
      );
    }

    if (this.keysPressed[MOVEMENT_KEYS.right]) {
      this.walkDirection.set(1, 0, 0).applyAxisAngle(this.rotateAngle, angle);
      this.player.position.addScaledVector(
        this.walkDirection,
        velocity * deltaTime
      );
    }

    const directionOffset = this.directionOffset(this.keysPressed);
    // rotate model
    this.rotateQuarternion.setFromAxisAngle(
      this.rotateAngle,
      angle + directionOffset
    );
    this.player.quaternion.rotateTowards(this.rotateQuarternion, 0.15);
    this.player.updateMatrixWorld(true);
  }

  handleAnimation(delta) {
    const isMovementPressed = Object.values(MOVEMENT_KEYS).some(
      (key) => this.keysPressed[key] === true
    );
    // const isJumpPressed = this.keysPressed[JUMP_KEYS];
    let action = ACTION_TYPE.stand;
    if (isMovementPressed) {
      action = ACTION_TYPE.walk;

      if (this.toggleRun) {
        action = ACTION_TYPE.run;
      }
    }

    // if (isJumpPressed) {
    //   action = ACTION_TYPE.jump;
    // }

    if (this.currentAction !== action) {
      const prevAction = this.animations.get(this.currentAction);
      const currentAction = this.animations.get(action);

      prevAction.fadeOut(this.fadeDuration);
      currentAction.reset().fadeIn(this.fadeDuration).play();
      this.currentAction = action;
    }

    this.mixer.update(delta);
  }

  update(delta, playerIsOnGround) {
    this.handleAnimation(delta);
    this.handleMovement(delta, playerIsOnGround);
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
