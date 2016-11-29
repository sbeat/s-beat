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
from APIBase import respond
import UserTools


def handle():
    sortable = DB.CourseSemesterInfo().__dict__.keys()
    sortable.append('_id')

    query_types = {
        'semester_id': 'int',
        'stg': 'str'
    }

    limit = request.args.get('limit', default=20, type=int)
    start = request.args.get('start', default=0, type=int)
    sort1 = request.args.get('sort1', default='semeser_id,1').split(',')
    sort2 = request.args.get('sort2', default='').split(',')

    if not 1 <= limit <= 1000:
        return respond({'error': 'invalid_limit'}, 400)

    ret = {
        'start': start,
        'limit': limit,
        'count': 0,
        'list': None,
        'query': None,
        'sort': None
    }

    db_query = dict()
    db_sort = []
    if len(sort1) == 2 and DB.CourseSemesterInfo.db_is_sortable(sort1[0]):
        db_sort.append((sort1[0], int(sort1[1])))
    if len(sort2) == 2 and DB.CourseSemesterInfo.db_is_sortable(sort2[0]):
        db_sort.append((sort2[0], int(sort2[1])))

    ident = request.args.get('ident', default=None)
    if ident is not None:
        db_query['_id'] = ident

    for name in request.args:
        if name not in query_types:
            continue

        try:
            value = request.args.get(name)
            db_query[name] = DB.get_db_query_by_type(value, query_types[name])

        except ValueError:
            return respond({'error': 'invalid_filter', name: name}, 400)

    allowed_stgs = UserTools.get_allowed_stgs(g.user)
    if allowed_stgs:
        db_query['stg'] = {'$in': allowed_stgs}

    cursor = DB.CourseSemesterInfo.find(db_query, limit=limit, skip=start, sort=db_sort)

    ret['count'] = cursor.count()
    ret['list'] = [s.__dict__ for s in cursor]
    ret['query'] = repr(db_query)
    ret['sort'] = repr(db_sort)

    ret['hide_resigned'] = DB.Settings.load('hide_resigned')

    return respond(ret, 200)




