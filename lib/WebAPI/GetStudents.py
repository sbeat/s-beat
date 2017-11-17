# -*- coding: utf-8 -*-
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

import json
import math
import time
from datetime import datetime

from flask import request, Response, g

import CalcTools
import DB
import DataDefinitions
import UserTools
from APIBase import respond
from GetDefinitions import get_definitions


def get_queries():
    queries = dict()

    for name, query in DataDefinitions.get_queries().iteritems():
        queries[name] = query.get_dict()

    return queries


def is_field_allowed(field, user_role, query_types):
    if field not in DataDefinitions.get_queries() and field not in query_types:
        return False
    if not DB.Student.is_field_allowed(field, user_role):
        return False
    return True


def get_db_query(value, query):
    if query.formatting in ('int', 'grade', 'semester', 'percent'):
        parts = value.split(',')
        if len(parts) > 1:
            result = {}
            if len(parts[0]) > 0:
                result['$gte'] = int(parts[0])

            if len(parts[1]) > 0:
                result['$lte'] = int(parts[1])
        else:
            result = int(value)

    elif query.formatting == 'date':
        parts = value.split(',')
        if len(parts) > 1:
            result = {}
            if len(parts[0]) > 0:
                result['$gte'] = datetime.utcfromtimestamp(float(parts[0]))

            if len(parts[1]) > 0:
                result['$lte'] = datetime.utcfromtimestamp(float(parts[1]))
        else:
            result = datetime.utcfromtimestamp(float(value))

    elif query.formatting == 'yesno':
        if value == 'true':
            result = True
        else:
            result = False

    else:
        result = value

    return result


def get_formatted_value(value, formatting):
    if value is None:
        return ''
    if formatting == 'gender':
        return value
    if formatting == 'date':
        if type(value) == datetime:
            return value.strftime('%d.%m.%Y')
        return value
    if formatting == 'semester':
        return CalcTools.get_semester_text(value)
    if formatting == 'grade':
        return str(round(math.floor(value / 10) / 10, 1)).replace('.', ',')
    if formatting == 'percent':
        return str(round(value * 100, 1)).replace('.', ',') + '%'
    if formatting == 'yesno':
        return 'ja' if value else 'Nein'
    if formatting == 'float':
        return str(round(value, 1)).replace('.', ',')

    if type(value) not in (unicode, str, float, int):
        return ''

    return str(value)


def get_csv_col(student, col, settings):
    if col.q == 'finishstatus':
        if student['finished']:
            if student['success']:
                return 'Erfolgreich'
            elif student['aborted']:
                return 'Abgebrochen'
            else:
                return 'Abgeschlossen'
        else:
            return 'Studiert'

    if col.q == 'risk':
        value = student['risk']['median_scaled']
        if value >= settings['lights'][2]:
            return u'rot'
        elif value >= settings['lights'][1]:
            return u'gelb'
        else:
            return u'grün'

    else:
        value = col.run(student)
        if value is None:
            return ''
        return get_formatted_value(value, col.formatting)


def get_csv_row(student, columns, delimiter, settings):
    values = []

    for col in columns:
        values.append(get_csv_col(student, col, settings).encode('windows-1252'))

    return delimiter.join(values)


def respond_csv(cursor, ret):
    if request.method != 'POST' or 'csvcolumns' not in request.form:
        return respond({'error': 'missing_csvcolumns'}, 400)

    csvcolumns = request.form['csvcolumns']  # [{name:'',q:'',formatting:''}]
    if type(csvcolumns) in (unicode, str):
        try:
            csvcolumns = json.loads(csvcolumns)
        except ValueError:
            return respond({'error': 'unparseable_csvcolumns'}, 400)

    if type(csvcolumns) != list:
        return respond({'error': 'invalid_csvcolumns'}, 400)

    requiredkeys = {'q', 'name', 'formatting'}
    columns = [DB.Query(csvcol['q'], csvcol['name'], None, csvcol['formatting']) for csvcol in csvcolumns if
               type(csvcol) == dict and requiredkeys <= set(csvcol.keys())]

    csvdelimiter = ';'
    user_role = g.user_role

    settings = DB.Settings.load_dict([
        'lights',
        'hide_finished_ident_data'
    ])

    def generate():
        yield csvdelimiter.join([col.name.encode('windows-1252') for col in columns]) + '\r\n'

        for student in cursor:
            data = student.get_dict(user_role, hide_finished_ident_data=settings['hide_finished_ident_data'])
            strident = str(data['ident'])
            if 'mlist' in ret and strident in ret['mlist']['comments']:
                data['comment'] = ret['mlist']['comments'][strident]['text']

            yield get_csv_row(data, columns, csvdelimiter, settings) + '\r\n'

    return Response(generate(), mimetype='text/csv', headers=[
        ('Content-Description', 'File Transfer'),
        ('Content-Type', 'application/csv'),
        ('Content-Disposition', 'attachment; filename=students.csv')
    ])


