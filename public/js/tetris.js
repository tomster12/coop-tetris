
class Tetris {

  // #region - Setup

  constructor() {
    // Intialize variables
    this._states = [];

    // Setup state
    this.pushState(new MenuState(this));
  }

  // #endregion


  // #region - Main

  draw(output) {
    // Draw background
    background("#090909");

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
    return this._states[this._states.length - 1];
  }


  pushState(state) {
    // Push a state
    this._states.push(state);
  }


  popState() {
    // Pop the current state
    this.getState().pop();
    this._states.pop();
  }

  // #endregion
}

Tetris.TETRONIMOES = [
  [ [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0] ],

  [ [1, 0, 0],
    [1, 1, 1],
    [0, 0, 0] ],

  [ [0, 0, 1],
    [1, 1, 1],
    [0, 0, 0] ],

  [ [0, 0, 0, 0],
    [0, 1, 1, 0],
    [0, 1, 1, 0],
    [0, 0, 0, 0] ],

  [ [0, 1, 1],
    [1, 1, 0],
    [0, 0, 0] ],

  [ [0, 1, 0],
    [1, 1, 1],
    [0, 0, 0] ],

  [ [1, 1, 0],
    [0, 1, 1],
    [0, 0, 0] ]
];

Tetris.getRotatedCell = (pieceID, x, y, rot) => {
  let t = Tetris.TETRONIMOES[pieceID];
  let size = t.length - 1;
  if (rot == 0) return t[y][x];
  if (rot == 1) return t[size - x][y];
  if (rot == 2) return t[size - y][size - x];
  if (rot == 3) return t[x][size - y];
};


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
    this.subscribe = (sock, e, func) => { sock.on(e, func); this._listeners.push({ sock, e, func }); };
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
    this.subscribe(socket, "updateGameList", (data) => {
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
    // Send request and initialize new loadState
    socket.emit("requestJoin", { id: id });
    let loadState = new LoadState(this._tetris);
    this._tetris.pushState(loadState);


    // Listen for requestJoin response
    loadState.subscribe(socket, "requestJoin", (data) => {

      // Accepted into game
      if (data.accepted) {
        this._tetris.popState();
        this._tetris.pushState(new GameState(this._tetris, data.id, data.serverData));

      // Denied from game
      } else {
        this._tetris.popState();
        console.log("Join game unsuccessful: " + data.reason);
      }
    });
  }


  hostGame() {
    // Send request and initialize new loadState
    socket.emit("requestHost");
    let loadState = new LoadState(this._tetris);
    this._tetris.pushState(loadState);


    // Listen for requestHost response
    loadState.subscribe(socket, "requestHost", (data) => {

      // Host denied
      if (!data.accepted) {
        this._tetris.popState();
        console.log("Host unsuccessful: " + data.reason);
      }
    });


    // Listen for requestJoin response
    loadState.subscribe(socket, "requestJoin", (data) => {

      // Host accepted
      if (data.accepted) {
        this._tetris.popState();
        this._tetris.pushState(new GameState(this._tetris, data.id, data.serverData));

      // Host denied
      } else {
        this._tetris.popState();
        console.log("Join unsuccessful: " + data.reason);
      }
    });
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
    if (mouseX > this.pos.x
    && mouseX < this.pos.x + this.size.x
    && mouseY > this.pos.y
    && mouseY < this.pos.y + this.size.y) {
      if (!this.hovered) assets.sounds["hover"].play();
      this.hovered = true;
    } else this.hovered = false;

    // CLick function
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
    assets.sounds["click"].play();
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
    assets.sounds["dingle"].play();
    this._menu.hostGame();
  }

  // #endregion
}


class LoadState extends State {

  // #region - Setup

