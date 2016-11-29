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
import UserTools
from APIBase import respond

available_formatting = [
    'auto',
    'str',
    'int',
    'gender',
    'grade',
    'date',
    'stg',
    'semester',
    'yesno',
    'percent'
]

available_comparators = [
    'equal',
    'lower',
    'lower_equal',
    'greater',
    'greater_equal',
    'between',
    'is_nan',
    'in',
    'is'
]


def handle():
    if not UserTools.has_right('admin_access', g.user_role):
        return respond({'error': 'no_rights'}, 403)

    data = request.get_json()
    action = data.get('action')

    if action == 'get_all_definitions':
        return get_all_definitions()

    if action == 'get_definition_stats':
        return get_definition_stats()

    if action == 'add_query':
        return add_query(data)

    if action == 'edit_query':
        return edit_query(data)

    if action == 'remove_query':
        return remove_query(data)

    if action == 'add_path_element':
        return add_path_element(data)

    if action == 'edit_path_element':
        return edit_path_element(data)

    if action == 'remove_path_element':
        return remove_path_element(data)

    return respond({'error': 'unknown_action'}, 200)


def get_all_definitions():
    data = {'queries': {}, 'path_elements': {}}
    for item in DB.Query.find({}):
        data['queries'][item.md5_id()] = item.get_dict(True)

    for item in DB.PathElement.find({}):
        data['path_elements'][item.md5_id()] = item.get_dict(True)

    return respond(data, 200)


def get_definition_stats():
    data = {'path_element_stats': {}}
    path_elements = {}
    for item in DB.PathElement.find({}):
        path_elements[item.md5_id()] = item

    for pe_id, pe in path_elements.iteritems():
        pe_list = [pe]
        if isinstance(pe.query.depends, set):
            for dep_pe_id in pe.query.depends:
                if dep_pe_id in path_elements:
                    pe_list.append(path_elements[dep_pe_id])

        count = DB.Student.get_matching_students_count(pe_list)
        data['path_element_stats'][pe_id] = {'count': count}

    return respond(data, 200)


def add_query(data):
    query = DB.Query()
    errors = set_query_from_input(query, data)

    if len(errors) > 0:
        return respond({'error': 'invalid_data', 'errors': errors}, 200)

    if query.db_insert():
        return respond({'status': 'ok', 'query': query.get_dict()}, 200)
    else:
        return respond({'error': 'insert_failed'}, 200)


def edit_query(data):
    if not isinstance(data.get('query_id'), unicode):
        return respond({'error': 'invalid_query_id'}, 200)

    query_id = long(data.get('query_id'))

    query = DB.Query.find_by_id(query_id)
    if query is None:
        return respond({'error': 'query_not_found'}, 200)

    errors = set_query_from_input(query, data)

    if len(errors) > 0:
        return respond({'error': 'invalid_data', 'errors': errors}, 200)

    if query.db_update():
        if query_id != query.md5_id():
            DB.PathElement.update_query_id(query_id, query.md5_id())
        return respond({'status': 'ok', 'query': query.get_dict()}, 200)
    else:
        return respond({'error': 'edit_failed'}, 200)


def remove_query(data):
    if not isinstance(data.get('query_id'), unicode):
        return respond({'error': 'invalid_query_id'}, 200)

    query_id = long(data.get('query_id'))

    query = DB.Query.find_by_id(query_id)
    if query is None:
        return respond({'error': 'query_not_found'}, 200)

    if query.db_remove():
        DB.PathElement.remove_by_query_id(query_id)
        return respond({'status': 'ok', 'query': query.get_dict()}, 200)
    else:
        return respond({'error': 'remove_failed'}, 200)


def add_path_element(data):
    if not isinstance(data.get('query_id'), unicode):
        return respond({'error': 'invalid_query_id'}, 200)

    query_id = long(data.get('query_id'))

    query = DB.Query.find_by_id(query_id)
    if query is None:
        return respond({'error': 'query_not_found'}, 200)

    pe = DB.PathElement(query, DB.Condition())
    errors = set_path_element_from_input(pe, data)

    if len(errors) > 0:
        return respond({'error': 'invalid_data', 'errors': errors}, 200)

    if pe.db_insert():
        return respond({'status': 'ok', 'pe': pe.get_dict()}, 200)
    else:
        return respond({'error': 'insert_failed'}, 200)


