# RealFirmware HWNP Editor

Windows application to parse, edit, and repackage Huawei HWNP firmware binaries.

## Features

- **Product ID Editor**: Add, remove, and reorder hardware product IDs
- **UpgradeCheck.xml**: Toggle hardware check flags (HardVer, Product, LswChip, etc.)
- **Shell Script Editor**: Edit embedded `.sh` scripts with syntax highlighting
- **Flag Editor**: Modify binary flags (ProductLineMode, TelnetEnable, etc.)
- **Hex Viewer**: Inspect binary sections
- **Automatic Fixes on Save**:
  - Zeros signinfo header to bypass signature verification
  - Updates SHA-256 hashes in signinfo entries
  - Recalculates HeadCRC = CRC32(file[0x0C:EOF])

## HWNP Format

```
Offset  Field           Encoding
0x00    Magic           "HWNP" (4 bytes)
0x04    Payload Size    Big-endian uint32
0x08    HeadCRC         Little-endian uint32 = CRC32(file[0x0C:EOF])
0x0C    HeadLen         Little-endian uint32
0x14    Item Count      Little-endian uint32 (low byte)
0x24    Product IDs     Null-terminated ASCII, pipe-separated
0x128   Section Descs   360 bytes each × itemNum
```

## Build (.exe)

Requires Python 3.8+ with tkinter (included in standard Python for Windows).

```batch
pip install pyinstaller
pyinstaller --onefile --windowed --name "RealFirmware-HWNP-Editor" firmware_editor.py
```

Or simply run `build.bat`.

The resulting `.exe` is in the `dist/` folder.

## Run from source

```bash
python firmware_editor.py
```

No external dependencies required — uses only Python standard library (tkinter, struct, binascii, hashlib, re).
