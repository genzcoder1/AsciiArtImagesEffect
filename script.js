const ASCII_CHARS = "   .:-i|=+%O#@";
const FONT_SIZE = 14;
const ASPECT_WIDTH = 4;
const ASPECT_HEIGHT = 5;
const ASCII_COLUMNS = 25;
const IMAGE_STAGGER_MS = 100;
const CELL_APPEAR_MS = 2;
const SCRAMBLE_COUNT = 10;
const SCRAMBLE_SPEED_MS = 100;
const REVEAL_DELAY_MS = 0;

const denseCharIndex = ASCII_CHARS.lastIndexOf(".");
const denseChars = ASCII_CHARS.slice(denseCharIndex + 1).split("");

const measureCtx = document.createElement("canvas").getContext("2d");
measureCtx.font = `${FONT_SIZE}px monospace`;
const charWidth = Math.ceil(measureCtx.measureText("M").width);
const charHeight = FONT_SIZE;
const ASCII_ROWS = Math.round(
  ASCII_COLUMNS * (ASPECT_HEIGHT / ASPECT_WIDTH) * (charWidth / charHeight),
);

document.querySelectorAll("img.matrix-renderer").forEach((img, index) => {
  const canvas = document.createElement("canvas");
  const staggerDelay = index * IMAGE_STAGGER_MS;

  const originalSrc = img.src;
  img.crossOrigin = "anonymous";
  img.src = originalSrc;

  const onLoaded = () => startEffect(img, canvas, staggerDelay);
  const onError = () => {
    console.error(`CORS or Loading Error on: ${img.src}`);
    img.closest(".visual-card").classList.add("unlocked");
  };

  img.closest(".visual-card").appendChild(canvas);

  if (img.complete && img.naturalWidth) {
    onLoaded();
  } else {
    img.addEventListener("load", onLoaded);
    img.addEventListener("error", onError);
  }
});

function startEffect(img, canvas, staggerDelay) {
  const { asciiGrid, brightnessGrid } = imageToAsciiGrid(img);
  prepareCanvas(canvas);
  animateCells(canvas, asciiGrid, brightnessGrid, staggerDelay);
}

function imageToAsciiGrid(img) {
  const imageAspect = img.naturalWidth / img.naturalHeight;
  const itemAspect = ASPECT_WIDTH / ASPECT_HEIGHT;

  let cropX = 0,
    cropY = 0,
    cropW = img.naturalWidth,
    cropH = img.naturalHeight;

  if (imageAspect > itemAspect) {
    cropW = img.naturalHeight * itemAspect;
    cropX = (img.naturalWidth - cropW) / 2;
  } else {
    cropH = img.naturalWidth / itemAspect;
    cropY = (img.naturalHeight - cropH) / 2;
  }

  const samplingCanvas = document.createElement("canvas");
  samplingCanvas.width = ASCII_COLUMNS;
  samplingCanvas.height = ASCII_ROWS;
  samplingCanvas
    .getContext("2d")
    .drawImage(
      img,
      cropX,
      cropY,
      cropW,
      cropH,
      0,
      0,
      ASCII_COLUMNS,
      ASCII_ROWS,
    );

  const { data } = samplingCanvas
    .getContext("2d")
    .getImageData(0, 0, ASCII_COLUMNS, ASCII_ROWS);
  const asciiGrid = [];
  const brightnessGrid = [];

  for (let row = 0; row < ASCII_ROWS; row++) {
    const asciiRow = [];
    const brightnessRow = [];

    for (let col = 0; col < ASCII_COLUMNS; col++) {
      const pixelIndex = (row * ASCII_COLUMNS + col) * 4;
      const brightness =
        (data[pixelIndex] * 0.299 +
          data[pixelIndex + 1] * 0.587 +
          data[pixelIndex + 2] * 0.114) /
        255;
      const charIndex = Math.min(
        ASCII_CHARS.length - 1,
        Math.floor(brightness * ASCII_CHARS.length),
      );

      asciiRow.push(ASCII_CHARS[charIndex]);
      brightnessRow.push(charIndex);
    }

    asciiGrid.push(asciiRow);
    brightnessGrid.push(brightnessRow);
  }

  return { asciiGrid, brightnessGrid };
}

function prepareCanvas(canvas) {
  const dpr = 2;
  canvas.width = ASCII_COLUMNS * charWidth * dpr;
  canvas.height = ASCII_ROWS * charHeight * dpr;

  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#111";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function drawCharacter(ctx, col, row, char) {
  ctx.fillStyle = "#111";
  ctx.fillRect(col * charWidth, row * charHeight, charWidth, charHeight);
  ctx.fillStyle = "#c8c8c8";
  ctx.fillText(char, col * charWidth, row * charHeight);
}

