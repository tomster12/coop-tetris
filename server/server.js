class Tetris {
    // #region - Setup

    constructor() {
        // Initialize variables
        this.playerInfo = {};
        this.nextGameID = 0;
        this.currentGames = {};
    }

    subscribeEventListeners(socket) {
        // Pass events through to this
        let toListen = ["requestHost", "requestJoin", "requestLeave", "updatePlayerGameList"];
        for (let evt of toListen) socket.on(evt, (data) => this[evt](socket, data));

        // Pass events through to game based functions
        let gameToListen = ["game::readyUp", "game::input", "game::randomizeColor"];
        for (let evt of gameToListen) {
            let name = evt.substring(6);
            name = "player" + name.charAt(0).toUpperCase() + name.slice(1);
            socket.on(evt, (data) => {
                let game = this.playerInfo[socket.id].currentGame;
                if (game != null) this.currentGames[game][name](socket, data);
            });
        }
    }

    // #endregion

    // #region - Main

    clientConnect(socket) {
        // Client connected
        log(0, "Client connected: " + socket.id);
        this.playerInfo[socket.id] = {};
        this.updatePlayerGameList();
    }

    clientDisconnect(socket) {
        // Client disconnected
        log(0, "Client disconnected: " + socket.id);
        if (this.playerInfo[socket.id].currentGame != null) this.requestLeave(socket, { id: this.playerInfo[socket.id].currentGame });
        delete this.playerInfo[socket.id];
    }

    async requestHost(socket) {
        // Create a new tetris game
        if (true) {
            log(0, socket.id + " request host game " + this.nextGameID + ": accepted");
            let { newGame, id } = this.createGame(this.nextGameID);
            socket.emit("requestHost", { id: id, accepted: true });
            newGame.addPlayer(socket.id);
            this.updatePlayerGameList();
            await sleep(250); // Fake delay
            socket.emit("requestJoin", { id: id, accepted: true, serverData: newGame.getServerData(socket.id) });

            // Cannot create game
        } else {
            log(0, socket.id + " request host game " + this.nextGameID + ": denied");
            await sleep(150); // Fake delay
            socket.emit("requestHost", { id: this.nextGameID, accepted: false, reason: "None" });
        }
    }

    async requestJoin(socket, data) {
        // Game exists and isnt playing
        if (this.currentGames[data.id]) {
            if (!this.currentGames[data.id].started) {
                log(0, socket.id + " requests join game " + data.id + ": accepted");
                this.currentGames[data.id].addPlayer(socket.id);
                this.updatePlayerGameList();
                await sleep(250); // Fake delay
                socket.emit("requestJoin", { id: data.id, accepted: true, serverData: this.currentGames[data.id].getServerData(socket.id) });

                // Game exists but has started
            } else {
                log(0, socket.id + " requests join game " + data.id + ": game has started");
                await sleep(150); // Fake delay
                socket.emit("requestJoin", { id: data.id, accepted: false, reason: "Game has started" });
            }

            // Game doesnt exist
        } else {
            log(0, socket.id + " requests join game " + data.id + ": game not found");
            await sleep(150); // Fake delay
            socket.emit("requestJoin", { id: data.id, accepted: false, reason: "No game found" });
        }
    }

    async requestLeave(socket, data) {
        // Game exists
        if (this.currentGames[data.id]) {
            log(0, socket.id + " requests leave game " + data.id + ": accepted");
            this.currentGames[data.id].removePlayer(socket.id);
            this.updatePlayerGameList();
            await sleep(100); // Fake delay
            socket.emit("requestLeave", { id: data.id, accepted: true });

            // Game doesnt exist
        } else {
            log(0, socket.id + " requests leave game " + data.id + ": game not found");
            socket.emit("requestLeave", { id: data.id, accepted: false, reason: "No game found" });
        }
    }

    updatePlayerGameList() {
        // Send a list of available games to everyone
        let games = Object.values(this.currentGames).map((g) => {
            return {
                id: g.id,
                playerCount: g.getPlayers().length,
            };
        });
        io.emit("updateGameList", games);
    }

    createGame() {
        // Create a new tetris game
        log(0, "Creating game with id: " + this.nextGameID);
        let newGame = new Game(this, this.nextGameID);
        this.currentGames[this.nextGameID] = newGame;
        this.updatePlayerGameList();
        return { newGame: newGame, id: this.nextGameID++ };
    }

    removeGame(id) {
        // Remove the specified game
        log(0, "Deleting game with id: " + id);
        if (this.currentGames[id]) delete this.currentGames[id];
        this.updatePlayerGameList();
    }

    // #endregion
}

