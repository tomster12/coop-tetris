
// Declare variables
let assets = {

  preload() {
    // Preload all sounds
    this.sounds = {};
    this.sounds["hover"] = loadSound("./assets/sounds/scifiHover.mp3");
    this.sounds["click"] = loadSound("./assets/sounds/lightClick.mp3");
    this.sounds["dingle"] = loadSound("./assets/sounds/softDingle.mp3");
    this.sounds["blip"] = loadSound("./assets/sounds/lightScifiBlip.mp3");
  }
};
let input = {

  setup() {
    // Declare and initialize variables
    this.keys = { held: {}, clicked: {} };
    this.mouse = { held: {}, clicked: {} };
    this.mouseWheel = 0;

    // Bind input functions
    window.keyPressed = () => { this.keys.held[keyCode] = true; this.keys.clicked[keyCode] = true; }
    window.keyReleased = () => { this.keys.held[keyCode] = false; this.keys.clicked[keyCode] = false; }
    window.mousePressed = () => { this.mouse.held[mouseButton] = true; this.mouse.clicked[mouseButton] = true; }
    window.mouseReleased = () => { this.mouse.held[mouseButton] = false; this.mouse.clicked[mouseButton] = false; }
    window.mouseWheel = (e) => { this.mouseWheel = e.delta; }
  },

  draw() {
    // Update clicked
    this.keys.clicked = {};
    this.mouse.clicked = {};
  }
};
let cfg = {

  // Private getters and variables
  currentConfig: "purple",
  _configs: [ "purple", "blue" ],
  get _current() { return this["_" + this.currentConfig]; },

  // Public getter and variables
  get mainFont() { return this._current.mainFont; },
  get mainColor() { return this._current.mainColor; },
  get hoverColor() { return this._current.hoverColor; },
  get defaultPieceColor() { return this._current.defaultPieceColor; },
  get bloomRange() { return this._current.bloomRange; },
  get bloomStrength() { return this._current.bloomStrength; },


  preload(name) {
    // Preload all assets used in configs
    if (name == null) {
      for (let config of this._configs) {
        if (!this["_" + config].loaded) {
          this["_" + config].mainFont = loadFont(this["_" + config].mainFont);
          this["_" + config].loaded = true;
        }
      }

    // Preloads all assets used in specific config
    } else if (this.hasConfig(name)) {
      if (!this["_" + name].loaded) {
        this["_" + name].mainFont = loadFont(this["_" + name].mainFont);
        this["_" + name].loaded = true;
      }
    }
  },

  setConfig(config) {
    // If exists sets the current config
    if (this.hasConfig(config)) {
      if (!this._configs._loaded) this.preload(config);
      this.currentConfig = config;
    }
  },

  hasConfig(config) {
    // Checks if config exists
    return this._configs.indexOf(config) != -1;
  },


  // Neon purple
  _purple: {
    loaded: false,
    mainFont: "./assets/Montserrat-Regular.ttf",
    mainColor: "#d13ee9",
    hoverColor: "#ec7aff",
    defaultPieceColor: "#ebebeb",
    bloomRange: 0.6,
    bloomStrength: 0.8
  },

  // Neon blue
  _blue: {
    loaded: false,
    mainFont: "./assets/Montserrat-Regular.ttf",
    mainColor: "#366eff",
    hoverColor: "#7196f6",
    defaultPieceColor: "#ebebeb",
    bloomRange: 0.6,
    bloomStrength: 0.8
  }
};
let pp = new PostProcessor();
let output, socket, tetris;


function preload() {
  // Load assets
  assets.preload();
  cfg.preload("purple");
  pp.preload("bloom");
}


function setup() {
  // Initialize canvas
  canv = createCanvas(600, 900);
  canv.parent("main");
  canvas.style.width = (windowHeight * 0.6) + "px";
  canvas.style.height = (windowHeight * 0.9) + "px";

  // Initialize variables
  input.setup();
  cfg.setConfig("purple");
  pp.setup("bloom");
  output = createGraphics(600, 900);
  socket = io.connect();
  tetris = new Tetris();

  // Initial setup
  output.textFont(cfg.mainFont);
  output.noStroke();
  output.noFill();
  socket.on("debug", (data) => console.log(data));
}


function windowResized() {
  // Keep canvas sizing correct
  canvas.style.width = (windowHeight * 0.6) + "px";
  canvas.style.height = (windowHeight * 0.9) + "px";
}


function draw() {
  // Clear output
  output.clear();

  // Tetris draw call
  tetris.draw(output);

  // Update input
  input.draw();

  // Draw output and post process
  image(output, 0, 0, width, height);
  pp.bloom(output, cfg.bloomRange, cfg.bloomStrength);
}
