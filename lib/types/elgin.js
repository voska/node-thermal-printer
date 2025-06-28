const PrinterType = require('./printer-type');

// Elgin Bematech i9 ESC/POS Printer Type
// Vendor ID: 0x20d1, Product ID: 0x7008
// Based on Epson, but allows for Elgin-specific overrides in the future.

class Elgin extends PrinterType {
  constructor () {
    super();
    this.config = require('./elgin-config');
  }

  // ------------------------------ Append ------------------------------
  append (appendBuffer) {
    if (this.buffer) {
      this.buffer = Buffer.concat([this.buffer, appendBuffer]);
    } else {
      this.buffer = appendBuffer;
    }
  }

  // ------------------------------ QR ------------------------------
  printQR (str, settings) {
    this.buffer = null;
    settings = {
      model: 2,
      cellSize: 3,
      correction: 'M',
      ...settings
    };

    // [Name] Select the QR code model
    // [Code] 1D 28 6B 04 00 31 41 n1 n2
    // n1
    // [49 x31, model 1]
    // [50 x32, model 2]
    // [51 x33, micro qr code]
    // n2 = 0
    // ESC/POS standard QR code model selection
    if (settings.model === 1) this.append(this.config.QRCODE_MODEL1);
    else if (settings.model === 3) this.append(this.config.QRCODE_MODEL3);
    else this.append(this.config.QRCODE_MODEL2);

    // [Name]: Set the size of module
    // 1D 28 6B 03 00 31 43 n
    // n depends on the printer
    // ESC/POS standard QR code cell size setting
    const size = 'QRCODE_CELLSIZE_'.concat(settings.cellSize.toString());
    this.append(this.config[size]);

    // [Name] Select the error correction level
    // 1D 28 6B 03 00 31 45 n
    // n
    // [48 x30 -> 7%]
    // [49 x31-> 15%]
    // [50 x32 -> 25%]
    // [51 x33 -> 30%]
    // ESC/POS standard QR code error correction levels
    const correction = 'QRCODE_CORRECTION_'.concat(settings.correction.toUpperCase());
    this.append(this.config[correction]);

    // [Name] Store the data in the symbol storage area
    // 1D 28  6B pL pH 31 50 30 d1...dk
    // ESC/POS standard QR code data storage
    const s = str.length + 3;
    const lsb = parseInt(s % 256);
    const msb = parseInt(s / 256);
    this.append(Buffer.from([0x1d, 0x28, 0x6b, lsb, msb, 0x31, 0x50, 0x30]));
    this.append(Buffer.from(str));

    // [Name] Print the symbol data in the symbol storage area
    // 1D 28 6B 03 00 31 51 m
    // ESC/POS standard QR code print command
    this.append(this.config.QRCODE_PRINT);

    return this.buffer;
  }

  // ------------------------------ BARCODE ------------------------------
  printBarcode (data, type, settings) {
    this.buffer = null;
    settings = {
      hriPos: 0,
      hriFont: 0,
      width: 3,
      height: 162,
      ...settings
    };

    // Set HRI characters Position, 0-3 (none, top, bottom, top/bottom)
    this.append(Buffer.from([0x1d, 0x48])); // GS H
    this.append(Buffer.from([settings.hriPos]));

    // Set HRI character font. 0-4, 48-52, 97, 98 (depending on printer, 0 and 1 available on all), default 0
    this.append(Buffer.from([0x1d, 0x66])); // GS f
    this.append(Buffer.from([settings.hriFont]));

    // Set width 2-6, default 3
    this.append(Buffer.from([0x1d, 0x77])); // GS W
    this.append(Buffer.from([settings.width]));

    // Set height 1 - 255 default 162
    this.append(Buffer.from([0x1d, 0x68])); // GS h
    this.append(Buffer.from([settings.height]));

    // Print Barcode
    this.append(Buffer.from([0x1d, 0x6b])); // GS k

    // Select type and bit length of data
    if (type == 73) {
      this.append(Buffer.from([type, data.length + 2]));
      this.append(Buffer.from([0x7b, 0x42]));
    } else {
      this.append(Buffer.from([type, data.length]));
    }

    // Data
    this.append(Buffer.from(data));

    return this.buffer;
  }

  // ----------------------------------------------------- PRINT IMAGE -----------------------------------------------------
  // ESC/POS standard raster image printing
  async printImage (image) {
    const fs = require('fs');
    const { PNG } = require('pngjs');
    try {
      const data = fs.readFileSync(image);
      const png = PNG.sync.read(data);
      const buff = this.printImageBuffer(png.width, png.height, png.data);
      return buff;
    } catch (error) {
      throw error;
    }
  }

  printImageBuffer (width, height, data) {
    this.buffer = null;

    // Get pixel rgba in 2D array
    const pixels = [];
    for (let i = 0; i < height; i++) {
      const line = [];
      for (let j = 0; j < width; j++) {
        const idx = (width * i + j) << 2;
        line.push({
          r: data[idx],
          g: data[idx + 1],
          b: data[idx + 2],
          a: data[idx + 3],
        });
      }
      pixels.push(line);
    }

    const imageBufferArray = [];
    for (let i = 0; i < height; i++) {
      for (let j = 0; j < Math.ceil(width / 8); j++) {
        let byte = 0x0;
        for (let k = 0; k < 8; k++) {
          let pixel = pixels[i][j * 8 + k];

          // Image overflow
          if (pixel === undefined) {
            pixel = {
              a: 0,
              r: 0,
              g: 0,
              b: 0,
            };
          }

          if (pixel.a > 126) { // checking transparency
            const grayscale = parseInt(0.2126 * pixel.r + 0.7152 * pixel.g + 0.0722 * pixel.b);

            if (grayscale < 128) { // checking color
              const mask = 1 << 7 - k; // setting bitwise mask
              byte |= mask; // setting the correct bit to 1
            }
          }
        }

        imageBufferArray.push(byte);
        // imageBuffer = Buffer.concat([imageBuffer, Buffer.from([byte])]);
      }
    }

    const imageBuffer = Buffer.from(imageBufferArray);

    // Print raster bit image
    // GS v 0
    // 1D 76 30 m xL xH yL yH d1...dk
    // xL = (this.width >> 3) & 0xff;
    // xH = 0x00;
    // yL = this.height & 0xff;
    // yH = (this.height >> 8) & 0xff;
    // ESC/POS standard raster bit image format

    // Check if width/8 is decimal
    if (width % 8 != 0) {
      width += 8;
    }

    this.append(Buffer.from([0x1d, 0x76, 0x30, 48]));
    this.append(Buffer.from([(width >> 3) & 0xff]));
    this.append(Buffer.from([0x00]));
    this.append(Buffer.from([height & 0xff]));
    this.append(Buffer.from([(height >> 8) & 0xff]));

    // append data
    this.append(imageBuffer);

    return this.buffer;
  }
}

module.exports = Elgin; 
