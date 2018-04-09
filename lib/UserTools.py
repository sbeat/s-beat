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

import time

user_rights = [
    # 'courses_access',
    # 'students_access',
    # 'exams_access',
    'admin_access',
    'personal_data',
    'identification_data',
    'list_identification_data',
    'applicant_data'
]

# the following user roles can be overwritten by the main.cfg
user_roles = {
    'admin': ['admin_access', 'personal_data', 'identification_data', 'list_identification_data', 'applicant_data'],
    'berater': ['personal_data', 'identificationd_data'],
    'dozent': ['personal_data', 'identificationd_data'],
    'guest': []
}

all_users = {}
last_loaded = None


def set_user_roles_by_config(config):
    global user_roles
    if not config.has_section('user_roles'):
        return

    user_roles = {}
    for role, rights_text in config.items('user_roles'):
        user_roles[role] = rights_text.split(',')


def has_right(required_right, user_role='guest'):
    rights = user_roles.get(user_role, [])
    if required_right in rights:
        return True
    else:
        return False


def has_stg(required_stg, user):
    if user['stg_list'] is None or required_stg in user['stg_list']:
        return True
    else:
        return False


def get_allowed_stgs(user):
    """
    Returns None if all stgs are allowed
    :param user:
    :return:
    """
    return user['stg_list']


def get_all_users():
    """
    Loads users from file and returns looked up user.
    Returns the user
    :return:
    """
    global all_users, last_loaded
    if len(all_users) == 0 or last_loaded is None or last_loaded < time.time() - 10:
        with open('config/access_users.txt', 'rb') as f:
            all_users = {}
            for u in f.readlines():
                u = u.decode("utf-8").strip()
                if len(u) == 0:
                    continue
                parts = u.split(u';')
                if len(parts) >= 2:
                    name = parts[0].strip()
                    all_users[name] = {'name': name, 'role': parts[1].strip(), 'stg_list': None}
                    if len(parts) == 3:
                        all_users[name]['stg_list'] = [stg.strip() for stg in parts[2].split(u',')]

            last_loaded = time.time()
    return all_users


def get_user(user):
    users = get_all_users()
    return users.get(user)


def save_user(username, role, stg_list):
    global all_users
    users = get_all_users()
    if role is None and username in users:
        del users[username]
    elif role not in user_roles:
        return False
    else:
        users[username] = {'role': role, 'stg_list': stg_list}

    content = unicode()
    for user, ud in users.iteritems():
        if ud['stg_list'] is not None:
            content += user + u';' + ud['role'] + u';' + (u",".join(ud['stg_list'])) + u'\n'
        elif ud['role'] is not None:
            content += user + u';' + ud['role'] + u'\n'

    with open('config/access_users.txt', 'wb') as f:
        f.write(content.encode('utf-8'))
        f.close()
        all_users = {}

    return True



