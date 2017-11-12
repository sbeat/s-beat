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

from flask import g

import DB
from APIBase import respond
import DataDefinitions
import UserTools


def get_queries(settings):
    filters = dict()

    allowed_stgs = UserTools.get_allowed_stgs(g.user)

    for name, query in DataDefinitions.get_queries().iteritems():
        if allowed_stgs is not None and query.q == 'stg' and len(allowed_stgs) == 1:
            continue
        filters[query.md5_id()] = query.get_dict(replace_vars={
            '{cp_label}': settings['cp_label']
        })

    return filters


def get_definitions():
    data = {
        'path_elements': {},
        'restricted': []  # list of restricted fields
    }
    user_role = g.user_role

    for field, role in DB.Student.restricted_fields.iteritems():
        if not UserTools.has_right(role, user_role):
            data['restricted'].append(field)

    allowed_stgs = UserTools.get_allowed_stgs(g.user)

    for pe in DataDefinitions.get_elements():
        if allowed_stgs is not None and pe.query.q == 'stg_original' \
                and DB.Course.get_mapped_short(pe.condition.compare_value) not in allowed_stgs:
            continue
        if allowed_stgs is not None and pe.query.q == 'stg' \
                and (pe.condition.compare_value not in allowed_stgs or len(allowed_stgs) == 1):
            continue

        data['path_elements'][pe.md5_id()] = pe.get_dict(query_id=True)

    last_date = DB.MetaData.find_by_id('lastDate')
    data['lastDate'] = last_date.data['date'] if last_date is not None else None

    data['user_roles'] = UserTools.user_roles.keys()

    risk_values_allowed_key = 'risk_value_' + user_role
    settings = DB.Settings.load_dict([
        risk_values_allowed_key,
        'generate_risk_group_all',
        'generate_risk_group_stg',
        'generate_risk_group_degree',
        'main_risk_group',
        'compare_averages',
        'cp_label',
        'hide_resigned',
        'hide_median_risk'
    ])

    data['queries'] = get_queries(settings)

    data['lights'] = DB.Settings.load_dict_for_key('lights')
    data['generate_risk_group_all'] = settings['generate_risk_group_all']
    data['generate_risk_group_stg'] = settings['generate_risk_group_stg']
    data['generate_risk_group_degree'] = settings['generate_risk_group_degree']
    data['main_risk_group'] = settings['main_risk_group']
    data['risk_value_allowed'] = settings[risk_values_allowed_key]
    data['compare_averages'] = settings['compare_averages']
    data['hide_resigned'] = settings['hide_resigned']
    data['hide_median_risk'] = settings['hide_median_risk']

    return data


def handle():
    # if request.method == 'POST':
    # name = request.form['name']

    return respond(get_definitions(), 200)
