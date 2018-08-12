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

import UserTools
import DB


def handle():
    ret = dict()
    ret['settings'] = dict()

    db_query = {'type': 'global'}

    setting_id = request.args.get('id')
    setting_type = request.args.get('type', default='global')
    if setting_type == 'my':
        db_query['type'] = 'my'
        db_query['user'] = g.username

        if setting_id:
            db_query['_id'] = g.username + '_' + setting_id

    elif setting_type == 'list':
        db_query['type'] = 'list'

        if setting_id:
            db_query['_id'] = 'list_' + setting_id
        else:
            db_query['user'] = g.username

    elif setting_type == 'shared':
        db_query['type'] = 'shared'

        if setting_id:
            db_query['_id'] = 'shared_' + setting_id

    elif not UserTools.has_right('admin_access', g.user_role):
        return respond({'error': 'no_rights'}, 403)

    cursor = DB.Settings.find(db_query)
    for s in cursor:
        if setting_type == 'my':
            ret['settings'][s.id.replace(g.username + '_', '', 1)] = s.data
        elif setting_type == 'list':
            ret['settings'][s.id.replace('list_', '', 1)] = s.data
        elif setting_type == 'shared':
            ret['settings'][s.id.replace('shared_', '', 1)] = s.data
        else:
            ret['settings'][s.id] = s.data

    return respond(ret, 200)




