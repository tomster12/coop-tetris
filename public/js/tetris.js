
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
      pos: { x: 50, y: 50 },
      size: { x: width - 100, y: height - 100 } };
    this.opCfg.opSize = { x: width - 100, y: 80 };
    this.opCfg.indexLimit = (height - this.opCfg.size.y) / (1.2 * this.opCfg.opSize.y);

    // Initial setup
    this.options.push(new HostOption(this, this.opCfg));
    socket.emit("getGameList");
  }


  _subscribeEventListeners() {
    super._subscribeEventListeners();

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
    output.fill(output.get(this.opCfg.pos.x, this.opCfg.pos.y));
    output.rect(this.opCfg.pos.x, 0,
      width - this.opCfg.size.x, this.opCfg.pos.y );
    output.rect(this.opCfg.pos.x, this.opCfg.pos.y + this.opCfg.size.y,
      width - this.opCfg.size.x, height - this.opCfg.size.y - this.opCfg.pos.y );
  }


  joinGame(id) {
    // Send a request to join a game and load
    socket.emit("requestJoin", { id: id });
    this._tetris.pushState(new LoadState(this._tetris, "requestJoin", (data) => {

      // Accepted into game
      if (data.accepted) {
        this._tetris.popState();
        this._tetris.pushState(new GameState(this._tetris, data.id, data.config));

      // Denied from game
      } else {
        this._tetris.popState();
        console.log("Join game unsuccessful: " + data.reason);
      }
    }));
  }


  hostGame() {
    socket.emit("requestHost");
    this._tetris.pushState(new LoadState(this._tetris, "requestHost", (data) => {

      // Host accepted
      if (data.accepted) {
        this._tetris.popState();
        this.joinGame(data.id);

      // Host denied
      } else {
        this._tetris.popState();
        console.log("Host unsuccessful: " + data.reason);
      }
    }));
  }

  // #endregion
}


class MenuOption {

  // #region - Setup

  constructor(menu_, opCfg) {
    // Initialize variables
    this._menu = menu_;
    this.hovered = false;
    this.size = { x: opCfg.opSize.x, y: opCfg.opSize.y };
  }

  // #endregion


  // #region - Main

  draw(output, index, opCfg) {
    // Update position and size
    this.pos = {
      x: opCfg.pos.x,
      y: opCfg.pos.y + (0.2 + index * 1.2) * opCfg.opSize.y };

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
    this._menu.joinGame(this.id);
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
    this._menu.hostGame();
  }

  // #endregion
}


class LoadState extends State {

  // #region - Setup

  constructor(tetris_, evt_, response_) {
    super(tetris_);

    // Recieved response
    this._subscribe(socket, evt_, response_);
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

  constructor(tetris_, id_, config_) {
    super(tetris_);

    // Initialize variables
    this._id = id_;
    this._config = config_;
    this.running = false;
    this.tetronimos = [];
    this._boardPos = { x: 50, y: 50 };
    this._boardSize = { x: 0, y: height - 100 };
    this._queuePos = { x: width - 130, y: 50 };
    this._queueSize = { x: 80, y: 0 };

    // Initial setup
    this._setupBoard();
  }


  _setupBoard() {
    // Setup board using this._config
    this._board = [];
    this._cellSize = this._boardSize.y / this._config.boardSize.y;
    this._boardSize.x = this._config.boardSize.x * this._cellSize;
    this._queueSize.y = this._queueSize.x * this._config.queueLength;
    for (let y = 0; y < this._config.boardSize.y; y++) {
      this._board.push([]);
      for (let x = 0; x < this._config.boardSize.x; x++) {
        this._board[y].push(null);
      }
    }

    // Debug setup
    this._debugNumber = 0;
    this._board[2][2] = color("#cf7b24");
    this._board[3][2] = color("#cf7b24");
    this._board[4][2] = color("#cf7b24");
    this._board[4][3] = color("#cf7b24");
  }


  _subscribeEventListeners() {
    super._subscribeEventListeners();

    // Received debug number
    this._subscribe(socket, "game::debugNumber", (data) => {
      this._debugNumber = data;
    });
  }

  // #endregion


  // #region - Main

  draw(output) {
    // Enter game state
    if (input.keys.clicked[27]) this.leaveGame();

    // Draw board
    this._drawBoard(output);

    // Draw debug number
    output.noStroke();
    output.fill(255);
    output.textSize(20);
    output.text(this._debugNumber, width * 0.5, height * 0.5);
  }


  _drawBoard(output) {
    // Draw cells
    output.noStroke();
    for (let y = 0; y < this._config.boardSize.y; y++) {
      for (let x = 0; x < this._config.boardSize.x; x++) {
        let val = this._board[y][x];
        if (val != null) {
          output.fill(val);
          output.rect(
            this._boardPos.x + x * this._cellSize,
            this._boardPos.y + y * this._cellSize,
            this._cellSize, this._cellSize
          );
        }
      }
    }

    // Draw the board and queue outlines
    output.strokeWeight(2);
    output.stroke(cfg.mainColor);
    output.noFill();
    output.rect(this._boardPos.x, this._boardPos.y,
      this._boardSize.x, this._boardSize.y);
    output.rect(this._queuePos.x, this._queuePos.y,
      this._queueSize.x, this._queueSize.y);
    output.strokeWeight(1);
  }


  leaveGame() {
    // Leave the current game
    socket.emit("requestLeave", { id: this._id });
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
