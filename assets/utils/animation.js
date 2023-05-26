export function animateScale(model, isReverse = false) {
  let initialScale = 20; // Initial scale value
  let targetScale = 1; // Target scale value
  if (isReverse) {
    initialScale = 1;
    targetScale = 20;
  }

  const duration = 500; // Duration of the animation in milliseconds
  let currentScale = initialScale;

  return new Promise((resolve) => {
    // Calculate the scale increment based on the duration
    const scaleIncrement = (targetScale - initialScale) / duration;

    // Create a variable to store the animation start time
    let startTime = null;

    function rotationAnimation() {
      if (model.isRemove) return;

      model.rotation.y += 0.01;
      requestAnimationFrame(rotationAnimation);
    }

    // Define the animation function
    function scaleAnimation(timestamp) {
      if (!startTime) startTime = timestamp; // Store the start time of the animation

      // Calculate the elapsed time since the start of the animation
      const elapsed = timestamp - startTime;

      // Calculate the new scale value based on the elapsed time and scale increment
      currentScale = initialScale + scaleIncrement * elapsed;

      // Apply the scale to the model
      model.scale.set(currentScale, currentScale, currentScale);
      // Check if the animation duration has been reached
      if (elapsed < duration) {
        // Continue the animation
        requestAnimationFrame(scaleAnimation);
      } else {
        rotationAnimation();
        resolve(true);
      }
    }

    // Start the animation
    requestAnimationFrame(scaleAnimation);
  });
}
