#  Copyright (c) 2019 S-BEAT GbR and others
#
#  This file is part of S-BEAT.
#
#  S-BEAT is free software: you can redistribute it and/or modify
#  it under the terms of the GNU General Public License as published by
#  the Free Software Foundation, either version 3 of the License, or
#  (at your option) any later version.
#
#  S-BEAT is distributed in the hope that it will be useful,
#  but WITHOUT ANY WARRANTY; without even the implied warranty of
#  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
#  GNU General Public License for more details.
#
#  You should have received a copy of the GNU General Public License
#  along with S-BEAT. If not, see <http://www.gnu.org/licenses/>.

from flask import request, g

import DB
import UserTools
from APIBase import respond
from GetDefinitions import get_definitions


def handle():
    if not UserTools.has_right('admin_access', g.user_role):
        return respond({'error': 'no_rights'}, 403)

    data = request.get_json()
    action = data.get('action')

    if action == 'get_texts':
        return get_display_texts(data)

    if action == 'add_text':
        return add_text(data)

    if action == 'edit_text':
        return edit_query(data)

    if action == 'remove_text':
        return remove_query(data)

    return respond({'error': 'unknown_action'}, 200)


def get_display_texts(data):
    query = {}
    if 'filters' in data and type(data['filters']) is list:
        query['filters'] = {"$all": data['filters']}

    result = {
        'texts': [text.get_dict() for text in DB.DisplayText.find(query, sort=[('position', 1),('order', 1)])],
        'definitions': get_definitions()
    }

    return respond(result, 200)


def add_text(data):
    errors = validate_data(data)

    if len(errors) > 0:
        return respond({'error': 'invalid_data', 'errors': errors}, 200)

    text_entry = DB.DisplayText()
    assign_data(data, text_entry)

    if text_entry.db_insert():
        return respond({'status': 'ok', 'text': text_entry.get_dict()}, 200)
    else:
        return respond({'error': 'insert_failed'}, 200)


def edit_query(data):
    errors = validate_data(data)

    if len(errors) > 0:
        return respond({'error': 'invalid_data', 'errors': errors}, 200)

    text_entry = DB.DisplayText.find_one({'_id': data['ident']})
    if not text_entry:
        return respond({'error': 'not_found'}, 200)

    assign_data(data, text_entry)

    if text_entry.db_save():
        return respond({'status': 'ok', 'text': text_entry.get_dict()}, 200)
    else:
        return respond({'error': 'save_failed'}, 200)


def remove_query(data):
    if 'ident' not in data or len(data['ident']) < 2:
        return respond({'error': 'invalid_ident'}, 200)

    text_entry = DB.DisplayText.find_one({'_id': data['ident']})
    if not text_entry:
        return respond({'error': 'not_found'}, 200)

    if text_entry.db_remove():
        return respond({'status': 'ok', 'text': text_entry.get_dict()}, 200)
    else:
        return respond({'error': 'remove_failed'}, 200)


def assign_data(data, text_entry):
    text_entry.ident = data['ident']
    text_entry.position = data['position']
    text_entry.enabled = data['enabled']
    text_entry.filters = data['filters']
    text_entry.text = data['text']
    text_entry.order = data['order']


def validate_data(data):
    errors = []
    if 'ident' not in data or type(data['ident']) is not unicode or len(data['ident']) < 2:
        errors.append('invalid_ident')

    if 'position' not in data or type(data['position']) is not unicode or len(data['position']) < 2:
        errors.append('invalid_position')

    if 'text' not in data or type(data['text']) is not unicode:
        errors.append('invalid_text')

    if 'enabled' not in data or type(data['enabled']) is not bool:
        errors.append('invalid_enabled')

    if 'order' not in data or type(data['order']) is not int:
        errors.append('invalid_order')

    return errors