Tetris.TETRONIMOES = [
    [
        [0, 0, 0, 0],
        [1, 1, 1, 1],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
    ],

    [
        [1, 0, 0],
        [1, 1, 1],
        [0, 0, 0],
    ],

    [
        [0, 0, 1],
        [1, 1, 1],
        [0, 0, 0],
    ],

    [
        [0, 0, 0, 0],
        [0, 1, 1, 0],
        [0, 1, 1, 0],
        [0, 0, 0, 0],
    ],

    [
        [0, 1, 1],
        [1, 1, 0],
        [0, 0, 0],
    ],

    [
        [0, 1, 0],
        [1, 1, 1],
        [0, 0, 0],
    ],

    [
        [1, 1, 0],
        [0, 1, 1],
        [0, 0, 0],
    ],
];

Tetris.getRotatedCell = (pieceID, x, y, rot) => {
    let t = Tetris.TETRONIMOES[pieceID];
    let size = t.length - 1;
    if (rot == 0) return t[y][x];
    if (rot == 1) return t[size - x][y];
    if (rot == 2) return t[size - y][size - x];
    if (rot == 3) return t[x][size - y];
};

class Game {
    // #region - Setup

    constructor(tetris_, id_) {
        // Initialize variables
        this.tetris = tetris_;
        this.id = id_;
        this.config = {
            gameMode: "standard",
            boardSize: { x: 10, y: 24 },
            listLength: 6,
        };

        this.started = false;
        this.playing = false;
        this.playerCount = [0, 0];

        this.players = {};
        this.board = [];
        this.tetronimoBag = [];
        this.tetronimoList = [];
        this.heldTetronimo = null;
        this.level = 1;
        this.score = 0;
        this.linesCleared = 0;

        // Initial setup
        this._setupBoard();
    }

    _setupBoard() {
        // Setup board using this.config
        this.board = [];
        for (let y = 0; y < this.config.boardSize.y; y++) {
            this.board.push([]);
            for (let x = 0; x < this.config.boardSize.x; x++) {
                this.board[y].push(null);
            }
        }
    }

    // #endregion

    // #region - Main

    addPlayer(id) {
        // Add player to this game
        log(1, this.id + ": Adding player: " + id);
        this.players[id] = {
            id: id,
            ready: false,
            color: randomColor([70, 160], [70, 160], [70, 160]),
        };
        this.tetris.playerInfo[id].currentGame = this.id;
        this.updatePlayerCount();
    }

    removePlayer(id) {
        // Remove player from this game
        log(1, this.id + ": Removing player: " + id);
        if (this.players[id]) delete this.players[id];
        this.tetris.playerInfo[id].currentGame = null;
        for (let player of this.getPlayers()) player.ready = false;
        this.updatePlayerCount();

        // Stop game and delete if no players
        if (this.playerCount[1] == 0) this.tetris.removeGame(this.id);
        if (this.started) this.stopGame();
    }

    playerReadyUp(socket) {
        // Ready up the player
        log(1, this.id + ": Player ready up");
        this.players[socket.id].ready = true;
        this.updatePlayerCount();

        // Check if all players ready
        if (this.playerCount[0] == this.playerCount[1]) this.startGame();
    }

    playerRandomizeColor(socket) {
        // Randomize players color
        this.players[socket.id].color = randomColor([70, 160], [70, 160], [70, 160]);
        io.to(socket.id).emit("game::updateColor", this.players[socket.id].color);
        if (this.playing) this.updatePlayerTetronimos();
    }

