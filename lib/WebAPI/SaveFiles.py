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

from flask import request, g
from APIBase import respond

import ImportTools
import UserTools


def handle():
    if not UserTools.has_right('admin_access', g.user_role):
        return respond({'error': 'no_rights'}, 403)

    ret = dict()

    data = request.get_json()

    directory = data.get('directory')
    if directory is None or directory not in ImportTools.allowed_directories:
        return respond({'error': 'invalid_directory'}, 400)

    ret['files_info'] = ImportTools.get_files_info(directory, data.get('list'))

    return respond(ret, 200)




