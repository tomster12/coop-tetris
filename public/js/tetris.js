
class Tetris {

  // #region - Setup

  constructor() {
    // Intialize variables
    this.states = [];

    // Setup state
    this.pushState(new MenuState(this));
  }

  // #endregion


  // #region - Main

  draw(output) {
    // Draw background
    output.background("#090909");

    // Draw current state
    this.getState().draw(output);

    // Outline
    output.noFill();
    output.stroke(cfg.mainColor);
    output.strokeWeight(2);
    output.rect(0, 0, width, height);
    output.strokeWeight(1);
  }


  getState() {
    // Returns the current state
    return this.states[this.states.length - 1];
  }


  pushState(state) {
    // Push a state
    this.states.push(state);
  }


  popState() {
    // Pop the current state
    this.getState().pop();
    this.states.pop();
  }

  // #endregion
}


class State {

  // #region - Main

  constructor(tetris_) {
    // Initialize variables
    this._tetris = tetris_;
    this._subscribeEventListeners();
  }


  pop() {
    // Removed from state stack
    this._unsubscribeEventListeners();
  }


  _subscribeEventListeners() {
    // Initialize variables
    this._listeners = [];
    this._subscribe = (sock, e, func) => { sock.on(e, func); this._listeners.push({ sock, e, func }); };
  }


  _unsubscribeEventListeners() {
    // Initialize variables
    this._unsubscribe = ({ sock, e, func }) => { sock.off(e, func); };

    // Unsubscribe all listeners
    for (let listener of this._listeners) this._unsubscribe(listener);
  }


  draw(output) {}

  // #endregion
}


class MenuState extends State {

  // #region - Setup

  constructor(tetris_) {
    super(tetris_);

    // Intialize variables
    this.options = [];

    // Setup option config
    this.opCfg = {
      scrollPos: 0, scrollVel: 0,
      border: { left: 50, top: 50, right: 50, bottom: 50 } };
    this.opCfg.size = { x: width - this.opCfg.border.left - this.opCfg.border.right, y: 80 };
    this.opCfg.indexLimit = (height - this.opCfg.border.top - this.opCfg.border.bottom) / (1.2 * this.opCfg.size.y);

    // Initial setup
    this.options.push(new HostOption(this, this.opCfg));
    socket.emit("getGameList");
  }


  _subscribeEventListeners() {
    super._subscribeEventListeners();

    // Accepted host request
    this._subscribe(socket, "requestHost", (data) => {
      if (data.accepted) {
        this.joinGame(data.id);
      }
    });

    // Received game list
    this._subscribe(socket, "getGameList", (data) => {
      this.options = [];
      this.options.push(new HostOption(this, this.opCfg));

      // Add linked game options
      for (let game of data) {
        this.options.push(new GameOption(this, this.opCfg, game.id, game.playerCount));
      }
    });
  }

  // #endregion


  // #region - Main

  draw(output) {
    // Draw options
    this._drawOptions(output);
  }


  _drawOptions(output) {
    // Update mouse wheel
    this.opCfg.scrollVel += input.mouseWheel * 0.03;
    this.opCfg.scrollPos += this.opCfg.scrollVel;
    this.opCfg.scrollVel *= 0.9;
    this.opCfg.scrollPos = constrain(this.opCfg.scrollPos, 0, 0.2 + this.options.length - this.opCfg.indexLimit);

    // Draw options and covers
    for (let i = 0; i < this.options.length; i++)
      this.options[i].draw(output, i - this.opCfg.scrollPos, this.opCfg);
    output.noStroke();
    output.fill(output.get(this.opCfg.border.left, 0));
    output.rect(this.opCfg.border.left, 0,
      width - this.opCfg.border.left - this.opCfg.border.right, this.opCfg.border.top );
    output.rect(this.opCfg.border.left, height - this.opCfg.border.bottom,
      width - this.opCfg.border.left - this.opCfg.border.right, this.opCfg.border.bottom );
  }


  joinGame(id) {
    // Send a request to join a game and load
    socket.emit("requestJoin", { id: id });
    this._tetris.pushState(new LoadState(this._tetris, "requestJoin", (data) => {

      // Accepted into game
      if (data.accepted) {
        this._tetris.popState();
        this._tetris.pushState(new GameState(this._tetris, data.id));

      // Denied from game
      } else {
        this._tetris.popState();
        console.log("Join game unsuccessful: " + data.reason);
      }
    }));
  }

