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

from flask import request
import DataDefinitions
import DB
from APIBase import respond
from GetDefinitions import get_definitions


def get_queries():
    queries = dict()

    for name, query in DataDefinitions.get_queries().iteritems():
        queries[name] = query.get_dict()

    return queries


def get_student_matching_elements(student_id):
    student = DB.Student.find_one({'_id': student_id})
    if student is None:
        return None

    return [pe.md5_id() for pe in student.get_matching_elements()]


def get_student_matching_paths(student_id):
    student = DB.Student.find_one({'_id': student_id})
    if student is None:
        return None

    # generate all paths which the student matches
    dimensions = 3
    path_hashes = set()
    for num in range(dimensions):
        path_hashes.update(student.generate_path_hashes(num + 1, 1))
    return list(path_hashes)


def handle():
    # if request.method == 'POST':
    # name = request.form['name']

    use_preferred_paths = DB.Settings.load('use_preferred_paths')

    query_types = {
        '_id': 'long',
        'group': 'str',
        'value': 'float',
        'weight': 'float',
        'weighted_value': 'float',
        'support': 'float',
        'confidence': 'float',
        'count': 'int',
        'matched': 'int',
        'elements': 'intlist',
        'filter_elements': 'intlist'
    }

    limit = request.args.get('limit', default=20, type=int)
    start = request.args.get('start', default=0, type=int)
    sort1 = request.args.get('sort1', default='value,-1').split(',')
    sort2 = request.args.get('sort2', default='').split(',')
    with_definitions = request.args.get('definitions', default='false')
    student_id = request.args.get('student_id', default=None, type=str)
    filter_dim = request.args.get('filter_dim', default=None)
    in_filter_elements = request.args.get('in_filter_elements', default=None)

    settings = DB.Settings.load_dict([
        'student_ident_string'
    ])

    if not settings['student_ident_string'] and student_id is not None:
        student_id = int(student_id)

    ret = {
        'start': start,
        'limit': limit,
        'count': 0,
        'list': None,
        'query': None,
        'sort': None
    }
    if with_definitions == 'true':
        ret['definitions'] = get_definitions()
        ret['metadata'] = {}
        ret['metadata']['group'] = [d['_id'] for d in DB.Path.get_grouped_values('group')]

    if not 1 <= limit <= 10000:
        return respond({'error': 'invalid_limit'}, 400)

    db_query = dict()
    db_sort = []
    if len(sort1) == 2 and sort1[0] in query_types:
        db_sort.append((sort1[0], int(sort1[1])))
    if len(sort2) == 2 and sort2[0] in query_types:
        db_sort.append((sort2[0], int(sort2[1])))

    if filter_dim is not None:
        db_query['filter_elements'] = {'$size': DB.get_db_query_by_type(filter_dim, 'int')}

    for name in request.args:
        if name not in query_types:
            continue

        try:
            value = request.args.get(name)
            qtype = query_types[name]
            db_query[name] = DB.get_db_query_by_type(value, qtype)

        except ValueError:
            return respond({'error': 'invalid_filter', name: name}, 400)

    if student_id is not None:
        student_element_ids = get_student_matching_elements(student_id)
        if student_element_ids is None:
            return respond({'error': 'invalid_student_id'}, 400)

        student = DB.Student.find_one({'_id': student_id})

        # print 'on all', [DataDefinitions.get_element_by_hash(peId).get_str() for peId in student_element_ids]
        if in_filter_elements is not None:
            in_fids = in_filter_elements.split(',')
            seids = [long(feid) for feid in in_fids if long(feid) in student_element_ids]
            db_query['filter_elements'] = {'$in': seids}
            # print 'one in', [DataDefinitions.get_element_by_hash(peId).get_str() for peId in seids]

        if 'group' not in db_query:
            db_query['group'] = {'$in': ['all', student.stg]}
        # db_query['$where'] = Code(
        # 'this.filter_elements.every(function(id){return student_elements.indexOf(id.toNumber().toString())!=-1})',
        # {'student_elements': [str(el_id) for el_id in student_element_ids]}
        # )

        results = DB.Path.get_list_by_element_ids(student_element_ids, db_query)
        if use_preferred_paths:
            results = DB.Path.get_preferred_paths(results)

        result_list = []

        def sort_cmp(x, y):
            for se in db_sort:
                if hasattr(x, se[0]) and hasattr(y, se[0]):
                    if getattr(x, se[0]) < getattr(y, se[0]):
                        return se[1] * -1
                    elif getattr(x, se[0]) > getattr(y, se[0]):
                        return se[1]
            return 0

        results.sort(cmp=sort_cmp)

        element_stats = {}

        for i in range(len(results)):
            path = results[i]
            for pe in path.filter_elements:
                pe_id = pe.md5_id()
                if pe_id not in element_stats:
                    element_stats[pe_id] = {'count': 0, 'value_sum': 0.0, 'support_sum': 0.0}
                element_stats[pe_id]['count'] += 1
                element_stats[pe_id]['value_sum'] += path.value
                element_stats[pe_id]['support_sum'] += path.support
                element_stats[pe_id]['value_mean'] = \
                    element_stats[pe_id]['value_sum'] / element_stats[pe_id]['count']
                element_stats[pe_id]['support_mean'] = \
                    element_stats[pe_id]['support_sum'] / element_stats[pe_id]['count']

            if start <= i < start + limit:
                result_list.append(path)

        ret['element_stats'] = element_stats

        ret['count'] = len(results)
        ret['list'] = [s.get_dict(True) for s in result_list]
        ret['query'] = repr(db_query)
        ret['sort'] = repr(db_sort)

    else:
        cursor = DB.Path.find(db_query, limit=limit, skip=start, sort=db_sort)
        ret['count'] = cursor.count()
        ret['list'] = [s.get_dict(True) for s in cursor]
        ret['query'] = repr(db_query)
        ret['sort'] = repr(db_sort)

    return respond(ret, 200)
