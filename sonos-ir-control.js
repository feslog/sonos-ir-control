// Learning node.js
// Much of this taken from https://github.com/jishi/node-sonos-http-api


// fs = require('fs');
const http = require('http');
const path = require('path');
const JSON5 = require('json5');
const tryLoadJson = require('sonos-http-api/lib/helpers/try-load-json');
const logger = require('sonos-http-api/node_modules/sonos-discovery/lib/helpers/logger');
var nodeLIRC = require('node-lirc');

const hostname = '127.0.0.1';
var previousPlaybackState;
var systemState = 0;  // 0=off, 1=turning on, 2=on, 3=turning off
var receiverStep  = 0;  // used to itterate through steps needed to turn on or off

nodeLIRC.init();

commandState = { "commandList":"", // command list object currently being executed
				 "step":""         // current step in command list
};

commandListOn = {
    "name":"Power on", 
    "commands": [
        { "name":"PowerOn",   "device":"denon", "code":"Main_Zone_On", "sleep":"1000" },
        { "name":"SetInput",  "device":"denon", "code":"Source_CD", "sleep":"1000" },
        { "name":"SetVolume", "device":"denon", "code":"Master_vol_preset1", "sleep":"1000" }
    ],
	"nextState":"2"
 }

commandListOff = {
    "name":"Power off", 
	"commands": [
        { "name":"SetVolume", "device":"denon", "code":"Master_vol_preset3", "sleep":"1000" },
        { "name":"PowerOff",  "device":"denon", "code":"Main_Zone_OFF", "sleep":"1000" }
    ],
	"nextState":"0"
 }
 
function execCommand() {
	if (commandState.step < commandState.commandList.commands.length) {
		console.log('Executing step: ', commandState.step, commandState.commandList.commands[commandState.step].name);
		nodeLIRC.send(commandState.commandList.commands[commandState.step].device, commandState.commandList.commands[commandState.step].code);
		setTimeout(execCommand, commandState.commandList.commands[commandState.step].sleep);	
		commandState.step++;;
	} else {
		systemState = commandState.commandList.nextState;
		console.log('Command ', commandState.commandList.name, 'Done - new system state is: ', systemState);
		commandState.commandList = '';
	}
}

function execCommandBegin(commandList) {
	console.log('execCommandBegin', commandState.commandList.name);
	if (commandState.commandList) {
		console.log('Refusing to start command ', commandList.name, ' Command already executing: ', commandState.commandList.name);
	} else {
		commandState.commandList=commandList;
		commandState.step=0;
		execCommand();
	}
}

var settings = {
  shutoffDelay: 10000,
  serverPort: 5007
};

function merge(target, source) {
  Object.keys(source).forEach((key) => {
    if ((Object.getPrototypeOf(source[key]) === Object.prototype) && (target[key] !== undefined)) {
      merge(target[key], source[key]);
    } else {
      target[key] = source[key];
    }
  });
}

// load user settings
const settingsFileFullPath = path.resolve(__dirname, 'settings.json');
const userSettings = tryLoadJson(settingsFileFullPath);
merge(settings, userSettings);

let shutoffTimer;

logger.info('Starting with settings:\r\n', settings);

function setSystemState(newState) {
	logger.info('setSystemState ', systemState, newState);
	if (newState != systemState) {
		if (newState == 0)
			execCommandBegin(commandListOff);
		else if (newState == 2) 
			execCommandBegin(commandListOn);
	}
}

function shutOff() {
  console.log('Shut off timer fired');
  shutoffTimer = null;
  setSystemState(0);
}

function cancelShutOffTimer() {
	// cancel any previous timers
	if (shutoffTimer) {
		console.log('cancelling previous timer\r\n');
		clearTimeout(shutoffTimer);
	}
	
}

function startShutOffTimer() {
	cancelShutOffTimer();
	console.log('starting timer\r\n');
	shutoffTimer = setTimeout(shutOff, settings.shutoffDelay);		
}

function checkPlaybackState(state) {
	console.log('checkPlaybackState', previousPlaybackState, state);
	if ( state != "TRANSITIONING") {
		if (state != previousPlaybackState) {
			if ( state == "PLAYING") {
				cancelShutOffTimer();
				setSystemState(2);
			} else {
					startShutOffTimer();
			}
			previousPlaybackState = state;
		}	
	}
}

const server = http.createServer((req, res) => {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/plain');

  const buffer = [];

  req.on('data', (data) => buffer.push(data.toString()));
  req.on('end', () => {
    res.end();

    const json = JSON.parse(buffer.join(''));
    //console.dir(json, {depth: 10});
    console.log('');
	
	// TO DO - Each message can possible? have an array of elements - itterate through these properly!
	//Object.keys(json).forEach((index) => {
	//	console.log('got message type ', index, index.type);
	//});
	console.log('got message type ', json.type);
  
	if (json.type == "transport-state") {
		if (json.data.roomName == "Living Room") {
			checkPlaybackState(json.data.state.playbackState);
		}
	}
	else if (json.type == "topology-change") {  // handles cases where target room is grouped and not coordinator
		for (let changes of json.data) {
			//console.log(changes);
			for (let room of changes.members) {
				console.log("Got transport state: ", room.roomName, room.state.playbackState);
				if (room.roomName == "Living Room") {
					checkPlaybackState(room.state.playbackState);
				}				
			}
		}

	}
  });  
});

server.listen(settings.serverPort, hostname, () => {
  console.log(`Server running at http://${hostname}:${settings.serverPort}/`);
});

// to do - add https://github.com/jprichardson/node-death