function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function animateCells(canvas, asciiGrid, brightnessGrid, staggerDelay) {
  const dpr = 2;
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.font = `${charHeight}px monospace`;
  ctx.textBaseline = "top";

  const totalCells = ASCII_COLUMNS * ASCII_ROWS;
  const scrambleState = new Array(totalCells).fill(null);
  let settledCount = 0;

  const cellOrder = shuffleArray(
    Array.from({ length: totalCells }, (_, i) => i),
  );

  cellOrder.forEach((cellIndex, i) => {
    setTimeout(
      () => {
        const row = Math.floor(cellIndex / ASCII_COLUMNS);
        const col = cellIndex % ASCII_COLUMNS;
        const isDark = brightnessGrid[row][col] > denseCharIndex;

        if (!isDark) {
          drawCharacter(ctx, col, row, asciiGrid[row][col]);
          scrambleState[cellIndex] = 0;
          settledCount++;
          if (settledCount === totalCells) scheduleImageReveal(canvas);
        } else {
          drawCharacter(
            ctx,
            col,
            row,
            denseChars[Math.floor(Math.random() * denseChars.length)],
          );
          scrambleState[cellIndex] = SCRAMBLE_COUNT;
        }
      },
      staggerDelay + i * CELL_APPEAR_MS,
    );
  });

  const scrambleTicker = setInterval(() => {
    let stillScrambling = false;

    for (let cellIndex = 0; cellIndex < totalCells; cellIndex++) {
      const remaining = scrambleState[cellIndex];
      if (remaining === null || remaining === 0) continue;

      stillScrambling = true;
      const row = Math.floor(cellIndex / ASCII_COLUMNS);
      const col = cellIndex % ASCII_COLUMNS;

      if (remaining === 1) {
        drawCharacter(ctx, col, row, asciiGrid[row][col]);
        scrambleState[cellIndex] = 0;
        settledCount++;
        if (settledCount === totalCells) scheduleImageReveal(canvas);
      } else {
        drawCharacter(
          ctx,
          col,
          row,
          denseChars[Math.floor(Math.random() * denseChars.length)],
        );
        scrambleState[cellIndex] = remaining - 1;
      }
    }

    if (!stillScrambling && settledCount === totalCells)
      clearInterval(scrambleTicker);
  }, SCRAMBLE_SPEED_MS);
}

function scheduleImageReveal(canvas) {
  setTimeout(() => {
    canvas.closest(".visual-card").classList.add("unlocked");
  }, REVEAL_DELAY_MS);
}

// --- Premium Draggable Interaction ---
document.querySelectorAll('.visual-card').forEach(makeDraggable);

let highestZIndex = 10;

function makeDraggable(element) {
  let isDragging = false;
  let startX, startY;
  let x = 0, y = 0;
  let rotate = 0;

  // Capture initial rotation from CSS to avoid snapping
  const style = window.getComputedStyle(element);
  const matrix = new WebKitCSSMatrix(style.transform);
  const initialRotate = Math.round(Math.atan2(matrix.b, matrix.a) * (180 / Math.PI));
  let currentRotate = initialRotate;

  element.style.cursor = 'grab';
  element.style.transition = 'transform 0.6s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.6s ease';

  element.addEventListener('mousedown', dragStart);
  element.addEventListener('touchstart', dragStart, { passive: false });

  function dragStart(e) {
    if (e.target.tagName.toLowerCase() === 'a') return;

    if (e.type === 'mousedown') e.preventDefault();

    isDragging = true;
    highestZIndex++;
    element.style.zIndex = highestZIndex;
    element.style.cursor = 'grabbing';
    element.style.transition = 'none';
    element.classList.add('active-pull');

    if (e.type === 'touchstart') {
      startX = e.touches[0].clientX - x;
      startY = e.touches[0].clientY - y;
    } else {
      startX = e.clientX - x;
      startY = e.clientY - y;
    }

    document.addEventListener('mousemove', drag);
    document.addEventListener('touchmove', drag, { passive: false });
    document.addEventListener('mouseup', dragEnd);
    document.addEventListener('touchend', dragEnd);
    document.addEventListener('mouseleave', dragEnd);
  }

  function drag(e) {
    if (!isDragging) return;
    if (e.type === 'touchmove') e.preventDefault();

    let clientX, clientY;
    if (e.type === 'touchmove') {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const newX = clientX - startX;
    const newY = clientY - startY;

    const velocityX = newX - x;
    const targetRotate = Math.max(-15, Math.min(15, velocityX * 0.8));
    // Blend with initial rotation for a smoother feel
    currentRotate = initialRotate + targetRotate;

    x = newX;
    y = newY;

    element.style.transform = `translate(${x}px, ${y}px) scale(1.08) rotate(${currentRotate}deg)`;
    element.style.boxShadow = '0 40px 80px rgba(0,0,0,0.8)';
  }

  function dragEnd() {
    isDragging = false;
    element.style.cursor = 'grab';
    element.classList.remove('active-pull');

    element.style.transition = 'transform 0.8s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.8s ease';
    element.style.transform = `translate(${x}px, ${y}px) scale(1) rotate(${initialRotate}deg)`;
    element.style.boxShadow = '0 20px 50px rgba(0,0,0,0.5)';

    document.removeEventListener('mousemove', drag);
    document.removeEventListener('touchmove', drag);
    document.removeEventListener('mouseup', dragEnd);
    document.removeEventListener('touchend', dragEnd);
    document.removeEventListener('mouseleave', dragEnd);
  }
}
