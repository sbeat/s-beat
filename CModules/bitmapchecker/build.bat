rem Copyright (c) 2016 S-BEAT GbR and others. Licensed under GPL-v3-or-Later
rem see LICENSE.md file in the root of this project or http://www.gnu.org/licenses/

SET VS90COMNTOOLS=%VS100COMNTOOLS%

python setup.py build

xcopy /y build\lib.win32-2.7\bitmapchecker.pyd ..\..\lib