  constructor(tetris_, evt_, response_) {
    super(tetris_);

    // Recieved response
    this.subscribe(socket, evt_, response_);
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

  constructor(tetris_, id_, serverData_) {
    super(tetris_);

    // Initialize variables
    this.id = id_;
    this.config = serverData_.config;
    this.color = serverData_.color;

    this.ready = false;
    this.playing = false;
    this.playerCount = serverData_.playerCount;

    this.movementTimer = 0;
    this.tetronimos = [];
    this.board = [];
    this.tetronimoList = [];
    this.heldTetronimo = null;
    this.level = 1;
    this.score = 0;
    this.linesCleared = 0;

    this.boardPos = { x: 50, y: 50 };
    this.boardSize = { x: 0, y: height - 100 };
    this.listPos = { x: width - 140, y: 50 };
    this.listSize = { x: 90, y: 0 };
    this.colorPos = { x: width - 80, y: height - 180 };
    this.colorSize = { x: 30, y: 45 };
    this.readyButton = new Button(
      { x: width - 180, y: height - 110 },
      { x: 130, y: 60 },
      "Ready?", () => {
        assets.sounds["click"].play();
        this._readyUp();
      });
    this.outputText = null;

    // Initial setup
    this._setupBoard();
  }


  _setupBoard() {
    // Setup board using this.config
    this.board = [];
    this.cellSize = this.boardSize.y / this.config.boardSize.y;
    this.boardSize.x = this.config.boardSize.x * this.cellSize;
    this.listSize.y = this.listSize.x * this.config.listLength;
    for (let y = 0; y < this.config.boardSize.y; y++) {
      this.board.push([]);
      for (let x = 0; x < this.config.boardSize.x; x++) {
        this.board[y].push(null);
      }
    }
  }


  _subscribeEventListeners() {
    super._subscribeEventListeners();

    // Player count update
    this.subscribe(socket, "game::updateReadyPlayerCount", (data) => {
      this.playerCount = data;
    });

    // Pregame outputText update
    this.subscribe(socket, "game::updateOutputText", (data) => {
      if (data.type == "countdown") assets.sounds["blip"].play();
      this.outputText = data.text;
    });

    // Pregame outputText update
    this.subscribe(socket, "game::updateColor", (data) => {
      this.color = data;
    });

    // Update tetronimos
    this.subscribe(socket, "game::updateBoard", (data) => {
      this.board = data;
    });

    // Update tetronimos
    this.subscribe(socket, "game::updateTetronimos", (data) => {
      this.tetronimos = data.tetronimos;
      this.heldTetronimo = data.heldTetronimo;
    });

    // Update tetronimos
    this.subscribe(socket, "game::updateTetronimoList", (data) => {
      this.tetronimoList = data;
    });

    // Update tetronimos
    this.subscribe(socket, "game::updateScore", (data) => {
      this.level = data.level;
      this.score = data.score;
      this.linesCleared = data.linesCleared;
    });


    // Game started
    this.subscribe(socket, "game::startGame", (data) => {
      this.playing = true;
      this.ready = false;
      this.level = 1;
      this.score = 0;
      this.linesCleared = 0;
    });

    // Game started
    this.subscribe(socket, "game::stopGame", (data) => {
      this.playing = false;
      this.tetronimos = [];
      this._setupBoard();
      this.tetronimoList = [];
      this.heldTetronimo = null;
    });
  }

  // #endregion


  // #region - Main

  draw(output) {
    // Exit game
    if (input.keys.clicked[27]) this._leaveGame();

    // Run draws
    this._checkInput();
    this._drawBoard(output);
    this._drawTetronimoList(output);
    this._drawUI(output);
  }


  _checkInput() {
    if (this.playing) {

      // Move on click
      let clickedDir = {
        x: (input.keys.clicked[37] ? -1 : input.keys.clicked[39] ? 1 : 0),
        y: (input.keys.clicked[32] ? 2 : input.keys.clicked[40] ? 1 : 0) };
      if (clickedDir.x != 0 || clickedDir.y != 0) {
        socket.emit("game::input", { dir: clickedDir });
        this.movementTimer = 15;

      // Move on hold
      } else if (this.movementTimer == 0) {
        let heldDir = {
          x: (input.keys.held[37] ? -1 : input.keys.held[39] ? 1 : 0),
          y: (input.keys.held[40] ? 1 : 0) };
        if (heldDir.x != 0 || heldDir.y != 0) {
          socket.emit("game::input", { dir: heldDir });
          this.movementTimer = 5;
        }

      // Update timer
      } else this.movementTimer--;

      // Rotate piece on z / x
      let rot = (input.keys.clicked[90] ? -1 : 0) + (input.keys.clicked[88] ? 1 : 0);
      if (rot != 0) socket.emit("game::input", { rot });

      // Hold piece on c
      if (input.keys.clicked[67]) socket.emit("game::input", { hold: true });
    }
  }


  _drawBoard(output) {
    // Draw board cells
    for (let y = 0; y < this.config.boardSize.y; y++) {
      for (let x = 0; x < this.config.boardSize.x; x++) {
        let val = this.board[y][x];
        if (val != null) {
          output.stroke(val);
          output.fill(val);
          output.rect(
            this.boardPos.x + x * this.cellSize,
            this.boardPos.y + y * this.cellSize,
            this.cellSize, this.cellSize
          );
        }
      }
    }

    // Draw each tetronimo on board
    for (let t of this.tetronimos) {
      output.stroke(t.color);
      output.fill(t.color);
      this._drawTetronimo(
        output,
        t.tetronimoID,
        { x: this.boardPos.x + t.pos.x * this.cellSize,
          y: this.boardPos.y + t.pos.y * this.cellSize },
        t.rot,
        this.cellSize
      );

      // Draw ghost if is own tetronimo
      if (t.playerID == socket.id) {
        let newColor = "#" + t.color.substring(1) + "64";
        output.noStroke();
        output.fill(newColor);
        this._drawTetronimo(
          output,
          t.tetronimoID,
          { x: this.boardPos.x + t.pos.x * this.cellSize,
            y: this.boardPos.y + (t.pos.y + t.ghostOffset) * this.cellSize },
          t.rot,
          this.cellSize
        );
      }
    }

    // Draw the board outline
    output.strokeWeight(2);
    output.stroke(cfg.mainColor);
    output.noFill();
    output.rect(this.boardPos.x, this.boardPos.y,
      this.boardSize.x, this.boardSize.y);
    output.strokeWeight(1);
  }


  _drawTetronimoList(output) {
    // Draw each tetronimo in the list
    output.stroke(cfg.defaultPieceColor);
    output.fill(cfg.defaultPieceColor);
    for (let i = 0; i < this.tetronimoList.length; i++) {
      this._drawTetronimo(
        output,
        this.tetronimoList[i],
        { x: this.listPos.x + this.listSize.x * 0.1,
          y: this.listPos.y + this.listSize.x * (0.1 + i) },
        0,
        (this.listSize.x * 0.8) / Tetris.TETRONIMOES[this.tetronimoList[i]].length
      );
    }

    // Draw held tetronimo
    if (this.heldTetronimo != null) {
      output.stroke(cfg.defaultPieceColor);
      output.fill(cfg.defaultPieceColor);
      this._drawTetronimo(
        output,
        this.heldTetronimo,
        { x: this.listPos.x + this.listSize.x * 0.1,
          y: this.listPos.y + this.listSize.x * (0.1 + this.config.listLength) + 20 },
        0,
        (this.listSize.x * 0.8) / Tetris.TETRONIMOES[this.heldTetronimo].length
      );
    }

    // Draw list and held outline
    output.strokeWeight(2);
    output.stroke(cfg.mainColor);
    output.noFill();
    output.rect(this.listPos.x, this.listPos.y,
      this.listSize.x, this.listSize.y);
    output.rect(
      this.listPos.x,
      this.listPos.y + this.listSize.x * this.config.listLength + 20,
      this.listSize.x, this.listSize.x
    );
    output.strokeWeight(1);
  }


  _drawTetronimo(output, tetronimoID, pos, rot, cellSize) {
    // Draw a given piece at pos, rot and with cellSize
    for (let y = 0; y < Tetris.TETRONIMOES[tetronimoID].length; y++) {
      for (let x = 0; x < Tetris.TETRONIMOES[tetronimoID].length; x++) {
        if (Tetris.getRotatedCell(tetronimoID, x, y, rot) == 1) {
          output.rect(
            pos.x + x * cellSize,
            pos.y + y * cellSize,
            cellSize, cellSize
          );
        }
      }
    }
  }


  _drawUI(output) {
    // Update and draw button
    this.readyButton.hoverable = !this.ready;
    this.readyButton.text = this.playing ? "Playing..."
      : (this.ready ? "Ready!" : "Ready?") + " " + this.playerCount[0] + "/" + this.playerCount[1];
    this.readyButton.draw(output);

    // Draw outputText
    if (this.outputText != null) {
      let size = (this.boardSize.x / this.outputText.length) * 0.9;
      output.textSize(size);
      output.noStroke();
      output.fill(cfg.mainColor);
      output.textAlign(CENTER);
      output.text(this.outputText, this.boardPos.x + this.boardSize.x * 0.5, this.boardPos.y + this.boardSize.y * 0.5 + size * 0.3);
    }

    // Draw score
    output.textSize(20);
    output.noStroke();
    output.fill(cfg.mainColor);
    output.textAlign(RIGHT);
    output.text("Level: " + this.level, width - 90, height - 165);
    output.text(" Score: " + this.score, width - 90, height - 135);

    // Draw and update color
    output.noStroke();
    output.fill(this.color);
    output.rect(this.colorPos.x, this.colorPos.y, this.colorSize.x, this.colorSize.y);
    if (mouseX > this.colorPos.x
    && mouseX < this.colorPos.x + this.colorSize.x
    && mouseY > this.colorPos.y
    && mouseY < this.colorPos.y + this.colorSize.y
    && input.mouse.clicked[LEFT]) socket.emit("game::randomizeColor");
  }


  _readyUp() {
    // Ready up with the current game
    this.ready = true;
    socket.emit("game::readyUp");
  }


  _leaveGame() {
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


class Button {

  // #region - Main

  constructor(pos_, size_, text_, func_) {
    // Initialize variables
    this.pos = pos_;
    this.size = size_;
    this.text = text_;
    this.func = func_;
    this.hoverable = true;
  }


  draw(output) {
    // Update hovered
    if (this.hoverable
    && mouseX > this.pos.x
    && mouseX < this.pos.x + this.size.x
    && mouseY > this.pos.y
    && mouseY < this.pos.y + this.size.y) {
      if (!this.hovered) assets.sounds["hover"].play();
      this.hovered = true;
    } else this.hovered = false;

    // CLick function
    if (this.hovered && input.mouse.clicked[LEFT]) this.func();

    // Show button
    output.noFill();
    if (!this.hovered) { output.stroke(cfg.mainColor); output.strokeWeight(2);
    } else { output.stroke(cfg.hoverColor); output.strokeWeight(3); }
    output.rect(this.pos.x, this.pos.y, this.size.x, this.size.y);
    output.strokeWeight(1);

    // Show text
    output.textSize(this.size.y * 0.35);
    output.noStroke();
    output.fill(cfg.mainColor);
    output.textAlign(CENTER);
    output.text(this.text, this.pos.x + this.size.x * 0.5, this.pos.y + this.size.y * 0.65);
  }

  // #endregion
}
