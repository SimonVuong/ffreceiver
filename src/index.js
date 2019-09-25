import { printer } from 'node-thermal-printer';
import { activeConfig } from './config';
import PQueue from 'p-queue';
import io from 'socket.io-client';
import parser from 'socket.io-json-parser';

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

const printTickets = printRequest => {
  const customerName = printRequest.data.customerName;
  const tableNumber = printRequest.data.tableNumber;
  printRequest.data.items.forEach(({ printers, ...item }) => {
    printers.forEach(({ ip, type, port }) => {
      const q = getPrinterQ(ip);
      q.add(async () => {
        try {
          await printItem(ip, type, port, customerName, tableNumber, item);
        } catch (e) {
          console.error(`failed to print ticket to ${ip}, ${e}`);
        }
      });
    });
  });
};

const printReceipts = printRequest => {
  const customerName = printRequest.data.customerName;
  const tableNumber = printRequest.data.tableNumber;
  printRequest.data.receiptPrinters.forEach(({ ip, type, port }) => {
    const q = getPrinterQ(ip);
    q.add(async () => {
      try {
        await printOrder(ip, type, port, customerName, tableNumber, printRequest.data.items, printRequest.data.costs);
      } catch (e) {
        console.error(`failed to print receipt to ${ip}, ${e}`);
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
      console.error(`failed to print test to ${ip}, ${e}`);
    }
  });
};

const handlePrintRequest = json => {
  try {
    if (json.type === 'TICKETS') {
      printTickets(json);
    } else if (json.type === 'RECEIPTS') {
      printReceipts(json);
    } else if (json.type === 'TEST') {
      testPrint(json)
    } else {
      throw new Error(`Unknown type ${json.type}`);
    }
  } catch(e) {
    console.error(`error ${e} with ${json}`);
  }
};
 
const registerReceiver = () => {
  const socket = io(`${activeConfig.registration.host}?id=${activeConfig.receiver.id}`, {
    parser,
    transports: ['websocket'],
    forceNode: true,
  });

  let socketId;
  socket.on('connect', () => {
    socketId = socket.id;
    console.log('socket connected', socketId);
  });
  
  socket.on('reconnecting', attemptNumber => {
    console.log('socket reconnecting', attemptNumber);
  });

  socket.on('disconnect', reason => {
    console.log('socket disconnected', socketId, reason);
  })

  socket.on('message', handlePrintRequest);
}

registerReceiver();
