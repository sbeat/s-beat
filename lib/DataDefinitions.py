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

import pickle
import datetime

_elements = []  # List of PathElements
_queries = dict()  # Dictionary of Queries
_elements_by_hash = dict()

_last_loaded_date = None
_last_checked_date = None
_last_db_prefix = ''

"""
Formats:
    str
    int
    gender      M,W
    grade       three digit number
    date        timestamp to format as YYYY-MM-DD
    stg         short of a course of study
    semester    semester id in form of [year][1|2]
    yesno       boolean to display as yes or no
    percent     number betwen 0.0 and 1.0 to be formatted as num*100%

"""


def get_condition_groups(field, num=4):
    from DB import Student, Condition

    datalist = sorted(Student.get_grouped_values(field), key=lambda sd: sd['_id'])
    print datalist

    if len(datalist) <= num:
        return [Condition('equal', d['_id']) for d in datalist]

    conditions = []
    count = len(datalist)
    step = 1.0 / num
    steps = [(i + 1) * step for i in range(num - 1)]
    for i, q in enumerate(steps):
        d = datalist[int(count * q)]
        if i == 0:
            conditions.append(Condition('lower', d['_id']))
        else:
            ld = datalist[int(count * steps[i - 1])]
            conditions.append(Condition('between', (ld['_id'], d['_id'])))
            if i == len(steps) - 1:
                conditions.append(Condition('greater', d['_id']))

    return conditions


def get_elements():
    _check_reload_meta_data()
    return _elements


def get_queries():
    _check_reload_meta_data()
    return _queries


def get_element_by_hash(el_id):
    _check_reload_meta_data()
    return _elements_by_hash.get(el_id, None)


def get_element_by_name(name):
    _check_reload_meta_data()
    for pe in _elements:
        if pe.condition.name == name:
            return name
    return None


def get_elements_by_query(query):
    _check_reload_meta_data()
    return [el for el in _elements if el.query == query]


def _reset_definitions():
    global _elements, _queries, _elements_by_hash
    _elements = []  # List of PathElements
    _queries = dict()  # Dictionary of Queries
    _elements_by_hash = dict()


def save_definitions_to_meta_data():
    from DB import MetaData
    import bson

    data = {
        'elements': _elements,
        'queries': _queries
    }

    MetaData.set_data('definitions', bson.Binary(pickle.dumps(data)))
    MetaData.set_data('definitionsDate', datetime.datetime.utcnow())


def load_definitions_from_meta_data():
    global _elements, _queries, _elements_by_hash, _last_loaded_date, _last_db_prefix
    from DB import MetaData

    _last_db_prefix = MetaData.get_collection_prefix()

    _elements = []
    _queries = dict()
    _elements_by_hash = dict()

    md = MetaData.find_by_id('definitions')
    if md is None:
        return

    data = pickle.loads(md.data)
    _elements = data['elements']
    _queries = data['queries']

    for el in _elements:
        _elements_by_hash[el.md5_id()] = el

    _last_loaded_date = datetime.datetime.utcnow()


def _check_reload_meta_data():
    from DB import MetaData
    prefix = MetaData.get_collection_prefix()

    global _last_checked_date

    now = datetime.datetime.utcnow()

    if _last_checked_date is not None:
        delta = now - _last_checked_date
        _last_checked_date = now

        if delta < datetime.timedelta(0, 60) and _last_db_prefix == prefix:
            return False
    else:
        _last_checked_date = now

    md = MetaData.find_by_id('definitionsDate')

    if _last_loaded_date is None or _last_db_prefix != prefix or md is None or _last_loaded_date < md.data:
        load_definitions_from_meta_data()
        return True

    return False


def save_defintions_to_db():
    for q, query in _queries.iteritems():
        query.db_insert()

    for pe in _elements:
        pe.db_insert()


def load_definitions_from_db():
    global _elements, _queries, _elements_by_hash
    import DB

    _reset_definitions()

    for query in DB.Query.find({}):
        _queries[query.q] = query

    for pe in DB.PathElement.find({}):
        _elements.append(pe)

    for el in _elements:
        _elements_by_hash[el.md5_id()] = el


def generate_definitions_in_db():
    import DB

    for query in DB.Query.find({'auto_generate': True}):
        DB.PathElement.remove_by_query_id(query.md5_id())
        for d in DB.Student.get_grouped_values(query.q):
            pe = DB.PathElement(query, DB.Condition('equal', d['_id']))
            pe.db_insert()


def export_definitions_from_db(with_generated_pe=False):
    import DB
    import json

    data = {'queries': {}, 'path_elements': {}}
    for item in DB.Query.find({}):
        data['queries'][item.md5_id()] = item.get_dict(True)

    for item in DB.PathElement.find({}):
        if item.query.auto_generate and with_generated_pe is False:
            continue
        data['path_elements'][item.md5_id()] = item.get_dict(True)

    return json.dumps(data, ensure_ascii=False, indent=4, separators=(',', ': '))


def import_definitions_into_db(json_data, drop_before=False):
    import DB
    import json

    data = json.loads(json_data)
    if 'queries' not in data or 'path_elements' not in data:
        print 'Error: missing queries or path_elements'
        return

    if drop_before:
        DB.Query.drop()
        DB.PathElement.drop()

    queries = {}
    path_elements = {}
    index_q = 0
    index_pe = 0
    for q_id, query_data in data['queries'].iteritems():
        queries[q_id] = DB.Query.from_dict(query_data)

    for pe_id, pe_data in data['path_elements'].iteritems():
        path_elements[pe_id] = DB.PathElement(
            queries[pe_data['query_id']],
            DB.Condition.from_dict(pe_data['condition'])
        )

    for q_id, query in queries.iteritems():
        if query.depends is not None:
            depends = set()
            for pe_id in query.depends:
                pe = path_elements[pe_id]
                if pe:
                    depends.add(pe.md5_id())
            query.depends = depends

        if query.db_insert():
            index_q += 1

    for pe_id, pe in path_elements.iteritems():
        if pe.db_insert():
            index_pe += 1

    print 'imported', index_q, 'queries and ', index_pe, 'path elements'


load_definitions_from_meta_data()
