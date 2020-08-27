
// Declare variables
let socket, tetris, input;


function setup() {
  // Initialize canvas
  canv = createCanvas(600, 900);
  canv.parent("main");

  // Initialize variables
  socket = io.connect();
  tetris = new Tetris();
  input = {
    keys: { held: {}, clicked: {} },
    mouse: { held: {}, clicked: {} },
    mouseWheel: 0
  };
}


function draw() {
  // Update tetris
  tetris.draw();

  // Update input
  input.keys.clicked = {};
  input.mouse.clicked = {};
  input.mouseWheel = 0;
}


// Handle input
function keyPressed() { input.keys.held[keyCode] = true; input.keys.clicked[keyCode] = true; }
function keyReleased() { input.keys.held[keyCode] = false; input.keys.clicked[keyCode] = false; }
function mousePressed() { input.mouse.held[mouseButton] = true; input.mouse.clicked[mouseButton] = true; }
function mouseReleased() { input.mouse.held[mouseButton] = false; input.mouse.clicked[mouseButton] = false; }
function mouseWheel(e) { input.mouseWheel = e.delta; }
