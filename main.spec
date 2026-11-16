# -*- mode: python ; coding: utf-8 -*-
import sys
from PyInstaller.utils.hooks import collect_data_files, collect_dynamic_libs

winpty_datas = collect_data_files('winpty') if sys.platform == 'win32' else []
winpty_binaries = collect_dynamic_libs('winpty') if sys.platform == 'win32' else []

webview_datas = collect_data_files('webview')
webview_binaries = collect_dynamic_libs('webview')

certifi_datas = collect_data_files('certifi')

hidden_imports = [
    'win11toast',
    'pystray',
    'pystray._win32' if sys.platform == 'win32' else 'pystray._dummy',
    'bcrypt',
    'yaml',
    'certifi',
    'PIL.Image',
    'PIL.ImageDraw',
    'PIL.ImageFont',
    'PIL.IcoImagePlugin',
    'PIL.BmpImagePlugin',
    'PIL.PngImagePlugin',
    'PIL.JpegImagePlugin',
]
if sys.platform == 'win32':
    hidden_imports.extend(['winpty', 'winpty.ptyprocess', 'winpty.enums', 'clr'])

a = Analysis(
    ['main.py'],
    pathex=[],
    binaries=winpty_binaries + webview_binaries,
    datas=[
        ('frontend/dist', 'frontend/dist'),
        ('frontend/src/assets', 'frontend/src/assets'),
        ('frontend/src/locales', 'frontend/src/locales'),
        ('docs/user_guide.md', 'docs'),
    ] + winpty_datas + webview_datas + certifi_datas,
    hiddenimports=hidden_imports,
    hookspath=['hooks'],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='main',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=['frontend/src/assets/icons-nobg.ico'],
)
