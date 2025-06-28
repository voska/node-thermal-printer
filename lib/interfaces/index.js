function getInterface (uri, options, driver) {
  const networkRegex = /^tcp:\/\/([^/:]+)(?::(\d+))?\/?$/i;
  const printerRegex = /^printer:([^/]+)(?:\/([\w-]*))?$/i;
  const usbRegex = /^usb:\/\/([0-9a-fA-F]+):([0-9a-fA-F]+)\/?$/i;

  const net = networkRegex.exec(uri);
  const printer = printerRegex.exec(uri);
  const usb = usbRegex.exec(uri);

  if (typeof uri === 'object') {
    return uri;
  } if (net) {
    const Network = require('./network');
    return new Network(net[1], net[2], options);
  } if (printer) {
    const Printer = require('./printer');
    return new Printer(printer[1], driver);
  } if (usb) {
    const USB = require('./usb');
    return new USB(parseInt(usb[1], 16), parseInt(usb[2], 16));
  }
  const File = require('./file');
  return new File(uri);
}

module.exports = getInterface;