    async startGame() {
        // Stop ending if needed
        if (this.stopGame.sleep != null) clearInterval(this.stopGame.sleep.timeout);

        // Countdown to game
        this.started = true;
        this.emitToPlayers("game::updateOutputText", { text: "3", type: "countdown" });
        this.startGame.sleep = cSleep(1000);
        await this.startGame.sleep.promise;
        this.emitToPlayers("game::updateOutputText", { text: "2", type: "countdown" });
        this.startGame.sleep = cSleep(1000);
        await this.startGame.sleep.promise;
        this.emitToPlayers("game::updateOutputText", { text: "1", type: "countdown" });
        this.startGame.sleep = cSleep(1000);
        await this.startGame.sleep.promise;
        this.emitToPlayers("game::updateOutputText", { text: "GO!", type: "countdown" });
        this.startGame.sleep = cSleep(500);
        await this.startGame.sleep.promise;

        // Start game
        log(1, this.id + ": Starting game");
        this.playing = true;
        this.level = 1;
        this.score = 0;
        this.linesCleared = 0;
        this.initTetronimos();
        this.gameLoop();

        // Update players
        this.emitToPlayers("game::updateOutputText", { text: null });
        this.emitToPlayers("game::startGame");
    }

    async stopGame() {
        log(1, this.id + ": Stopping game");

        // Stop startup if needed
        if (this.startGame.sleep != null) clearInterval(this.startGame.sleep.timeout);
        if (this.gameLoop.sleep != null) clearInterval(this.gameLoop.sleep.timeout);

        // Reset variables
        this.started = false;
        this.playing = false;
        for (let player of this.getPlayers()) player.ready = false;
        this.updatePlayerCount();
        this.clearBoard();
        this.clearTetronimos();

        // Clear output text
        this.emitToPlayers("game::stopGame");
        this.emitToPlayers("game::updateOutputText", { text: "Game over" });
        this.stopGame.sleep = cSleep(2000);
        await this.stopGame.sleep.promise;
        this.emitToPlayers("game::updateOutputText", { text: null });
    }

    // #endregion

    // #region - Game

    initTetronimos() {
        // Create a tetronimo for each player
        this.tetronimoList = [];
        for (let i = 0; i < this.config.listLength; i++) this.getNextTetronimo(true);
        for (let player of this.getPlayers()) player.tetronimo = this.getNextTetronimo();
        this.updatePlayerTetronimos();
    }

    async gameLoop() {
        // Round delay
        let delay = 1000 - 150 * this.level;
        delay = delay > 100 ? delay : 100;
        this.gameLoop.sleep = cSleep(delay);
        await this.gameLoop.sleep.promise;

        // Move tetronimos
        for (let player of this.getPlayers()) {
            let moved = this.transformTetronimo(player.id, { dir: { x: 0, y: 1 } });
            if (!moved && !player.hasMoved && this.placeTetronimo(player.id) == false) return;
            player.hasMoved = false;
        }

        // Game loop recursion
        this.gameLoop();
    }

    checkLines() {
        // Check for any lines and clear them
        let lines = 0;
        for (let y = this.config.boardSize.y - 1; y >= 0; y--) {
            if (this.board[y].indexOf(null) == -1) {
                lines++;
                this.board.splice(y, 1);
                this.board.unshift([]);
                y++;
                for (let x = 0; x < this.config.boardSize.x; x++) {
                    this.board[0].push(null);
                }
            }
        }

        // Calculate score
        if (lines > 0) {
            let score = [100, 300, 500, 800][lines - 1];
            score *= this.level;
            this.score += score;
            this.linesCleared += lines;
            this.level = 1 + Math.floor(this.linesCleared / 10.0);
        }

        // Update board
        this.updatePlayerBoard();
        this.updatePlayerScore();
    }

    playerInput(socket, data) {
        // Recieved player input
        if (this.playing) {
            if (data.hold) this.holdTetronimo(socket.id);
            else this.transformTetronimo(socket.id, data);
        }
    }

    transformTetronimo(id, data) {
        // Move specified players tetronimo in direction
        if (data.dir != null) {
            if (data.dir.y <= 1) {
                let newPos = { x: this.players[id].tetronimo.pos.x + data.dir.x, y: this.players[id].tetronimo.pos.y + data.dir.y };
                if (this.tetronimoIsViable(this.players[id].tetronimo.tetronimoID, newPos, this.players[id].tetronimo.rot)) {
                    this.players[id].tetronimo.pos = newPos;
                    this.players[id].hasMoved = true;
                    this.updatePlayerTetronimos();
                    return true;
                }

                // Hard drop tetronimo
            } else {
                while (this.transformTetronimo(id, { dir: { x: 0, y: 1 } })) {}
                this.placeTetronimo(id);
                return true;
            }

            // Rotate specified players tetronimo
        } else if (data.rot != null) {
            let newRot = this.players[id].tetronimo.rot + data.rot;
            newRot = (newRot + 4) % 4;
            if (this.tetronimoIsViable(this.players[id].tetronimo.tetronimoID, this.players[id].tetronimo.pos, newRot)) {
                this.players[id].tetronimo.rot = newRot;
                this.updatePlayerTetronimos();
                return true;
            }
        }

        // Could not move
        return false;
    }

