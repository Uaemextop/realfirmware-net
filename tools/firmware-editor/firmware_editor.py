#!/usr/bin/env python3
"""
RealFirmware HWNP Editor — Windows GUI Application
Parse, edit, and repackage Huawei HWNP firmware binaries with automatic CRC correction.

HWNP Structure (reverse-engineered from libhw_swm_dll.so via Capstone):
  0x00-0x03: "HWNP" magic
  0x04-0x07: payload size (big-endian)
  0x08-0x0B: HeadCRC = CRC32(file[0x0C:EOF]) stored little-endian
  0x0C-0x0F: headLen (LE)
  0x10-0x13: fileCRC (LE)
  0x14-0x17: itemNum (LE, low byte)
  0x18-0x1B: version
  0x1C-0x1F: itemDescSize (LE, typically 360)
  0x20-0x23: reserved
  0x24-0x127: product ID list (null-terminated ASCII)
  0x128+:     section descriptors (360 bytes each)
"""

import tkinter as tk
from tkinter import ttk, filedialog, messagebox, scrolledtext
import struct
import binascii
import hashlib
import os
import re
import sys

# ── Constants ──
HWNP_MAGIC = b"HWNP"
SECT_DESC_START = 0x128
SECT_DESC_SIZE = 360
PID_OFFSET = 0x24
PID_MAX_LEN = SECT_DESC_START - PID_OFFSET  # 260 bytes

APP_TITLE = "RealFirmware HWNP Editor"
APP_VERSION = "1.0.0"


# ══════════════════════════════════════════════════════════════
# CRC32 (standard polynomial 0xEDB88320)
# ══════════════════════════════════════════════════════════════
def crc32(data: bytes) -> int:
    """Compute CRC32 using standard polynomial (same as zlib/binascii)."""
    return binascii.crc32(data) & 0xFFFFFFFF


# ══════════════════════════════════════════════════════════════
# HWNP Parser
# ══════════════════════════════════════════════════════════════
class HWNPSection:
    """Represents one section inside an HWNP firmware file."""

    def __init__(self, index, item_crc, stored_offset, data_offset, data_size,
                 path, label, data, content_type, text_content, desc_raw):
        self.index = index
        self.item_crc = item_crc
        self.stored_offset = stored_offset
        self.data_offset = data_offset
        self.data_size = data_size
        self.path = path
        self.file_name = path.replace("file:", "")
        self.label = label
        self.data = data            # bytes
        self.content_type = content_type  # 'xml', 'shell', 'flag', 'text', 'binary'
        self.text_content = text_content  # decoded string or None
        self.desc_raw = desc_raw    # raw 360-byte descriptor


