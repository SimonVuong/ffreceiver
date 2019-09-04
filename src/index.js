import https from 'https';
import { printer } from 'node-thermal-printer';
import { activeConfig } from './config';
import PQueue from 'p-queue';
import { readFileSync } from 'fs'
const localPrinters = {};

const getPrinterQ = ip => {
  if (!localPrinters[ip]) {
    localPrinters[ip] = new PQueue({ concurrency: 1 });
  }
  return localPrinters[ip];
}

const printPrinterName = (ip, type, port, name) => {
  const thermalPrinter = new printer({
    interface: `tcp://${ip}:${port}`,
    type,
  });
  thermalPrinter.println(`${name} is ready to print for foodflick`);
  thermalPrinter.cut();
  thermalPrinter.beep();   
  return thermalPrinter.execute();
}

const printItem = (ip, type, port, customerName, tableNumber, { name, selectedPrice, selectedOptions, quantity, specialRequests }) => {
  const thermalPrinter = new printer({
    interface: `tcp://${ip}:${port}`,
    type,
  });
  thermalPrinter.println(`Table number: ${tableNumber}`);
  thermalPrinter.println(`Customer: ${customerName}`);
  thermalPrinter.newLine();
  thermalPrinter.println(`Name: ${name} (${quantity})`)
  thermalPrinter.newLine();

  if (selectedPrice.label || selectedOptions.length > 0) {
    thermalPrinter.println(`Options:`);
  }

  if (selectedPrice.label) {
    thermalPrinter.println(selectedPrice.label);
  }

  if (selectedOptions.length > 0) {
    selectedOptions.forEach(({ name }) => thermalPrinter.println(name));
  }

  if (specialRequests) thermalPrinter.println(`Special requests: ${specialRequests}`);
  
  thermalPrinter.cut();
  thermalPrinter.beep();   
  
  return thermalPrinter.execute();
}

const printOrder = (ip, type, port, customerName, tableNumber, items, { itemTotal, tax, tip, total }) => {
  const thermalPrinter = new printer({
    interface: `tcp://${ip}:${port}`,
    type,
  });
  thermalPrinter.println(`Table number: ${tableNumber}`);
  thermalPrinter.println(`Customer: ${customerName}`);

  items.forEach(({ name, selectedPrice, selectedOptions, quantity, specialRequests }) => {
    thermalPrinter.newLine()
    thermalPrinter.leftRight(`${name} (${quantity})`, quantity*selectedPrice.value);
    if (selectedPrice.label) {
      thermalPrinter.println(`- ${selectedPrice.label}`);
    }
    selectedOptions.forEach(({ name }) => thermalPrinter.println(`- ${name}`));
    if (specialRequests) thermalPrinter.println(`Special requests: ${specialRequests}`);
  });

  thermalPrinter.leftRight('Item total', itemTotal);
  thermalPrinter.leftRight('Tax', tax);
  thermalPrinter.underline(true);
  thermalPrinter.leftRight('Tip', tip);
  thermalPrinter.underline(false);
  thermalPrinter.leftRight('Total', total);

  thermalPrinter.cut();
  thermalPrinter.beep();   
  return thermalPrinter.execute();
}

const print = printRequest => {
  const customerName = printRequest.data.customerName;
  const tableNumber = printRequest.data.tableNumber;

  // print items
  printRequest.data.items.forEach(({ printers, ...item }) => {
    printers.forEach(({ ip, type, port }) => {
      const q = getPrinterQ(ip);
      q.add(async () => {
        try {
          await printItem(ip, type, port, customerName, tableNumber, item);
        } catch (e) {
          console.log(`failed to print to ${ip}, ${e}`);
        }
      });
    });
  });

  // print order
  printRequest.receiptPrinters.forEach(({ ip, type, port }) => {
    const q = getPrinterQ(ip);
    q.add(async () => {
      try {
        await printOrder(ip, type, port, customerName, tableNumber, printRequest.data.items, printRequest.data.costs);
      } catch (e) {
        console.log(`failed to print receipt to ${ip}, ${e}`);
      }
    });
  });
};

const testPrint = printRequest => {
  const { ip, port, type, name } = printRequest.data.printer;
  const q = getPrinterQ(ip);
  q.add(async () => {
    try {
      await printPrinterName(ip, type, port, name);
    } catch (e) {
      console.log(`failed to print to ${ip}, ${e}`);
    }
  });
};

const options = {
  agent: false,
  host: activeConfig.registration.host,
  defaultPort: activeConfig.registration.port,
  path: `/register-receiver?id=${activeConfig.receiver.id}`,
  ca: readFileSync(__dirname + '/foodflick_co.ca-bundle'),
  headers: {
    connection: 'keep-alive',
    'content-type': 'application/json',
  }
};

const registerReceiver = () => {
  https.get(options, res => {
    res.setEncoding('utf8');
    res.on('data', data => {
      if (data === '1') {
        console.log('received heartbeat');
        return;
      }
      try {
        const response = JSON.parse(data);
        if (response.isOrder) {
          print(response);
        } else {
          testPrint(response)
        }
      } catch(e) {
        console.log(`error ${e} with ${data}`);
      }
    });
    res.on('end', () => console.log(`Registration aborted`) )
  })
  .on('close', () => console.log('closed'))
  .on('error', e => console.log('error', e));

  console.log(`listening with config ${JSON.stringify(activeConfig)}`);
}

registerReceiver();
