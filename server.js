'use strict';

var port = process.env.OPENSHIFT_NODEJS_PORT || 8080;
var ip =  process.env.OPENSHIFT_NODEJS_IP || "127.0.0.1";
    
var express = require('express');
var app = express();
var http = require('http').Server(app);
const request = require('request');
var io = require('socket.io')(http);
//var io = require('socket.io')(65080, null);
//var io = require('socket.io')(65080, null);
//var port = 8080;
//For static files
app.use(express.static(__dirname));

var counter = 0;
var sessions = [];

// [START external_ip]
// In order to use websockets on App Engine, you need to connect directly to
// application instance using the instance's public external IP. This IP can
// be obtained from the metadata server.
//const METADATA_NETWORK_INTERFACE_URL = 'http://metadata/computeMetadata/v1/' +
//    '/instance/network-interfaces/0/access-configs/0/external-ip';
//
//function getExternalIp (cb) {
//  const options = {
//    url: METADATA_NETWORK_INTERFACE_URL,
//    headers: {
//      'Metadata-Flavor': 'Google'
//    }
//  };
//
//  request(options, (err, resp, body) => {
//    if (err || resp.statusCode !== 200) {
//      console.log('Error while talking to metadata server, assuming localhost');
//      cb('localhost');
//      return;
//    }
//    cb(body);
//  });
//}
//// [END external_ip]
//
//app.get('/data', (req, res) => {
//    console.log("Getting ip...");
//    getExternalIp((externalIp) => {
//        res.json({
//            'externalIp': externalIp
//        })
//    })
//});

app.get('/', function(req, res){
//    console.log(req);
//    console.log(res);
//    res.send('<h1>Hallo mand</h1>');
    res.sendFile(__dirname + '/index.html');
})

app.get('/game', function(req, res){
    res.sendFile(__dirname + '/game.html') 
});


http.listen(port, function(){
    console.log('listening in port ' + port);
});

var players = io.of('/player');
var game = io.of('/game');
players.on('connection', function(socket){
    
    console.log('new player: ' + socket.id);
    
    game.emit('newplayer', socket.id);
    
    socket.on('disconnect', function(t){
        console.log('connection closed');
        game.emit('playerdisconnected', socket.id);
    });
    
    socket.on('move', function(data){
        console.log("player " + socket.id + " is moving " + data);
        game.emit("playermove", {id: socket.id, direction: data})
    });
    
});

game.on('connection', function(socket){
    console.log('new game: ' + socket.id);
    
    socket.on('playerinit', function(data){
        var otherSocket = players.connected[data.id];
        if (otherSocket){
            otherSocket.emit('init', data.color);
        } else {
            console.log("not found");
        }
            
        console.log("Color " + data.color + " given to player " + data.id);
    });
    
    socket.on('score', function(data){
        var otherSocket = players.connected[data.id];
        if (otherSocket){
            otherSocket.emit('score', data.score);
        } else {
            console.log("not found");
        }
    });
});
