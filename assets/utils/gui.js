import { GUI } from "dat.gui";

export function createGUI(model) {
  const gui = new GUI();

  const folder = gui.addFolder("Model");
  folder.close();

  const rotationFolder = folder.addFolder("Rotation");
  rotationFolder.add(model.rotation, "x", 0, Math.PI * 2);
  rotationFolder.add(model.rotation, "y", 0, Math.PI * 2);
  rotationFolder.add(model.rotation, "z", 0, Math.PI * 2);
  rotationFolder.open();

  const positionFolder = folder.addFolder("Position");
  positionFolder.add(model.position, "x", -10, 10, 2);
  positionFolder.add(model.position, "y", -10, 10, 2);
  positionFolder.add(model.position, "z", -10, 10, 2);
  positionFolder.open();

  const scaleFolder = folder.addFolder("Scale");
  scaleFolder.add(model.scale, "x", -5, 5);
  scaleFolder.add(model.scale, "y", -5, 5);
  scaleFolder.add(model.scale, "z", -5, 5);
  scaleFolder.open();

  folder.add(model, "visible");

  // const cameraFolder = gui.addFolder("Camera");
  // cameraFolder.open();

  // const cameraPositionFolder = cameraFolder.addFolder("Position");
  // cameraPositionFolder.add(camera.position, "x", 0, 10);
  // cameraPositionFolder.add(camera.position, "y", 0, 10);
  // cameraPositionFolder.add(camera.position, "z", 0, 10);
  // cameraPositionFolder.open();

  // const cameraRotationFolder = cameraFolder.addFolder("Rotation");
  // cameraRotationFolder.add(camera.rotation, "x", 0, 10);
  // cameraRotationFolder.add(camera.rotation, "y", 0, 10);
  // cameraRotationFolder.add(camera.rotation, "z", 0, 10);
  // cameraRotationFolder.open();
}
