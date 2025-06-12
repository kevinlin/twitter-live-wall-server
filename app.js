"use strict";
const socketio = require("socket.io");
const express = require("express");
const os = require("os");
const port = process.env.PORT || 3003;
const env = process.env.NODE_ENV || "development";
const app = express();
const Twitter = require('twitter');
const config = require('./config.js');

const twitter = new Twitter(config.twitter);

app.set('port', port);
app.set('env', env);
app.use(function (req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});

/*
 * DEFINE ROUTER: 
 *  Search Tweet API: 
 *    url: api/:term/tweets
 *    params: 
 *      `term`: String
 *    
 *    Ex: curl -m GET -h http://localhost:3003/api/nodejs/tweets
*/
const router = express.Router();
router.get('/api/:term/tweets', function (req, res) {
    if (req.params.term) {
        searchTweets(req.params.term, function (data) {
            res.json(data);
        });
    }
    else {
        res.status(404);
    }
});
router.get('/', (req, res) => {
    res.json({health: 'OK'});
});
router.get('/stats', (req, res) => {
    res.json(getServerStats());
});
router.get('/room/:qry/stats', (req, res) => {
    if (io.sockets.adapter.rooms.has(req.params.qry)) {
        res.json(getRoomStats(req.params.qry));
    }
    else {
        res.status(404);
    }
});
app.use('/', router);

const server = app.listen(app.get('port'), () => {
    console.log('server listening on port ' + app.get('port'));
});
const io = socketio(server, {cors: {origin: '*'}});
const escapeHtml = (text = "") => {
    return text.replace(/&/g, "&amp;").replace(/>/g, "&gt;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
};

io.on('connection', (client) => {
    console.log("client connected...");

    client.on("join", (data) => {
        client.join(data.query);
        streamTweets(data.query, client);
        client.to(data.query).emit('qryUpdate', getRoomStats(data.query));
        io.emit('statsUpdate', getServerStats());
    });

    client.on("leave", (data) => {
        console.log('leave', data);
        client.leave(data.query);
        client.disconnect(true);
        client.to(data.query).emit('qryUpdate', getRoomStats(data.query));
        io.emit('statsUpdate', getServerStats());
    });

    client.on('disconnect', () => {
        for (const [query, sockets] of io.sockets.adapter.rooms) {
            if (io.sockets.sockets.has(query)) continue;
            io.to(query).emit('qryUpdate', {
                query: query,
                clientsCount: sockets.size
            });
        }
        io.emit('statsUpdate', getServerStats());
    });

    client.emit('host', os.hostname());
});

function getServerStats() {
    return {
        clientsCount: io.engine.clientsCount - 1,
        roomsCount: io.sockets.adapter.rooms.size - io.sockets.sockets.size
    };
}

function getRoomStats(frq) {
    const room = io.sockets.adapter.rooms.get(frq);
    return {
        frq: frq,
        clientsCount: room ? room.size : 0
    };
}

function streamTweets(term, client) {
    console.log('twitter.js: start stream >>', term);
    twitter.stream('statuses/filter', {track: term}, function (stream) {
        stream.on('data', function (tweet) {
            if (tweet == undefined ||
                tweet.user == undefined ||
                tweet.user.screen_name == undefined)
                return;
            var new_tweet = {
                query: term,
                id: tweet.id,
                text: tweet.text,
                pic: tweet.user.profile_image_url,
                screenname: tweet.user.screen_name,
                name: tweet.user.name
            };
            var room = io.sockets.adapter.rooms.get(term);
            var clientsCount = room ? room.size : 0
            if (clientsCount < 1) {
                stream.destroy();
                return;
            }
            try {
                console.log("pushing new tweet to client for " + term + " id=" + new_tweet.id);
                client.emit('new_tweet', new_tweet);

            } catch (error) {
                console.log("twitter.js: catch >>> " + error);
                stream.destroy();
                return;
            }
        });
        stream.on('error', function (error) {
            console.log('twitter.js: error >>', error);
            stream.destroy();
        });
        stream.on('end', function (response) {
            console.log('twitter.js: end >>');
        });
        stream.on('destroy', function (response) {
            console.log('twitter.js: destroy >>');
        });
    });
}

function searchTweets(term, callback) {
    twitter.get('search/tweets', {q: term}, function (error, tweets, response) {
        var results = [];
        var maxitem = 10;
        var cmds = "";
        if (!tweets) {
            console.log("unable to connect to fetch tweets")
        }
        for (var i = 0; i < maxitem; i++) {
            if (tweets.statuses[i] == undefined)
                break;
            var tweet = tweets.statuses[i];
            var new_tweet = {
                id: tweet.id,
                text: tweet.text,
                pic: tweet.user.profile_image_url,
                name: tweet.user.screen_name
            };
            results.push(new_tweet);
        }
        if (callback) callback(results);
    });
}
