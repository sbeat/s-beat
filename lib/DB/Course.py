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
import logging

import ImportTools
from Db import DBDocument
from ProcessTracking import ProcessTracking

encoding = 'windows-1252'
logger = logging.getLogger(__name__)


class Course(DBDocument):
    collection_name = 'courses'

    all_original_cached = None

    def __init__(self, **kwargs):

        # Data from import
        self.stg_original = None  # IDENT: short of course in original form
        self.stg = None  # short of course (already_mapped)
        self.name = None  # name of course
        self.short_name = None  # short name of course
        self.faculty = None  # faculty of that course
        self.semesters = None  # usual count of semesters
        self.degree_type = None  # type of degree: Diplom,Bachelor,Master
        self.ignore = False

        # Calculated data
        self.count_finished = 0  # count students that are no longer studying this course
        self.count_successful = 0  # count students that passed the course
        self.count_failed = 0  # count students that failed the course
        self.count_students = 0  # total number of students in this course
        self.count_studying = 0  # total number of students in this course
        self.success_perc = None  # percent of success
        self.failed_perc = None  # percent of failed

        self.count_male = 0
        self.count_female = 0
        self.male_perc = None
        self.female_perc = None

        self.exams = 0  # count of exams the students have
        self.exam_count_finish = 0  # count of finished exams
        self.exam_count_success = 0  # count of successful exams
        self.exam_count_failed = 0  # count of failed exams
        self.exam_count_applied = 0  # count of applied exams
        self.exam_count_resigned = 0  # count of resigned exams

        self.exam_perc_resigned = None
        self.exams_per_student = None

        self.risk_data = {
            'min': None,  # minimum risk a student got
            'max': None,  # maximum risk a student got
            'mean': None,  # average risk students have
            'values': {}  # rounded risk student: count of students
        }

        self.hzb_grade_data = {
            'min': None,
            'max': None,
            'mean': None,
            'values': {}
        }

        self.hzb_type_values = {}

        self.age_data = {
            'min': None,
            'max': None,
            'mean': None,
            'values': {}
        }

        # students in this course which have delayed many exams, but still managed to succeed
        self.delayed_success = dict()
        # students in this course which have delayed many exams and failed/aborted
        self.delayed_failed = dict()
        # students in this course which have delayed many exams and are still studying
        self.delayed_ongoing = dict()

    def reset(self):
        self.count_finished = 0
        self.count_successful = 0
        self.count_students = 0
        self.count_failed = 0

    def update_by_student(self, student):
        self.count_students += 1
        if student.success:
            self.count_successful += 1
        if student.finished:
            self.count_finished += 1
        if student.aborted:
            self.count_failed += 1

        self.exams += student.exam_count
        self.exam_count_finish += student.exam_count_finish
        self.exam_count_success += student.exam_count_success
        self.exam_count_failed += student.exam_count_failed
        self.exam_count_applied += student.exam_count_applied
        self.exam_count_resigned += student.exam_count_resigned

        if student.risk and not student.finished and student.risk['median_scaled'] is not None:
            risk_id = str(int(student.risk['median_scaled'] * 100))
            if risk_id not in self.risk_data['values']:
                self.risk_data['values'][risk_id] = 1
            else:
                self.risk_data['values'][risk_id] += 1

        if student.hzb_grade is not None:
            hzb_grade_id = str(student.hzb_grade)
            if hzb_grade_id not in self.hzb_grade_data['values']:
                self.hzb_grade_data['values'][hzb_grade_id] = 1
            else:
                self.hzb_grade_data['values'][hzb_grade_id] += 1

        if student.age is not None:
            age_id = str(student.age)
            if age_id not in self.age_data['values']:
                self.age_data['values'][age_id] = 1
            else:
                self.age_data['values'][age_id] += 1

        if student.gender == 'W':
            self.count_female += 1
        elif student.gender == 'M':
            self.count_male += 1

        if student.hzb_type not in self.hzb_type_values:
            self.hzb_type_values[student.hzb_type] = 1
        else:
            self.hzb_type_values[student.hzb_type] += 1

    def __repr__(self):
        return 'Course(' + repr(self.__dict__) + ')'

    @staticmethod
    def update_stat_dict_by_values(d):
        total_count = sum(d['values'].values())
        if total_count:
            exams_values = [int(x) for x in d['values'] if x != 'None']
            d['min'] = min(exams_values)
            d['max'] = max(exams_values)
            values_sum = [int(x) * c for x, c in d['values'].iteritems() if x != 'None']
            d['mean'] = float(sum(values_sum)) / total_count

    def db_transform(self):
        """
        Transforms self to a database dictionary object.
        Gets called by transform_incoming of SONManipulator
        """

        total = float(self.count_finished)
        if total > 0:
            self.success_perc = float(self.count_successful) / total
            self.failed_perc = float(self.count_failed) / total

        if self.exams > 0 and self.count_students > 0:
            self.exams_per_student = float(self.exams) / self.count_students
            self.exam_perc_resigned = float(self.exam_count_resigned) / self.exams

        if self.risk_data:
            self.update_stat_dict_by_values(self.risk_data)

        if self.count_students > 0:
            self.female_perc = float(self.count_female) / self.count_students
            self.male_perc = float(self.count_male) / self.count_students
            self.count_studying = self.count_students - self.count_finished

        self.update_stat_dict_by_values(self.hzb_grade_data)
        self.update_stat_dict_by_values(self.age_data)

        data = self.__dict__.copy()
        del data['stg_original']
        data['_id'] = self.stg_original
        return data

    @staticmethod
    def db_create(son):
        """
        Creates a new Instance based of database SON data.
        Gets called by transform_outgoing of SONManipulator
        """
        p = Course()
        p.stg_original = son['_id']
        del son['_id']
        p.__dict__.update(son)
        return p

    @classmethod
    def get_all_by_stg_original(cls, cached=True):
        if cls.all_original_cached is not None:
            return cls.all_original_cached

        cls.all_original_cached = {}
        for course in cls.find({}):
            cls.all_original_cached[course.stg_original] = course

        return cls.all_original_cached

    @classmethod
    def save_cached(cls):
        if cls.all_original_cached is None:
            return
        for course in cls.all_original_cached.values():
            course.db_save()

    @classmethod
    def get_by_stg_original(cls, stg_original, cached=True):
        all_originals = cls.get_all_by_stg_original(cached)
        if all_originals is not None and stg_original in all_originals:
            return all_originals.get(stg_original)
        else:
            return None

    @staticmethod
    def import_from_file(file_info):
        import ImportTools
        from Settings import Settings
        global encoding

        settings = Settings.load_dict([
            'course_allowed_degree_types',
            'import_encoding'
        ])
        allowed_degree_types = settings['course_allowed_degree_types']
        encoding = settings['import_encoding']

        num = 0
        for entry, curr, total in ImportTools.read_csv(file_info):
            num += 1
            try:
                course = create_course_from_entry(entry, settings)
            except:
                logger.warning('Failed to create Course from entry %d', num)
                raise

            if allowed_degree_types and course.degree_type not in allowed_degree_types:
                course.ignore = True

            result = course.db_insert()
            logger.info('course %d %s', num, (result.inserted_id if result else None))

            if num % 100 == 0:
                ProcessTracking.process_update('import_courses', float(curr) / total, {
                    'num': num
                })

        ProcessTracking.process_update('import_courses', 1.0, {
            'num': num
        })

    @staticmethod
    def get_mapped_short(stg_original):
        return ImportTools.map_by_definiton("stg", stg_original)

    @staticmethod
    def get_delayed():
        """
        Calculate additions values of student based on exam data
        """

        courses = Course.find({}, modifiers={'$snapshot': True}).batch_size(10)

        num = 0
        for course in courses:
            num += 1
            get_courses_with_delayed_exams(course)