    holdTetronimo(id) {
        if (!this.players[id].hasHeld) {
            // Get swapped tetromino
            let nextTetronimo;
            if (this.heldTetronimo != null) {
                nextTetronimo = {
                    tetronimoID: this.heldTetronimo,
                    pos: this.getStartPos(this.heldTetronimo),
                    rot: 0,
                };
            } else nextTetronimo = this.getNextTetronimo();

            // Swap tetromino
            this.heldTetronimo = this.players[id].tetronimo.tetronimoID;
            this.players[id].tetronimo = nextTetronimo;
            this.players[id].hasHeld = true;
            this.updatePlayerTetronimos();
        }
    }

    placeTetronimo(id) {
        // Place specified players tetronimo
        this.players[id].hasHeld = false;
        let t = this.players[id].tetronimo;
        for (let y = 0; y < Tetris.TETRONIMOES[t.tetronimoID].length; y++) {
            for (let x = 0; x < Tetris.TETRONIMOES[t.tetronimoID].length; x++) {
                if (Tetris.getRotatedCell(t.tetronimoID, x, y, t.rot) == 1) {
                    this.board[t.pos.y + y][t.pos.x + x] = this.players[id].color;
                }
            }
        }
        this.checkLines();
        let nextTetronimo = this.getNextTetronimo();
        if (nextTetronimo != false) {
            this.players[id].tetronimo = nextTetronimo;
            this.updatePlayerBoard();
            this.updatePlayerTetronimos();
        } else return false;
    }

    tetronimoIsViable(tetronimoID, pos, rot) {
        // Returns whether a tetronimo can in a location
        for (let y = 0; y < Tetris.TETRONIMOES[tetronimoID].length; y++) {
            for (let x = 0; x < Tetris.TETRONIMOES[tetronimoID].length; x++) {
                if (
                    Tetris.getRotatedCell(tetronimoID, x, y, rot) == 1 &&
                    !(
                        pos.x + x >= 0 &&
                        pos.x + x < this.config.boardSize.x &&
                        pos.y + y >= 0 &&
                        pos.y + y < this.config.boardSize.y &&
                        this.board[pos.y + y][pos.x + x] == null
                    )
                ) {
                    return false;
                }
            }
        }
        return true;
    }

    getNextTetronimo(generate) {
        // Refill piece bag
        if (this.tetronimoBag.length == 0) {
            for (let i = 0; i < Tetris.TETRONIMOES.length; i++) {
                let index = Math.floor(Math.random() * (this.tetronimoBag.length + 1));
                this.tetronimoBag.splice(index, 0, i);
            }
        }

        // Calculate next tetronimo
        let nextTetronimoID = this.tetronimoBag.splice(0, 1);
        this.tetronimoList.push(nextTetronimoID);

        // Returns the next tetronimo and check viable
        if (!generate) {
            let currentTetronimoID = this.tetronimoList.splice(0, 1);
            this.updatePlayerTetronimoList();
            if (!this.tetronimoIsViable(currentTetronimoID, this.getStartPos(currentTetronimoID), 0)) {
                this.stopGame();
                return false;
            } else {
                return {
                    tetronimoID: currentTetronimoID,
                    pos: this.getStartPos(currentTetronimoID),
                    rot: 0,
                };
            }
        }
    }

    getStartPos(id) {
        // Returns the starting position for a tetronimo
        return {
            x: Math.floor(this.config.boardSize.x * 0.5 - Tetris.TETRONIMOES[id].length * 0.5),
            y: 0,
        };
    }

    clearBoard() {
        // Reset board
        for (let y = 0; y < this.config.boardSize.y; y++) {
            for (let x = 0; x < this.config.boardSize.x; x++) {
                this.board[y][x] = null;
            }
        }
    }

    clearTetronimos() {
        // Clear tetronimo data
        for (let player of this.getPlayers()) player.tetronimo = {};
        this.tetronimoBag = [];
        this.tetronimoList = [];
    }

