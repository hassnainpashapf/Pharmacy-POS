#!/usr/bin/env python3
import os
import sys
import struct
import zlib
import subprocess
import shutil

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SVG_PATH = os.path.join(ROOT_DIR, 'public', 'icon.svg')
BUILD_DIR = os.path.join(ROOT_DIR, 'build')
ELECTRON_DIR = os.path.join(ROOT_DIR, 'electron')
PUBLIC_DIR = os.path.join(ROOT_DIR, 'public')
TMP_DIR = '/tmp/pharmacy_icon_build'

os.makedirs(BUILD_DIR, exist_ok=True)
os.makedirs(ELECTRON_DIR, exist_ok=True)
os.makedirs(PUBLIC_DIR, exist_ok=True)
os.makedirs(TMP_DIR, exist_ok=True)

print("=== Generating High-Fidelity Multi-Platform Icons ===")

# 1. Rasterize SVG to 1024x1024 and 512x512 master PNG using macOS sips
master_512 = os.path.join(TMP_DIR, 'master_512.png')
master_1024 = os.path.join(TMP_DIR, 'master_1024.png')

subprocess.run(['sips', '-s', 'format', 'png', SVG_PATH, '--out', master_512], check=True, stdout=subprocess.DEVNULL)
subprocess.run(['sips', '-z', '1024', '1024', master_512, '--out', master_1024], check=True, stdout=subprocess.DEVNULL)

# Copy PNGs to public, build, electron
shutil.copyfile(master_512, os.path.join(PUBLIC_DIR, 'icon-512.png'))
shutil.copyfile(master_512, os.path.join(BUILD_DIR, 'icon.png'))
shutil.copyfile(master_512, os.path.join(ELECTRON_DIR, 'icon.png'))

subprocess.run(['sips', '-z', '192', '192', master_512, '--out', os.path.join(PUBLIC_DIR, 'icon-192.png')], check=True, stdout=subprocess.DEVNULL)
subprocess.run(['sips', '-z', '180', '180', master_512, '--out', os.path.join(PUBLIC_DIR, 'apple-touch-icon.png')], check=True, stdout=subprocess.DEVNULL)

# Helper: Extract uncompressed BGRA rows from PNG
def get_rgba_from_png(png_path):
    with open(png_path, 'rb') as f:
        data = f.read()
    pos = 8
    width, height = 0, 0
    idat = b''
    while pos < len(data):
        length, chunk_type = struct.unpack('>I4s', data[pos:pos+8])
        chunk_data = data[pos+8:pos+8+length]
        if chunk_type == b'IHDR':
            width, height, bit_depth, color_type = struct.unpack('>IIBB', chunk_data[:10])
        elif chunk_type == b'IDAT':
            idat += chunk_data
        pos += 12 + length
    
    decompressed = zlib.decompress(idat)
    bytes_per_pixel = 4 if color_type == 6 else 3
    stride = width * bytes_per_pixel
    raw_rows = []
    offset = 0
    prev_row = bytearray(stride)
    
    for r in range(height):
        filter_type = decompressed[offset]
        offset += 1
        scanline = bytearray(decompressed[offset:offset+stride])
        offset += stride
        row = bytearray(stride)
        for c in range(stride):
            left = row[c - bytes_per_pixel] if c >= bytes_per_pixel else 0
            up = prev_row[c]
            up_left = prev_row[c - bytes_per_pixel] if c >= bytes_per_pixel else 0
            val = scanline[c]
            if filter_type == 0:
                filt = val
            elif filter_type == 1:
                filt = (val + left) & 0xFF
            elif filter_type == 2:
                filt = (val + up) & 0xFF
            elif filter_type == 3:
                filt = (val + ((left + up) >> 1)) & 0xFF
            elif filter_type == 4:
                p = left + up - up_left
                pa = abs(p - left)
                pb = abs(p - up)
                pc = abs(p - up_left)
                if pa <= pb and pa <= pc:
                    pr = left
                elif pb <= pc:
                    pr = up
                else:
                    pr = up_left
                filt = (val + pr) & 0xFF
            else:
                filt = val
            row[c] = filt
        prev_row = row
        raw_rows.append(row)
        
    bgra_rows = []
    for row in raw_rows:
        bgra_row = bytearray(width * 4)
        for i in range(width):
            if color_type == 6:
                r, g, b, a = row[i*4 : i*4+4]
            else:
                r, g, b = row[i*3 : i*3+3]
                a = 255
            bgra_row[i*4 : i*4+4] = bytes([b, g, r, a])
        bgra_rows.append(bgra_row)
    return width, height, bgra_rows

