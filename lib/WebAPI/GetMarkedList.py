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
    query_types = {
        'ident': 'str',
        'owner': 'str',
        'created_by': 'str',
        'updated_by': 'str',
        'name': 'str',
        'count': 'int',
        'list': 'int',
        'read_only': 'bool'
    }

    sortable = DB.MarkedList().__dict__.keys()
    sortable.extend([
        '_id'
    ])

    limit = request.args.get('limit', default=20, type=int)
    start = request.args.get('start', default=0, type=int)
    sort1 = request.args.get('sort1', default='_id,-1').split(',')
    sort2 = request.args.get('sort2', default='').split(',')

    if not 1 <= limit <= 1000:
        return respond({'error': 'invalid_limit'}, 400)

    ret = {
        'start': start,
        'limit': limit,
        'count': 0,
        'list': None,
        'query': None,
        'sort': None,
        'user_roles': UserTools.user_roles.keys()
    }

    db_query = dict()
    db_sort = []
    if len(sort1) == 2 and sort1[0] in sortable:
        db_sort.append((sort1[0], int(sort1[1])))
    if len(sort2) == 2 and sort2[0] in sortable:
        db_sort.append((sort2[0], int(sort2[1])))

    for name in request.args:
        if name in query_types:
            dbfield = name
            if name == 'ident':
                dbfield = '_id'
            try:
                value = request.args.get(name)
                db_query[dbfield] = DB.get_db_query_by_type(value, query_types[name])

            except ValueError:
                return respond({'error': 'invalid_filter', name: name}, 400)

    db_user_cond = {'$or': [{'owner': g.username}, {'user_roles': g.user_role}]}
    db_query = {'$and': [db_user_cond, db_query]}

    cursor = DB.MarkedList.find(db_query, limit=limit, skip=start, sort=db_sort)
    ret['list'] = []
    for s in cursor:
        entry = s.get_dict()
        entry['is_writable'] = s.is_writable(g.username, g.user_role)
        ret['list'].append(entry)

    ret['count'] = cursor.count()
    ret['query'] = repr(db_query)
    ret['sort'] = repr(db_sort)

    return respond(ret, 200)
