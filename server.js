'use strict';

var port = process.env.OPENSHIFT_NODEJS_PORT || 8080;
var ip =  process.env.OPENSHIFT_NODEJS_IP || "127.0.0.1";
    
var express = require('express');
var app = express();
var http = require('http').Server(app);
const request = require('request');
var io = require('socket.io')(http);

//For serving static files
app.use(express.static(__dirname));

var activePlayersLimit = 6;
var activePlayers = [];
var playerQueue = [];


app.get('/', function(req, res){
    res.sendFile(__dirname + '/index.html');
})

app.get('/game', function(req, res){
    res.sendFile(__dirname + '/game.html') 
});

//For probe and liveness tests
app.get('/probe', (req, res) => res.sendStatus(200));
app.get('/liveness', (req, res) => res.sendStatus(200));

http.listen(port, function(){
    console.log('listening in port ' + port);
});

var players = io.of('/player'); //Make socket namespace for player-clients
var game = io.of('/game'); //name space for game-client (ie. the actual game)

players.on('connection', function(socket){
    
    console.log('new player: ' + socket.id);
    
    //Check if there's room for more active players
    if (activePlayers.length < activePlayersLimit){
        //If there is, let player join game
        //Inform game client of new player
        game.emit('newplayer', socket.id);
        console.log("joining game")
        //let player client know it has joined
        socket.emit('joinedgame');
        
        //store connection id
        activePlayers.push(socket.id)

        //bind handler for client input
        socket.on('move', function(data){
            movePlayer(socket, data);
        });
    } else {
        //If not, store connection id in queue
        console.log("joining queue")
        playerQueue.push(socket.id)
    }
    
    console.log("active players: " + activePlayers.length);
    console.log("queue: " + playerQueue.length);
    console.log("");

    
    socket.on('disconnect', function(t){
        console.log('connection ' + socket.id + ' closed');
        game.emit('playerdisconnected', socket.id);
        
        //When a player disconnects, determine if this player was playing or in queue
//        if (activePlayers.includes(socket.id)){ //This, apparently, does not work in node 4.x
        if (activePlayers.indexOf(socket.id) != -1){
            console.log(socket.id + ' was playing (not queued)');
            
            //if player was playing, that means there's now an opening for another player.
            //Remove player from activeplayers 
            var i = activePlayers.indexOf(socket.id);
            if(i != -1) {
                activePlayers.splice(i, 1);
                console.log('player was removed from game list');
            }
            
            //Then admit first player from queue
            if (playerQueue.length > 0){
                //Get first socket id from queue
                var newPlayerSocketId = playerQueue[0];
                console.log("Admitting player " + newPlayerSocketId + " to game");

                //Inform game client of new player
                game.emit('newplayer', newPlayerSocketId);
                
                //find socket with that id
                var newPlayerSocket = players.connected[newPlayerSocketId];
                
                //bind handler for client input
                newPlayerSocket.on('move', function(data){
                    movePlayer(newPlayerSocket, data);
                });

                if (newPlayerSocket){
                    newPlayerSocket.emit('joinedgame');
                } else {
                    console.log("not found");
                }

                //store socket id in activeplayers list
                activePlayers.push(newPlayerSocketId);

                //remove from queue
                var i = playerQueue.indexOf(newPlayerSocketId);
                if(i != -1) {
                    playerQueue.splice(i, 1);
                    console.log('player ' + newPlayerSocketId + ' no longer in queue');
                }
            }
            
        } else {
            console.log("disconnected player was in queue");
            //Remove from queue
            var i = playerQueue.indexOf(socket.id);
            if(i != -1) {
                playerQueue.splice(i, 1);
                console.log('player was removed from queue');
            } else {
                console.log("not found");
            }
            
        }
        
        console.log("active players: " + activePlayers.length);
        console.log("queue: " + playerQueue.length);
        console.log("");
        
    });
    
});

game.on('connection', function(socket){
    console.log('new game: ' + socket.id);
    
    //Reset active players and queue
    activePlayers = [];
    playerQueue = [];
    
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

function movePlayer(socket, data){
    console.log("player " + socket.id + " is moving " + data);
    game.emit("playermove", {id: socket.id, direction: data})
}