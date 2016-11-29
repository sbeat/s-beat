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
from datetime import datetime

from flask import request, g

import DB
from APIBase import respond


def handle():
    ident = request.args.get('ident')

    is_new = False
    mlist = DB.MarkedList.find_one({'_id': ident})
    if mlist is None:
        is_new = True
        mlist = DB.MarkedList()
        mlist.ident = ''.join(random.choice(string.ascii_uppercase + string.digits) for x in range(10))
        mlist.created_by = g.username
        mlist.updated_by = g.username
        mlist.owner = g.username
    else:
        mlist.date_update = datetime.utcnow()
        mlist.updated_by = g.username

    if not mlist.is_writable(g.username, g.user_role):
        return respond({'error': 'not_allowed'}, 401)

    data = request.get_json()
    if data.get('delete') and mlist.deleteable and mlist.owner == g.username:
        mlist.db_remove()
        return respond({'mlist': None}, 200)

    name = data.get('name')
    if name is not None:
        mlist.name = name

    add_idents = data.get('add_idents')
    if add_idents is not None and type(add_idents) == list:
        for ident in add_idents:
            mlist.add_student(int(ident))

    remove_idents = data.get('remove_idents')
    if remove_idents is not None and type(remove_idents) == list:
        for ident in remove_idents:
            mlist.remove_student(int(ident))

    comments = data.get('comments')
    if comments is not None and type(comments) == dict:
        for comment_ident, comment in comments.iteritems():
            if int(comment_ident) in mlist.list:
                mlist.comments[comment_ident] = {'text': comment, 'by': g.username, 'date': datetime.utcnow()}

    if mlist.owner == g.username:
        owner = data.get('owner')
        if owner is not None and type(owner) == unicode:
            mlist.owner = owner

        read_only = data.get('read_only')
        if read_only is not None and type(read_only) == bool:
            mlist.read_only = read_only

    user_roles = data.get('user_roles')
    if 'user_roles' in data and type(user_roles) == list:
        mlist.user_roles = user_roles
    elif 'user_roles' in data:
        mlist.user_roles = None

    data['ident'] = ident

    if is_new:
        mlist.db_insert()
        DB.UserLog.add_entry('addMarkedList', g.username, data)
    else:
        mlist.db_save()
        DB.UserLog.add_entry('saveMarkedList', g.username, data)

    ret = mlist.get_dict()
    ret['is_writable'] = mlist.is_writable(g.username, g.user_role)

    return respond({'mlist': mlist.get_dict()}, 200)




