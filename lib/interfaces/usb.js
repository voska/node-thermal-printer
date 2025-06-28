const usb = require('usb');
const Interface = require('./interface');

class USB extends Interface {
  constructor (vendorId, productId) {
    super();
    this.vendorId = vendorId;
    this.productId = productId;
    this.device = null;
    this.interface = null;
    this.endpoint = null;
  }

  async isPrinterConnected () {
    try {
      this.device = usb.findByIds(this.vendorId, this.productId);
      return this.device !== undefined;
    } catch {
      return false;
    }
  }

  async execute (buffer) {
    return new Promise((resolve, reject) => {
      try {
        if (!this.device) {
          this.device = usb.findByIds(this.vendorId, this.productId);
          if (!this.device) {
            reject(new Error('USB device not found'));
            return;
          }
        }

        this.device.open();
        this.interface = this.device.interface(0);
        
        // Check if kernel driver is attached and detach if necessary
        if (this.interface.isKernelDriverActive()) {
          this.interface.detachKernelDriver();
        }
        
        this.interface.claim();
        
        // Find the OUT endpoint
        this.endpoint = this.interface.endpoints.find(ep => ep.direction === 'out');
        if (!this.endpoint) {
          throw new Error("No OUT endpoint found");
        }
        
        // Send data to printer
        this.endpoint.transfer(buffer, (error) => {
          // Clean up
          try {
            this.interface.release();
            this.device.close();
          } catch {
            // Ignore cleanup errors
          }
          
          if (error) {
            reject(error);
          } else {
            resolve('Print job completed');
          }
        });
        
      } catch (error) {
        // Clean up on error
        try {
          if (this.interface) this.interface.release();
          if (this.device) this.device.close();
        } catch {
          // Ignore cleanup errors
        }
        reject(error);
      }
    });
  }
}

module.exports = USB;