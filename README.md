# Twitter live wall - Server

Basic project that make use of the Twitter Streaming API to show live tweets.

# Installation

First you should get credentials for accessing the Twitter API.

Installing the development version:

	npm install

	# update config file > config.js
	exports.twitter = {
		consumer_key : 'key',
		consumer_secret : 'secret',
		access_token_key : 'key',
		access_token_secret : 'secret'
	}

# Libraries 

 * express
 * socket.io
 * twitter
 