class HWNPFirmware:
    """Parsed HWNP firmware file."""

    def __init__(self, file_path):
        self.file_path = file_path
        self.file_name = os.path.basename(file_path)
        with open(file_path, "rb") as f:
            self.raw = bytearray(f.read())
        self._parse()

    def _parse(self):
        data = self.raw
        if data[:4] != HWNP_MAGIC:
            raise ValueError("Not a valid HWNP file (missing 'HWNP' magic)")

        self.payload_size = struct.unpack(">I", data[0x04:0x08])[0]
        self.head_crc = struct.unpack("<I", data[0x08:0x0C])[0]
        self.head_len = struct.unpack("<I", data[0x0C:0x10])[0]
        self.file_crc = struct.unpack("<I", data[0x10:0x14])[0]
        self.item_num = struct.unpack("<I", data[0x14:0x18])[0] & 0xFF
        self.version = struct.unpack("<I", data[0x18:0x1C])[0]
        self.item_desc_size = struct.unpack("<I", data[0x1C:0x20])[0]

        # Product IDs
        pid_end = data.index(0, PID_OFFSET) if 0 in data[PID_OFFSET:PID_OFFSET + PID_MAX_LEN] else PID_OFFSET + PID_MAX_LEN
        pid_str = data[PID_OFFSET:pid_end].decode("ascii", errors="replace")
        self.product_ids = [s for s in pid_str.split("|") if s]

        # Verify CRC
        self.computed_crc = crc32(bytes(data[0x0C:]))
        self.crc_valid = self.computed_crc == self.head_crc

        # Parse sections
        self.sections = []
        data_offset = SECT_DESC_START + self.item_num * SECT_DESC_SIZE

        for i in range(self.item_num):
            desc_off = SECT_DESC_START + i * SECT_DESC_SIZE
            desc_raw = bytes(data[desc_off:desc_off + SECT_DESC_SIZE])

            item_crc = struct.unpack("<I", data[desc_off:desc_off + 4])[0]
            stored_offset = struct.unpack("<I", data[desc_off + 4:desc_off + 8])[0]
            data_size = struct.unpack("<I", data[desc_off + 8:desc_off + 12])[0]

            # Path
            path_bytes = data[desc_off + 12:desc_off + 12 + 256]
            path_end = path_bytes.index(0) if 0 in path_bytes else 256
            path = path_bytes[:path_end].decode("ascii", errors="replace")

            # Label
            label_bytes = data[desc_off + 268:desc_off + 268 + 92]
            label_end = label_bytes.index(0) if 0 in label_bytes else 92
            label = label_bytes[:label_end].decode("ascii", errors="replace")

            # Section data
            sect_data = bytes(data[data_offset:data_offset + data_size])

            # Determine content type
            file_name = path.replace("file:", "")
            content_type = "binary"
            text_content = None

            if file_name.endswith(".sh"):
                content_type = "shell"
                try:
                    text_content = sect_data.decode("utf-8")
                except UnicodeDecodeError:
                    content_type = "binary"
            elif file_name.endswith(".xml"):
                content_type = "xml"
                try:
                    text_content = sect_data.decode("utf-8")
                except UnicodeDecodeError:
                    content_type = "binary"
            elif data_size <= 4:
                content_type = "flag"
                text_content = " ".join(f"0x{b:02X}" for b in sect_data)
            else:
                is_text = all(b == 0 or (0x09 <= b <= 0x0D) or (0x20 <= b <= 0x7E) for b in sect_data)
                if is_text and data_size < 65536:
                    content_type = "text"
                    try:
                        text_content = sect_data.decode("utf-8")
                    except UnicodeDecodeError:
                        pass

            self.sections.append(HWNPSection(
                index=i, item_crc=item_crc, stored_offset=stored_offset,
                data_offset=data_offset, data_size=data_size, path=path,
                label=label, data=sect_data, content_type=content_type,
                text_content=text_content, desc_raw=desc_raw
            ))

            data_offset += data_size
            if data_offset % 4 != 0:
                data_offset += 4 - (data_offset % 4)

    def set_product_ids(self, ids):
        """Update product IDs in the raw buffer."""
        pid_str = "|".join(ids) + "|"
        pid_bytes = pid_str.encode("ascii")
        if len(pid_bytes) > PID_MAX_LEN:
            raise ValueError(f"Product ID string too long ({len(pid_bytes)} > {PID_MAX_LEN})")
        self.raw[PID_OFFSET:PID_OFFSET + PID_MAX_LEN] = b"\x00" * PID_MAX_LEN
        self.raw[PID_OFFSET:PID_OFFSET + len(pid_bytes)] = pid_bytes
        self.product_ids = list(ids)

    def set_section_data(self, idx, new_data: bytes):
        """Replace section data (same size only for in-place edit)."""
        section = self.sections[idx]
        if len(new_data) != section.data_size:
            # Pad or truncate if needed (prefer same size)
            if len(new_data) < section.data_size:
                new_data = new_data + b"\x00" * (section.data_size - len(new_data))
            else:
                raise ValueError(
                    f"New data too large ({len(new_data)} > {section.data_size}). "
                    "In-place editing requires same size."
                )
        self.raw[section.data_offset:section.data_offset + section.data_size] = new_data
        section.data = new_data
        if section.content_type in ("xml", "shell", "text"):
            try:
                section.text_content = new_data.decode("utf-8")
            except UnicodeDecodeError:
                pass

    def fix_signinfo(self):
        """Zero signinfo header and update section hashes.

        The signinfo section contains SHA-256 hashes of other sections and
        a header string (e.g. "500R020C00SPC270B520 | SIGNINFO").
        If the header is non-zero, the router verifies every hash.
        Zeroing the first 60 bytes disables signature checking
        (same approach used by the working v2.bin / signinfo_v5 format).
        We also update the hash entries as a belt-and-suspenders measure.
        """
        for section in self.sections:
            if "signinfo" not in section.path:
                continue

            sig_off = section.data_offset
            sig_size = section.data_size

            # Zero the header (first 60 bytes) → bypass signature check
            self.raw[sig_off:sig_off + 60] = b"\x00" * 60

            # Update hash entries for modified sections
            sig_text = self.raw[sig_off:sig_off + sig_size].decode("ascii", errors="replace")
            for m in re.finditer(r"([0-9a-f]{64})\s+(/[^\n]+)", sig_text):
                file_path = m.group(2).strip()
                for sec in self.sections:
                    dest = sec.path.replace("file:", "")
                    if dest == file_path:
                        new_hash = hashlib.sha256(
                            bytes(self.raw[sec.data_offset:sec.data_offset + sec.data_size])
                        ).hexdigest()
                        start = sig_off + m.start(1)
                        self.raw[start:start + 64] = new_hash.encode("ascii")
                        break

            section.data = bytes(self.raw[sig_off:sig_off + sig_size])
            break

    def recalculate_crc(self):
        """Recalculate and update HeadCRC."""
        new_crc = crc32(bytes(self.raw[0x0C:]))
        struct.pack_into("<I", self.raw, 0x08, new_crc)
        self.head_crc = new_crc
        self.computed_crc = new_crc
        self.crc_valid = True

    def save(self, output_path):
        """Save the modified firmware to a file."""
        self.fix_signinfo()
        self.recalculate_crc()
        with open(output_path, "wb") as f:
            f.write(self.raw)


