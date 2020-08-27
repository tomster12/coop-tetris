
// #region - Modules

// Import modules
let http = require("http");
let path = require("path");
let fs = require("fs");
let sock = require("socket.io");

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
const io = sock.listen(server);
io.sockets.on("connection", (socket) => {
    console.log("Client connected: " + socket.id);

    // Host request
    socket.on("requestHost", () => { requestHost(socket); });

    // Request to join specificed game
    socket.on("requestJoin", (data) => { requestJoin(socket, data); });

    // Request to leave specified game
    socket.on("requestLeave", (data) => { requestLeave(socket, data); });

    // Game list Request
    socket.on("getGameList", () => { getGameList(socket); });

    // Client disconnect
    socket.on("disconnect", () => {
      console.log("Client disconnected: " + socket.id);
    });
  }
);

// #endregion


// #region - Tetris

// Initialize variables
let nextGameID = 0;
let tetrisGames = {};


function requestHost(socket) {
  // Create a new tetris game
  console.log("Creating new game with ID: " + nextGameID);
  let newGame = new TetrisGame(nextGameID);
  tetrisGames[nextGameID] = newGame;
  socket.emit("requestHost", { id: nextGameID++, accepted: true });
  getGameList(io);
}


async function requestJoin(socket, data) {
  await sleep(500);

  // Game exists
  if (tetrisGames[data.id]) {
    console.log(socket.id + " requests join game " + data.id + ": accepted");
    tetrisGames[data.id].addPlayer(socket.id);
    socket.emit("requestJoin", { id: data.id, accepted: true });
    getGameList(io);

  // Game doesnt exist
  } else {
    console.log(socket.id + " requests join game " + data.id + ": game not found");
    socket.emit("requestJoin", { id: data.id, accepted: false, reason: "No game found" });
  }
}


function requestLeave(socket, data) {
  // Game exists
  if (tetrisGames[data.id]) {
    console.log(socket.id + " requests leave game " + data.id + ": accepted");
    tetrisGames[data.id].removePlayer(socket.id);
    getGameList(io);

  // Game doesnt exist
  } else {
    console.log(socket.id + " requests leave game " + data.id + ": game not found");
  }
}


function getGameList(target) {
  // Send a list of available games to the target
  let games = Object.values(tetrisGames).map(g => {
    return { id: g.id, playerCount: g.players.length }
  });
  target.emit("getGameList", games);
}


function removeGame(id) {
  // Remove the specified game
  console.log("Deleting game with id: " + id);
  if (tetrisGames[id])
    delete tetrisGames[id];
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
    this.players = [];
  }

  // #endregion


  // #region - Main

  addPlayer(id) {
    // New player joined
    this.players.push({ id: id });
  }


  removePlayer(id) {
    // Player wants to leave
    this.players.splice(this.players.findIndex(v => v.id == id), 1);

    // Delete if no players
    if (this.players.length == 0) removeGame(this.id);
  }

  // #endregion
}
