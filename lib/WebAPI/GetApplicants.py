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


def get_csv_col(applicant, col, settings):
    if col.q == 'admissionstatus':
        if applicant['admitted']:
            return 'Zugelassen'
        else:
            return 'Offen'

    else:
        value = col.run(applicant)
        if value is None:
            return ''
        return get_formatted_value(value, col.formatting)


def get_csv_row(applicant, columns, delimiter, settings):
    values = []

    for col in columns:
        values.append(get_csv_col(applicant, col, settings).encode('windows-1252'))

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

        for applicant in cursor:
            data = applicant.get_dict(user_role)
            strident = str(data['ident'])
            if 'mlist' in ret and strident in ret['mlist']['comments']:
                data['comment'] = ret['mlist']['comments'][strident]['text']

            yield get_csv_row(data, columns, csvdelimiter, settings) + '\r\n'

    return Response(generate(), mimetype='text/csv', headers=[
        ('Content-Description', 'File Transfer'),
        ('Content-Type', 'application/csv'),
        ('Content-Disposition', 'attachment; filename=applicants.csv')
    ])


def handle():
    # if request.method == 'POST':
    # name = request.form['name']

    status = 200

    query_types = {
        'admitted': 'bool',
        'age': 'int',
        'appl_date': 'datetime',
        'birth_date': 'datetime',
        'degree_type': 'str',
        'email': 'str',
        'eu': 'bool',
        'forename': 'str',
        'gender': 'str',
        'hzb_appl_time': 'int',
        'hzb_date': 'datetime',
        'hzb_grade': 'int',
        'hzb_type': 'str',
        'ident': 'str',
        'country': 'str',
        'zip': 'str',
        'citship': 'str',
        'start_semester': 'int',
        'stg': 'str',
        'stg_original': 'str',
        'surname': 'str',
        'adm_date': 'datetime'
    }
    sortable = DB.Applicant().__dict__.keys()
    sortable.extend([
        '_id'
    ])

    limit = request.args.get('limit', default=20, type=int)
    start = request.args.get('start', default=0, type=int)
    sort1 = request.args.get('sort1', default='_id,-1').split(',')
    sort2 = request.args.get('sort2', default='').split(',')
    with_definitions = request.args.get('definitions', default='false')
    do_calc = request.args.get('do_calc', default=None)
    groups = request.args.get('groups', default=None)
    single_groups = request.args.get('single_groups', default=None)
    calculations = request.args.get('calculations', default=None)
    is_csv = request.args.get('output', default='json') == 'csv'

    user_role = g.user_role

    if not UserTools.has_right('applicant_data', user_role):
        return respond({'error': 'invalid_access'}, 400)

    ret = {
        'start': start,
        'limit': limit,
        'count': 0,
        'list': None,
        'query': None,
        'sort': None
    }
    # if with_definitions == 'true':
    #     ret['definitions'] = get_definitions()

    settings = DB.Settings.load_dict([
        'hide_applicant_fields'
    ])

    ret['hide_applicant_fields'] = settings['hide_applicant_fields']

    db_query = dict()
    db_queries = []  # for restrictions
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
                continue

            except ValueError:
                return respond({'error': 'invalid_filter', 'name': name}, 400)

    allowed_stgs = UserTools.get_allowed_stgs(g.user)
    if allowed_stgs:
        db_queries.append({'stg': {'$in': allowed_stgs}})

    if len(db_queries) > 0:
        db_queries.append(db_query)
        db_query = {'$and': db_queries}

    if groups is not None:
        allowed_groups = []

        if not isinstance(groups, unicode):
            return respond({'error': 'invalid_groups'}, 400)

        for name in groups.split(','):
            allowed_groups.append(name)

        allowed_calculations = list()
        allowed_ops = ['sum', 'avg', 'max', 'min', 'addToSet']
        if isinstance(calculations, unicode):
            for full_name in calculations.split(','):
                op, name = full_name.split('.', 2)
                if op not in allowed_ops:
                    continue
                allowed_calculations.append({'field': name, 'op': op})

        ret['groups'] = allowed_groups
        ret['calculations'] = allowed_calculations
        ret['group_results'] = DB.Applicant.calc_groups(allowed_groups, db_query, allowed_calculations)

    elif single_groups is not None:
        allowed_groups = []

        if not isinstance(single_groups, unicode):
            return respond({'error': 'invalid_groups'}, 400)

        for name in single_groups.split(','):
            allowed_groups.append(name)

        allowed_calculations = list()
        allowed_ops = ['sum', 'avg', 'max', 'min', 'addToSet']
        if isinstance(calculations, unicode):
            for full_name in calculations.split(','):
                op, name = full_name.split('.', 2)
                if op not in allowed_ops:
                    continue
                allowed_calculations.append({'field': name, 'op': op})

        ret['single_groups'] = allowed_groups
        ret['calculations'] = allowed_calculations
        ret['group_results'] = DB.Applicant.calc_single_groups(allowed_groups, db_query, allowed_calculations)

    elif do_calc == 'sums':
        ret['sums'] = DB.Applicant.calc_sums(db_query)

    elif do_calc == 'avgs':
        ret['avgs'] = None
        avgs = DB.Applicant.calc_avgs(db_query)
        if avgs:
            ret['avgs'] = {}
            for key, value in avgs.iteritems():
                ret['avgs'][key] = value

    elif is_csv:
        cursor = DB.Applicant.find(db_query, sort=db_sort)
        return respond_csv(cursor, ret)

    else:
        if not 1 <= limit <= 1000:
            return respond({'error': 'invalid_limit'}, 400)

        try:
            cursor = DB.Applicant.find(db_query, limit=limit, skip=start, sort=db_sort)
            ret['count'] = cursor.count()
            ret['list'] = [s.get_dict() for s in cursor]
        except DB.errors.OperationFailure as e:
            ret['count'] = 0
            ret['error'] = e.message
            status = 500

    ret['query'] = repr(db_query)
    ret['sort'] = repr(db_sort)

    return respond(ret, status)
