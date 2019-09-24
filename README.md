# ffreceiver

to run as a service on rasberry pi boot...

make sure node is installed in the rasberry pi. follow first few steps here
https://linuxize.com/post/how-to-install-node-js-on-raspberry-pi/.

make sure to allow ssh in case we need to debug on premise
	- preferences -> raspberry pi config -> interfaces -> enable ssh

make sure to allow make the pi wait for network on bootup
	- preferences -> raspberry pi config -> system -> check off wait for network

clone the repo at the home location. 

make sure to run `npm install -g cross-env`. make sure to update the config file to hold the correct receiverId


cd into repo and run `npm run build`. this will do npm install and package
the files.

setup system d to run rasberry pi server by first creating the .service file

`sudo cp tools/ffreceiver.service /lib/systemd/system`

then...
`sudo systemctl daemon-reload` so that systemd picks up the new file.
`sudo systemctl start ffreceiver` to run it
`sudo systemctl enable ffreceiver` to enable starting app on boot


