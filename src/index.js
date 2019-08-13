import http from 'http';
import { printer, types } from 'node-thermal-printer';
import { activeConfig } from './config';

const print = printRequest => {
  const customerName = printRequest.customer;
  // print items
  printRequest.data.items.forEach(({ name, selectedPrice, selectedOptions, quantity, specialRequests, printers }) => {
    printers.forEach(({ ip, type, port }) => {
      console.log('printing to', ip, type, port);
      console.log('item', { name, selectedPrice, selectedOptions, quantity, specialRequests })
      const thermalPrinter = new printer({
        interface: `tcp://${ip}:${port}`,
        type,
      });
      thermalPrinter.println(`Customer: ${customerName}`);
      thermalPrinter.newLine();
      thermalPrinter.println(`Name: ${name} (${quantity})`)
      thermalPrinter.newLine();
      thermalPrinter.println(`Options:`);

      if (selectedPrice.label) {
        thermalPrinter.println(selectedPrice.label);
        thermalPrinter.newLine();
      }

      if (selectedOptions) {
        selectedOptions.forEach(({ name }) => thermalPrinter.println(name));
        thermalPrinter.newLine();
      }

      if (specialRequests) thermalPrinter.println(`Special requests: ${specialRequests}`);
      
      thermalPrinter.cut();
      thermalPrinter.beep();   
      
      thermalPrinter.execute()
        .then(res => {
          console.log('print success:', res)
        })
        .catch(e => {
          console.error('print err:', e);
        });

    });
  });
};

const options = {
  agent: false,
  host: activeConfig.registration.host,
  defaultPort: activeConfig.registration.port,
  path: `/register-receiver?id=${activeConfig.receiver.id}`,
  headers: {
    connection: 'keep-alive',
    'content-type': 'application/json',
  }
};

const registerReceiver = () => {
  http.get(options, res => {
    res.setEncoding('utf8');
    res.on('data', data => {
      const response = JSON.parse(data);
      if (response.data) {
        print(response);
      } else {
        console.log(response.message);
      }
    });
    res.on('end', () => console.log(`Registration aborted`) )
  })
  .on('close', c => console.log('closed'))
  .on('error', e => console.log('error', e));

  console.log(`listening with config ${JSON.stringify(activeConfig)}`);
}

registerReceiver();

/**
 * 
 * 
 *   printOrder(signedInUser, cart, receiverId, receiptPrinters, itemTotal, tax, tip, total) {
    const registeredReceiver = this.getRegisteredReceiver(receiverId);
    registeredReceiver.write(JSON.stringify({
      printers: receiptPrinters,
      message: `Customer: ${signedInUser.email}`
      + cart.items.map(({ name, selectedPrice, selectedOptions, quantity, specialRequests }) => (
        '\n' + name + `(${quantity})${selectedPrice.label ? ' - ' +  selectedPrice.label : ''}` + ` ${selectedPrice.value}` 
      )),
    }));
  }

  printItems(signedInUser, rest, cart) {
    const registeredReceiver = this.getRegisteredReceiver(rest.receiver.receiverId);
    cart.items.forEach(({ name, categoryIndex, itemIndex, selectedPrice, selectedOptions, quantity, specialRequests }) => {
      const storedItem = rest.menu[categoryIndex].items[itemIndex];
      registeredReceiver.write(JSON.stringify({
        printers: storedItem.printers,
        data: {
          customer: signedInUser.email,
          item: {
            name,
            quantity,
            selectedPrice,
            selectedOptions,
            specialRequests,
          },
        },
      }));
    })
  }
 */