    updatePlayerBoard() {
        // Send users updated board
        this.emitToPlayers("game::updateBoard", this.board);
    }

    updatePlayerTetronimos() {
        // Send users updated tetronimos
        let tetronimos = [];
        for (let player of this.getPlayers()) {
            let t = player.tetronimo;

            // Calculate ghost pos
            let ghostOffset = 0;
            while (this.tetronimoIsViable(t.tetronimoID, { x: t.pos.x, y: t.pos.y + ghostOffset + 1 }, t.rot)) ghostOffset++;

            // Add to list
            tetronimos.push({
                playerID: player.id,
                tetronimoID: t.tetronimoID,
                ghostOffset: ghostOffset,
                pos: t.pos,
                rot: t.rot,
                color: player.color,
            });
        }
        this.emitToPlayers("game::updateTetronimos", { tetronimos: tetronimos, heldTetronimo: this.heldTetronimo });
    }

    updatePlayerTetronimoList() {
        // Send users updated board
        this.emitToPlayers("game::updateTetronimoList", this.tetronimoList);
    }

    updatePlayerScore() {
        // Send users updated score
        this.emitToPlayers("game::updateScore", { level: this.level, score: this.score, linesCleared: this.linesCleared });
    }

    // #endregion

    // #region - Other

    updatePlayerCount() {
        // Update server and players player count
        let players = this.getPlayers();
        let readied = players.reduce((acc, p) => acc + (p.ready ? 1 : 0), 0);
        this.playerCount = [readied, players.length];
        this.emitToPlayers("game::updateReadyPlayerCount", this.playerCount);
    }

    emitToPlayers(evt_, data_) {
        // Emit an event to all players
        let players = this.getPlayers();
        for (let { id } of players) io.to(id).emit(evt_, data_);
    }

    getPlayers() {
        // Returns a list of players
        return Object.values(this.players);
    }

    getServerData(id) {
        // Returns server info for joining player
        return {
            color: this.players[id].color,
            config: this.config,
            playerCount: this.playerCount,
        };
    }

    // #endregion
}

// #region - Modules

// Import modules
let http = require("http");
let path = require("path");
let fs = require("fs");
let socketio = require("socket.io");

// #endregion

// #region - HTTP Server

// Handler function
function handleRequest(req, res) {
    let pathname = req.url == "/" ? "/index.html" : req.url;
    pathname = "/../public" + pathname;

    let ext = path.extname(pathname);
    let typeExt =
        {
            ".html": "text/html",
            ".js": "text/javascript",
            ".css": "text/css",
        }[ext] || "text/plain";

    fs.readFile(__dirname + pathname, function (err, data) {
        if (err) {
            res.writeHead(500, { "Content-Type": "text/Plain" });
            return res.end("Error loading " + __dirname + pathname);
        }
        res.writeHead(200, { "Content-Type": typeExt });
        res.end(data);
    });
}

// Initialize HTTP Server
const server = http.createServer(handleRequest).listen(3000);
console.log("[-] Server started at http://localhost:3000/");

// #endregion

// #region - Socket IO

// Initialize variables
let tetris = new Tetris();
let log = (level, msg) => console.log("[" + level + "] " + msg);

// Initialize server
const io = socketio.listen(server);
io.sockets.on("connection", (socket) => {
    tetris.clientConnect(socket);

    // Pass events through to tetris
    tetris.subscribeEventListeners(socket);

    // Client disconnect
    socket.on("disconnect", () => {
        tetris.clientDisconnect(socket);
    });
});

// #endregion

// #region - Other

function randomColor(rRange, bRange, gRange) {
    // Returns a random hex color
    let r = rRange[0] + Math.ceil(Math.random() * (rRange[1] - rRange[0]));
    let g = gRange[0] + Math.ceil(Math.random() * (gRange[1] - gRange[0]));
    let b = bRange[0] + Math.ceil(Math.random() * (bRange[1] - bRange[0]));
    let hex = "#" + r.toString(16) + g.toString(16) + b.toString(16);
    return hex;
}

function sleep(ms) {
    // Asynchronous sleep for given time
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function cSleep(ms) {
    // Cancellable asynchronous sleep for given time
    let timeout;
    let promise = new Promise((resolve) => {
        timeout = setTimeout(resolve, ms);
    });

    // Returns toolkit
    return { promise, timeout };
}

// #endregion
