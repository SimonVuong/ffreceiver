import { printer } from 'node-thermal-printer';
import { activeConfig } from './config';
import PQueue from 'p-queue';
import io from 'socket.io-client';
import parser from 'socket.io-json-parser';
import iconvLite from 'iconv-lite';

const localPrinters = {};
const restDetails = {};

const getPrinterQ = ip => {
  if (!localPrinters[ip]) {
    localPrinters[ip] = new PQueue({ concurrency: 1 });
  }
  return localPrinters[ip];
}

const isAlphaNumeric = str => {
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if (!(code > 47 && code < 58) && // numeric (0-9)
        !(code > 64 && code < 91) && // upper alpha (A-Z)
        !(code > 96 && code < 123)) { // lower alpha (a-z)
      return false;
    }
  }
  return true;
};

const printChinese = (thermalPrinter, text) => {
  thermalPrinter.append(iconvLite.encode(text, 'Big5'));
}

const printlnChinese = (thermalPrinter, text) => {
  printChinese(thermalPrinter, text);
  thermalPrinter.append('\n');
}

const printDoubleSizedChineseNamePrice = (printer, name, price) => {
  printChinese(printer, name);
  // chinese characters are ~ 2x the width of alphanumeric
  let nameLength = isAlphaNumeric(name) ? name.toString().length : name.toString().length * 2
  const width = printer.getWidth() / 2 - nameLength - price.toString().length;
  for (let i = 0; i < width; i++) {
    printer.append(Buffer.from(' '));
  }
  printer.print(price);
  printer.newLine();
}

const printDoubleSizedLeftRight = (printer, left, right) => {
  printChinese(printer, left);
  const width = printer.getWidth() / 2 - left.toString().length - right.toString().length;
  for (let i = 0; i < width; i++) {
    printer.append(Buffer.from(' '));
  }
  printChinese(printer, right);
  printer.newLine();
}

const printDoubleSizedLine = thermalPrinter => {
  for (let i = 0; i < thermalPrinter.getWidth() / 2; i++) {
    thermalPrinter.print('-');
  }
  thermalPrinter.newLine();
}

