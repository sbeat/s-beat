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

from flask import g

import DB
import UserTools
from APIBase import respond


def handle():
    if not UserTools.has_right('admin_access', g.user_role):
        return respond({'error': 'no_rights'}, 403)

    ret = dict()
    ret['roles'] = UserTools.user_roles
    ret['rights'] = UserTools.user_rights
    ret['users'] = UserTools.get_all_users()
    ret['stg_list'] = [d['_id'] for d in DB.Course.get_grouped_values('stg', {'ignore': False}) if d['_id'] is not None]

    return respond(ret, 200)