  // #endregion
}


class MenuOption {

  // #region - Setup

  constructor(menu_, opCfg) {
    // Initialize variables
    this.menu = menu_;
    this.hovered = false;
    this.size = { x: opCfg.size.x, y: opCfg.size.y };
  }

  // #endregion


  // #region - Main

  draw(output, index, opCfg) {
    // Update position and size
    this.pos = {
      x: opCfg.border.left,
      y: opCfg.border.top + (0.2 + index * 1.2) * opCfg.size.y };

    // Update hovered
    this.hovered = mouseX > this.pos.x
      && mouseX < this.pos.x + this.size.x
      && mouseY > this.pos.y
      && mouseY < this.pos.y + this.size.y;

    // CLick functions
    if (this.hovered && input.mouse.clicked[LEFT]) this.click();

    // Show option
    output.noFill();
    if (!this.hovered) { output.stroke(cfg.mainColor); output.strokeWeight(2);
    } else { output.stroke(cfg.hoverColor); output.strokeWeight(3); }
    output.rect(this.pos.x, this.pos.y, this.size.x, this.size.y);
    output.strokeWeight(1);
  }


  click() {}

  // #endregion
}


class GameOption extends MenuOption {

  // #region - Setup

  constructor(menu_, opCfg, id_, playerCount_) {
    super(menu_, opCfg);

    // Initialize variables
    this.id = id_;
    this.playerCount = playerCount_;
  }

  // #endregion


  // #region - Main

  draw(output, index, opCfg) {
    super.draw(output, index, opCfg);

    // Show id and playerCount
    output.textSize(this.size.y * 0.3);
    output.noStroke();
    output.fill(cfg.mainColor);
    output.textAlign(LEFT);
    output.text("Server ID: " + this.id, this.pos.x + 50, this.pos.y + this.size.y * 0.65);
    output.textAlign(RIGHT);
    output.text(this.playerCount + " Players", this.pos.x + this.size.x - 50, this.pos.y + this.size.y * 0.65);
  }


  click() {
    // Send host request to server
    this.menu.joinGame(this.id);
  }

  // #endregion
}


class HostOption extends MenuOption {

  // #region - Setup

  constructor(menu_, opCfg) {
    super(menu_, opCfg);
  }

  // #endregion


  // #region - Main

  draw(output, index, opCfg) {
    super.draw(output, index, opCfg);

    // Draw plus
    output.noStroke();
    output.fill(cfg.mainColor);
    output.rect(this.pos.x + this.size.x * 0.5 - 5, this.pos.y + this.size.y * 0.5 - 20, 10, 40);
    output.rect(this.pos.x + this.size.x * 0.5 - 20, this.pos.y + this.size.y * 0.5 - 5, 40, 10);
  }


  click() {
    // Send host request to server
    socket.emit("requestHost");
  }

  // #endregion
}


class LoadState extends State {

  // #region - Setup

  constructor(tetris_, event_, response_) {
    super(tetris_);

    // Recieved response
    this._subscribe(socket, event_, response_);
  }

  // #endregion


  // #region - Main

  draw(output) {
    // Show loading text
    output.textAlign(CENTER);
    output.textSize(60);
    output.noStroke();
    output.fill(cfg.mainColor);
    output.text("Loading...", width * 0.5, height * 0.5);
  }

  // #endregion
}


class GameState extends State {

  // #region - Setup

  constructor(tetris_, id_) {
    super(tetris_);

    // Initialize variables
    this.id = id_;
  }

  // #endregion


  // #region - Main

  draw(output) {
    // Enter game state
    if (input.keys.clicked[27]) this.leaveGame();
  }


  leaveGame() {
    // Leave the current game
    socket.emit("requestLeave", { id: this.id });
    this._tetris.popState();

    // Send a request to join a game and load
    this._tetris.pushState(new LoadState(this._tetris, "requestLeave", (data) => {

      // Leaving game successfully
      if (data.accepted) {
        this._tetris.popState();

      // Leaving game unsuccesfully
      } else {
        this._tetris.popState();
        console.log("Leave game unsuccessful: " + data.reason);
      }
    }));
  }

  // #endregion
}
