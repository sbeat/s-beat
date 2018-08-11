"""
Copyright (c) 2016 S-BEAT GbR and others and others

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

import array
import base64
import hashlib
import logging
import numbers
import time

from pymongo import errors

import CalcTools
import ImportTools
import UserTools
from Course import Course
from CourseSemesterInfo import CourseSemesterInfo
from Db import DBDocument, get_last_error
from Exam import Exam
from ExamInfo import ExamInfo
from MarkedList import MarkedList
from Path import Path
from ProcessTracking import ProcessTracking
from Settings import Settings
from StudentTag import StudentTag
from ImportTools import get_date_from_csv, get_int, get_unicode, get_boolean, clean_db_string

encoding = 'windows-1252'
logger = logging.getLogger(__name__)


class Student(DBDocument):
    collection_name = 'students'

    restricted_fields = {
        'gender': 'personal_data',
        'birth_date': 'personal_data',
        'hzb_grade': 'personal_data',
        'hzb_type': 'personal_data',
        'hzb_date': 'personal_data',
        'matrikelno': 'identification_data',
        'forename': 'identification_data',
        'surname': 'identification_data',
        'short': 'identification_data',
        'email': 'identification_data',
        'country': 'identification_data',
        'zip': 'identification_data',
        'citship': 'identification_data',
        'eu': 'identification_data',
        'applicant_ident': 'applicant_data',
        'appl_date': 'applicant_data',
        'adm_date': 'applicant_data',
    }

    cached_min_max = None

    def __init__(self, **kwargs):

        self.ident = None  # System Ident number
        self.ident_original = None  # Original ident number
        self.gender = ''  # Gender of student: M,W
        self.birth_date = None  # Date of birth
        self.hzb_grade = 0  # entrance qualification grade
        self.hzb_type = ''  # entrance qualification type
        self.hzb_date = None  # entrance qualification date
        self.stg = None  # Short of the degree course (already mapped!)
        self.stg_original = None  # Original unmapped course
        self.degree_type = None  # type of degree: Diplom,Bachelor,Master
        self.imm_date = None  # Enrollment date
        self.exm_date = None  # Disenrollment date
        self.finished = False  # Whether the study is finished
        self.success = False  # Whether the study is finished successful
        self.aborted = False  # Whether the study has been aborted
        self.status = None  # Status 1=Finished, 2=Aborted, 3=Successful, 4=Studying
        self.tags = []

        # applicant data
        self.applicant_ident = None  # ident of the applicant
        self.appl_date = None  # application date
        self.adm_date = None  # admission date

        # Identity
        self.matrikelno = None
        self.forename = None
        self.surname = None
        self.short = None
        self.email = None
        self.country = None  # country of residence
        self.zip = None  # zip code
        self.citship = None  # citizenship
        self.eu = None  # EU citizen (yes/no)

        # 1st step calculated values
        self.start_semester = None  # calculated start semester number
        self.end_semester = None  # calculated end semester number
        self.age = None  # Age of student
        self.hzb_imm_time = None  # count of months between entrance qualification and enrollment
        self.semesters = None  # Count of semesters between imm and exm
        self.final_grade = None  # grade of thesis imported from Exams
        self.consulted = False

        # 2nd step calculated values
        self.exams = None  # dictionary of distinct exams the student has taken part in
        self.exams_grades = None  # dictionary of distinct exams the student has a grade with the grade as value
        self.exam_count = None  # count of exams in database
        self.exam_count_finish = None  # count of finished exams
        self.exam_count_success = None  # count of successful exams
        self.exam_count_failed = None  # count of failed exams
        self.exam_count_applied = None  # count of applied exams
        self.exam_count_resigned = None  # count of resigned exams: status=AN and comment in (G,U,RT)
        self.exam_resign_perc = None  # percent of resigned exams
        self.exam_success_perc = None  # percent of successful exams
        self.exam_failed_perc = None  # percent of failed exams
        self.exam_count_status = {}  # counts by status
        self.exam_count_type = {}  # counts by type
        self.exam_count_try = {}  # counts by tries
        self.bonus_total = None  # total count of reached ECTS points
        self.study_time_real = None  # amount of semesters with finished exams
        self.study_semesters = []  # list of semester numbers
        self.semester_data = {}  # dictionary for every semester # {sem_1: {bonus:0, bonus_total:0, ...}}
        self.phase_data = {}  # dictionary for every phase # {G: {bonus:0, bonus_total:0, ...}, H:...}
        self.cnt_delayed_exams = 0  # count of delayed exams due to valid reasons: is_resigned and comment==G
        self.cnt_unauthorized_delayed_exams = 0  # count of delayed exams due to unauthorized absence
        self.grade_basic_studies = None  # average grade reached in the basic studies
        self.grade_main_studies = None  # average grade reached in the main studies
        self.grade_current = None  # average grade reached until now
        self.grade_nb_current = None  # average grade reached until now incl. NB and EN exams
        self.grade_total = None  # average grade reached in total
        self.ignore = False  # if data is faulty - ignore student
        self.current_semester = None

        # 5th step calculated risk values
        self.risk = None  # dictionary with probability for success and fail
        self.risk_all = None
        self.risk_stg = None
        self.risk_degree = None

    def get_student_in_semester(self, sem_nr):
        """
        Returns a new Student Object with the state of this Student in a particular semester.
        :param sem_nr:
        :return:
        """
        student = Student()
        semester_dependent_fields = [
            'exm_date', 'finished', 'success', 'aborted', 'status', 'semesters', 'exams', 'exams_grades',
            'exam_count', 'exam_count_finish', 'exam_count_success', 'exam_count_failed', 'bonus_total',
            'study_time_real', 'study_semesters', 'semester_data', 'phase_data', 'cnt_delayed_exams',
            'cnt_unauthorized_delayed_exams', 'grade_basic_studies', 'grade_main_studies', 'grade_current',
            'grade_total', 'current_semester', 'risk', 'exam_count_applied', 'exam_count_resigned',
            'exam_resign_perc', 'exam_success_perc', 'exam_failed_perc', 'risk_preferred'
        ]
        for field, value in self.__dict__.iteritems():
            if field not in semester_dependent_fields:
                student.__dict__[field] = value

        if len(self.study_semesters) < sem_nr:
            return None

        max_semester_id = self.study_semesters[sem_nr - 1]
        student.calculate_from_exams(max_semester_id, True)

        return student

    def get_dict(self, user_role=None, hide_finished_ident_data=True):
        data = self.__dict__.copy()
        if user_role is not None:
            for field, role in self.restricted_fields.iteritems():
                if not UserTools.has_right(role, user_role) and field in data:
                    del data[field]
        if hide_finished_ident_data and self.finished:
            for field, role in self.restricted_fields.iteritems():
                if role == 'identification_data':
                    del data[field]

        return data

    @classmethod
    def is_field_allowed(cls, field, user_role):
        if field not in cls.restricted_fields:
            return True
        role = cls.restricted_fields[field]
        if UserTools.has_right(role, user_role):
            return True
        return False

    def get_semester_number(self, semester_id, real=False):
        """
        returns semester number
        :param semester_id:
        :param real: semesters where the student took part in exams
        :return:
        """
        number = 0
        real_number = 0
        current = self.start_semester
        while current <= semester_id:
            number += 1
            if current in self.study_semesters:
                real_number += 1
            if current % 10 == 2:
                current = (current // 10 + 1) * 10 + 1
            else:
                current += 1

        if real:
            return real_number
        else:
            return number

    def get_matching_elements(self):
        import DataDefinitions

        return [pe for pe in DataDefinitions.get_elements() if pe.check(self)]

    def generate_path_hashes(self, filter_count, success_count):
        import itertools
        import DataDefinitions

        success_elements = [el for el in DataDefinitions.get_elements() if el.query.success]
        filter_path_elements = self.get_matching_elements()

        generated = set()

        for filter_elements in itertools.combinations(filter_path_elements, filter_count):
            for elements in itertools.combinations(success_elements, success_count):
                path = Path()
                path.filter_elements = set(filter_elements)
                path.elements = set(elements)

                if path.is_valid():
                    # print 'generate:', hash(path), path.get_str()
                    generated.add(path.md5_id())

        # print self.ident, 'matching elements', len(generated), [f.get_str() for f in filter_path_elements]
        return generated

    def __repr__(self):
        return 'Student(' + repr(self.__dict__) + ')'

    def db_transform(self):
        """
        Transforms self to a database dictionary object.
        Gets called by transform_incoming of SONManipulator
        """
        data = self.__dict__.copy()
        del data['ident']
        data['_id'] = self.ident
        return data

    @staticmethod
    def db_create(son):
        """
        Creates a new Instance based of database SON data.
        Gets called by transform_outgoing of SONManipulator
        """
        p = Student()
        p.ident = son['_id']
        del son['_id']
        p.__dict__.update(son)
        return p

    @classmethod
    def get_min_max(cls, field='start_semester', cached=True):
        if cls.cached_min_max is not None and cached:
            return cls.cached_min_max
        result = cls.db_aggregate([
            {"$group": {"_id": 0, "max_count": {"$max": "$" + field}, "min_count": {"$min": "$" + field}}}
        ])[0]
        cls.cached_min_max = (result["min_count"], result["max_count"])
        return cls.cached_min_max

    @staticmethod
    def generate_ident(student, fields):
        if len(fields) == 1:
            return getattr(student, fields[0])
        m = hashlib.md5()
        for field in fields:
            m.update(unicode(getattr(student, field)))
        return base64.b32encode(m.digest())[0:8]

    @staticmethod
    def import_from_file(file_info):
        import ImportTools
        global encoding

        settings = Settings.load_dict([
            'final_exam_numbers_ba',
            'min_semester',
            'import_ident_from_students',
            'import_encoding',
            'student_ident_string',
            'unique_student_id'
        ])
        encoding = settings['import_encoding']

        min_semester_stg = Settings.load_dict_for_key('min_semester')
        final_exam_numbers_ba_stg = Settings.load_dict_for_key('final_exam_numbers_ba')

        # Has there been a consulting with the student?
        consulted_list = MarkedList.find_one({'_id': 'consulted'})

        num = 0
        num_success = 0
        for entry, curr, total in ImportTools.read_csv(file_info):
            num += 1
            stg = get_unicode(entry['stg'], encoding)
            if stg is None:
                logger.error(
                    "Student at line " + str(num) + " has no STG")
                continue

            student_settings = {
                "min_semester": min_semester_stg.get(stg, settings['min_semester']),
                "final_exam_numbers_ba": final_exam_numbers_ba_stg.get(stg, settings['final_exam_numbers_ba']),
                "import_ident_from_students": settings['import_ident_from_students'],
                "student_ident_string": settings['student_ident_string'],
                "unique_student_id": settings['unique_student_id']
            }
            student = create_student_from_entry(entry, student_settings)
            if student is not None:
                if consulted_list and student.ident in consulted_list.list:
                    student.consulted = True
                student.tags = StudentTag.find_student_tags(student.ident)
                result = student.db_save()
                logger.info('student %d %s', num, (result.upserted_id if result else None))
                num_success += 1

            if num % 100 == 0:
                ProcessTracking.process_update('import_students', float(curr) / total, {
                    'num': num,
                    'num_success': num_success
                })

        ProcessTracking.process_update('import_students', 1.0, {
            'num': num,
            'num_success': num_success
        })

    @classmethod
    def import_identity_from_file(cls, file_info):
        import ImportTools
        global encoding

        settings = Settings.load_dict([
            'import_encoding',
            'student_ident_string',
            'unique_student_id'
        ])
        encoding = settings['import_encoding']

        num = 0
        for data, curr, total in ImportTools.read_csv(file_info):
            num += 1

            if len(settings['unique_student_id']) > 1 or settings['unique_student_id'][0] != 'ident_original':
                raise Exception("Identity data only allowed for students with unique_student_id == ident_original")

            ident = get_int(data['identnr'])
            student = cls.find_one({'_id': ident})
            if student is None:
                continue

            if 'matrikelnr' in data:
                student.matrikelno = get_int(data['matrikelnr'])
            if 'mtknr' in data:
                student.matrikelno = get_int(data['mtknr'])
            student.forename = get_unicode(data['vorname'], encoding)
            student.surname = get_unicode(data['nachname'], encoding)
            if 'kuerzel' in data:
                student.short = get_unicode(data['kuerzel'], encoding)

            if 'email' in data:
                student.email = get_unicode(data['email'], encoding)

            if 'land' in data:
                student.country = get_unicode(data['land'], encoding)

            if 'plz' in data:
                student.zip = get_unicode(data['plz'], encoding)

            if 'stang' in data:
                student.citship = get_unicode(data['stang'], encoding)

            if 'eu' in data:
                student.eu = get_boolean(data['eu'])

            student.db_update([
                'matrikelno', 'forename', 'surname', 'short', 'email', 'country', 'zip', 'citship', 'eu'
            ])

            if num % 100 == 0:
                ProcessTracking.process_update('import_students', float(curr) / total, {
                    'num': num
                })

        ProcessTracking.process_update('import_students', 1.0, {
            'num': num
        })

    def calculate_from_exams(self, max_semester_id=None, no_save=False, settings=None):
        calc = StudentExamCalculator(self, max_semester_id, settings)
        """
           'count': 0,  # count of exams
            'finished': 0,  # count of finished exams
            'successful': 0,  # count of successful exams
            'failed': 0,  # count of failed exams
            'applied': 0,  # count of applied exams
            'resigned': 0,  # count of resigned exams
            'delayed': 0,  # delayed exams
            'delayed_u': 0,  # unauthorized delayed exams
            'bonus': 0,  # bonus of successful exams
            'count_KL': 0,  # count of exams of form KL
            'bonus_total': 0,  # total bonus in study
            'grade_sum': 0,  # sum of all weighted grades
            'grade_bonus': 0,  # sum of bonus from exams with grade
            'grade': None,  # grade of only BE exams
            'grade_nb_sum': 0,  # sum of all weighted grades with NB and EN exams
            'grade_nb_bonus': 0,  # sum of bonus from exams with NB and EN exams with grade
            'grade_nb': None  # grade of all exams
        """

        self.exam_count = calc.exam_totals['count']
        self.exam_count_finish = calc.exam_totals['finished']
        self.exam_count_success = calc.exam_totals['successful']
        self.exam_count_failed = calc.exam_totals['failed']
        self.exam_count_resigned = calc.exam_totals['resigned']
        self.exam_count_applied = calc.exam_totals['applied']
        self.exam_count_status = calc.exam_status_counts
        self.exam_count_type = calc.exam_type_counts
        self.exam_count_try = calc.exam_try_counts
        total = float(self.exam_count_success + self.exam_count_failed)
        if total > 0:
            self.exam_success_perc = float(self.exam_count_success) / total
            self.exam_failed_perc = float(self.exam_count_failed) / total
        if self.exam_count:
            self.exam_resign_perc = float(self.exam_count_resigned) / self.exam_count

        self.bonus_total = calc.exam_totals['bonus']
        self.study_time_real = calc.semester_counts['finished']
        if self.exm_date is None:
            self.semesters = calc.semester_counts['count']

        self.study_semesters = calc.semester_ids

        self.semester_data = calc.exam_semesters  #
        self.phase_data = calc.exam_phases

        if self.study_time_real >= 2 and calc.exam_phases.get('G', {}).get('bonus') >= 60:
            self.grade_basic_studies = calc.exam_phases.get('G', {}).get('grade')
        self.grade_main_studies = calc.exam_phases.get('H', {}).get('grade')
        self.grade_current = calc.exam_totals['grade']
        self.grade_nb_current = calc.exam_totals['grade_nb']
        if self.success:
            self.grade_total = calc.exam_totals['grade']

        # self.exams = calc.exam_booleans
        # self.exams_grades = calc.exam_grades

        self.cnt_delayed_exams = calc.exam_totals['delayed']
        self.cnt_unauthorized_delayed_exams = calc.exam_totals['delayed_u']

        if self.finished:
            self.current_semester = None
        elif not self.finished and len(self.study_semesters):
            self.current_semester = self.study_semesters[-1]
        elif self.imm_date:
            self.current_semester = self.start_semester

        if not no_save:
            self.db_update([
                'exam_count',
                'exam_count_finish',
                'exam_count_success',
                'exam_count_failed',
                'exam_count_applied',
                'exam_count_resigned',
                'exam_success_perc',
                'exam_failed_perc',
                'exam_count_status',
                'exam_count_type',
                'exam_count_try',
                'bonus_total',
                'study_time_real',
                'study_semesters',
                'semester_data',
                'grade_basic_studies',
                'grade_main_studies',
                'grade_current',
                'grade_nb_current',
                'grade_total',
                'exams',
                'exams_grades',
                'cnt_delayed_exams',
                'cnt_unauthorized_delayed_exams',
                'current_semester'
            ])

            for exam in calc.exams:
                ExamInfo.update_by_exam(exam)

    @staticmethod
    def calculate_exams():
        """
        Calculate additions values of student based on exam data
        """

        settings = Settings.load_dict([
            'risk_ignore_recognized_exams',
            'max_valid_cp'
        ])

        max_valid_cp_stg = Settings.load_dict_for_key('max_valid_cp')

        students = Student.find({}, modifiers={'$snapshot': True}).batch_size(
            10)  # choose small batches to avoid cursor timeout
        start = time.clock()
        count = students.count()

        if count == 0:
            ProcessTracking.process_update('calculate_student_exams', 1.0, {'num': 0, 'count': 0})
            return

        num = 0
        for student in students:
            num += 1

            max_valid_cp = max_valid_cp_stg.get(student.stg_original, settings['max_valid_cp'])

            # calculate_student_from_exams(student)
            student.calculate_from_exams(settings=settings)

            if student.bonus_total > max_valid_cp or student.exm_date is None and student.finished:
                logger.warning(
                    "Student has a bonus over %s (%s) or (no exm_date %s and is finished): %s ID: %s",
                    max_valid_cp,
                    student.bonus_total, student.exm_date, student.stg_original, student.ident)
                student.db_remove()

            if num % 100 == 0:
                print get_progress(num, count, start)

                ProcessTracking.process_update('calculate_student_exams', float(num) / count, {
                    'num': num,
                    'count': count
                })

        ExamInfo.save_cached()

        ProcessTracking.process_update('calculate_student_exams', float(num) / count, {
            'num': num,
            'count': count
        })

    @staticmethod
    def calculate_student_risk():

        settings = Settings.load_dict([
            'use_preferred_paths',
            'generate_risk_group_all',
            'generate_risk_group_stg',
            'generate_risk_group_degree',
            'main_risk_group'
        ])

        all_paths = {}
        for path in Path.find({}):
            group = 'all' if path.group is None else path.group
            if group not in all_paths:
                all_paths[group] = []
            all_paths[group].append(path)

        db_query = {"ignore": False}
        students = Student.find(db_query, modifiers={'$snapshot': True}).batch_size(20)
        index = 0
        count = students.count()
        start_time = time.clock()

        min_max = {}

        names = set()
        for student in students:
            index += 1
            # risk = student.calculate_risk(all_paths, False)
            # set_risk_on_student('risk_all', student, risk, min_max)

            if settings['generate_risk_group_all'] and 'all' in all_paths:
                risk = student.calculate_risk(all_paths['all'], settings['use_preferred_paths'])
                name = 'risk_all'
                set_risk_on_student(name, 'all', student, risk, min_max)
                names.add(name)

            if settings['generate_risk_group_stg'] and student.stg in all_paths:
                risk = student.calculate_risk(all_paths[student.stg], settings['use_preferred_paths'])
                name = 'risk_stg'
                set_risk_on_student(name, student.stg, student, risk, min_max)
                names.add(name)

            if settings['generate_risk_group_degree'] and student.degree_type in all_paths:
                risk = student.calculate_risk(all_paths[student.degree_type], settings['use_preferred_paths'])
                name = 'risk_degree'
                set_risk_on_student(name, student.degree_type, student, risk, min_max)
                names.add(name)

            if len(names) > 0:
                student.db_update(names)
            print 'risk', get_progress(index, count, start_time)

            if index % 100 == 0:
                ProcessTracking.process_update('calculate_student_risk', float(index) / count, {
                    'num': index,
                    'count': count
                })

        students = Student.find(db_query, modifiers={'$snapshot': True}).batch_size(20)
        for student in students:
            for group, mm in min_max.iteritems():
                name = mm['name']
                if name == 'risk_stg' and student.stg != group:
                    continue
                if name == 'risk_degree' and student.degree_type != group:
                    continue
                if not hasattr(student, name):
                    continue
                r = getattr(student, name)
                if r is not None and r['median'] is not None:
                    if mm['max'] - mm['min'] > 0:
                        r['median_scaled'] = (r['median'] - mm['min']) / (mm['max'] - mm['min'])
                    else:
                        r['median_scaled'] = 0.0

            name = 'risk_' + settings['main_risk_group']
            if hasattr(student, name):
                student.risk = getattr(student, name)
                names.add('risk')

            student.db_update(names)

            if not student.ignore:
                course = Course.get_by_stg_original(student.stg_original)
                if course is not None:
                    course.update_by_student(student)

                CourseSemesterInfo.update_by_student(student)

        print min_max

        Course.save_cached()
        CourseSemesterInfo.save_cached()

        ProcessTracking.process_update('calculate_student_risk', 1, {
            'num': index,
            'count': count
        })

    def calculate_risk(self, all_paths=None, use_preferred=False):
        """
        Calculates the risk of this student, by looping through all paths and checking if student is in path filters.
        """
        risk_values = dict()  # {"hash_value_path_element":{probability value}}

        if all_paths:
            paths = [path for path in all_paths if path.check_filter(self)]
        else:
            student_element_ids = [pe.md5_id() for pe in self.get_matching_elements()]
            paths = Path.get_list_by_element_ids(student_element_ids)

        if use_preferred:
            paths = Path.get_preferred_paths(paths)

        risk_count_paths = dict()
        for path in paths:
            success_element = list(path.elements)[0]  # success criteria
            success_id = success_element.condition.name
            if path.scaled_value is not None:
                value = path.scaled_value
            else:
                value = path.value

            if success_id not in risk_values:
                risk_values[success_id] = {
                    'sum': value,
                    'count': 1,
                    'max': value,
                    'min': value,
                    'values': [value]
                }
                risk_count_paths[success_id] = 1
            else:
                risk_count_paths[success_id] += 1
                risk_values[success_id]['sum'] += value
                risk_values[success_id]['count'] += 1
                risk_values[success_id]['values'].append(value)
                if value > risk_values[success_id]['max']:
                    risk_values[success_id]['max'] = value
                if value < risk_values[success_id]['min']:
                    risk_values[success_id]['min'] = value

        for success_id, info in risk_values.iteritems():
            info['mean'] = info['sum'] / info['count']
            info['values'].sort()
            info['median'] = info['values'][info['count'] / 2]
            info['q25'] = info['values'][int(info['count'] * 0.25)]
            info['q75'] = info['values'][int(info['count'] * 0.75)]

        return risk_values

    @classmethod
    def calc_groups(cls, groups=list(), find=None, calculations=None):
        """
        Groups and counts values for a defined field
        """
        try:
            pipeline = list()
            if find is not None:
                pipeline.append({'$match': find})

            group_id = {}
            for grp in groups:
                group_id[sanitize_field(grp)] = '$' + grp

            group_stage = {
                '_id': group_id,
                'count': {'$sum': 1}
            }

            if calculations is not None:
                for calc_def in calculations:
                    entry = dict()
                    op = calc_def['op']
                    entry['$' + op] = '$' + calc_def['field']
                    group_stage[op + '-' + sanitize_field(calc_def['field'])] = entry
                    if op == 'avg':
                        entry = dict()
                        entry['$sum'] = {'$cond': ['$' + calc_def['field'], 1, 0]}
                        group_stage['count-' + sanitize_field(calc_def['field'])] = entry

            pipeline.append({'$group': group_stage})

            results = cls.db_aggregate(pipeline)
            for d in results:
                unsanitize_dict(d)
                unsanitize_dict(d['_id'])

            return results

        except errors.PyMongoError:
            return None

    @classmethod
    def calc_single_groups(cls, groups=list(), find=None, calculations=None):
        results = dict()
        for grp in groups:
            results[grp] = cls.calc_groups([grp], find, calculations)

        return results

    @classmethod
    def calc_sums(cls, find=None):
        """
        Groups and counts values for a defined field
        """
        try:
            pipeline = list()
            if find is not None:
                pipeline.append({'$match': find})
            pipeline.append({'$group': {
                '_id': None,
                'count': {'$sum': 1},
                'exam_count_success': {'$sum': '$exam_count_success'},
                'risk-count': {'$sum': '$risk.count'},
                'exam_count_failed': {'$sum': '$exam_count_failed'},
                'hzb_imm_time': {'$sum': '$hzb_imm_time'},
                'semesters': {'$sum': '$semesters'},
                'exam_count': {'$sum': '$exam_count'},
                'bonus_total': {'$sum': '$bonus_total'},
                'study_time_real': {'$sum': '$study_time_real'},
                'cnt_delayed_exams': {'$sum': '$cnt_delayed_exams'},
                'cnt_unauthorized_delayed_exams': {'$sum': '$cnt_unauthorized_delayed_exams'}
            }})

            result = cls.db_aggregate(pipeline)
            for d in result:
                return unsanitize_dict(d)
            return None

        except errors.PyMongoError:
            return None

    @classmethod
    def calc_avgs(cls, find=None):
        """
        Groups and counts values for a defined field
        """
        try:
            pipeline = list()
            if find is not None:
                pipeline.append({'$match': find})
            pipeline.append({'$group': {
                '_id': None,
                'final_grade': {'$avg': '$final_grade'},
                'age': {'$avg': '$age'},
                'count': {'$sum': 1},
                'exam_count_success': {'$avg': '$exam_count_success'},
                'risk-count': {'$avg': '$risk.count'},
                'exam_count_failed': {'$avg': '$exam_count_failed'},
                'hzb_imm_time': {'$avg': '$hzb_imm_time'},
                'semesters': {'$avg': '$semesters'},
                'exam_count': {'$avg': '$exam_count'},
                'bonus_total': {'$avg': '$bonus_total'},
                'study_time_real': {'$avg': '$study_time_real'},
                'cnt_delayed_exams': {'$avg': '$cnt_delayed_exams'},
                'cnt_unauthorized_delayed_exams': {'$avg': '$cnt_unauthorized_delayed_exams'},
                'grade_basic_studies': {'$avg': '$grade_basic_studies'},
                'grade_main_studies': {'$avg': '$grade_main_studies'},
                'grade_current': {'$avg': '$grade_current'},
                'risk-median': {'$avg': '$risk.median'},
                'risk-median_scaled': {'$avg': '$risk.median_scaled'}
            }})

            result = cls.db_aggregate(pipeline)
            for d in result:
                return unsanitize_dict(d)
            return None

        except errors.PyMongoError:
            print 'calc_avgs PyMongoError ', get_last_error()
            return None

    def db_save_ignore(self):
        self.ignore = True
        self.db_update(['ignore'])

    @classmethod
    def db_setup(cls):
        c = cls.get_collection()
        c.create_index([('ignore', 1)])

    @staticmethod
    def get_matching_students_count(path_elements, query=None):
        if query is None:
            query = dict()
        else:
            query = query.copy()
        for pe in path_elements:
            pe.get_db_query(query)
        # print 'query ', query
        return Student.find(query).count()

    @staticmethod
    def get_students_bitarray(path_elements, query=None):
        return StudentsBitArray(path_elements, query)


def set_risk_on_student(name, group, student, risk, min_max):
    if 'failed' in risk:
        r = risk['failed']
        setattr(student, name, r)
        if not student.finished:
            if group not in min_max:
                min_max[group] = {'name': name, 'min': r['median'], 'max': r['median']}
            elif min_max[group]['min'] > r['median']:
                min_max[group]['min'] = r['median']
            elif min_max[group]['max'] < r['median']:
                min_max[group]['max'] = r['median']
        else:
            # students who are finished should not have a risk
            r['median'] = None
            r['median_scaled'] = None
    else:
        setattr(student, name, None)


def sanitize_field(field):
    return field.replace('.', '-')


def unsanitize_field(field):
    return field.replace('-', '.')


def unsanitize_dict(d):
    for key in d:
        if '-' in key:
            d[unsanitize_field(key)] = d.pop(key)
    return d


def create_student_from_entry(data, settings):
    """
    Part of 1st Step Student import from csv file
    """
    from Course import Course

    final_exam_numbers = [int(x) for x in settings['final_exam_numbers_ba']]

    student = Student()
    if settings['student_ident_string']:
        student.ident_original = get_unicode(data['identnr'], encoding)
    else:
        student.ident_original = get_int(data['identnr'])
    student.gender = get_unicode(data['geschl'], encoding)
    student.birth_date = get_date_from_csv(data['gebdat'])

    student.stg_original = get_unicode(data['stg'], encoding)

    course = Course.get_by_stg_original(student.stg_original)
    if course is None or course.ignore:
        logger.error(
            "Student has no known STG group for: " + student.stg_original + " ID: " + repr(student.ident))
        return None

    student.stg = course.stg
    student.degree_type = course.degree_type

    student.imm_date = get_date_from_csv(data['immdat'])
    student.exm_date = get_date_from_csv(data['exmdat'])
    if student.imm_date is not None and student.exm_date is not None:
        student.semesters = CalcTools.semester_delta(student.imm_date, student.exm_date)

    if 'sem_start' in data and len(data.sem_start) == 5:
        student.start_semester = get_int(data['sem_start'])
    elif student.imm_date is not None:
        student.start_semester = CalcTools.get_semester_from_date(student.imm_date)

    if student.start_semester is None:
        logger.error(
            "Student has no start semester ID: " + repr(student.ident))
        return None

    if 'sem_end' in data and len(data.sem_start) == 5:
        student.end_semester = get_int(data['sem_end'])
    elif student.exm_date is not None:
        student.end_semester = CalcTools.get_semester_from_date(student.exm_date)

    student.hzb_grade = get_int(data['hzbnote'])
    if student.hzb_grade == 990:
        student.hzb_grade = None
    if 'hzbart' in data:
        student.hzb_type = get_hzbgrp(data['hzbart'])
    if 'hzbgrp' in data:
        student.hzb_type = clean_db_string(get_unicode(data['hzbgrp'], encoding))

    if student.hzb_type == '':
        logger.warning('No hzb_type for ' + student.stg_original + " ID: " + repr(student.ident))

    student.hzb_date = get_date_from_csv(data['hzbdatum'])
    if student.imm_date is not None and student.hzb_date is not None:
        student.hzb_imm_time = CalcTools.month_delta(student.hzb_date, student.imm_date)

    pnr = get_int(data['pnr'])
    student.finished = not ((pnr is None or pnr == 0) and student.exm_date is None)
    student.success = pnr is not None and pnr in final_exam_numbers and student.exm_date is not None
    student.aborted = (pnr is None or pnr == 0) and student.exm_date is not None

    if pnr is not None and pnr in final_exam_numbers and student.exm_date is not None and CalcTools.semester_delta(
            student.imm_date,
            student.exm_date) < 5:
        logger.warning(
            "Student in 4 or less semesters successful: " + student.stg_original + " ID: " + repr(student.ident))

    # Status 1=Finished, 2=Aborted, 3=Successful, 4=Studying
    if student.finished:
        if student.success:
            student.status = 3
        elif student.aborted:
            student.status = 2
        else:
            student.status = 1
    else:
        student.status = 4

    if data['sperrart1'] == '01' \
            or student.start_semester < settings['min_semester']:
        logger.error(
            "sperrart1 is 01 or start semester too early: %s ID: %s Sperrart: %s Start: %s",
            student.stg_original, student.ident, data['sperrart1'], student.start_semester)
        return None

    student.stg = course.stg

    student.age = CalcTools.calculate_age(student.birth_date, student.imm_date)

    if settings['import_ident_from_students']:
        if 'matrikelnr' in data:
            student.matrikelno = get_int(data['matrikelnr'])
        if 'mtknr' in data:
            student.matrikelno = get_int(data['mtknr'])
        if 'vorname' in data:
            student.forename = get_unicode(data['vorname'], encoding)

        if 'nachname' in data:
            student.surname = get_unicode(data['nachname'], encoding)
        if 'kuerzel' in data:
            student.short = get_unicode(data['kuerzel'], encoding)

        if 'email' in data:
            student.email = get_unicode(data['email'], encoding)

        if 'land' in data:
            student.country = get_unicode(data['land'], encoding)

        if 'plz' in data:
            student.zip = get_unicode(data['plz'], encoding)

        if 'stang' in data:
            student.citship = get_unicode(data['stang'], encoding)

        if 'eu' in data:
            student.eu = get_boolean(data['eu'])

    student.ident = Student.generate_ident(student, settings['unique_student_id'])

    return student


def get_hzbgrp(hzbart):
    return ImportTools.map_by_definiton('hzbart', int(hzbart), True, u'Unbekannt')


def get_progress(num, count, start):
    if num == 0:
        return ''

    left = count - num
    needed = time.clock() - start
    num_per_second = num / needed if needed else 0
    left_time = left * (needed / num) if num else 0

    return '%d / %d %.2f it/s %ds left' % (num, count, num_per_second, left_time)


class StudentExamCalculator:
    def __init__(self, student, max_semester_id=None, settings=None):
        self.settings = settings
        self.student = student
        db_query = {'student_id': student.ident}
        if max_semester_id is not None:
            db_query['semester'] = {'$lte': max_semester_id}

        if settings and settings['risk_ignore_recognized_exams']:
            db_query['recognized'] = False

        self.distinct_fields = [  # independend of count of tries
            'count',  # count of distinct exams
            'finished',  # count of finished exams
            'applied',  # count of currently applied exams
            'count_KL',
            'bonus',
            'bonus_total',
            'grade_sum',
            'grade_bonus',
            'grade_nb_sum',
            'grade_nb_bonus'
        ]
        self.total_fields = [
            'delayed',  # total count of G delays
            'delayed_u',  # total count of U delays
            'successful',  # total count of BE, should be the same as if it would be distinct
            'failed',  # total of failed tries
            'resigned'  # total count of resignations
        ]

        self.exams = list(Exam.find(db_query, sort=[('semester', 1)]))  # ordered list of exams

        # calculated values
        self.semester_ids = self.get_semester_ids()  # sorted list of semester ids
        self.exam_totals, \
        self.exam_semesters, \
        self.exam_phases, \
        self.exam_status_counts, \
        self.exam_type_counts, \
        self.exam_try_counts = self.get_counts()

        self.semester_counts = self.get_semester_counts()

        self.exam_booleans = self.get_exam_booleans()
        self.exam_grades = self.get_exam_grades()

    def get_distinct_exams(self, field=None):
        # returns the latest result for an exam
        exams = {}
        for exam in self.exams:
            ident = str(exam.exam_id)
            if field is not None:
                ident += '_' + str(getattr(exam, field, ''))
            exams[ident] = exam

        return exams.values()

    def get_exam_booleans(self):
        exams = {}
        for exam in self.exams:
            exam_id_str = 'e' + str(exam.exam_id)
            if exam_id_str not in exams or not exams[exam_id_str]:
                if exam.is_success():
                    exams[exam_id_str] = True
                elif exam.is_failed():
                    exams[exam_id_str] = False

        return exams

    def get_exam_grades(self):
        exams = {}
        for exam in self.exams:
            exam_id_str = 'e' + str(exam.exam_id)
            if exam_id_str not in exams and exam.is_success() and exam.grade is not None:
                exams[exam_id_str] = exam.grade

        return exams

    def get_semester_counts(self):
        result = self.create_counters()
        for sem_nr_id, counts in self.exam_semesters.iteritems():
            for c in result:
                if counts[c] and result[c] is not None:
                    result[c] += 1

        return result

    def get_semester_ids(self):
        semester_ids = []
        for exam in self.exams:
            if exam.semester not in semester_ids:
                semester_ids.append(exam.semester)
        semester_ids.sort()
        return semester_ids

    def get_semester_number(self, semester_id, real=True):
        number = 0
        real_number = 0
        current = self.student.start_semester

        if real and self.semester_ids:
            for sem_id in self.semester_ids:
                real_number += 1
                if semester_id == sem_id:
                    return real_number
            real_number = 0

        while current <= semester_id:
            number += 1
            if current in self.semester_ids:
                real_number += 1
            if current % 10 == 2:
                current = (current // 10 + 1) * 10 + 1
            else:
                current += 1

        if real:
            return real_number
        else:
            return number

    def is_last_semester(self, semester_id):
        if semester_id == self.semester_ids[-1]:
            return True
        else:
            return False

    @staticmethod
    def create_counters():
        return {
            'count': 0,  # count of exams
            'finished': 0,  # count of finished exams
            'successful': 0,  # count of successful exams
            'failed': 0,  # count of failed exams
            'applied': 0,  # count of applied exams
            'resigned': 0,  # count of resigned exams
            'delayed': 0,  # delayed exams
            'delayed_u': 0,  # unauthorized delayed exams
            'bonus': 0.0,  # bonus of successful exams
            'count_KL': 0,  # count of exams of form KL
            'bonus_total': 0.0,  # total bonus in study
            'grade_sum': 0,  # sum of all weighted grades
            'grade_bonus': 0.0,  # sum of bonus from exams with grade
            'grade': None,  # grade of only BE exams
            'grade_nb_sum': 0,  # sum of all weighted grades with NB and EN exams
            'grade_nb_bonus': 0.0,  # sum of bonus from exams with NB and EN exams with grade
            'grade_nb': None  # grade of all exams
        }

    @staticmethod
    def add_to_counters(target_counters, from_counters):
        for c in from_counters:
            if from_counters[c] is None or not isinstance(from_counters[c], numbers.Number):
                continue
            if c not in target_counters:
                target_counters[c] = 0
            target_counters[c] += from_counters[c]

    def get_counts_for_exam(self, exam):
        """
        How does one exam count towards the counters
        """

        counts = self.create_counters()
        counts['count'] += 1
        if exam.is_finished():
            counts['finished'] += 1

        if exam.is_failed():
            counts['failed'] += 1
            counts['failed_exam_type_' + exam.type] = 1

        if exam.is_success():
            counts['successful'] += 1
            counts['successful_exam_type_' + exam.type] = 1

            if exam.bonus is not None:
                counts['bonus'] += exam.bonus

                if exam.grade is not None:
                    counts['grade_sum'] += exam.grade * exam.bonus
                    counts['grade_bonus'] += exam.bonus

        if exam.is_applied():
            counts['applied'] += 1
        if exam.is_resigned():
            counts['resigned'] += 1
        if exam.is_delayed():
            counts['delayed'] += 1
        if exam.is_delayed_u():
            counts['delayed_u'] += 1

        if exam.form == 'KL':
            counts['count_KL'] += 1

        if exam.bonus is not None and exam.grade is not None:
            counts['grade_nb_sum'] += exam.grade * exam.bonus
            counts['grade_nb_bonus'] += exam.bonus

        counts['exam_type_' + exam.type] = 1
        counts['exam_status_type_' + exam.status + '_' + exam.type] = 1
        counts['exam_try_' + str(exam.try_nr)] = 1

        return counts

    def get_counts(self):
        totals = self.create_counters()
        semester_counters = {}  # counters for every semester, sem_0, sem_1, sem_2, ...
        phase_counters = {}  # counters for every phase (G=basic studies, H=main studies)
        exam_status_counts = {}  # count of exams for each status
        exam_type_counts = {}  # count of exams for each type
        exam_try_counts = {}  # count of exams for each number of ties

        # run through distinct exams and add to counters
        for exam in self.get_distinct_exams():
            counts = self.get_counts_for_exam(exam)
            fcounts = {}
            for k in self.distinct_fields:
                fcounts[k] = counts[k]
            self.add_to_counters(totals, fcounts)

        # run through distinct exams by phase and add to counters
        for exam in self.get_distinct_exams('phase'):
            counts = self.get_counts_for_exam(exam)
            fcounts = {}
            for k in self.distinct_fields:
                fcounts[k] = counts[k]
            # by phase G or H
            if exam.phase not in phase_counters:
                phase_counters[exam.phase] = self.create_counters()
            self.add_to_counters(phase_counters[exam.phase], fcounts)

        # run through all exams and add to counters
        for exam in self.exams:
            counts = self.get_counts_for_exam(exam)
            fcounts = {}
            for k in self.total_fields:
                fcounts[k] = counts[k]
            self.add_to_counters(totals, fcounts)

            # by semester nr
            sem_nr = self.get_semester_number(exam.semester)
            sem_nr_id = 'sem_' + str(sem_nr)
            if sem_nr_id not in semester_counters:
                semester_counters[sem_nr_id] = self.create_counters()
                semester_counters[sem_nr_id]['semester_id'] = exam.semester
            self.add_to_counters(semester_counters[sem_nr_id], counts)

            # by phase G or H
            if exam.phase not in phase_counters:
                phase_counters[exam.phase] = self.create_counters()
            self.add_to_counters(phase_counters[exam.phase], fcounts)

            if exam.status not in exam_status_counts:
                exam_status_counts[exam.status] = 0
            exam_status_counts[exam.status] += 1

            if exam.type not in exam_type_counts:
                exam_type_counts[exam.type] = 0
            exam_type_counts[exam.type] += 1

            try_id = str(exam.try_nr)
            if try_id not in exam_try_counts:
                exam_try_counts[try_id] = 0
            exam_try_counts[try_id] += 1

        # calculate grades
        totals['grade'] = totals['grade_sum'] / totals['grade_bonus'] if totals['grade_bonus'] > 0 else None
        totals['grade_nb'] = totals['grade_nb_sum'] / totals['grade_nb_bonus'] if totals['grade_nb_bonus'] > 0 else None

        for sem_nr_id, entry in semester_counters.iteritems():
            entry['grade'] = entry['grade_sum'] / entry['grade_bonus'] if entry['grade_bonus'] > 0 else None
            entry['grade_nb'] = entry['grade_nb_sum'] / entry['grade_nb_bonus'] if entry['grade_nb_bonus'] > 0 else None

        for phase, entry in phase_counters.iteritems():
            entry['grade'] = entry['grade_sum'] / entry['grade_bonus'] if entry['grade_bonus'] > 0 else None
            entry['grade_nb'] = entry['grade_nb_sum'] / entry['grade_nb_bonus'] if entry['grade_nb_bonus'] > 0 else None

        # caluclate total bonus
        for sem_nr in range(1, len(semester_counters) + 1):
            sem_nr_id = 'sem_' + str(sem_nr)
            last_sem_nr_id = 'sem_' + str(sem_nr - 1)
            if sem_nr_id not in semester_counters:
                continue
            semester_counters[sem_nr_id]['bonus_total'] = semester_counters[sem_nr_id]['bonus']
            if last_sem_nr_id in semester_counters:
                semester_counters[sem_nr_id]['bonus_total'] += semester_counters[last_sem_nr_id]['bonus_total']

        last_phase = None
        for phase in sorted(phase_counters.keys()):
            phase_counters[phase]['bonus_total'] = phase_counters[phase]['bonus']
            if last_phase in phase_counters:
                phase_counters[phase]['bonus_total'] += phase_counters[last_phase]['bonus_total']
            last_phase = phase

        return totals, semester_counters, phase_counters, exam_status_counts, exam_type_counts, exam_try_counts


class StudentsBitArray:
    def __init__(self, elements, query=None):
        self.elements = list(elements)
        self.count = 0
        self.query = query if not None else dict()
        self.data = []
        self.bmo = None
        self.rows = 0
        self.yields = 0
        self.read_rows = 0

        import imp

        try:
            imp.find_module('bitmapchecker')
            self.load_bitmapchecker()
        except ImportError:
            self.load()

    def load_bitmapchecker(self):
        import bitmapchecker

        # self.order_elements()

        print 'load_bitmapchecker query', self.query
        students = Student.find(self.query, modifiers={'$snapshot': True})
        self.count = students.count()
        self.yields = 0

        generator = self.generate_students(students, self.elements)

        self.bmo = bitmapchecker.BitmapObject(generator, self.count, len(self.elements))
        self.rows = self.bmo.rows
        self.read_rows = self.bmo.read_rows
        print 'load_bitmapchecker count:', self.count, 'columns:', len(self.elements), 'rows:', self.rows, \
            'yields', self.yields, 'read_rows:', self.read_rows

    def generate_students(self, students, elements):
        for student in students:
            bm = [pe.check(student) for pe in elements]
            self.yields += 1
            yield bm

    def run_combinations(self, k, start, end, callback, el_counts, min_support, rate, min_matching):
        if not self.bmo:
            return False

        element_counts = [el_counts[pe] for pe in self.elements]
        required = []
        for pe in self.elements:
            dep_index = -1
            if pe.query.depends is not None and len(pe.query.depends):
                dep_indexes = [self.elements.index(pe2) for pe2 in self.elements if pe2.md5_id() in pe.query.depends]
                if len(dep_indexes):
                    dep_index = dep_indexes[0]
            required.append(dep_index)

        def info_callb(num, denied, itemset, matched, total):
            ret = {
                'num': num,
                'denied': denied,
                'itemset': None,
                'matched': matched,
                'total': total
            }
            if itemset is not None:
                ret['itemset'] = [self.elements[i] for i in itemset]

            callback(ret)

        # startt = time.time()
        # print 'run_combinations start:', start, 'end:', end
        self.bmo.run_combinations_k(
            k,
            element_counts,
            required,
            info_callb,
            start,
            end,
            min_support,
            rate,
            min_matching
        )

        # print 'run_combinations start:', start, 'end:', end, 'ended after ', time.time() - startt

    def load(self):

        self.order_elements()

        count_elements = len(self.elements)
        students = Student.find(self.query, modifiers={'$snapshot': True})
        self.count = students.count()
        for student in students:
            ba = self.make_bit_array(count_elements, 0)
            for i, pe in enumerate(self.elements):
                if pe.check(student):
                    self.set_bit(ba, i)
                    if i > ba[1]:
                        ba[1] = i
            curr_ba = self.bit_array_from_ba(ba)
            if curr_ba is not None:
                curr_ba[0] += 1
            else:
                ba[0] = 1
                self.data.append(ba)

        self.rows = len(self.data)

        self.data.sort(key=lambda x: x[1], reverse=True)

    def order_elements(self):
        students = Student.find(self.query)
        element_counts = {}
        for pe in self.elements:
            element_counts[pe] = 0

        for student in students:
            for pe in self.elements:
                if pe.check(student):
                    element_counts[pe] += 1

        self.elements.sort(key=lambda p: element_counts[p], reverse=True)

    def count_matching(self, test_elements):
        if self.bmo is not None:
            test_bm = [pe in test_elements for pe in self.elements]
            # print 'count_matching ', [pe.get_str() for pe in test_elements]
            return self.bmo.count_matching(test_bm)

        test_ba = self.bit_array_from_elements(test_elements)
        # print 'test_ba', test_ba
        # count = sum(map(lambda x: self.test_bit_array(x, test_ba), self.data))
        count = 0
        for ba in self.data:
            if ba[1] < test_ba[1]:
                break
            count += self.test_bit_array(ba, test_ba)
        return count

    def bit_array_from_ba(self, test_ba):
        for ba in self.data:
            if self.test_bit_array(ba, test_ba):
                return ba
        return None

    def bit_array_from_elements(self, test_elements):
        ba = self.make_bit_array(len(self.elements))
        for i, pe in enumerate(self.elements):
            if pe in test_elements:
                self.set_bit(ba, i)
                if i > ba[1]:
                    ba[1] = i

        # i = len(ba) - 1
        # while i > 0:
        # if ba[i] == 0:
        # ba.pop(i)
        # else:
        # break
        # i -= 1

        return ba

    @staticmethod
    def make_bit_array(bit_size, fill=0):
        int_size = bit_size >> 5  # number of 32 bit integers
        if bit_size & 31:  # if bitSize != (32 * n) add
            int_size += 1  # a record for stragglers
        if fill == 1:
            fill = 0xFFFFFFFF
        else:
            fill = 0

        int_size += 2  # one more int for count
        bit_array = array.array('I')  # 'I' = unsigned 32-bit integer
        bit_array.extend((fill,) * int_size)

        return bit_array

    @staticmethod
    def set_bit(bit_array, bit_num):
        record = bit_num >> 5
        offset = bit_num & 31
        mask = 1 << offset
        record += 2
        bit_array[record] |= mask
        return bit_array[record]

    @staticmethod
    def test_bit(bit_array, bit_num):
        record = bit_num >> 5
        offset = bit_num & 31
        mask = 1 << offset
        record += 2
        return bit_array[record] & mask

    @staticmethod
    def test_bit_array(bit_array, test_ba):
        for i, test_int in enumerate(test_ba):
            if i > 1 and bit_array[i] & test_int != test_int:
                return 0
        return bit_array[0]

    def for_transfer(self):
        import pickle

        res = dict()
        res['elements'] = self.elements
        res['count'] = self.count
        res['query'] = self.query
        res['data'] = self.data
        res['bmo_s'] = pickle.dumps(self.bmo)
        res['rows'] = self.rows
        return res

    @staticmethod
    def from_transfer(data):
        import pickle

        ret = StudentsBitArray(data['elements'], data['query'])
        ret.count = data['count']
        ret.query = data['query']
        ret.data = data['data']
        ret.bmo = pickle.loads(data['bmo_s'])
        ret.rows = data['rows']
        return ret
