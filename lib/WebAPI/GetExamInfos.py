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

    if not UserTools.has_right('exams_data', g.user_role):
        return respond({'error': 'no_rights'}, 403)

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
        'version': 'int',
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
        'semester_data.LAST.failed_perc': 'float',
        'semester_data.PERIOD.exams': 'int',
        'semester_data.PERIOD.successful': 'int',
        'semester_data.PERIOD.failed': 'int',
        'semester_data.PERIOD.applied': 'int',
        'semester_data.PERIOD.success_perc': 'float',
        'semester_data.PERIOD.failed_perc': 'float'
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

    settings = DB.Settings.load_dict([
        'hide_exam_fields'
    ])

    ret['hide_exam_fields'] = settings['hide_exam_fields']

    db_query = dict()
    db_queries = []  # for restrictions
    db_sort = {}
    if len(sort1) == 2 and sort1[0] in sortable:
        db_sort[gff(sort1[0])] = int(sort1[1])
    if len(sort2) == 2 and sort2[0] in query_types:
        db_sort[gff(sort2[0])] = int(sort2[1])

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
        db_queries.append({'stg': {'$in': allowed_stgs}})

    if len(db_queries) > 0:
        db_queries.append(db_query)
        db_query = {'$and': db_queries}

    pipeline = [{'$match': db_query}]
    if request.args.has_key('semesters'):
        cond = DB.get_db_aggregation_condition(request.args.get('semesters'), 'int', {'$toInt': '$$this.k'})
        pipeline.append({'$addFields': {
            'semester_data.PERIOD': {
                '$reduce': {
                    'input': {'$objectToArray': '$semester_data'},
                    'initialValue': {
                        'applied': 0,
                        'failed': 0,
                        'exams': 0,
                        'successful': 0,
                        'resigned': 0
                    },
                    'in': {
                        '$cond': {
                            'if': cond,
                            'then': {
                                'applied': {'$add': ['$$value.applied', '$$this.v.applied']},
                                'failed': {'$add': ['$$value.failed', '$$this.v.failed']},
                                'exams': {'$add': ['$$value.exams', '$$this.v.exams']},
                                'successful': {'$add': ['$$value.successful', '$$this.v.successful']},
                                'resigned': {'$add': ['$$value.resigned', '$$this.v.resigned']},
                                'failed_perc': {'$divide': [
                                    {'$add': ['$$value.failed', '$$this.v.failed']},
                                    {'$add': ['$$value.exams', '$$this.v.exams']}
                                ]},
                                'success_perc': {'$divide': [
                                    {'$add': ['$$value.successful', '$$this.v.successful']},
                                    {'$add': ['$$value.exams', '$$this.v.exams']}
                                ]},
                                'resign_perc': {'$divide': [
                                    {'$add': ['$$value.resigned', '$$this.v.resigned']},
                                    {'$add': ['$$value.exams', '$$this.v.exams']}
                                ]}
                            },
                            'else': '$$value'
                        }
                    }
                }
            }
        }})

    pipeline.append({'$sort': db_sort})
    pipeline.append({'$skip': start})
    pipeline.append({'$limit': limit})

    cursor = DB.ExamInfo.find(db_query, limit=limit, skip=start)

    ret['count'] = cursor.count()
    ret['list'] = [DB.ExamInfo.db_create(d).__dict__ for d in DB.ExamInfo.db_aggregate(pipeline)]
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

    if ret['metadata'] and allowed_stgs:
        ret['metadata']['stg'] = [stg for stg in ret['metadata']['stg'] if stg in allowed_stgs]
        ret['metadata']['stg_original'] = [stg for stg in ret['metadata']['stg_original']
                                           if DB.Course.get_by_stg_original(stg).stg in allowed_stgs]

    return respond(ret, 200)