def handle():
    # if request.method == 'POST':
    # name = request.form['name']

    status = 200
    query_types = {
        'ident': 'int',
        'status': 'int',
        'risk.mean': 'float',
        'risk.avg': 'float',
        'risk.median': 'float',
        'risk.median_scaled': 'float',
        'risk_all.median_scaled': 'float',
        'risk_stg.median_scaled': 'float',
        'risk_degree.median_scaled': 'float',
        'risk.q25': 'float',
        'risk.q75': 'float'
    }

    sortable = DB.Student().__dict__.keys()
    sortable.extend([
        '_id',
        'risk.median',
        'risk.median_scaled',
        'risk_all.median_scaled',
        'risk_stg.median_scaled',
        'risk_degree.median_scaled',
        'risk.mean',
        'risk.q25',
        'risk.q75',
        'semester_data.sem_1.bonus_total',
        'semester_data.sem_1.grade',
        'semester_data.sem_1.delayed',
        'semester_data.sem_1.failed',
        'semester_data.sem_1.successful',
        'semester_data.sem_1.count_KL',
        'semester_data.sem_2.bonus_total',
        'semester_data.sem_2.grade',
        'semester_data.sem_2.delayed',
        'semester_data.sem_2.failed',
        'semester_data.sem_2.successful',
        'semester_data.sem_2.count_KL',
        'semester_data.sem_3.bonus_total',
        'semester_data.sem_3.grade',
        'semester_data.sem_3.delayed',
        'semester_data.sem_3.failed',
        'semester_data.sem_3.successful',
        'semester_data.sem_3.count_KL'
    ])

    limit = request.args.get('limit', default=20, type=int)
    start = request.args.get('start', default=0, type=int)
    sort1 = request.args.get('sort1', default='_id,-1').split(',')
    sort2 = request.args.get('sort2', default='').split(',')
    with_definitions = request.args.get('definitions', default='false')
    mlist = request.args.get('mlist', default=None)
    do_calc = request.args.get('do_calc', default=None)
    groups = request.args.get('groups', default=None)
    single_groups = request.args.get('single_groups', default=None)
    calculations = request.args.get('calculations', default=None)
    is_csv = request.args.get('output', default='json') == 'csv'

    user_role = g.user_role

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

    db_query = dict()
    db_queries = []  # for restrictions
    db_sort = []
    if len(sort1) == 2 and sort1[0] in sortable:
        db_sort.append((sort1[0], int(sort1[1])))
    if len(sort2) == 2 and sort2[0] in sortable:
        db_sort.append((sort2[0], int(sort2[1])))

    settings = DB.Settings.load_dict([
        'lights',
        'main_risk_group',
        'hide_finished_ident_data',
        'hide_finished_after_days',
        'student_ident_string'
    ])

    # filter by MarkedList
    if mlist is not None:
        ml = DB.MarkedList.find_one({'_id': mlist})
        if ml is not None and ml.is_allowed(g.username, user_role):
            student_ids = list(ml.list)
            if not settings['student_ident_string']:
                student_ids = [int(x) for x in student_ids]
            db_query['_id'] = {'$in': student_ids}
            ret['mlist'] = ml.get_dict()
            ret['mlist']['is_writable'] = ml.is_writable(g.username, user_role)
        else:
            return respond({'error': 'invalid_mlist'}, 400)

    filter_elements = request.args.get('elements', default=None)
    if filter_elements is not None:
        for fe_id in filter_elements.split(','):
            fe = DataDefinitions.get_element_by_hash(long(fe_id))
            if fe is not None:
                fe.get_db_query(db_query)  # apply condition from filter element to db_query

    if settings['student_ident_string']:
        query_types['ident'] = 'str'

    for name in ['risk', 'risk_all', 'risk_stg', 'risk_degree']:
        if name in request.args:
            if request.args[name] == 'green':
                db_query[name + '.median_scaled'] = {'$lt': settings['lights'][1]}
            if request.args[name] == 'yellow':
                db_query[name + '.median_scaled'] = {'$gte': settings['lights'][1], '$lt': settings['lights'][2]}
            if request.args[name] == 'red':
                db_query[name + '.median_scaled'] = {'$gte': settings['lights'][2]}

    for name in request.args:
        if name in query_types:
            dbfield = name
            if name == 'ident':
                dbfield = '_id'
            try:
                value = request.args.get(name)
                db_query[dbfield] = DB.get_db_query_by_type(value, query_types[name])
                continue

            except ValueError:
                return respond({'error': 'invalid_filter', 'name': name}, 400)

        if name not in DataDefinitions.get_queries():
            continue

        query = DataDefinitions.get_queries()[name]

        try:
            value = request.args.get(name)
            db_query[name] = get_db_query(value, query)

        except ValueError:
            return respond({'error': 'invalid_filter', 'name': name}, 400)

    allowed_stgs = UserTools.get_allowed_stgs(g.user)
    if allowed_stgs:
        db_queries.append({'stg': {'$in': allowed_stgs}})

    if settings['hide_finished_after_days'] != -1:
        earliest = datetime.utcfromtimestamp(time.time() - float(settings['hide_finished_after_days']) * 86400)
        db_queries.append({'$or': [
            {'finished': True, 'exm_date': {'$gt': earliest}},
            {'finished': False}
        ]})

    if len(db_queries) > 0:
        db_queries.append(db_query)
        db_query = {'$and': db_queries}

    if groups is not None:
        allowed_groups = []

        if not isinstance(groups, unicode):
            return respond({'error': 'invalid_groups'}, 400)

        for name in groups.split(','):
            if not is_field_allowed(name, g.user_role, query_types):
                return respond({'error': 'invalid_group', 'name': name}, 400)
            allowed_groups.append(name)

        allowed_calculations = list()
        allowed_ops = ['sum', 'avg', 'max', 'min', 'addToSet']
        if isinstance(calculations, unicode):
            for full_name in calculations.split(','):
                op, name = full_name.split('.', 2)
                if not is_field_allowed(name, g.user_role, query_types) or op not in allowed_ops:
                    continue
                allowed_calculations.append({'field': name, 'op': op})

        ret['groups'] = allowed_groups
        ret['calculations'] = allowed_calculations
        ret['group_results'] = DB.Student.calc_groups(allowed_groups, db_query, allowed_calculations)

    elif single_groups is not None:
        allowed_groups = []

        if not isinstance(single_groups, unicode):
            return respond({'error': 'invalid_groups'}, 400)

        for name in single_groups.split(','):
            if not is_field_allowed(name, g.user_role, query_types):
                return respond({'error': 'invalid_group', 'name': name}, 400)
            allowed_groups.append(name)

        allowed_calculations = list()
        allowed_ops = ['sum', 'avg', 'max', 'min', 'addToSet']
        if isinstance(calculations, unicode):
            for full_name in calculations.split(','):
                op, name = full_name.split('.', 2)
                if not is_field_allowed(name, g.user_role, query_types) or op not in allowed_ops:
                    continue
                allowed_calculations.append({'field': name, 'op': op})

        ret['single_groups'] = allowed_groups
        ret['calculations'] = allowed_calculations
        ret['group_results'] = DB.Student.calc_single_groups(allowed_groups, db_query, allowed_calculations)

    elif do_calc == 'sums':
        ret['sums'] = DB.Student.calc_sums(db_query)

    elif do_calc == 'avgs':
        ret['avgs'] = None
        risk_values_allowed_key = 'risk_value_' + user_role
        settings = DB.Settings.load_dict([risk_values_allowed_key])
        avgs = DB.Student.calc_avgs(db_query)
        if avgs:
            ret['avgs'] = {}
            for key, value in avgs.iteritems():
                if 'risk' in key and not settings[risk_values_allowed_key]:
                    continue
                if key in DB.Student.restricted_fields:
                    if UserTools.has_right(DB.Student.restricted_fields[key], user_role):
                        ret['avgs'][key] = value
                else:
                    ret['avgs'][key] = value

    elif is_csv:
        cursor = DB.Student.find(db_query, sort=db_sort)
        return respond_csv(cursor, ret)

    else:
        if not 1 <= limit <= 1000:
            return respond({'error': 'invalid_limit'}, 400)

        try:
            cursor = DB.Student.find(db_query, limit=limit, skip=start, sort=db_sort)
            ret['count'] = cursor.count()
            ret['list'] = [s.get_dict(user_role, hide_finished_ident_data=settings['hide_finished_ident_data'])
                           for s in cursor]
        except DB.errors.OperationFailure as e:
            ret['count'] = 0
            ret['error'] = e.message
            status = 500

    ret['query'] = repr(db_query)
    ret['sort'] = repr(db_sort)

    return respond(ret, status)
