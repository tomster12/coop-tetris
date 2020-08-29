

// Use bitwise operations for piece identification with sides / color


// Declare global variables
let INPUT = {

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
  }
};
let CFG = {

  // Private getters and variables
  _configs: [ "purple", "blue" ],
  _currentConfig: "purple",
  get _current() { return this["_" + this._currentConfig]; },

  // Public getter and variables
  get mainFont() { return this._current.mainFont; },
  get mainColor() { return this._current.mainColor; },
  get hoverColor() { return this._current.hoverColor; },
  get bloomRange() { return this._current.bloomRange; },
  get bloomStrength() { return this._current.bloomStrength; },


  preload(name) {
    // Preload all assets used in configs
    if (name == null) {
      for (let config of this.configs) {
        if (!this[config].loaded) {
          this["_" + config].mainFont = loadFont(this[config].mainFont);
          this["_" + config].loaded = true;
        }
      }

    // Preloads all assets used in specific config
    } else if (this.hasConfig(name)) {
      if (!this["_" + name]._loaded) {
        this["_" + name].mainFont = loadFont(this["_" + name].mainFont);
        this["_" + name].loaded = true;
      }
    }
  },

  setConfig(config) {
    // If exists sets the current config
    if (this.hasConfig(config)) {
      if (!this._configs._loaded) this.preload(config);
      this._currentConfig = config;
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
    bloomRange: 0.6,
    bloomStrength: 0.6
  },

  // Neon blue
  _blue: {
    loaded: false,
    mainFont: "./assets/Montserrat-Regular.ttf",
    mainColor: "#366eff",
    hoverColor: "#7196f6",
    bloomRange: 0.6,
    bloomStrength: 0.8
  }
};

// Declare variables
let pp = new PostProcessor();
let output, socket, tetris;


function preload() {
  // Load assets
  // CFG.preload();
  pp.preload();
}


function setup() {
  // Initialize canvas
  canv = createCanvas(600, 900);
  canv.parent("main");

  // Initialize variables
  INPUT.setup();
  pp.setup();
  output = createGraphics(600, 900);
  socket = io.connect();
  tetris = new Tetris();

  // Initial setup
  CFG.setConfig("purple");
  output.textFont(CFG.mainFont);
  output.noStroke();
  output.noFill();
}


function draw() {
  // Clear output
  output.clear();

  // Tetris draw call
  tetris.draw(output);

  // Draw output and post process
  image(output, 0, 0, width, height);
  pp.bloom(output, CFG.bloomRange, CFG.bloomStrength);
}
