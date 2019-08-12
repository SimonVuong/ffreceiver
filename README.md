# ffreceiver

when running make sure to create a .env file which contains the receiver's id


to run as a service on rasberry pi boot...


make sure node is installed in the rasberry pi. follow first few steps here
https://linuxize.com/post/how-to-install-node-js-on-raspberry-pi/.


clone the repo at the home location. cd into repo and run `npm run build`. this will do npm install and package
the files. also be sure to add a `.env` file at project root to specify any necessary env variables.

setup system d to run rasberry pi server.

take the `./tools/ffreceiver.service` file and paste it into `/lib/systemd/system`

then...

`sudo systemctl start ffreceiver` to run it
`sudo systemctl daemon-reload` so that systemd picks up the new file.
`sudo systemtl enable ffreceiver` to enable starting app on boot


