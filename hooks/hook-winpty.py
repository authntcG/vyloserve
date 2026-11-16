# -*- coding: utf-8 -*-
"""
PyInstaller hook for winpty (pywinpty).
Ensures companion console host executables (OpenConsole.exe, winpty-agent.exe)
and dynamic libraries (conpty.dll, winpty.dll) are bundled into the binary package.
"""
from PyInstaller.utils.hooks import collect_data_files, collect_dynamic_libs

datas = collect_data_files('winpty')
binaries = collect_dynamic_libs('winpty')
hiddenimports = ['winpty', 'winpty.ptyprocess', 'winpty.enums']
