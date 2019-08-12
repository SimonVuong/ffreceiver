import http from 'http';
import { printer, types } from 'node-thermal-printer';
import { activeConfig } from './config';

const print = data => {
  const thermalPrinter = new printer({
    type: types.EPSON,
    interface: 'tcp://192.168.123.100:9100',
  });
  thermalPrinter.alignCenter();
  thermalPrinter.println(data);
  thermalPrinter.cut();
  thermalPrinter.execute()
    .then((res) => {
      console.log('print success:', res)
    })
    .catch((e) => {
      console.log('print err:', e);
    })

  thermalPrinter.beep(); 
};

const options = {
  agent: false,
  host: activeConfig.registration.host,
  defaultPort: activeConfig.registration.port,
  path: `/register-receiver?id=${activeConfig.receiver.id}`,
  headers: {
    connection: 'keep-alive',
  }
};

const registerReceiver = () => {
  http.get(options, res => {
    if (res.statusCode === 200) {
      res.on('data', print);
      return;
    }
    res.setEncoding('utf8');
    res.on('data', reason => console.error(`Registration aborted: ${reason}`));
  })
  .on('close', c => console.log('close', c))
  .on('error', e => console.log('error', e));

  console.log(`listening with config ${JSON.stringify(activeConfig)}`);
}

registerReceiver();