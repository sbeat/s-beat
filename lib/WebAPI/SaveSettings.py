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

import random
import string

from flask import request, g

import DB
import UserTools
from APIBase import respond


def handle():
    data = request.get_json()
    setting_id = data.get('id')
    if setting_id is None:
        return respond({'error': 'no_id'}, 200)

    setting_type = data.get('type', 'global')
    db_query = {}
    if setting_type == 'my':
        db_query['type'] = 'user'
        db_query['user'] = g.username
        db_query['_id'] = g.username + '_' + setting_id

    elif setting_type == 'list':
        db_query['type'] = 'list'
        db_query['user'] = g.username
        db_query['_id'] = 'list_' + setting_id

    elif setting_type == 'shared':
        db_query['type'] = 'shared'
        db_query['_id'] = 'shared_' + setting_id

    elif not UserTools.has_right('admin_access', g.user_role):
        return respond({'error': 'no_rights'}, 403)

    else:
        db_query['_id'] = setting_id

    if 'data' not in data and data.get('delete') is True:
        DB.Settings.get_collection().remove(db_query)
        DB.UserLog.add_entry('removeSetting', g.username, [setting_id])
        return respond({'status': 'ok'}, 200)

    s = DB.Settings.find_one(db_query)
    data = data.get('data')
    do_insert = False
    if s is None and setting_type == 'global' and ':' in setting_id:
        s = DB.Settings()
        s.type = setting_type
        s.id = setting_id
        do_insert = True

    elif s is None and setting_type == 'global':
        return respond({'error': 'no_setting'}, 200)

    elif s is None and setting_type == 'my':
        s = DB.Settings()
        s.type = setting_type
        s.id = g.username + '_' + setting_id
        s.user = g.username

    elif s is None and setting_type == 'list':
        s = DB.Settings()
        s.type = setting_type
        if '<new>' in setting_id:
            do_insert = True
            randid = ''.join(
                random.choice(string.ascii_lowercase + string.ascii_uppercase + string.digits) for x in range(10))
            s.id = 'list_' + setting_id.replace('<new>', randid)
        else:
            s.id = 'list_' + setting_id
        s.user = g.username

    elif s is None and setting_type == 'shared':
        s = DB.Settings()
        s.type = setting_type
        if '<new>' in setting_id:
            do_insert = True
            randid = ''.join(
                random.choice(string.ascii_lowercase + string.ascii_uppercase + string.digits) for x in range(10))
            s.id = 'shared_' + setting_id.replace('<new>', randid)
        else:
            s.id = 'shared_' + setting_id
        s.user = g.username

    s.data = data

    if setting_type == 'list':
        ex_s = DB.Settings.find_one({
            'type': 'list',
            'hash': s.generate_md5(),
            'user': g.username
        })
        if ex_s and ex_s.id != s.id:
            return respond({'error': 'already_exists', 'id': ex_s.id.replace('list_', '', 1)}, 200)

    if do_insert and s.db_insert() or s.db_save():
        DB.UserLog.add_entry('saveSetting', g.username, [s.id, data])
        return respond({'status': 'ok'}, 200)

    return respond({'error': 'not_saved'}, 200)