def edit_path_element(data):
    if not isinstance(data.get('pe_id'), unicode):
        return respond({'error': 'invalid_pe_id'}, 200)

    pe_id = long(data.get('pe_id'))

    pe = DB.PathElement.find_by_id(pe_id)
    if pe is None:
        return respond({'error': 'pe_not_found'}, 200)

    errors = set_path_element_from_input(pe, data)

    if len(errors) > 0:
        return respond({'error': 'invalid_data', 'errors': errors}, 200)

    if pe_id != pe.md5_id():
        DB.PathElement.remove_by_id(pe_id)

        if pe.db_insert():
            return respond({'status': 'ok', 'pe': pe.get_dict()}, 200)

    elif pe.db_update():
        return respond({'status': 'ok', 'pe': pe.get_dict()}, 200)
    else:
        return respond({'error': 'edit_failed'}, 200)


def remove_path_element(data):
    if not isinstance(data.get('pe_id'), unicode):
        return respond({'error': 'invalid_pe_id'}, 200)

    pe_id = long(data.get('pe_id'))

    pe = DB.PathElement.find_by_id(pe_id)
    if pe is None:
        return respond({'error': 'pe_not_found'}, 200)

    if pe.db_remove():
        return respond({'status': 'ok', 'pe': pe.get_dict()}, 200)
    else:
        return respond({'error': 'remove_failed'}, 200)


def set_query_from_input(query, data):
    errors = []
    if not isinstance(data.get('name'), unicode):
        errors.append('invalid_name')

    if not isinstance(data.get('category'), unicode):
        errors.append('invalid_category')

    if not isinstance(data.get('formatting'), unicode) or data.get('formatting') not in available_formatting:
        errors.append('invalid_formatting')

    if not isinstance(data.get('q'), unicode):
        errors.append('invalid_q')

    if not isinstance(data.get('success'), bool):
        errors.append('invalid_success')

    if not isinstance(data.get('depends'), list) and data.get('depends') is not None:
        errors.append('invalid_depends')
    elif data.get('depends') is not None:
        for item in data.get('depends'):
            if not isinstance(item, unicode):
                errors.append('invalid_depends_item')

    if not isinstance(data.get('ignore'), bool):
        errors.append('invalid_ignore')

    if 'auto_generate' in data and not isinstance(data.get('auto_generate'), bool):
        errors.append('invalid_auto_generate')

    if len(errors) > 0:
        return errors

    query.name = data.get('name')
    query.category = data.get('category')
    query.formatting = data.get('formatting')
    query.q = data.get('q')
    query.success = data.get('success')
    query.ignore = data.get('ignore')
    if 'auto_generate' in data:
        query.auto_generate = data.get('auto_generate')

    if isinstance(data.get('depends'), list):
        query.depends = set()
        for pe_id in data.get('depends'):
            query.depends.add(long(pe_id))
    else:
        query.depends = None

    return errors


def set_path_element_from_input(pe, data):
    """
    Checks input and applies data to given path element
    :param pe: PathElement
    :param data:
    :return:
    """
    errors = []
    if 'name' in data and not isinstance(data.get('name'), unicode) and data.get('name') is not None:
        errors.append('invalid_name')

    if 'comparator' in data and (
                not isinstance(data.get('comparator'), unicode) or data.get('comparator') not in available_comparators):
        errors.append('invalid_comparator')

    if 'compare_value' in data and not isinstance(data.get('compare_value'), unicode) and not isinstance(
            data.get('compare_value'), int) and not isinstance(data.get('compare_value'), list):
        errors.append('invalid_compare_value')

    if 'negate' in data and not isinstance(data.get('negate'), bool):
        errors.append('invalid_negate')

    if 'order' in data and not isinstance(data.get('order'), int):
        errors.append('invalid_order')

    if len(errors) > 0:
        return errors

    if 'name' in data:
        pe.condition.name = data.get('name')
        if len(pe.condition.name) == 0:
            pe.condition.name = None

    if 'comparator' in data:
        pe.condition.comparator = data.get('comparator')

    if 'compare_value' in data:
        pe.condition.compare_value = data.get('compare_value')
        if isinstance(pe.condition.compare_value, list):
            pe.condition.compare_value = tuple(pe.condition.compare_value)

    if 'negate' in data:
        pe.condition.negate = data.get('negate')

    if 'order' in data:
        pe.condition.order = data.get('order')

    return errors
