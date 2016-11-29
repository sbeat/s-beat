"""
Copyright (c) 2016 S-BEAT GbR and others

This file is part of S-BEAT.

S-BEAT is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

S-BEAT is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with S-BEAT. If not, see <http://www.gnu.org/licenses/>.
"""

import re

from flask import request, g

import DB
import ImportTools
import UserTools
from APIBase import respond


def handle():

    if not UserTools.has_right('admin_access', g.user_role):
        return respond({'error': 'no_rights'}, 403)

    ret = dict()

    directory = request.args.get('directory')
    if directory is None or directory not in ImportTools.allowed_directories:
        return respond({'error': 'invalid_directory'}, 400)

    if request.method == 'GET':
        pass

    upload_file = request.files.get('file')
    if upload_file is None:
        return respond({'error': 'missing_file'}, 400)

    if not re.match(r'^[-\w]+\.csv$', upload_file.filename):
        return respond({'error': 'missing_filename'}, 400)

    file_path = ImportTools.get_file_path(directory, upload_file.filename)
    upload_file.save(file_path)

    DB.UserLog.add_entry('uploadFile', g.username, upload_file.filename)

    ret['success'] = True

    return respond(ret, 200)
