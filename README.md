# sonos-ir-control
Control AV gear via IR in response to Sonos activity

** NOTE - This project is currently alpha and quite unstable **

## Overview
This project was initiated to automate the control of an AV receiver based on the state of a Sonos system. My Denon AV receiver is connected to a Sonos Connect device and should be turned on when audio is played on the Sonos Connect. If audio is no longer being played, the AV receiver should be powered off following a period of inactivity.

## Description
This node project is based on two main components:

### Sonos Interface
The Sonos interface utilizes the project [node-sonos-http-api](https://github.com/jishi/node-sonos-http-api) to discover system devices and to listen for Sonos communication.

### IR Interface
The AV gear is controlled via node-lirc.

### Logic
This project implements a server to which a node-sonos-http-api webhook sends every state and topology change. Logic is in place to send certain IR code sequences based on a number of state changes.

## Dependencies

### Install node
On a Raspberry Pi, the following did the trick:
```
sudo apt-get update
sudo apt-get dist-upgrade
curl -sL https://deb.nodesource.com/setup_11.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### Install required node packages
`npm install --production`

### Install lirc
`sudo apt-get install lirc`

## Configuration
Enable the webhook in node-sonos-http-api/settings.json:
```
{
  "webhook": "http://localhost:5007/"
}
```

### Configure lirc for IR hardware
The specifics depends on what hardware (IR blaster) is being used. In my case I used a Raspberry Pi 2 Model B v1.1 with a home-made IR transmitter/receiver board that uses GPIO22 for transmitting IR signals and GPIO23 for receiving IR signals. The following files required modifications for my setup:
/etc/lirc/hardware.conf

`/boot/config.txt` required:
```
# Uncomment this to enable the lirc-rpi module
dtoverlay=lirc-rpi,gpio_in_pin=23,gpio_out_pin=22
```

Since I'm using GPIO pins,I also needed to add to the `/etc/modules` file:
```
lirc_dev
lirc_rpi gpio_in_pin=23 gpio_out_pin=22
```

[This page](https://www.hackster.io/austin-stanton/creating-a-raspberry-pi-universal-remote-with-lirc-2fd581) was helpful when setting up lirc on a Raspberry Pi

### Install IR codes for AV equipment used
Lirc requires a configuration file in `/etc/lirc/lircd.conf.d` for the AV device that contains the codes to be send. I've included an [example file](../example/lirc/denon_codes.conf) that I used with my Denon receiver. Note that the IR codes can either be "learned" from an existing remote, they can be downloaded from the web, or they can be converted from another format, such as Pronto, which was the case for the files in the example file.

### Restart lircd
```
sudo /etc/init.d/lirc stop
sudo /etc/init.d/lirc start
```

## Running
### Start node-sonos-http-api
`node node_modules/sonos-http-api/server.js`

### Start sonos-ir-control
`node sonos-ir-control`
