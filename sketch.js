// ============================================================
//  CREEPER MACHINE — IMAGE-BASED VERSION
// ============================================================

const MODEL_URL = 
    
  "https://teachablemachine.withgoogle.com/models/8C4XrqJVT/";

// ─── Teachable Machine State ────────────────────────────────
let tmModel, tmWebcam;
let currentGesture = "none";
let labelText = "Loading model...";

async function initTM() {
  tmModel = await tmImage.load(MODEL_URL + "model.json", MODEL_URL + "metadata.json");
  tmWebcam = new tmImage.Webcam(200, 150, true);
  await tmWebcam.setup();
  await tmWebcam.play();
  labelText = "Model ready!";
  tmLoop();
}

async function tmLoop() {
  tmWebcam.update();
  const preds = await tmModel.predict(tmWebcam.canvas);
  const best = preds.reduce((a, b) => a.probability > b.probability ? a : b);
  const label = best.className.toLowerCase();
  const conf = best.probability;
  labelText = `${best.className}  ${(conf * 100).toFixed(0)}%`;

  if (conf > 0.75) {
    if (label.includes("smile")) currentGesture = "smile";
    else if (label.includes("frown")) currentGesture = "frown";
    else currentGesture = "none";
  } else {
    currentGesture = "none";
  }

  requestAnimationFrame(tmLoop);
}

// ─── Image Sprite Setup ─────────────────────────────────────
let spriteImg;
const S = 16; // block size
let pieces = [];
let cx = 220, cy = 280;

// Explosion state machine
const STATES = { IDLE: 0, WALK: 1, EXPLODE: 2, REFORM: 3 };
let state = STATES.IDLE;
let walkDir = 1;
let reformTimer = 0;

// Gesture tracking
let lastGesture = "none";
let gestureHold = 0;
let statusText = "Show 👍 or 👎";

// ─── Load your uploaded image here ──────────────────────────
function preload() {
  spriteImg = loadImage("cat.png");
}


// ─── Build pieces from image pixels ─────────────────────────
function buildPieces(x, y) {
  pieces = [];

  // Resize image to a manageable grid
  let w = 32;
  let h = 32;
  spriteImg.resize(w, h);
  spriteImg.loadPixels();

  for (let r = 0; r < h; r++) {
    for (let c = 0; c < w; c++) {
      let idx = (r * w + c) * 4;
      let rCol = spriteImg.pixels[idx];
      let gCol = spriteImg.pixels[idx + 1];
      let bCol = spriteImg.pixels[idx + 2];
      let aCol = spriteImg.pixels[idx + 3];

      if (aCol < 10) continue; // skip transparent pixels

      let col = color(rCol, gCol, bCol, aCol);

      pieces.push({
        tx: x - (w / 2) * S + c * S,
        ty: y - (h / 2) * S + r * S,
        px: x - (w / 2) * S + c * S,
        py: y - (h / 2) * S + r * S,
        vx: 0,
        vy: 0,
        col: col
      });
    }
  }
}

// ─── Scatter pieces for explosion ───────────────────────────
function scatterPieces() {
  for (const pc of pieces) {
    pc.vx = random(-13, 13);
    pc.vy = random(-15, -4);
  }
}

// ─── Draw the full sprite image ─────────────────────────────
function drawCreeper(x, y, alpha = 255) {
  push();
  imageMode(CENTER);
  tint(255, alpha);
  image(spriteImg, x, y);
  pop();
}

// ─── P5 Setup ───────────────────────────────────────────────
function setup() {
  createCanvas(440, 420);
  pixelDensity(1);
  buildPieces(cx, cy);
  initTM().catch(e => { labelText = "Webcam error: " + e.message; });
}

// ─── Main Draw Loop ─────────────────────────────────────────
function draw() {
  background(87, 70, 45);

  // Ground
  noStroke();
  fill("red");
  rect(0, 360, width, 60);
  fill(139, 0, 0);
  rect(0, 360, width, 8);

  // Gesture → state transitions
  const g = currentGesture;
  if (g !== lastGesture) { gestureHold = 0; lastGesture = g; }
  else gestureHold++;

  if (g === "frown" && gestureHold > 20 && state !== STATES.EXPLODE) {
    state = STATES.EXPLODE;
    buildPieces(cx, cy);
    scatterPieces();
    statusText = "💥 BOOM!";
  }

  if (g === "smile" && gestureHold > 20 && state !== STATES.WALK && state !== STATES.REFORM) {
    state = STATES.REFORM;
    reformTimer = 0;
    for (const pc of pieces) {
      pc.px = random(0, width);
      pc.py = random(0, height);
    }
    statusText = "✨ REFORMING...";
  }

  // IDLE
  if (state === STATES.IDLE) {
    drawCreeper(cx, cy);
  }

  // WALK
  if (state === STATES.WALK) {
    cx += walkDir * 1.5;
    if (cx > 410) walkDir = -1;
    if (cx < 30) walkDir = 1;
    const bob = sin(frameCount * 0.15) * 4;
    push(); translate(0, bob); drawCreeper(cx, cy); pop();
    statusText = "👍 Walking!";
  }

  // EXPLODE
  if (state === STATES.EXPLODE) {
    for (const pc of pieces) {
      pc.vy += 0.55;
      pc.px += pc.vx;
      pc.py += pc.vy;

      if (pc.py > 352) { pc.py = 352; pc.vy *= -0.3; pc.vx *= 0.8; }
      if (pc.px < 0 || pc.px > width - S) pc.vx *= -0.6;

      fill(pc.col);
      rect(pc.px, pc.py, S, S);
    }
  }

  // REFORM
  if (state === STATES.REFORM) {
    reformTimer++;
    const t = constrain(reformTimer / 90, 0, 1);
    let done = true;

    for (const pc of pieces) {
      pc.px = lerp(pc.px, pc.tx, 0.07);
      pc.py = lerp(pc.py, pc.ty, 0.07);
      if (dist(pc.px, pc.py, pc.tx, pc.ty) > 2) done = false;

      let c = pc.col;
      c.setAlpha(map(t, 0, 1, 60, 255));
      fill(c);
      rect(pc.px, pc.py, S, S);
    }

    if (done) {
      buildPieces(cx, cy);
      state = STATES.WALK;
    }
  }

  // Webcam thumbnail
  if (tmWebcam && tmWebcam.canvas) {
    noStroke();
    fill(0, 255, 136, 40);
    rect(width - 214, 6, 208, 162, 4);
    drawingContext.drawImage(tmWebcam.canvas, width - 212, 8, 204, 158);
  }

  // Pixel grid
  stroke(255, 255, 255, 6);
  strokeWeight(0.5);
  for (let x = 0; x < width; x += S) line(x, 0, x, height);
  for (let y = 0; y < height; y += S) line(0, y, width, y);

  // HUD
  noStroke();
  fill(0, 255, 136);
  textFont('Courier New');
  textSize(12);
  text(labelText, 8, 18);
  textSize(14);
  fill(255, 220, 0);
  text(statusText, 8, height - 10);
}
