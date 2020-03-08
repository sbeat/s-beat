"""
Copyright (c) 2019 S-BEAT GbR and others

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
import DataDefinitions
from WebAPI.APIBase import respond


def handle():
    student = g.user
    ret = dict()
    ret['student'] = student.get_dict(None, False)

    ret['definitions'] = get_definitions()

    cursor = DB.Exam.find({'student_id': student.ident}, sort=[('semester', 1)])
    ret['exams'] = [s.__dict__ for s in cursor]

    if ret['definitions']['compare_averages']:

        exam_ids = list(set([e['exam_info_id'] for e in ret['exams']]))
        exam_info_cursor = DB.ExamInfo.find({'_id': {'$in': exam_ids}})
        ret['exams_info'] = []

        for s in exam_info_cursor:
            entry = {
                'exam_info_id': s.exam_info_id,
                'semester_data': {}
            }
            for semid, d in s.semester_data.iteritems():
                if d['grades']:
                    del d['grades']['values']
                    entry['semester_data'][semid] = {'grades': d['grades']}

            ret['exams_info'].append(entry)

    course_semester = DB.CourseSemesterInfo.get_by_stg_and_semid(student.stg, student.start_semester)
    ret['course_semester'] = {'semester_data': course_semester.semester_data}
    if ret['course_semester']['semester_data']:
        for semid, d in ret['course_semester']['semester_data'].iteritems():
            continue  # del d['students']

    course = DB.Course.get_by_stg_original(student.stg_original)
    ret['student']['course'] = {
        'name': course.name,
        'short_name': course.short_name,
        'degree_type': course.degree_type
    }

    settings = DB.Settings.load_dict([
        'sv_max_risk_paths',
    ])

    ret['paths'] = [s.get_dict(True, True) for s in student.get_paths()][0:settings['sv_max_risk_paths']]

    ret['texts'] = [t.get_dict(True) for t in DB.DisplayText.get_by_student(student)]

    return respond(ret, 200)


def get_queries(settings):
    filters = dict()

    for name, query in DataDefinitions.get_queries().iteritems():
        if query.q == 'stg':
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

    for pe in DataDefinitions.get_elements():
        if pe.query.q == 'stg_original':
            continue
        if pe.query.q == 'stg':
            continue

        data['path_elements'][pe.md5_id()] = pe.get_dict(query_id=True)

    last_date = DB.MetaData.find_by_id('lastDate')
    data['lastDate'] = last_date.data['date'] if last_date is not None else None

    settings = DB.Settings.load_dict([
        'generate_risk_group_all',
        'generate_risk_group_stg',
        'generate_risk_group_degree',
        'main_risk_group',
        'sv_compare_averages',
        'cp_label',
        'hide_median_risk',
        'sv_hide_student_fields',
        'sv_show_risk_value',
        'sv_text_top',
        'sv_text_left',
        'sv_text_bottom'
    ])

    data['queries'] = get_queries(settings)

    data['lights'] = DB.Settings.load_dict_for_key('lights')
    data['generate_risk_group_all'] = settings['generate_risk_group_all']
    data['generate_risk_group_stg'] = settings['generate_risk_group_stg']
    data['generate_risk_group_degree'] = settings['generate_risk_group_degree']
    data['hide_student_fields'] = settings['sv_hide_student_fields']
    data['main_risk_group'] = settings['main_risk_group']
    data['risk_value_allowed'] = settings['sv_show_risk_value']
    data['compare_averages'] = settings['sv_compare_averages']
    data['hide_median_risk'] = settings['hide_median_risk']
    data['text_top'] = settings['sv_text_top']
    data['text_left'] = settings['sv_text_left']
    data['text_bottom'] = settings['sv_text_bottom']

    return data


def get_student_matching_elements(student_id):
    student = DB.Student.find_one({'_id': student_id})
    if student is None:
        return None

    return [pe.md5_id() for pe in student.get_matching_elements()]
