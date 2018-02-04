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


def handle():
    data = request.get_json()
    action = data.get('action')

    if action == 'get_tags':
        return get_tags()

    if action == 'add_tag':
        return add_tag(data)

    if action == 'edit_tag':
        return edit_tag(data)

    if action == 'remove_tag':
        return remove_tag(data)

    if action == 'assign_tag':
        return assign_tag(data)

    if action == 'unlink_tag':
        return unlink_tag(data)

    return respond({'error': 'unknown_action'}, 200)


def get_tags():
    data = {'result': []}
    for item in DB.Tag.find({}, sort=[['order', 1]]):
        data['result'].append(item.get_dict())

    return respond(data, 200)


def add_tag(data):
    if not UserTools.has_right('admin_access', g.user_role):
        return respond({'error': 'no_rights'}, 403)

    if not isinstance(data.get('name'), unicode):
        return respond({'error': 'invalid_name'}, 200)

    if not isinstance(data.get('order'), int):
        return respond({'error': 'invalid_order'}, 200)

    tag = DB.Tag()
    tag.name = data.get('name')
    tag.order = data.get('order')

    if isinstance(data.get('active'), bool):
        tag.active = data.get('active')

    if tag.db_insert():
        return respond({'status': 'ok', 'tag': tag.get_dict()}, 200)
    else:
        return respond({'error': 'insert_failed'}, 200)


def edit_tag(data):
    if not UserTools.has_right('admin_access', g.user_role):
        return respond({'error': 'no_rights'}, 403)

    if not isinstance(data.get('id'), unicode):
        return respond({'error': 'invalid_id'}, 200)

    if not isinstance(data.get('name'), unicode):
        return respond({'error': 'invalid_name'}, 200)

    if not isinstance(data.get('order'), int):
        return respond({'error': 'invalid_order'}, 200)

    tag = DB.Tag.find_one({'_id': data.get('id')})
    if tag is None:
        return respond({'error': 'tag_not_found'}, 200)

    # tag.name = data.get('name')
    tag.order = data.get('order')

    if isinstance(data.get('active'), bool):
        tag.active = data.get('active')

    if tag.db_update(['order', 'active']):
        return respond({'status': 'ok', 'tag': tag.get_dict()}, 200)
    else:
        return respond({'error': 'edit_failed'}, 200)


def remove_tag(data):
    if not UserTools.has_right('admin_access', g.user_role):
        return respond({'error': 'no_rights'}, 403)

    if not isinstance(data.get('id'), unicode):
        return respond({'error': 'invalid_id'}, 200)

    tag = DB.Tag.find_one({'_id': data.get('id')})
    if tag is None:
        return respond({'error': 'tag_not_found'}, 200)

    if not DB.StudentTag.remove_by_tag(tag.name):
        return respond({'error': 'remove_failed'}, 200)

    if tag.db_remove():
        return respond({'status': 'ok', 'tag': tag.get_dict()}, 200)
    else:
        return respond({'error': 'remove_failed'}, 200)


def assign_tag(data):
    if not isinstance(data.get('id'), unicode):
        return respond({'error': 'invalid_id'}, 200)

    if not isinstance(data.get('student_id'), unicode):
        return respond({'error': 'student_id'}, 200)

    tag = DB.Tag.find_one({'_id': data.get('id')})
    if tag is None:
        return respond({'error': 'tag_not_found'}, 200)

    if not tag.active:
        return respond({'error': 'tag_disabled'}, 200)

    settings = DB.Settings.load_dict([
        'student_ident_string'
    ])

    student_id = data.get('student_id')
    if not settings['student_ident_string']:
        student_id = int(student_id)

    student = DB.Student.find_one({'_id': student_id})
    if student is None:
        return respond({'error': 'student_not_found'}, 200)

    if not DB.StudentTag.create_tag(tag.name, student.ident):
        return respond({'error': 'create_failed'}, 200)

    if tag.name not in student.tags:
        student.tags.append(tag.name)

    if student.db_update(['tags']):
        return respond({'status': 'ok'}, 200)
    else:
        return respond({'error': 'update_failed'}, 200)


def unlink_tag(data):
    if not isinstance(data.get('id'), unicode):
        return respond({'error': 'invalid_id'}, 200)

    if not isinstance(data.get('student_id'), unicode):
        return respond({'error': 'student_id'}, 200)

    tag = DB.Tag.find_one({'_id': data.get('id')})
    if tag is None:
        return respond({'error': 'tag_not_found'}, 200)

    if not tag.active:
        return respond({'error': 'tag_disabled'}, 200)

    settings = DB.Settings.load_dict([
        'student_ident_string'
    ])

    student_id = data.get('student_id')
    if not settings['student_ident_string']:
        student_id = int(student_id)

    student = DB.Student.find_one({'_id': student_id})
    if student is None:
        return respond({'error': 'student_not_found'}, 200)

    link = DB.StudentTag.find_by_id(tag.name, student_id)
    if link is None:
        return respond({'error': 'link_not_found'}, 200)

    if not link.db_remove():
        return respond({'error': 'remove_failed'}, 200)

    student.tags.remove(link.name)

    if student.db_update(['tags']):
        return respond({'status': 'ok'}, 200)
    else:
        return respond({'error': 'update_failed'}, 200)
