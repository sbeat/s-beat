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

from Db import DBDocument


class CourseSemesterInfo(DBDocument):
    collection_name = 'courseSemesterInfos'

    entry_cache = {}

    def __init__(self, **kwargs):
        self.ident = None  # ident composed of stg and semester id
        self.stg = None  # group of course
        self.semester_id = None  # semester id

        self.students = {
            'count': 0,  # count of students with exams
            'finished': 0,  # count of students with finished exams
            'successful': 0,  # count of students with successful exams
            'studying': 0,
            'failed': 0,  # count of students with failed exams
            'success_perc': None,  # percentage of successful exams from finished
            'failed_perc': None,  # percentage of failed exams from finished
            'male': 0,
            'female': 0,
            'male_perc': 0,
            'female_perc': 0
        }
        self.exams = {
            'count': 0,  # count of exams
            'finished': 0,  # count of finished exams
            'successful': 0,  # count of successful exams
            'failed': 0,  # count of failed exams
            'applied': 0,  # count of applied exams
            'resigned': 0,  # count of resigned exams
            'resign_perc': 0,  # percent of resigned exams
            'delayed': 0,  # delayed exams
            'delayed_u': 0,  # unauthorized delayed exams
            'success_perc': None,  # percentage of successful exams from finished
            'failed_perc': None,  # percentage of failed exams from finished
            'min': None,  # minimum count of exams a student has in a semester
            'max': None,  # maximum count of exams a student has in a semester
            'mean': None,  # average count of exams a student has in a semester
            'values': {}  # dict: count exams: count of students
        }

        self.exam_count = {
            'min': None,  # minimum count of exams a student has
            'max': None,  # maximum count of exams a student has
            'mean': None,  # average count of exams a student has
            'values': {}  # dict: count exams: count of students
        }

        self.exams_per_student = None

        self.bonus_data = {
            'min': None,  # minimum bonus value, probably always 0
            'max': None,  # maximum bonus value a student received
            'mean': None,  # average bonus a student received
            'values': {}  # dict: bonus of student: count of students
        }

        self.grade_data = {
            'min': None,  # minimum grade a student got, probably 1.0
            'max': None,  # maximum grade a student got
            'mean': None,  # average grade students received
            'values': {}  # grade student: count of students
        }

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

        self.semester_data = {}  # sem_x : { all above }

    def __repr__(self):
        return 'CourseSemesterInfo(' + repr(self.__dict__) + ')'

    def db_transform(self):
        """
        Transforms self to a database dictionary object.
        Gets called by transform_incoming of SONManipulator
        """

        # calculate percentages and values
        self.update_totals_dict_by_semester_data(self.__dict__)
        for sem_nr_id, d in self.semester_data.iteritems():
            self.update_totals_dict_by_semester_data(d)

        if self.students['count']:
            self.exams_per_student = float(self.exams['count']) / self.students['count']
            self.students['male_perc'] = float(self.students['male']) / self.students['count']
            self.students['female_perc'] = float(self.students['female']) / self.students['count']
            self.students['studying'] = self.students['count'] - self.students['finished']

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
        p = CourseSemesterInfo()
        p.ident = son['_id']
        del son['_id']
        p.__dict__.update(son)
        return p

    @classmethod
    def get_by_stg_and_semid(cls, stg, semester_id, cached=True):
        ident = stg + '_' + str(semester_id)
        d = cls.entry_cache.get(ident)
        if d is not None and cached:
            return d

        d = cls.find_one({'_id': ident})
        if d is not None:
            cls.entry_cache[ident] = d
            return d

        d = CourseSemesterInfo()
        d.ident = ident
        d.stg = stg
        d.semester_id = semester_id
        d.db_insert()
        cls.entry_cache[ident] = d

        return d

    @classmethod
    def update_by_student(cls, student):

        d = cls.get_by_stg_and_semid(student.stg, student.start_semester)

        for sem_nr_id, semester_data in student.semester_data.iteritems():
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
            'grade': None
            """

            d.update_by_semester_data(sem_nr_id, semester_data)

        d.students['count'] += 1
        if student.finished:
            d.students['finished'] += 1
        if student.success:
            d.students['successful'] += 1
        if student.aborted:
            d.students['failed'] += 1

        if student.risk and not student.finished and student.risk['median_scaled'] is not None:
            risk_id = str(int(student.risk['median_scaled'] * 100))
            if risk_id not in d.risk_data['values']:
                d.risk_data['values'][risk_id] = 1
            else:
                d.risk_data['values'][risk_id] += 1

        if student.hzb_grade is not None:
            hzb_grade_id = str(student.hzb_grade)
            if hzb_grade_id not in d.hzb_grade_data['values']:
                d.hzb_grade_data['values'][hzb_grade_id] = 1
            else:
                d.hzb_grade_data['values'][hzb_grade_id] += 1

        if student.exam_count is not None:
            exam_count_id = str(student.exam_count)
            if exam_count_id not in d.exam_count['values']:
                d.exam_count['values'][exam_count_id] = 1
            else:
                d.exam_count['values'][exam_count_id] += 1

        if student.age is not None:
            age_id = str(student.age)
            if age_id not in d.age_data['values']:
                d.age_data['values'][age_id] = 1
            else:
                d.age_data['values'][age_id] += 1

        if student.gender == 'W':
            d.students['female'] += 1
        elif student.gender == 'M':
            d.students['male'] += 1

        if student.hzb_type not in d.hzb_type_values:
            d.hzb_type_values[student.hzb_type] = 1
        else:
            d.hzb_type_values[student.hzb_type] += 1

    @staticmethod
    def update_stat_dict_by_values(d):
        total_count = sum(d['values'].values())
        if total_count:
            exams_values = [int(x) for x in d['values'] if x != 'None']
            d['min'] = min(exams_values)
            d['max'] = max(exams_values)
            values_sum = [int(x) * c for x, c in d['values'].iteritems() if x != 'None']
            d['mean'] = float(sum(values_sum)) / total_count

    @classmethod
    def update_totals_dict_by_semester_data(cls, d):
        if d['exams']['finished']:
            d['exams']['success_perc'] = float(d['exams']['successful']) / float(d['exams']['finished'])
            d['exams']['failed_perc'] = float(d['exams']['failed']) / float(d['exams']['finished'])
        else:
            d['exams']['success_perc'] = 0.0
            d['exams']['failed_perc'] = 0.0

        if d['exams']['count']:
            d['exams']['resign_perc'] = float(d['exams']['resigned']) / float(d['exams']['count'])
        else:
            d['exams']['resign_perc'] = 0.0

        if d['students']['finished']:
            d['students']['success_perc'] = float(d['students']['successful']) / float(d['students']['count'])
            d['students']['failed_perc'] = float(d['students']['failed']) / float(d['students']['count'])
        else:
            d['students']['success_perc'] = 0.0
            d['students']['failed_perc'] = 0.0

        cls.update_stat_dict_by_values(d['exams'])
        cls.update_stat_dict_by_values(d['bonus_data'])
        if 'exam_count' in d:
            cls.update_stat_dict_by_values(d['exam_count'])
        if 'bonus_total_data' in d:
            cls.update_stat_dict_by_values(d['bonus_total_data'])
        cls.update_stat_dict_by_values(d['grade_data'])
        if 'risk_data' in d:
            cls.update_stat_dict_by_values(d['risk_data'])

        if 'hzb_grade_data' in d:
            cls.update_stat_dict_by_values(d['hzb_grade_data'])
        if 'age_data' in d:
            cls.update_stat_dict_by_values(d['age_data'])

    @staticmethod
    def update_dict_by_semester_data(d, semester_data, no_students=False):

        if not no_students:
            for key in d['students']:
                if key in semester_data and semester_data[key] > 0:
                    d['students'][key] += 1

        for key in d['exams']:
            if key in semester_data:
                d['exams'][key] += semester_data[key]

        count_id = str(semester_data['count'])
        if count_id not in d['exams']['values']:
            d['exams']['values'][count_id] = 1
        else:
            d['exams']['values'][count_id] += 1

        bonus_id = str(semester_data['bonus'])
        if bonus_id not in d['bonus_data']['values']:
            d['bonus_data']['values'][bonus_id] = 1
        else:
            d['bonus_data']['values'][bonus_id] += 1

        if 'bonus_total' in semester_data and 'bonus_total_data' in d:
            bonus_total_id = str(semester_data['bonus_total'])
            if bonus_total_id not in d['bonus_total_data']['values']:
                d['bonus_total_data']['values'][bonus_total_id] = 1
            else:
                d['bonus_total_data']['values'][bonus_total_id] += 1

        if semester_data['grade']:
            grade_id = str(semester_data['grade'] / 10 * 10)
            if grade_id not in d['grade_data']['values']:
                d['grade_data']['values'][grade_id] = 1
            else:
                d['grade_data']['values'][grade_id] += 1

    def update_by_semester_data(self, sem_nr_id, semester_data):
        if sem_nr_id not in self.semester_data:
            self.semester_data[sem_nr_id] = {
                'students': {
                    'count': 0,  # count of students with exams
                    'finished': 0,  # count of students with finished exams
                    'successful': 0,  # count of students with successful exams
                    'failed': 0,  # count of students with failed exams
                    'applied': 0,  # count of students with applied exams
                    'delayed': 0,  # students with delayed exams
                    'delayed_u': 0  # students with unauthorized delayed exams
                },
                'exams': {
                    'count': 0,  # count of exams
                    'finished': 0,  # count of finished exams
                    'successful': 0,  # count of successful exams
                    'failed': 0,  # count of failed exams
                    'applied': 0,  # count of applied exams
                    'resigned': 0,  # count of resigned exams
                    'resign_perc': 0,  # percent of resigned exams
                    'delayed': 0,  # delayed exams
                    'delayed_u': 0,  # unauthorized delayed exams
                    'success_perc': None,  # percentage of successful exams from finished
                    'failed_perc': None,  # percentage of failed exams from finished
                    'min': None,  # minimum count of exams a student has
                    'max': None,  # maximum count of exams a student has
                    'mean': None,  # average count of exams a student has
                    'values': {}  # dict: count exams: count of students
                },
                'bonus_data': {
                    'min': None,  # minimum bonus value, probably always 0
                    'max': None,  # maximum bonus value a student received
                    'mean': None,  # average bonus a student received
                    'values': {}  # dict: bonus of student: count of students
                },
                'bonus_total_data': {
                    'min': None,  # minimum bonus value, probably always 0
                    'max': None,  # maximum bonus value a student received
                    'mean': None,  # average bonus a student received
                    'values': {}  # dict: bonus of student: count of students
                },
                'grade_data': {
                    'min': None,  # minimum grade a student got, probably 1.0
                    'max': None,  # maximum grade a student got
                    'mean': None,  # average grade students received
                    'values': {}  # grade student: count of students
                }
            }

        self.update_dict_by_semester_data(self.__dict__, semester_data, True)
        self.update_dict_by_semester_data(self.semester_data[sem_nr_id], semester_data)

    @classmethod
    def save_cached(cls):
        for d in cls.entry_cache.values():
            d.db_save()
