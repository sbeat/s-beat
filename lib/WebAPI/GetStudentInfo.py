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
from APIBase import respond
from GetDefinitions import get_definitions
import UserTools


def handle():
    # if request.method == 'POST':
    # name = request.form['name']

    status = 200

    if 'ident' not in request.args:
        return respond({'error': 'missing_ident'}, 400)

    with_definitions = request.args.get('definitions', default='false')
    with_semesters = request.args.get('semesters', default='false')
    with_course_semester = request.args.get('course_semester', default='false')

    user_role = g.user_role

    ret = {}

    settings = DB.Settings.load_dict([
        'hide_finished_ident_data',
        'student_ident_string'
    ])

    ident = request.args.get('ident')
    if not settings['student_ident_string']:
        ident = int(ident)

    if with_definitions == 'true':
        ret['definitions'] = get_definitions()

    db_query = {
        '_id': ident
    }



    allowed_stgs = UserTools.get_allowed_stgs(g.user)
    if allowed_stgs:
        db_query['stg'] = {'$in': allowed_stgs}

    try:
        student = DB.Student.find_one(db_query)
        if not student:
            return respond({'error': 'not_found'}, 404)

        ret['student'] = student.get_dict(user_role, hide_finished_ident_data=settings['hide_finished_ident_data'])

        if with_course_semester == 'true':
            course_semester = DB.CourseSemesterInfo.get_by_stg_and_semid(student.stg, student.start_semester)
            ret['course_semester'] = course_semester.__dict__

        if with_semesters == 'true':
            ret['semesters'] = []
            for sem_nr in range(1, len(student.study_semesters) + 1):
                s = student.get_student_in_semester(sem_nr)
                risk = s.calculate_risk()
                if 'failed' in risk:
                    s.risk = risk['failed']

                ret['semesters'].append(s.get_dict(user_role,
                                                   hide_finished_ident_data=settings['hide_finished_ident_data']))

    except DB.errors.OperationFailure as e:
        ret['count'] = 0
        ret['error'] = e.message
        status = 500

    return respond(ret, status)
