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

_metadata_cache_examinfos = None
_metadata_cache_examinfos_prefix = None


def handle():
    global _metadata_cache_examinfos, _metadata_cache_examinfos_prefix
    # if request.method == 'POST':
    # name = request.form['name']

    query_types = {
        'exam_info_id': 'str',
        'exam_id': 'int',
        'name': 'str',
        'stg': 'str',
        'stg_original': 'str',
        'has_grade': 'bool',
        'bonus': 'int',
        'count_exams': 'int',
        'count_successful': 'int',
        'count_failed': 'int',
        'count_applied': 'int',
        'success_perc': 'float',
        'failed_perc': 'float',
        'semesters': 'int',
        'semester_data.CURRENT.exams': 'int',
        'semester_data.CURRENT.successful': 'int',
        'semester_data.CURRENT.failed': 'int',
        'semester_data.CURRENT.applied': 'int',
        'semester_data.CURRENT.success_perc': 'float',
        'semester_data.CURRENT.failed_perc': 'float',
        'semester_data.LAST.exams': 'int',
        'semester_data.LAST.successful': 'int',
        'semester_data.LAST.failed': 'int',
        'semester_data.LAST.applied': 'int',
        'semester_data.LAST.success_perc': 'float',
        'semester_data.LAST.failed_perc': 'float'
    }
    sortable = query_types.keys()
    sortable.append('_id')

    limit = request.args.get('limit', default=20, type=int)
    start = request.args.get('start', default=0, type=int)
    sort1 = request.args.get('sort1', default='_id,-1').split(',')
    sort2 = request.args.get('sort2', default='').split(',')
    with_metadata = request.args.get('metadata', default='false')

    first_semester, current_semester = DB.Student.get_min_max('start_semester')
    last_semester = current_semester - 1
    if current_semester % 10 == 1:
        last_semester = (current_semester // 10 - 1) * 10 + 2

    current_semester = str(current_semester)
    last_semester = str(last_semester)

    def gff(field):
        field = field.replace('CURRENT', current_semester)
        field = field.replace('LAST', last_semester)
        return field

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
    # if with_metadata == 'true':
    # ret['metadata'] = get_definitions() # TODO implement meta data like name of exam

    db_query = dict()
    db_sort = []
    if len(sort1) == 2 and sort1[0] in sortable:
        db_sort.append((gff(sort1[0]), int(sort1[1])))
    if len(sort2) == 2 and sort2[0] in query_types:
        db_sort.append((gff(sort2[0]), int(sort2[1])))

    for name in request.args:
        if name not in query_types:
            continue

        dbfield = name
        if name == 'exam_info_id':
            dbfield = '_id'

        try:
            value = request.args.get(name)
            qtype = query_types[name]
            qname = gff(dbfield)
            db_query[qname] = DB.get_db_query_by_type(value, qtype)

        except ValueError:
            return respond({'error': 'invalid_filter', name: name}, 400)

    allowed_stgs = UserTools.get_allowed_stgs(g.user)
    if allowed_stgs:
        db_query['stg'] = {'$in': allowed_stgs}

    cursor = DB.ExamInfo.find(db_query, limit=limit, skip=start, sort=db_sort)

    ret['count'] = cursor.count()
    ret['list'] = [s.__dict__ for s in cursor]
    ret['query'] = repr(db_query)
    ret['sort'] = repr(db_sort)
    ret['current'] = current_semester
    ret['last'] = last_semester

    if with_metadata and _metadata_cache_examinfos \
            and _metadata_cache_examinfos_prefix == DB.Exam.get_collection_prefix():
        ret['metadata'] = _metadata_cache_examinfos
    if with_metadata:
        ret['metadata'] = DB.Exam.get_grouped_values(['stg', 'stg_original', 'name'])
        _metadata_cache_examinfos = ret['metadata']
        _metadata_cache_examinfos_prefix = DB.Exam.get_collection_prefix()

    return respond(ret, 200)
