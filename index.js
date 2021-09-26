var http = require('http');
var socketIO = require('socket.io');
var PORT = process.env.PORT || 9000;

var app = http.createServer().listen(PORT);

var io = socketIO(app, {
  cors: {
    origin: true,
    methods: ['GET', 'POST'],
    transports: ['websocket', 'polling'],
    credentials: true
  }
});
io.sockets.on('connection', function(socket) {
  
  function clientLog() {
    var array = ['Message from server:'];
    array.push.apply(array, arguments);
    socket.emit('log', array);
  }

  socket.on('message', function(message) {
    clientLog('Client said: ', message);

    socket.broadcast.emit('message', message);
  });

  socket.on('create or join', function(room) {
    clientLog('Received request to create or join room ' + room);
    var clientsInRoom = io.sockets.adapter.rooms.get(room);
    var numClients = clientsInRoom ? clientsInRoom.size : 0;
    clientLog('Room ' + room + ' now has ' + numClients + ' client(s)');

    if (numClients === 0) {
      socket.join(room);
      clientLog('Client ID ' + socket.id + ' created room ' + room);
      socket.emit('created', room, socket.id);

    } else if (numClients === 1) {
      clientLog('Client ID ' + socket.id + ' joined room ' + room);
      io.sockets.in(room).emit('join', room);
      socket.join(room);
      socket.emit('joined', room, socket.id);
      io.sockets.in(room).emit('ready');
    } else { // max two clients
      socket.emit('full', room);
    }
  });

  socket.on('disconnect', function(){
    clientLog('received bye');
  });
});
