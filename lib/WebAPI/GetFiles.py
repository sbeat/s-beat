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

import ImportTools
import UserTools
import DB
from APIBase import respond


def handle():
    # if request.method == 'POST':
    # name = request.form['name']

    if not UserTools.has_right('admin_access', g.user_role):
        return respond({'error': 'no_rights'}, 403)

    ret = dict()
    directory = request.args.get('directory')



    if directory is None or directory not in ImportTools.allowed_directories:
        return respond({'error': 'invalid_directory'}, 400)

    if directory == 'studentidents':
        settings = DB.Settings.load_dict([
            'unique_student_id'
        ])
        if len(settings['unique_student_id']) > 1 or settings['unique_student_id'][0] != 'ident_original':
            return respond({'error': 'disabled_directory'}, 400)

    if directory == 'applicants':
        settings = DB.Settings.load_dict([
            'import_applicants'
        ])
        if not settings['import_applicants']:
            return respond({'error': 'disabled_directory'}, 400)

    ret['files_info'] = ImportTools.get_files_info(directory)

    return respond(ret, 200)