# Helper: Build 100% compliant Windows ICO file
def build_windows_ico(sizes, source_png):
    entries = []
    for s in sizes:
        png_s = os.path.join(TMP_DIR, f'ico_{s}.png')
        subprocess.run(['sips', '-z', str(s), str(s), source_png, '--out', png_s], check=True, stdout=subprocess.DEVNULL)
        
        if s == 256:
            with open(png_s, 'rb') as f:
                img_data = f.read()
            w_byte = 0
            h_byte = 0
            bpp = 32
        else:
            w, h, bgra_rows = get_rgba_from_png(png_s)
            w_byte = w
            h_byte = h
            bpp = 32
            
            # BITMAPINFOHEADER (40 bytes)
            bih = struct.pack('<IIIHHIIIIII',
                40,          # biSize
                w,           # biWidth
                h * 2,       # biHeight (doubled for XOR + AND masks)
                1,           # biPlanes
                32,          # biBitCount
                0,           # biCompression (BI_RGB)
                w * h * 4,   # biSizeImage
                0, 0, 0, 0   # resolution, colors
            )
            
            # XOR mask: bottom-up BGRA rows
            xor_mask = b''.join(bgra_rows[::-1])
            
            # AND mask: 1 bit per pixel, bottom-up rows, padded to 32-bit DWORD boundary
            and_row_bytes = ((w + 31) // 32) * 4
            and_rows = []
            for row in bgra_rows[::-1]:
                and_row = bytearray(and_row_bytes)
                for x in range(w):
                    a = row[x*4 + 3]
                    if a < 128:
                        and_row[x // 8] |= (1 << (7 - (x % 8)))
                and_rows.append(bytes(and_row))
            and_mask = b''.join(and_rows)
            img_data = bih + xor_mask + and_mask
            
        entries.append({
            'w': w_byte,
            'h': h_byte,
            'bpp': bpp,
            'size': len(img_data),
            'data': img_data
        })
        
    count = len(entries)
    header = struct.pack('<HHH', 0, 1, count)
    dir_size = 6 + count * 16
    
    current_offset = dir_size
    dir_entries = b''
    data_blobs = b''
    
    for entry in entries:
        dir_entries += struct.pack('<BBBBHHII',
            entry['w'],
            entry['h'],
            0, # color count
            0, # reserved
            1, # planes
            entry['bpp'],
            entry['size'],
            current_offset
        )
        current_offset += entry['size']
        data_blobs += entry['data']
        
    return header + dir_entries + data_blobs

# Generate Windows ICO
ico_bytes = build_windows_ico([256, 128, 64, 48, 32, 24, 16], master_512)

ico_targets = [
    os.path.join(PUBLIC_DIR, 'icon.ico'),
    os.path.join(PUBLIC_DIR, 'favicon.ico'),
    os.path.join(BUILD_DIR, 'icon.ico'),
    os.path.join(ELECTRON_DIR, 'icon.ico')
]

for t in ico_targets:
    with open(t, 'wb') as f:
        f.write(ico_bytes)
    print(f"Generated: {t} ({len(ico_bytes)} bytes)")

# 3. Generate macOS ICNS using iconutil
iconset_dir = os.path.join(TMP_DIR, 'AppIcon.iconset')
if os.path.exists(iconset_dir):
    shutil.rmtree(iconset_dir)
os.makedirs(iconset_dir, exist_ok=True)

mac_sizes = [
    (16, '16x16'),
    (32, '16x16@2x'),
    (32, '32x32'),
    (64, '32x32@2x'),
    (128, '128x128'),
    (256, '128x128@2x'),
    (256, '256x256'),
    (512, '256x256@2x'),
    (512, '512x512'),
    (1024, '512x512@2x')
]

for px, name in mac_sizes:
    target_png = os.path.join(iconset_dir, f'icon_{name}.png')
    src = master_1024 if px >= 512 else master_512
    subprocess.run(['sips', '-z', str(px), str(px), src, '--out', target_png], check=True, stdout=subprocess.DEVNULL)

icns_path = os.path.join(BUILD_DIR, 'icon.icns')
subprocess.run(['iconutil', '-c', 'icns', iconset_dir, '-o', icns_path], check=True, stdout=subprocess.DEVNULL)
shutil.copyfile(icns_path, os.path.join(ELECTRON_DIR, 'icon.icns'))
print(f"Generated macOS ICNS: {icns_path}")

print("=== Icon Generation Complete! ===")
