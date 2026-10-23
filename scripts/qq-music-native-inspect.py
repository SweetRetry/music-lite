#!/usr/bin/env python3
"""Read QQMusic 11.10.0 arm64 constants without launching it or reading user data."""
import argparse
import json
import pathlib
import plistlib
import struct
import subprocess

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('app', nargs='?', default='/Applications/QQMusic.app', help='QQMusic.app bundle path')
app = pathlib.Path(parser.parse_args().app)
with (app / 'Contents/Info.plist').open('rb') as f:
    version = plistlib.load(f)['CFBundleShortVersionString']
if version != '11.10.0':
    raise SystemExit(f'Addresses apply to 11.10.0, found {version}. Locate GetAlbumSongList methods with otool -arch arm64 -ov before updating the address table.')
fat = (app / 'Contents/MacOS/QQMusic').read_bytes()
assert fat[:4] == bytes.fromhex('cafebabe')
count = struct.unpack_from('>I', fat, 4)[0]
for i in range(count):
    cpu, _, offset, size, _ = struct.unpack_from('>IIIII', fat, 8 + i * 20)
    if cpu == 0x100000c:
        binary = fat[offset:offset + size]
        break
else:
    raise SystemExit('arm64 slice missing')
segments = []
offset = 32
for _ in range(struct.unpack_from('<I', binary, 16)[0]):
    command, size = struct.unpack_from('<II', binary, offset)
    if command == 0x19:
        _, vmaddr, vmsize, fileoff, _ = struct.unpack_from('<16sQQQQ', binary, offset + 8)
        segments.append((vmaddr, vmsize, fileoff))
    offset += size

def file_offset(address):
    for start, size, fileoff in segments:
        if start <= address < start + size:
            return fileoff + address - start
    raise ValueError(hex(address))

def cfstring(address):
    _, _, pointer, size = struct.unpack_from('<QQQQ', binary, file_offset(address))
    position = file_offset(pointer)
    return binary[position:position + size].decode('utf-8')

addresses = {
    'module': 0x1023c14a0,
    'method': 0x1023c14c0,
    'requestKey': 0x1023c14e0,
    'param.albumID': 0x1023af680,
    'param.albumMid': 0x1023c1500,
    'param.begin': 0x1023c1520,
    'param.num': 0x1023b5f00,
    'param.order': 0x1023c1540,
    'response.totalNum': 0x1023c1560,
    'response.curBegin': 0x1023c1580,
    'response.songList': 0x1023c15a0,
    'response.songInfo': 0x1023c15c0,
}
print(json.dumps({'appVersion':version, 'cfstrings': {
    key:{'address':hex(value),'value':cfstring(value)}
    for key,value in addresses.items()
}}, ensure_ascii=False, indent=2))
strings = subprocess.check_output(['strings', str(app / 'Contents/MacOS/QQMusic')], text=True)
print('\nPage URL templates from executable. Duplicates removed.')
for line in sorted(set(strings.splitlines())):
    if line.startswith('https://') and any(x in line for x in ('singer_detail', 'album_detail', '/musicmac/v6/singer/detail', '/musicmac/v6/album/detail')):
        print(line)

# Keep the evidence for constructor defaults and addParam literal assignments
# reproducible without retaining the complete disassembly on disk.
print('\narm64 GetAlbumSongList. Constructor and addParam disassembly.')
print('setAlbumID starts at 0x100103a88. addParam starts at 0x100103b48.')
print('curBegin uses ivar offset table entry 0x1025d2b04 and is initialized with xzr.')
process = subprocess.Popen(
    ['otool', '-arch', 'arm64', '-tvV', str(app / 'Contents/MacOS/QQMusic')],
    stdout=subprocess.PIPE, text=True,
)
try:
    for line in process.stdout:
        try:
            address = int(line.split()[0], 16)
        except (ValueError, IndexError):
            continue
        if address >= 0x100103c8c:
            break
        if address >= 0x100103a64:
            print(line.rstrip())
finally:
    process.stdout.close()
    if process.poll() is None:
        process.terminate()
    process.wait()