# ══════════════════════════════════════════════════════════════
# XML Helpers
# ══════════════════════════════════════════════════════════════
def parse_upgrade_checks(xml_str):
    """Parse UpgradeCheck.xml and extract check entries."""
    checks = []
    for m in re.finditer(r'<(\w+)\s+CheckEnable="([01])"\s*/?\s*>', xml_str):
        checks.append({"name": m.group(1), "enabled": m.group(2) == "1"})
    return checks


def modify_upgrade_checks(xml_str, changes):
    """Modify CheckEnable flags in UpgradeCheck.xml."""
    result = xml_str
    for name, enabled in changes.items():
        val = "1" if enabled else "0"
        result = re.sub(
            rf'(<{name}\s+CheckEnable=")([01])("\s*/?>)',
            rf"\g<1>{val}\g<3>",
            result,
        )
    return result


# ══════════════════════════════════════════════════════════════
# Hex Dump
# ══════════════════════════════════════════════════════════════
def hex_dump(data, max_bytes=512):
    lines = []
    length = min(len(data), max_bytes)
    for i in range(0, length, 16):
        chunk = data[i:min(i + 16, length)]
        addr = f"{i:08X}"
        hex_part = " ".join(f"{b:02X}" for b in chunk)
        ascii_part = "".join(chr(b) if 0x20 <= b < 0x7F else "." for b in chunk)
        lines.append(f"{addr}  {hex_part:<48s}  {ascii_part}")
    if len(data) > max_bytes:
        lines.append(f"... ({len(data) - max_bytes} more bytes)")
    return "\n".join(lines)


def fmt_bytes(n):
    if n == 0:
        return "0 B"
    for unit in ["B", "KB", "MB", "GB"]:
        if n < 1024:
            return f"{n:.1f} {unit}" if n != int(n) else f"{int(n)} {unit}"
        n /= 1024
    return f"{n:.1f} TB"


