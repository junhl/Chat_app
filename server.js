// server.js

// set up ======================================================================
// get all the tools we need
var express  = require('express');
var session  = require('express-session');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var morgan = require('morgan');
var app      = express();
//Chat
var server = require('http').createServer(app);
var io = require('socket.io')(server);
var port     = process.env.PORT || 8080;

var passport = require('passport');
var flash    = require('connect-flash');

// configuration ===============================================================
// connect to our database

require('./config/passport')(passport); // pass passport for configuration

app.get('/channel', function(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.send(JSON.stringify(rooms));
});

// set up our express application
app.use(morgan('dev')); // log every request to the console
app.use(cookieParser()); // read cookies (needed for auth)
app.use(bodyParser.urlencoded({
	extended: true
}));
app.use(bodyParser.json());

app.set('view engine', 'ejs'); // set up ejs for templating

// required for passport
app.use(session({
	secret: 'vidyapathaisalwaysrunning',
	resave: true,
	saveUninitialized: true
 } )); // session secret
app.use(passport.initialize());
app.use(passport.session()); // persistent login sessions
app.use(flash()); // use connect-flash for flash messages stored in session


// routes ======================================================================

require('./app/routes.js')(app, passport); // load our routes and pass in our app and fully configured passport

server.listen(port, function () {
  console.log('Server listening at port %d', port);
});

//========Chat App Starts here=========

//Routing
app.use(express.static(__dirname + '/public'));
app.use(express.static(__dirname + '/node_modules/angular'));
app.use(express.static(__dirname + '/node_modules/socket.io/node_modules/socket.io-client'));
app.use(express.static(__dirname + '/node_modules/bootstrap/dist/js'));
app.use(express.static(__dirname + '/node_modules/bootstrap/dist/css'));
console.log(__dirname);

// Chatroom : rooms which are currently available in chat
var rooms = ['Lobby','room1','room2'];

// usernames which are currently connected to the chat
var usernames = {};
var numUsers = 0;

io.on('connection', function (socket) {
  console.log(__dirname);
  var addedUser = false;

  // when the client emits 'new message', this listens and executes
  socket.on('new message', function (data) {
    // we tell the client to execute 'new message'
    console.log(socket.username + " in " + socket.room + " sent: " + data);
    socket.in(socket.room).emit('new message', {username: socket.username,message: data});
  });

  // when the client emits 'add user', this listens and executes
  socket.on('add user', function (username, room) {
    // we store the username in the socket session for this client
    socket.username = username;
	socket.room = room; ////////////////////////////////////////////////////
    // add the client's username to the global list
    usernames[username] = username;
    ++numUsers;
    addedUser = true;
    socket.emit('login', {numUsers: numUsers});
    // echo globally (all clients) that a person has connected --> changed to room echo !
    socket.broadcast.to(socket.room).emit('user joined', {username: socket.username,numUsers: numUsers, room: socket.room});
	
	////NEW STUFF HERE
	socket.join('Lobby');
	socket.broadcast.emit('updateroom', rooms, 'Lobby');
  });
  // NEW STUFF
  socket.on('switchRoom', function(newroom){
    console.log("switchRoom to " + newroom);
	  socket.broadcast.to(socket.room).emit('user left', {username: socket.username,numUsers: numUsers});
	  socket.leave(socket.room);
	  socket.join(newroom);
	  socket.room = newroom;
	  socket.broadcast.to(socket.room).emit('user joined', {username: socket.username, numUsers: numUsers, room: socket.room});
	  //socket.emit('updateroom', rooms, newroom);	  
  });
    
  socket.on('addRoom', function(newroom){
    console.log("adding room: " + newroom);
    socket.broadcast.to(socket.room).emit('user left', {username: socket.username,numUsers: numUsers});
    socket.leave(socket.room);
    rooms.push(newroom);
    socket.join(newroom);
    socket.room = newroom;
    socket.broadcast.to(socket.room).emit('user joined', {username: socket.username, numUsers: numUsers, room: socket.room});
    socket.emit('log', 'switched to channel: ' + newroom);
    //socket.emit('updateroom', rooms, newroom);    
  });

  socket.on('log', function(data) {
    console.log("LOG CALLED");
    socket.emit('log', data);
  });

  // when the client emits 'typing', we broadcast it to others
  socket.on('typing', function () {
    socket.broadcast.emit('typing', {username: socket.username});
  });

  // when the client emits 'stop typing', we broadcast it to others
  socket.on('stop typing', function () {
    socket.broadcast.emit('stop typing', {username: socket.username});
  });

  // when the user disconnects.. perform this
  socket.on('disconnect', function () {
    // remove the username from global usernames list
    if (addedUser) {
      delete usernames[socket.username];
      --numUsers;

      // echo globally that this client has left
      socket.broadcast.emit('user left', {username: socket.username,numUsers: numUsers});
	  socket.leave(socket.room); // NEW
	}
  });
});

// launch ======================================================================
// app.listen(port);
// console.log('The magic happens on port ' + port);






