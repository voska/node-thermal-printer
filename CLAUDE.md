# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

This is a Node.js library for printing on thermal printers (Epson, Star, Tanca, Daruma, Brother, Custom, and Elgin) using ESC/POS commands. The library provides a unified API for different printer models with support for text formatting, barcodes, QR codes, images, and various printer-specific features.

## Development Commands

### Linting
```bash
npx eslint .
```

### Quick Testing
```bash
# Test printing with Node REPL (example for Elgin USB printer)
node -e "
const ThermalPrinter = require('./node-thermal-printer').printer;
const Types = require('./node-thermal-printer').types;
const printer = new ThermalPrinter({
  type: Types.ELGIN,
  interface: 'usb://20d1:7008',
  width: 48
});
printer.println('Test Print');
printer.cut();
printer.execute().then(console.log).catch(console.error);
"
```

### Running Examples
```bash
# Network printer example
node examples/network.js

# File/USB printer example  
node examples/file.js

# System printer example
node examples/printer.js
```

### Testing
No automated test framework is configured. Testing is done manually using example files or the Node REPL for quick tests.

## Architecture

### Core Structure
- **Entry Point**: `node-thermal-printer.js` exports `lib/core.js`
- **Main Class**: `ThermalPrinter` (lib/core.js) - Handles printer initialization, buffering, and command delegation
- **Base Class**: `PrinterType` (lib/types/printer-type.js) - Abstract base for all printer implementations
- **Printer Types**: Each printer brand has two files in `lib/types/`:
  - Implementation file (e.g., `epson.js`) - Extends PrinterType with printer-specific logic
  - Configuration file (e.g., `epson-config.js`) - Contains ESC/POS command mappings

### Interface Layer
The library supports four connection interfaces in `lib/interfaces/`:
- **Network**: TCP/IP connections to network printers (format: `tcp://hostname:port`)
- **File**: Direct writing to device files (e.g., `/dev/usb/lp0`, `COM1`)  
- **Printer**: System printer integration using external drivers (format: `printer:name`, requires 'printer' module)
- **USB**: Direct USB communication using libusb (format: `usb://vendorId:productId`, requires 'usb' package)

### Adding New Printer Types
1. Create implementation and config files in `lib/types/`
2. Extend the `PrinterType` base class
3. Define ESC/POS commands in the config file
4. Add the new type to the switch statement in `lib/core.js` constructor

### Key Design Patterns
- **Command Buffer**: All print commands are buffered until `execute()` is called
- **Method Chaining**: Most methods return `this` for fluent API usage
- **Async Operations**: Interface methods (`execute()`, `raw()`) return Promises
- **Character Encoding**: Uses iconv-lite for multi-language support with configurable code pages

## Important Implementation Notes

- The library uses CommonJS modules (not ES modules)
- No TypeScript in source, but includes type definitions in `node-thermal-printer.d.ts`
- Image processing uses pngjs for PNG files only
- Character normalization uses unorm for Unicode support
- File writing uses write-file-queue for sequential operations
- ESLint is configured with relatively permissive rules (see eslint.config.mjs)
- Maximum line length is 140 characters per ESLint config
- USB support requires the 'usb' npm package (added as devDependency)
- Most thermal printers use ESC/POS commands, so printer implementations often share similar code

## Common Printer USB IDs
- Elgin i9: `usb://20d1:7008`
- Check vendor/product IDs with `ioreg -p IOUSB -l | grep -i "printer\|vendor\|product"` on macOS