const printHeader = (thermalPrinter, orderType, table, customerName) => {
  thermalPrinter.println(orderType);
  thermalPrinter.println(new Date().toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' }))
  thermalPrinter.println(`Table: ${table}`);
  thermalPrinter.println(`Customer: ${customerName}`);
}

const printGap = thermalPrinter => {
  thermalPrinter.newLine();
  thermalPrinter.newLine();
  thermalPrinter.newLine();
  thermalPrinter.newLine();
  thermalPrinter.newLine();
  thermalPrinter.newLine();
  thermalPrinter.newLine();
  thermalPrinter.newLine();
  thermalPrinter.newLine();
  thermalPrinter.newLine();
  thermalPrinter.newLine();
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

const printOrder = (ip, type, port, customerName, orderType, tableNumber, items) => {
  const thermalPrinter = new printer({
    interface: `tcp://${ip}:${port}`,
    type,
  });
  printGap(thermalPrinter);
  thermalPrinter.alignLeft();
  thermalPrinter.setTextNormal();
  printHeader(thermalPrinter, orderType, tableNumber, customerName);
  thermalPrinter.setTextSize(1,1);
  printDoubleSizedLine(thermalPrinter);
  items.forEach(({ name, selectedPrice, selectedOptions, quantity, specialRequests }) => {
    printlnChinese(thermalPrinter, `${quantity} ${name}`);
    if (selectedPrice.label || selectedOptions.length > 0) {
      thermalPrinter.setTextNormal();
      thermalPrinter.println(`Options:`);
      thermalPrinter.setTextSize(1,1);
    }

    if (selectedPrice.label) {
      thermalPrinter.println(`- ${selectedPrice.label}`);
    }

    if (selectedOptions.length > 0) {
      selectedOptions.forEach(({ name }) => thermalPrinter.println(`- ${name}`));
    }

    if (specialRequests) {
      thermalPrinter.setTextNormal();
      thermalPrinter.print(`Special requests:`);
      thermalPrinter.setTextDoubleHeight();
      thermalPrinter.setTextDoubleWidth();  
      thermalPrinter.print(specialRequests);
    }
    thermalPrinter.newLine();
  })

  thermalPrinter.beep(); 
  thermalPrinter.cut();
  return thermalPrinter.execute();
}

const printReceipt = (ip, type, port, customerName, orderType, tableNumber, items, { itemTotal, tax, tip, total }) => {
  const thermalPrinter = new printer({
    interface: `tcp://${ip}:${port}`,
    type,
  });
  printGap(thermalPrinter);
  thermalPrinter.alignLeft();
  thermalPrinter.setTextNormal();
  printHeader(thermalPrinter, orderType, tableNumber, customerName);
  thermalPrinter.setTextSize(1,1);
  printDoubleSizedLine(thermalPrinter);
  items.forEach(({ name, selectedPrice, selectedOptions, quantity, specialRequests }) => {
    printDoubleSizedChineseNamePrice(thermalPrinter, `${quantity} ${name}`, quantity*selectedPrice.value);
    if (selectedPrice.label) {
      thermalPrinter.println(`- ${selectedPrice.label}`);
    }
    selectedOptions.forEach(({ name }) => thermalPrinter.println(`- ${name}`));
    if (specialRequests) {
      thermalPrinter.newLine();
      thermalPrinter.setTextNormal();
      thermalPrinter.print(`Special requests:`);
      thermalPrinter.setTextDoubleHeight();
      thermalPrinter.setTextDoubleWidth();  
      thermalPrinter.print(specialRequests);
    }
  });
  thermalPrinter.newLine();
  printDoubleSizedLeftRight(thermalPrinter, 'Item total', itemTotal); 
  printDoubleSizedLeftRight(thermalPrinter, 'Tax', tax);
  printDoubleSizedLeftRight(thermalPrinter, 'Tip', tip);
  printDoubleSizedLine(thermalPrinter);
  printDoubleSizedLeftRight(thermalPrinter, 'Total', total);
  thermalPrinter.newLine();
  thermalPrinter.newLine();
  thermalPrinter.setTextNormal();
  thermalPrinter.alignCenter(); 
  thermalPrinter.println(restDetails.name);
  thermalPrinter.println(restDetails.address1);
  thermalPrinter.println(`${restDetails.city}, ${restDetails.state} ${restDetails.zip}`);
  thermalPrinter.println(restDetails.phone);
  thermalPrinter.cut();
  thermalPrinter.beep();
  return thermalPrinter.execute();
}

const printTickets = printRequest => {
  const customerName = printRequest.data.customerName;
  const tableNumber = printRequest.data.tableNumber;
  const orderType = printRequest.data.orderType;
  const targetPrinters = {};
  printRequest.data.items.forEach(({ printers, ...item }) => {
    printers.forEach(({ ip, type, port, itemName }) => {
      if (!targetPrinters[ip]) {
        targetPrinters[ip] = {
          type,
          port,
          items: []
        };
      }
      item.name = itemName;
      targetPrinters[ip].items.push(item);
    });
  });
  Object.entries(targetPrinters).forEach(([ip, ticket]) => {
    const q = getPrinterQ(ip);
    q.add(async () => {
      try {
        await printOrder(
          ip,
          ticket.type,
          ticket.port,
          customerName,
          orderType,
          tableNumber,
          ticket.items
        );
      } catch (e) {
        console.error(`failed to print ticket to ${ip}, ${e} ${e.stack}`);
      }
    });
  })
};

const printReceipts = printRequest => {
  const customerName = printRequest.data.customerName;
  const orderType = printRequest.data.orderType;
  const tableNumber = printRequest.data.tableNumber;
  printRequest.data.receiptPrinters.forEach(({ ip, type, port }) => {
    const q = getPrinterQ(ip);
    q.add(async () => {
      try {
        await printReceipt(ip, type, port, customerName, orderType, tableNumber, printRequest.data.items, printRequest.data.costs);
      } catch (e) {
        console.error(`failed to print receipt to ${ip}, ${e} ${e.stack}`);
      }
    });
  });
};

const saveDetails = details => {
  const { name, address, phone } = details.data;
  restDetails.name = name;
  restDetails.address1 = address.address1;
  restDetails.city = address.city;
  restDetails.state = address.state;
  restDetails.zip = address.zip;
  restDetails.phone = phone;
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

const handleRequest = json => {
  try {
    if (json.type === 'TICKETS') {
      printTickets(json);
    } else if (json.type === 'RECEIPTS') {
      printReceipts(json);
    } else if (json.type === 'REST_DETAILS') {
      saveDetails(json);
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

  socket.on('message', handleRequest);
}

registerReceiver();
