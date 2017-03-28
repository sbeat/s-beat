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


class ExamInfo(DBDocument):
    collection_name = 'examInfos'

    exam_info_cache = {}

    def __init__(self, **kwargs):
        self.exam_info_id = None  # internal ident of this exam
        self.exam_id = []  # used exam ids
        self.name = None  # exam name in full
        self.has_grade = False  # if this exam has a grade
        self.bonus = None  # bonus for this exam
        self.stg = []  # list of stg this exam was written in
        self.stg_original = []  # list of original stg this exam was written in

        self.count_exams = 0  # count of exams
        self.count_successful = 0  # count of passed exams
        self.count_failed = 0  # number of failed exams
        self.count_applied = 0  # number of applied exams
        self.count_resigned = 0  # number of resigned exams
        self.success_perc = None  # percent of success
        self.failed_perc = None  # percent of failed
        self.resign_perc = None  # percent of resigned exams

        self.form = []
        self.type = None

        # self.pv_id = None
        # self.pl_id = None

        self.grades = None
        self.grades_nb = None

        self.semester_data = {}  # for every semester_id {exams, successful, failed, applied, grades}
        self.form_data = {}  # for every form {exams, successful, failed, applied, grades}

        self.semesters = set()  # semester ids in which the exam was written

    def __repr__(self):
        return 'ExamInfo(' + repr(self.__dict__) + ')'

    @staticmethod
    def update_stat_dict_by_values(d):
        total_count = sum(d['values'].values())
        if total_count:
            exams_values = [int(x) for x in d['values']]
            d['min'] = min(exams_values)
            d['max'] = max(exams_values)
            values_sum = [int(x) * c for x, c in d['values'].iteritems()]
            d['mean'] = float(sum(values_sum)) / total_count

    def update_totals_dict_by_semester_data(self):
        total = float(self.count_successful + self.count_failed)
        if total > 0:
            self.success_perc = float(self.count_successful) / total
            self.failed_perc = float(self.count_failed) / total

        if self.count_exams > 0:
            self.resign_perc = float(self.count_resigned) / self.count_exams

        if self.grades:
            self.update_stat_dict_by_values(self.grades)

        if self.grades_nb:
            self.update_stat_dict_by_values(self.grades_nb)

        for semid, d in self.semester_data.iteritems():
            total = float(d['successful'] + d['failed'])
            if total > 0:
                d['success_perc'] = float(d['successful']) / total
                d['failed_perc'] = float(d['failed']) / total

            if d['exams'] > 0:
                d['resign_perc'] = float(d['resigned']) / d['exams']

            if d['grades']:
                self.update_stat_dict_by_values(d['grades'])

            if d['grades_nb']:
                self.update_stat_dict_by_values(d['grades_nb'])

    def db_transform(self):
        """
        Transforms self to a database dictionary object.
        Gets called by transform_incoming of SONManipulator
        """

        self.update_totals_dict_by_semester_data()

        data = self.__dict__.copy()
        del data['exam_info_id']
        data['_id'] = self.exam_info_id
        data['semesters'] = list(self.semesters)
        return data

    @staticmethod
    def db_create(son):
        """
        Creates a new Instance based of database SON data.
        Gets called by transform_outgoing of SONManipulator
        """
        p = ExamInfo()
        p.exam_info_id = son['_id']
        del son['_id']
        son['semesters'] = set(son['semesters'])
        p.__dict__.update(son)
        return p

    @classmethod
    def get_by_exam(cls, exam, cached=True):
        ei = cls.exam_info_cache.get(exam.exam_info_id)
        if ei is not None and cached:
            return ei

        ei = cls.find_one({'_id': exam.exam_info_id})
        if ei is not None:
            cls.exam_info_cache[ei.exam_info_id] = ei
            return ei

        ei = ExamInfo()
        ei.exam_info_id = exam.exam_info_id
        ei.name = exam.name
        ei.db_insert()
        cls.exam_info_cache[ei.exam_info_id] = ei

        # from Exam import Exam

        # TODO: that feature must be implemented by using SPO data
        # if exam.type == 'PL':
        #
        #     pv_id = exam.exam_id + 1
        #     pv_exam = Exam.find_one({"exam_id": pv_id})
        #
        #     if pv_exam is not None:
        #         if pv_exam.type == 'PV':
        #             ei.pv_id = pv_exam.exam_info_id
        #
        # elif exam.type == 'PV':
        #
        #     pl_id = exam.exam_id - 1
        #     pl_exam = Exam.find_one({"exam_id": pl_id})
        #
        #     if pl_exam is not None:
        #         if pl_exam.type == 'PL':
        #             ei.pl_id = pl_exam.exam_info_id

        return ei

    @classmethod
    def update_by_exam(cls, exam):
        if not exam.stg:
            return

        ei = cls.get_by_exam(exam)

        ei.semesters.add(exam.semester)

        semid = str(exam.semester)
        if semid not in ei.semester_data:
            ei.semester_data[semid] = {
                'exams': 0, 'successful': 0, 'failed': 0, 'applied': 0, 'resigned': 0,
                'success_perc': None, 'failed_perc': None, 'resign_perc': None, 'grades': None, 'grades_nb': None
            }

        formid = exam.form
        if formid not in ei.form_data:
            ei.form_data[formid] = {
                'exams': 0, 'successful': 0, 'failed': 0, 'applied': 0, 'resigned': 0,
                'success_perc': None, 'failed_perc': None, 'resign_perc': None, 'grades': None, 'grades_nb': None
            }

        ei.count_exams += 1
        ei.semester_data[semid]['exams'] += 1
        ei.form_data[formid]['exams'] += 1
        if exam.is_success():
            ei.count_successful += 1
            ei.semester_data[semid]['successful'] += 1
            ei.form_data[formid]['successful'] += 1
        if exam.is_failed():
            ei.count_failed += 1
            ei.semester_data[semid]['failed'] += 1
            ei.form_data[formid]['failed'] += 1
        if exam.is_applied():
            ei.count_applied += 1
            ei.semester_data[semid]['applied'] += 1
            ei.form_data[formid]['applied'] += 1
        if exam.is_resigned():
            ei.count_resigned += 1
            ei.semester_data[semid]['resigned'] += 1
            ei.form_data[formid]['resigned'] += 1

        if exam.stg not in ei.stg:
            ei.stg.append(exam.stg)

        if exam.exam_id not in ei.exam_id:
            ei.exam_id.append(exam.exam_id)

        if exam.stg_original not in ei.stg_original:
            ei.stg_original.append(exam.stg_original)

        if exam.form not in ei.form:
            ei.form.append(exam.form)

        ei.type = exam.type

        if exam.bonus:
            ei.bonus = max(exam.bonus, ei.bonus)

        if exam.grade:
            ei.has_grade = True
            if ei.grades is None:
                ei.grades = {'min': None, 'max': None, 'values': {}}

            if ei.grades_nb is None:
                ei.grades_nb = {'min': None, 'max': None, 'values': {}}

            if ei.semester_data[semid]['grades'] is None:
                ei.semester_data[semid]['grades'] = {'min': None, 'max': None, 'values': {}}

            if ei.semester_data[semid]['grades_nb'] is None:
                ei.semester_data[semid]['grades_nb'] = {'min': None, 'max': None, 'values': {}}

            if ei.form_data[formid]['grades'] is None:
                ei.form_data[formid]['grades'] = {'min': None, 'max': None, 'values': {}}

            if ei.form_data[formid]['grades_nb'] is None:
                ei.form_data[formid]['grades_nb'] = {'min': None, 'max': None, 'values': {}}

            grade_id = str(exam.grade / 10 * 10)
            if exam.is_success():
                if grade_id not in ei.grades['values']:
                    ei.grades['values'][grade_id] = 1
                else:
                    ei.grades['values'][grade_id] += 1

                if grade_id not in ei.semester_data[semid]['grades']['values']:
                    ei.semester_data[semid]['grades']['values'][grade_id] = 1
                else:
                    ei.semester_data[semid]['grades']['values'][grade_id] += 1

                if grade_id not in ei.form_data[formid]['grades']['values']:
                    ei.form_data[formid]['grades']['values'][grade_id] = 1
                else:
                    ei.form_data[formid]['grades']['values'][grade_id] += 1

            if grade_id not in ei.grades_nb['values']:
                ei.grades_nb['values'][grade_id] = 1
            else:
                ei.grades_nb['values'][grade_id] += 1

            if grade_id not in ei.semester_data[semid]['grades_nb']['values']:
                ei.semester_data[semid]['grades_nb']['values'][grade_id] = 1
            else:
                ei.semester_data[semid]['grades_nb']['values'][grade_id] += 1

            if grade_id not in ei.form_data[formid]['grades_nb']['values']:
                ei.form_data[formid]['grades_nb']['values'][grade_id] = 1
            else:
                ei.form_data[formid]['grades_nb']['values'][grade_id] += 1

    @classmethod
    def save_cached(cls):
        for ei in cls.exam_info_cache.values():
            ei.db_save()
