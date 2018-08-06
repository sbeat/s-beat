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

_metadata_cache_exams = None
_metadata_cache_exams_prefix = None


def handle():
    global _metadata_cache_exams, _metadata_cache_exams_prefix
    # if request.method == 'POST':
    # name = request.form['name']

    sortable = DB.Exam().__dict__.keys()

    query_types = {
        '_id': 'int',
        'exam_info_id': 'str',
        'student_id': 'int',
        'exam_id': 'int',
        'semester': 'int',
        'bonus': 'int',
        'recognized': 'bool',
        'degree_type': 'str',
        'name': 'str',
        'stg': 'str',
        'stg_original': 'str',
        'by_forename': 'str',
        'by_surname': 'str',
        'status': 'str',
        'type': 'str',
        'grade': 'int',
        'form': 'str',
        'phase': 'str',
        'try_nr': 'int',
        'mandatory': 'str',
        'comment': 'str'
    }

    limit = request.args.get('limit', default=20, type=int)
    start = request.args.get('start', default=0, type=int)
    sort1 = request.args.get('sort1', default='exam_id,-1').split(',')
    sort2 = request.args.get('sort2', default='').split(',')
    with_metadata = request.args.get('metadata', default='false')
    with_info = request.args.get('load_info', default='false')

    if not UserTools.has_right('students_data', g.user_role):
        return respond({'error': 'no_rights'}, 403)

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
    db_queries = []  # for restrictions
    db_sort = []
    if len(sort1) == 2 and sort1[0] in sortable:
        db_sort.append((sort1[0], int(sort1[1])))
    if len(sort2) == 2 and sort2[0] in query_types:
        db_sort.append((sort2[0], int(sort2[1])))

    ident = request.args.get('ident', default=None)
    if ident is not None:
        db_query['_id'] = ident

    settings = DB.Settings.load_dict([
        'compare_averages',
        'hide_exam_date',
        'student_ident_string',
        'hide_exam_fields'
    ])

    student_id = request.args.get('student_id', default=None, type=unicode)
    if settings['student_ident_string']:
        query_types['student_id'] = 'str'
    else:
        student_id = request.args.get('student_id', default=None, type=int)

    for name in request.args:
        if name not in query_types:
            continue

        try:
            value = request.args.get(name)
            if name == 'semester' and value == 'current' and 'student_id' in request.args:
                student = DB.Student.find_one({'_id': student_id})
                if student and student.current_semester is not None:
                    value = str(student.current_semester)
                else:
                    value = '0'

            db_query[name] = DB.get_db_query_by_type(value, query_types[name])

        except ValueError:
            return respond({'error': 'invalid_filter', name: name}, 400)

    allowed_stgs = UserTools.get_allowed_stgs(g.user)
    if allowed_stgs:
        db_queries.append({'stg': {'$in': allowed_stgs}})

    if len(db_queries) > 0:
        db_queries.append(db_query)
        db_query = {'$and': db_queries}

    cursor = DB.Exam.find(db_query, limit=limit, skip=start, sort=db_sort)

    ret['count'] = cursor.count()
    ret['list'] = [s.__dict__ for s in cursor]
    ret['query'] = repr(db_query)
    ret['sort'] = repr(db_sort)

    if with_info == 'true':
        if ret['count'] > 0:
            exam_ids = list(set([e['exam_info_id'] for e in ret['list']]))
            exam_info_cursor = DB.ExamInfo.find({'_id': {'$in': exam_ids}})
            ret['info'] = [s.__dict__ for s in exam_info_cursor]
        else:
            ret['info'] = []

        ret['compare_averages'] = settings['compare_averages']
        ret['hide_exam_date'] = settings['hide_exam_date']
        ret['hide_exam_fields'] = settings['hide_exam_fields']

    if with_metadata == 'true' and student_id:
        meta_query = {'student_id': student_id}
        ret['metadata'] = DB.Exam.get_grouped_values([
            'stg', 'stg_original', 'degree_type', 'status', 'type', 'phase', 'form', 'mandatory', 'comment', 'name'
        ], meta_query)

    elif with_metadata == 'true' and _metadata_cache_exams \
            and _metadata_cache_exams_prefix == DB.Exam.get_collection_prefix():
        ret['metadata'] = _metadata_cache_exams
    else:
        ret['metadata'] = DB.Exam.get_grouped_values([
            'stg', 'stg_original', 'degree_type', 'status', 'type', 'phase', 'form', 'mandatory', 'comment', 'name'
        ])
        _metadata_cache_exams = ret['metadata']
        _metadata_cache_exams_prefix = DB.Exam.get_collection_prefix()

    return respond(ret, 200)
