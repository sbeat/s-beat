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

import DB
import UserTools
from APIBase import respond


def handle():
    if not UserTools.has_right('admin_access', g.user_role):
        return respond({'error': 'no_rights'}, 403)

    data = request.get_json()
    user = data.get('user')
    if user is None:
        return respond({'error': 'no_user'}, 200)

    role = data.get('role')
    stg_list = data.get('stg_list')
    if UserTools.save_user(user, role, stg_list):
        DB.UserLog.add_entry('saveUser', g.username, [user, role, stg_list])
        return respond({'status': 'ok'}, 200)

    return respond({'error': 'not_saved'}, 200)




