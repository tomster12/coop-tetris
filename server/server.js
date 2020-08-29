
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
  let typeExt = {
    ".html": "text/html",
    ".js":   "text/javascript",
    ".css":  "text/css"
  }[ext] || "text/plain";

  fs.readFile(__dirname + pathname,
    function (err, data) {
      if (err) {
        res.writeHead(500, { "Content-Type": "text/Plain" });
        return res.end("Error loading " + __dirname + pathname);
      }
      res.writeHead(200, { "Content-Type": typeExt });
      res.end(data);
    }
  );
}


// Initialize HTTP Server
const server = http.createServer(handleRequest).listen(3000);
console.log("Server started at http://localhost:3000/");

// #endregion


// #region - Socket IO

// Initialize server
const io = socketio.listen(server);
io.sockets.on("connection", (socket) => {
    console.log("Client connected: " + socket.id);
    socketInfo[socket.id] = {};


    // Host request
    socket.on("requestHost", () => { requestHost(socket); });

    // Request to join specificed game
    socket.on("requestJoin", (data) => { requestJoin(socket, data); });

    // Request to leave specified game
    socket.on("requestLeave", (data) => { requestLeave(socket, data); });

    // Game list Request
    socket.on("getGameList", () => { getGameList(socket); });


    // Player ready up
    socket.on("game::readyUp", () => { currentGames[socketInfo[socket.id].currentGame].playerReadyUp(socket.id); });


    // Client disconnect
    socket.on("disconnect", () => {
      console.log("Client disconnected: " + socket.id);

      // Remove from current game
      if (socketInfo[socket.id].currentGame != null) {
        requestLeave(socket, { id: socketInfo[socket.id].currentGame });
      }

      // Delete info
      delete socketInfo[socket.id];
    });
  }
);

// #endregion


// #region - Tetris

// Initialize variables
let socketInfo = {};
let nextGameID = 0;
let currentGames = {};


function requestHost(socket) {
  // Create a new tetris game
  console.log("Creating new game with ID: " + nextGameID);
  let newGame = new TetrisGame(nextGameID);
  currentGames[nextGameID] = newGame;
  socket.emit("requestHost", { id: nextGameID++, accepted: true });
  getGameList(io);
}


async function requestJoin(socket, data) {
  await sleep(500);

  // Game exists
  if (currentGames[data.id]) {
    console.log(socket.id + " requests join game " + data.id + ": accepted");
    socketInfo[socket.id].currentGame = data.id;
    currentGames[data.id].addPlayer(socket.id);
    getGameList(io);
    socket.emit("requestJoin", { id: data.id, accepted: true, config: currentGames[data.id].config });

  // Game doesnt exist
  } else {
    console.log(socket.id + " requests join game " + data.id + ": game not found");
    socket.emit("requestJoin", { id: data.id, accepted: false, reason: "No game found" });
  }
}


function requestLeave(socket, data) {
  // Game exists
  if (currentGames[data.id]) {
    console.log(socket.id + " requests leave game " + data.id + ": accepted");
    socketInfo[socket.id].currentGame = null;
    currentGames[data.id].removePlayer(socket.id);
    getGameList(io);
    socket.emit("requestLeave", { id: data.id, accepted: true });

  // Game doesnt exist
  } else {
    console.log(socket.id + " requests leave game " + data.id + ": game not found");
    socket.emit("requestLeave", { id: data.id, accepted: false, reason: "No game found" });
  }
}


function getGameList(target) {
  // Send a list of available games to the target
  let games = Object.values(currentGames).map(g => {
    return { id: g.id, playerCount: g.players.length }
  });
  target.emit("getGameList", games);
}


function removeGame(id) {
  // Remove the specified game
  console.log("Deleting game with id: " + id);
  if (currentGames[id])
    delete currentGames[id];
  getGameList(io);
}

// #endregion


// #region - Other

function sleep(ms) {
  // Asynchronous sleep for given time
  return new Promise(resolve => setTimeout(resolve, ms));
}

// #endregion


class TetrisGame {

  // #region - Setup

  constructor(id_) {
    // Initialize variables
    this.id = id_;
    this.running = false;
    this.config = {
      gameMode: "standard",
      boardSize: { x: 10, y: 24 },
      queueLength: 5 };
    this.players = {};
  }

  // #endregion


  // #region - Main

  playerReadyUp(id) {
    // Ready up the player
    this.players[id].ready = true;

    // DEBUG count ready players
    let players = this.getPlayers();
    let count = players.reduce((acc, p) => (acc + (p.ready ? 1 : 0)));
    this.emitToPlayers("game::debugNumber", count);
  }


  addPlayer(id) {
    // New player joined
    this.players[id] = {
      id : id,
      ready: false
    };
  }


  removePlayer(id) {
    // Player wants to leave
    if (this.players[id]) delete this.players[id];

    // Delete if no players
    if (Object.keys(this.players).length == 0) removeGame(this.id);
  }


  getPlayers() {
    // Returns a list of players
    return Object.values(this.players);
  }


  emitToPlayers(evt_, data_) {
    // Emit an event to all players
    for (let player of Object.keys(this.players)) {
      io.to(player).emit(evt_, data_);
    }
  }

  // #endregion
}