# ══════════════════════════════════════════════════════════════
# GUI Application
# ══════════════════════════════════════════════════════════════
class FirmwareEditorApp(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title(f"{APP_TITLE} v{APP_VERSION}")
        self.geometry("960x700")
        self.minsize(800, 550)

        # App icon (embedded)
        try:
            self.iconbitmap(default="")
        except Exception:
            pass

        self.firmware = None
        self.modified = False

        self._build_ui()

        # Dark theme colors
        self.style = ttk.Style()
        self._apply_theme()

    # ── Theme ──
    def _apply_theme(self):
        bg = "#1e1e2e"
        fg = "#cdd6f4"
        accent = "#89b4fa"
        surface = "#313244"
        border = "#45475a"
        green = "#a6e3a1"
        red = "#f38ba8"
        yellow = "#f9e2af"

        self.configure(bg=bg)
        self.option_add("*Background", bg)
        self.option_add("*Foreground", fg)
        self.option_add("*selectBackground", accent)
        self.option_add("*selectForeground", "#1e1e2e")

        self.style.theme_use("clam")

        self.style.configure(".", background=bg, foreground=fg, fieldbackground=surface,
                             bordercolor=border, insertcolor=fg)
        self.style.configure("TFrame", background=bg)
        self.style.configure("TLabel", background=bg, foreground=fg)
        self.style.configure("TLabelframe", background=bg, foreground=fg)
        self.style.configure("TLabelframe.Label", background=bg, foreground=accent)
        self.style.configure("TButton", background=surface, foreground=fg, bordercolor=border, padding=(10, 5))
        self.style.map("TButton", background=[("active", "#45475a")])
        self.style.configure("Accent.TButton", background="#89b4fa", foreground="#1e1e2e")
        self.style.map("Accent.TButton", background=[("active", "#74c7ec")])
        self.style.configure("TNotebook", background=bg, bordercolor=border)
        self.style.configure("TNotebook.Tab", background=surface, foreground=fg, padding=(12, 6))
        self.style.map("TNotebook.Tab", background=[("selected", bg)], foreground=[("selected", accent)])
        self.style.configure("TEntry", fieldbackground=surface, foreground=fg, insertcolor=fg)
        self.style.configure("TCheckbutton", background=bg, foreground=fg)
        self.style.map("TCheckbutton", background=[("active", bg)])
        self.style.configure("Treeview", background=surface, foreground=fg, fieldbackground=surface,
                             bordercolor=border)
        self.style.configure("Treeview.Heading", background=border, foreground=fg)
        self.style.map("Treeview", background=[("selected", accent)], foreground=[("selected", "#1e1e2e")])

        self.style.configure("Valid.TLabel", foreground=green)
        self.style.configure("Invalid.TLabel", foreground=red)
        self.style.configure("Warning.TLabel", foreground=yellow)
        self.style.configure("Accent.TLabel", foreground=accent)

        self._colors = {
            "bg": bg, "fg": fg, "accent": accent, "surface": surface,
            "border": border, "green": green, "red": red, "yellow": yellow
        }

    # ── Build UI ──
    def _build_ui(self):
        # Menu bar
        menubar = tk.Menu(self, bg="#313244", fg="#cdd6f4", activebackground="#89b4fa",
                          activeforeground="#1e1e2e", tearoff=0)
        file_menu = tk.Menu(menubar, tearoff=0, bg="#313244", fg="#cdd6f4",
                            activebackground="#89b4fa", activeforeground="#1e1e2e")
        file_menu.add_command(label="Open Firmware…", command=self.open_file, accelerator="Ctrl+O")
        file_menu.add_command(label="Save As…", command=self.save_file, accelerator="Ctrl+S")
        file_menu.add_separator()
        file_menu.add_command(label="Exit", command=self.quit)
        menubar.add_cascade(label="File", menu=file_menu)

        help_menu = tk.Menu(menubar, tearoff=0, bg="#313244", fg="#cdd6f4",
                            activebackground="#89b4fa", activeforeground="#1e1e2e")
        help_menu.add_command(label="About", command=self.show_about)
        menubar.add_cascade(label="Help", menu=help_menu)
        self.config(menu=menubar)

        # Keyboard shortcuts
        self.bind("<Control-o>", lambda e: self.open_file())
        self.bind("<Control-s>", lambda e: self.save_file())

        # Top toolbar
        toolbar = ttk.Frame(self)
        toolbar.pack(fill=tk.X, padx=8, pady=(8, 4))

        ttk.Button(toolbar, text="📂 Open", command=self.open_file).pack(side=tk.LEFT, padx=(0, 4))
        self.btn_save = ttk.Button(toolbar, text="💾 Save As…", command=self.save_file, state=tk.DISABLED)
        self.btn_save.pack(side=tk.LEFT, padx=4)
        self.btn_repack = ttk.Button(toolbar, text="🔧 Repackage & Save", command=self.repackage_save,
                                     style="Accent.TButton", state=tk.DISABLED)
        self.btn_repack.pack(side=tk.LEFT, padx=4)

        self.lbl_mod = ttk.Label(toolbar, text="", style="Warning.TLabel")
        self.lbl_mod.pack(side=tk.LEFT, padx=12)

        # File info bar
        self.info_frame = ttk.Frame(self)
        self.info_frame.pack(fill=tk.X, padx=8, pady=4)

        self.lbl_file = ttk.Label(self.info_frame, text="No file loaded", style="Accent.TLabel",
                                  font=("Segoe UI", 10, "bold"))
        self.lbl_file.pack(side=tk.LEFT, padx=(0, 16))
        self.lbl_size = ttk.Label(self.info_frame, text="")
        self.lbl_size.pack(side=tk.LEFT, padx=(0, 16))
        self.lbl_sections = ttk.Label(self.info_frame, text="")
        self.lbl_sections.pack(side=tk.LEFT, padx=(0, 16))
        self.lbl_crc = ttk.Label(self.info_frame, text="")
        self.lbl_crc.pack(side=tk.LEFT, padx=(0, 8))
        self.lbl_crc_val = ttk.Label(self.info_frame, text="", font=("Consolas", 9))
        self.lbl_crc_val.pack(side=tk.LEFT)

        # Notebook (tabs)
        self.notebook = ttk.Notebook(self)
        self.notebook.pack(fill=tk.BOTH, expand=True, padx=8, pady=(4, 8))

        # Welcome tab (shown before loading)
        self.tab_welcome = ttk.Frame(self.notebook)
        self.notebook.add(self.tab_welcome, text="  Welcome  ")
        self._build_welcome_tab()

        # Status bar
        status_frame = ttk.Frame(self)
        status_frame.pack(fill=tk.X, side=tk.BOTTOM)
        self.status_var = tk.StringVar(value="Ready — Drop or open a .bin firmware file")
        ttk.Label(status_frame, textvariable=self.status_var, font=("Segoe UI", 9)).pack(
            side=tk.LEFT, padx=8, pady=4)

    def _build_welcome_tab(self):
        frame = self.tab_welcome
        center = ttk.Frame(frame)
        center.place(relx=0.5, rely=0.4, anchor=tk.CENTER)

        ttk.Label(center, text="🔧", font=("Segoe UI", 48)).pack()
        ttk.Label(center, text="RealFirmware HWNP Editor", font=("Segoe UI", 16, "bold"),
                  style="Accent.TLabel").pack(pady=(8, 4))
        ttk.Label(center, text="Parse, edit, and repackage Huawei HWNP firmware binaries",
                  font=("Segoe UI", 10)).pack(pady=(0, 16))
        ttk.Button(center, text="📂  Open Firmware File…", command=self.open_file,
                   style="Accent.TButton").pack(pady=8, ipadx=16, ipady=4)
        ttk.Label(center, text="Supported: .bin files with HWNP header",
                  font=("Segoe UI", 9)).pack(pady=(4, 0))

        features = [
            "• Edit Product IDs (add, remove, reorder)",
            "• Toggle hardware check flags (UpgradeCheck.xml)",
            "• Edit embedded shell scripts (.sh)",
            "• View hex dump of binary sections",
            "• Automatic CRC32 recalculation on save",
        ]
        feat_frame = ttk.Frame(center)
        feat_frame.pack(pady=(16, 0))
        for f in features:
            ttk.Label(feat_frame, text=f, font=("Segoe UI", 9)).pack(anchor=tk.W, pady=1)

    # ── File Operations ──
    def open_file(self):
        path = filedialog.askopenfilename(
            title="Open HWNP Firmware",
            filetypes=[("Firmware files", "*.bin"), ("All files", "*.*")]
        )
        if not path:
            return

        try:
            self.firmware = HWNPFirmware(path)
            self.modified = False
            self._load_firmware_ui()
            self.status_var.set(f"Loaded: {self.firmware.file_name}")
        except Exception as e:
            messagebox.showerror("Error", f"Failed to parse firmware:\n{e}")

    def save_file(self):
        if not self.firmware:
            return
        self._apply_all_changes()
        base = self.firmware.file_name.replace(".bin", "-modified.bin")
        path = filedialog.asksaveasfilename(
            title="Save Modified Firmware",
            initialfile=base,
            filetypes=[("Firmware files", "*.bin"), ("All files", "*.*")],
            defaultextension=".bin"
        )
        if not path:
            return

        try:
            self.firmware.save(path)
            crc_hex = f"0x{self.firmware.head_crc:08X}"
            self.status_var.set(f"Saved: {os.path.basename(path)} — CRC: {crc_hex}")
            self._update_crc_display()
            messagebox.showinfo("Success",
                                f"Firmware saved successfully!\n\n"
                                f"File: {os.path.basename(path)}\n"
                                f"Size: {fmt_bytes(len(self.firmware.raw))}\n"
                                f"HeadCRC: {crc_hex}")
        except Exception as e:
            messagebox.showerror("Error", f"Failed to save:\n{e}")

    def repackage_save(self):
        self.save_file()

    # ── Load Firmware into UI ──
    def _load_firmware_ui(self):
        fw = self.firmware

        # Update info bar
        self.lbl_file.config(text=fw.file_name)
        self.lbl_size.config(text=f"Size: {fmt_bytes(len(fw.raw))}")
        self.lbl_sections.config(text=f"Sections: {fw.item_num}")
        self._update_crc_display()

        # Enable buttons
        self.btn_save.config(state=tk.NORMAL)
        self.btn_repack.config(state=tk.NORMAL)

        # Clear old tabs
        for tab_id in self.notebook.tabs():
            self.notebook.forget(tab_id)

        # Product IDs tab
        self.tab_pids = ttk.Frame(self.notebook)
        self.notebook.add(self.tab_pids, text="  🏷️ Product IDs  ")
        self._build_pid_tab()

        # Section tabs
        for section in fw.sections:
            tab = ttk.Frame(self.notebook)
            icon = self._section_icon(section)
            name = os.path.basename(section.file_name)
            self.notebook.add(tab, text=f"  {icon} {name}  ")
            self._build_section_tab(tab, section)

        # Hex overview tab
        self.tab_hex = ttk.Frame(self.notebook)
        self.notebook.add(self.tab_hex, text="  🔍 Header Hex  ")
        self._build_hex_tab()

    def _update_crc_display(self):
        fw = self.firmware
        if fw.crc_valid:
            self.lbl_crc.config(text="CRC: ✓ Valid", style="Valid.TLabel")
        else:
            self.lbl_crc.config(text="CRC: ✗ Invalid", style="Invalid.TLabel")
        self.lbl_crc_val.config(text=f"0x{fw.head_crc:08X}")

    def _mark_modified(self, *_args):
        self.modified = True
        self.lbl_mod.config(text="● Modified — save to apply changes")

    # ── Product IDs Tab ──
    def _build_pid_tab(self):
        frame = self.tab_pids
        for w in frame.winfo_children():
            w.destroy()

        ttk.Label(frame, text="Product ID List", font=("Segoe UI", 11, "bold"),
                  style="Accent.TLabel").pack(anchor=tk.W, padx=12, pady=(12, 4))
        ttk.Label(frame, text="Each ID matches a hardware variant. The router checks if its own ID is in this list.",
                  font=("Segoe UI", 9)).pack(anchor=tk.W, padx=12, pady=(0, 8))

        # PID list frame
        self.pid_list_frame = ttk.Frame(frame)
        self.pid_list_frame.pack(fill=tk.X, padx=12, pady=4)
        self._render_pid_entries()

        # Buttons
        btn_frame = ttk.Frame(frame)
        btn_frame.pack(anchor=tk.W, padx=12, pady=8)
        ttk.Button(btn_frame, text="+ Add ID", command=self._add_pid).pack(side=tk.LEFT, padx=(0, 8))
        ttk.Button(btn_frame, text="Reset to Original", command=self._reset_pids).pack(side=tk.LEFT)

        # Product string preview
        ttk.Label(frame, text="Resulting string in firmware:", font=("Segoe UI", 9)).pack(
            anchor=tk.W, padx=12, pady=(16, 2))
        self.pid_preview_var = tk.StringVar()
        ttk.Label(frame, textvariable=self.pid_preview_var, font=("Consolas", 10),
                  style="Accent.TLabel", wraplength=800).pack(anchor=tk.W, padx=12)
        self._update_pid_preview()

    def _render_pid_entries(self):
        for w in self.pid_list_frame.winfo_children():
            w.destroy()

        self.pid_vars = []
        for i, pid in enumerate(self.firmware.product_ids):
            row = ttk.Frame(self.pid_list_frame)
            row.pack(fill=tk.X, pady=2)

            ttk.Label(row, text=f"#{i+1}", width=4, font=("Consolas", 9)).pack(side=tk.LEFT, padx=(0, 4))

            var = tk.StringVar(value=pid)
            var.trace_add("write", self._on_pid_change)
            entry = ttk.Entry(row, textvariable=var, font=("Consolas", 11), width=24)
            entry.pack(side=tk.LEFT, padx=4)
            self.pid_vars.append(var)

            ttk.Button(row, text="▲", width=3, command=lambda idx=i: self._move_pid(idx, -1)).pack(side=tk.LEFT, padx=2)
            ttk.Button(row, text="▼", width=3, command=lambda idx=i: self._move_pid(idx, 1)).pack(side=tk.LEFT, padx=2)
            ttk.Button(row, text="✕", width=3, command=lambda idx=i: self._remove_pid(idx)).pack(side=tk.LEFT, padx=2)

    def _on_pid_change(self, *_args):
        self._update_pid_preview()
        self._mark_modified()

    def _update_pid_preview(self):
        ids = [v.get() for v in self.pid_vars if v.get().strip()]
        preview = "|".join(ids) + "|" if ids else "(empty)"
        self.pid_preview_var.set(preview)

    def _add_pid(self):
        self.firmware.product_ids.append("")
        self._render_pid_entries()
        self._mark_modified()

    def _remove_pid(self, idx):
        if len(self.firmware.product_ids) <= 1:
            messagebox.showwarning("Warning", "At least one product ID is required.")
            return
        del self.firmware.product_ids[idx]
        self._render_pid_entries()
        self._update_pid_preview()
        self._mark_modified()

    def _move_pid(self, idx, direction):
        ids = self.firmware.product_ids
        new_idx = idx + direction
        if 0 <= new_idx < len(ids):
            ids[idx], ids[new_idx] = ids[new_idx], ids[idx]
            self._render_pid_entries()
            self._update_pid_preview()
            self._mark_modified()

    def _reset_pids(self):
        orig = HWNPFirmware(self.firmware.file_path)
        self.firmware.product_ids = list(orig.product_ids)
        self._render_pid_entries()
        self._update_pid_preview()

    # ── Section Tab ──
    def _build_section_tab(self, tab, section):
        # Section info
        info = ttk.Frame(tab)
        info.pack(fill=tk.X, padx=12, pady=8)

        ttk.Label(info, text=f"Path: {section.path}", font=("Consolas", 9)).pack(anchor=tk.W)
        ttk.Label(info, text=f"Label: {section.label}  |  Size: {fmt_bytes(section.data_size)}  |  "
                             f"Offset: 0x{section.data_offset:X}  |  CRC: 0x{section.item_crc:08X}",
                  font=("Consolas", 9)).pack(anchor=tk.W, pady=(2, 0))

        ttk.Separator(tab, orient=tk.HORIZONTAL).pack(fill=tk.X, padx=12, pady=4)

        if section.content_type == "xml" and section.text_content:
            self._build_xml_editor(tab, section)
        elif section.content_type == "shell" and section.text_content:
            self._build_text_editor(tab, section, "Shell Script")
        elif section.content_type == "text" and section.text_content:
            self._build_text_editor(tab, section, "Text Content")
        elif section.content_type == "flag":
            self._build_flag_editor(tab, section)
        else:
            self._build_hex_viewer(tab, section)

    def _build_xml_editor(self, tab, section):
        # Check toggles
        checks = parse_upgrade_checks(section.text_content)
        if checks:
            check_frame = ttk.LabelFrame(tab, text="Hardware Checks (UpgradeCheck.xml)")
            check_frame.pack(fill=tk.X, padx=12, pady=4)

            self._check_vars = {}
            for chk in checks:
                var = tk.BooleanVar(value=chk["enabled"])
                cb = ttk.Checkbutton(check_frame, text=f"  {chk['name']}", variable=var,
                                     command=lambda s=section: self._on_check_change(s))
                cb.pack(anchor=tk.W, padx=8, pady=2)
                self._check_vars[chk["name"]] = var

            btn_frame = ttk.Frame(check_frame)
            btn_frame.pack(anchor=tk.W, padx=8, pady=(4, 8))
            ttk.Button(btn_frame, text="Disable All",
                       command=lambda: self._set_all_checks(False, section)).pack(side=tk.LEFT, padx=(0, 8))
            ttk.Button(btn_frame, text="Enable All",
                       command=lambda: self._set_all_checks(True, section)).pack(side=tk.LEFT)

        # XML text editor
        self._build_text_editor(tab, section, "XML Source")

    def _on_check_change(self, section):
        changes = {name: var.get() for name, var in self._check_vars.items()}
        current = section.text_content or new_text_decoder(section.data)
        modified = modify_upgrade_checks(current, changes)

        # Update the text editor if it exists
        editor_key = f"editor_{section.index}"
        if hasattr(self, editor_key):
            editor = getattr(self, editor_key)
            editor.delete("1.0", tk.END)
            editor.insert("1.0", modified)

        section.text_content = modified
        self._mark_modified()

    def _set_all_checks(self, enabled, section):
        for var in self._check_vars.values():
            var.set(enabled)
        self._on_check_change(section)

    def _build_text_editor(self, tab, section, title):
        frame = ttk.LabelFrame(tab, text=title)
        frame.pack(fill=tk.BOTH, expand=True, padx=12, pady=4)

        text = scrolledtext.ScrolledText(
            frame, wrap=tk.NONE, font=("Consolas", 10),
            bg=self._colors["surface"], fg=self._colors["fg"],
            insertbackground=self._colors["fg"],
            selectbackground=self._colors["accent"],
            selectforeground=self._colors["bg"],
            relief=tk.FLAT, borderwidth=0, padx=8, pady=8
        )
        text.pack(fill=tk.BOTH, expand=True, padx=4, pady=4)
        text.insert("1.0", section.text_content or "")

        # Store reference
        editor_key = f"editor_{section.index}"
        setattr(self, editor_key, text)

        # Track changes
        text.bind("<<Modified>>", lambda e, s=section, t=text: self._on_text_edit(s, t))

    def _on_text_edit(self, section, text_widget):
        if text_widget.edit_modified():
            section.text_content = text_widget.get("1.0", tk.END).rstrip("\n")
            self._mark_modified()
            text_widget.edit_modified(False)

    def _build_flag_editor(self, tab, section):
        frame = ttk.LabelFrame(tab, text="Flag Value")
        frame.pack(fill=tk.X, padx=12, pady=8)

        ttk.Label(frame, text=f"Current: {section.text_content}", font=("Consolas", 12),
                  style="Accent.TLabel").pack(anchor=tk.W, padx=8, pady=(8, 4))

        entry_frame = ttk.Frame(frame)
        entry_frame.pack(anchor=tk.W, padx=8, pady=(4, 8))

        ttk.Label(entry_frame, text="New hex value:").pack(side=tk.LEFT, padx=(0, 8))

        hex_str = " ".join(f"{b:02X}" for b in section.data)
        self._flag_var = tk.StringVar(value=hex_str)
        self._flag_var.trace_add("write", lambda *a, s=section: self._on_flag_change(s))
        ttk.Entry(entry_frame, textvariable=self._flag_var, font=("Consolas", 11), width=24).pack(side=tk.LEFT)

        # Hex viewer
        self._build_hex_viewer(tab, section)

    def _on_flag_change(self, section):
        try:
            hex_str = self._flag_var.get().strip()
            byte_vals = [int(h, 16) for h in hex_str.split()]
            if byte_vals:
                section.data = bytes(byte_vals)
                section.text_content = " ".join(f"0x{b:02X}" for b in section.data)
                self._mark_modified()
        except (ValueError, IndexError):
            pass

    def _build_hex_viewer(self, tab, section):
        frame = ttk.LabelFrame(tab, text="Hex Dump")
        frame.pack(fill=tk.BOTH, expand=True, padx=12, pady=4)

        text = scrolledtext.ScrolledText(
            frame, wrap=tk.NONE, font=("Consolas", 9),
            bg=self._colors["surface"], fg=self._colors["fg"],
            insertbackground=self._colors["fg"], state=tk.NORMAL,
            relief=tk.FLAT, borderwidth=0, padx=8, pady=8
        )
        text.pack(fill=tk.BOTH, expand=True, padx=4, pady=4)
        text.insert("1.0", hex_dump(section.data, 2048))
        text.config(state=tk.DISABLED)

    # ── Header Hex Tab ──
    def _build_hex_tab(self):
        fw = self.firmware
        frame = self.tab_hex

        ttk.Label(frame, text="HWNP Header (first 0x128 bytes)", font=("Segoe UI", 11, "bold"),
                  style="Accent.TLabel").pack(anchor=tk.W, padx=12, pady=(12, 4))

        # Header field table
        fields_frame = ttk.Frame(frame)
        fields_frame.pack(fill=tk.X, padx=12, pady=4)

        fields = [
            ("0x00", "Magic", "HWNP"),
            ("0x04", "Payload Size", f"0x{fw.payload_size:08X} ({fmt_bytes(fw.payload_size)})"),
            ("0x08", "HeadCRC", f"0x{fw.head_crc:08X}" + (" ✓" if fw.crc_valid else " ✗")),
            ("0x0C", "Head Length", f"0x{fw.head_len:08X} ({fw.head_len})"),
            ("0x10", "File CRC", f"0x{fw.file_crc:08X}"),
            ("0x14", "Item Count", str(fw.item_num)),
            ("0x18", "Version", f"0x{fw.version:08X}"),
            ("0x1C", "Desc Size", f"{fw.item_desc_size} bytes"),
            ("0x24", "Product IDs", "|".join(fw.product_ids) + "|"),
        ]
        for offset, name, value in fields:
            row = ttk.Frame(fields_frame)
            row.pack(fill=tk.X, pady=1)
            ttk.Label(row, text=offset, width=8, font=("Consolas", 9)).pack(side=tk.LEFT)
            ttk.Label(row, text=name, width=16, font=("Segoe UI", 9, "bold")).pack(side=tk.LEFT)
            ttk.Label(row, text=value, font=("Consolas", 9)).pack(side=tk.LEFT)

        ttk.Separator(frame, orient=tk.HORIZONTAL).pack(fill=tk.X, padx=12, pady=8)

        # Raw hex
        text = scrolledtext.ScrolledText(
            frame, wrap=tk.NONE, font=("Consolas", 9),
            bg=self._colors["surface"], fg=self._colors["fg"],
            relief=tk.FLAT, borderwidth=0, padx=8, pady=8
        )
        text.pack(fill=tk.BOTH, expand=True, padx=12, pady=(0, 8))
        text.insert("1.0", hex_dump(fw.raw[:SECT_DESC_START], SECT_DESC_START))
        text.config(state=tk.DISABLED)

    # ── Apply Changes ──
    def _apply_all_changes(self):
        fw = self.firmware
        if not fw:
            return

        # Apply product IDs from UI
        if hasattr(self, "pid_vars"):
            ids = [v.get().strip() for v in self.pid_vars if v.get().strip()]
            if ids:
                fw.set_product_ids(ids)

        # Apply section text edits
        for section in fw.sections:
            editor_key = f"editor_{section.index}"
            if hasattr(self, editor_key):
                editor = getattr(self, editor_key)
                new_text = editor.get("1.0", tk.END).rstrip("\n")
                if new_text != section.text_content:
                    section.text_content = new_text

            if section.text_content and section.content_type in ("xml", "shell", "text"):
                new_data = section.text_content.encode("utf-8")
                if len(new_data) <= section.data_size:
                    fw.set_section_data(section.index, new_data)

            if section.content_type == "flag" and hasattr(self, "_flag_var"):
                try:
                    hex_str = self._flag_var.get().strip()
                    byte_vals = bytes(int(h, 16) for h in hex_str.split())
                    if byte_vals and len(byte_vals) <= section.data_size:
                        fw.set_section_data(section.index, byte_vals)
                except (ValueError, IndexError):
                    pass

    # ── Helpers ──
    @staticmethod
    def _section_icon(section):
        icons = {
            "xml": "📋", "shell": "📜", "flag": "🏷️", "text": "📄", "binary": "💾"
        }
        if section.label == "SIGNINFO":
            return "🔐"
        return icons.get(section.content_type, "💾")

    def show_about(self):
        messagebox.showinfo(
            "About",
            f"{APP_TITLE} v{APP_VERSION}\n\n"
            "Parse, edit, and repackage Huawei HWNP\n"
            "firmware binaries with automatic CRC correction.\n\n"
            "CRC Algorithm: CRC32(file[0x0C:EOF])\n"
            "Polynomial: 0xEDB88320 (standard)\n"
            "Stored: LE uint32 at offset 0x08\n\n"
            "github.com/Uaemextop/realfirmware-net"
        )


def new_text_decoder(data):
    try:
        return data.decode("utf-8")
    except UnicodeDecodeError:
        return data.decode("latin-1")


# ══════════════════════════════════════════════════════════════
# Entry Point
# ══════════════════════════════════════════════════════════════
if __name__ == "__main__":
    app = FirmwareEditorApp()
    app.mainloop()