def get_int(s):
    try:
        return int(s)
    except ValueError:
        return None


def get_unicode(s):
    return unicode(s.strip(), encoding)


def create_course_from_entry(data, settings):
    """
    Part of 1st Step Student import from csv file
    """
    course = Course()
    course.stg_original = get_unicode(data['stg'])

    if 'gruppe' in data:
        course.stg = get_unicode(data['gruppe'])
    else:
        course.stg = Course.get_mapped_short(course.stg_original)

    if 'abschlart' in data:
        course.degree_type = get_unicode(data['abschlart'])
    elif 'abschl' in data:
        course.degree_type = ImportTools.map_by_definiton('abschl', data['abschl'], True)

    if course.stg is None or course.degree_type is None:
        course.ignore = True

    course.name = get_unicode(data['ltxt'])
    course.short_name = get_unicode(data['ktxt'])
    course.faculty = get_int(data['fb'])
    course.semesters = get_int(data['regelstz'])

    return course


def get_courses_with_delayed_exams(course):
    if course.delayed_failed is not None and any(course.delayed_failed):
        print "Vorlesung " + repr(course.name) + " - Verschoben und abgebrochen: " + repr(course.delayed_failed)
    if course.delayed_success is not None and any(course.delayed_success):
        print "Vorlesung " + repr(course.name) + " - Verschoben und erfolgreich: " + repr(course.delayed_success)
    if course.delayed_ongoing is not None and any(course.delayed_ongoing):
        print "Vorlesung " + repr(course.name) + " - Verschoben und noch studierend: " + repr(course.delayed_ongoing)
