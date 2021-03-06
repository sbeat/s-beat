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

import base64
import hashlib
import logging

import ImportTools
from Db import DBDocument
from ProcessTracking import ProcessTracking
from Settings import Settings
from ImportTools import get_date_from_csv, get_int, get_unicode, get_boolean, get_float

encoding = 'windows-1252'
logger = logging.getLogger(__name__)

import_expressions = ImportTools.get_import_expressions()

if 'exam_is_finished' not in import_expressions:
    import_expressions['exam_is_finished'] = lambda e: e.status in ('BE', 'NB', 'EN', 'RT')

if 'exam_is_success' not in import_expressions:
    import_expressions['exam_is_success'] = lambda e: e.status == 'BE'

if 'exam_is_failed' not in import_expressions:
    import_expressions['exam_is_failed'] = lambda e: e.status in ('NB', 'EN')

if 'exam_is_applied' not in import_expressions:
    import_expressions['exam_is_applied'] = lambda e: e.status == 'AN' and e.comment not in ('G', 'RT', 'U')

if 'exam_is_resigned' not in import_expressions:
    import_expressions['exam_is_resigned'] = lambda e: e.status == 'RT' or e.status == 'AN' and e.comment in (
        'G', 'RT', 'U')

if 'exam_is_delayed' not in import_expressions:
    import_expressions['exam_is_delayed'] = lambda e: e.status == 'RT' or e.status == 'AN' and e.comment == 'G'

if 'exam_is_delayed_u' not in import_expressions:
    import_expressions['exam_is_delayed_u'] = lambda e: e.comment == 'U'

if 'exam_is_mandatory' not in import_expressions:
    import_expressions['exam_is_mandatory'] = lambda e: e.mandatory == 'P'


class Exam(DBDocument):
    collection_name = 'exams'

    def __init__(self, **kwargs):
        self.ident = None  # Combined ident: student_id, exam_id, semester, try_nr
        self.student_id = 0  # Ident of the student
        self.ident_original = None  # Ident of the student
        self.exam_id = 0  # ID Number of the exam (PNR)
        self.exam_info_id = 0  # ID of the exam info
        self.semester = 0  # semester number
        self.name = ''  # name of this exam
        self.bonus = 0.0  # number of ECTS
        self.degree_type = ''  # type of degree this exam is for: Diplom,Bachelor,Master
        self.stg_original = None  # Short of the degree course
        self.stg = None  # Short of the degree course
        self.by_forename = ''  # Forename of examinant
        self.by_surname = ''  # Surname of examinant
        self.status = ''  # BE, AN, NB, EN
        self.type = ''  # PL,PV,VS
        self.grade = None  # grade
        self.form = ''  # KL, HA
        self.comment = ''  # comment for this exam: G, U
        self.try_nr = 0  # try number
        self.mandatory = ''  # P,W,WA
        self.phase = ''  # G, H
        self.recognized = False  # is it a recognized exam
        self.version = 0
        self.date = None

    def is_finished(self):
        """
        If this exam entry is done and is not in status AN
        """
        return import_expressions['exam_is_finished'](self)

    def is_success(self):
        return import_expressions['exam_is_success'](self)

    def is_applied(self):
        return import_expressions['exam_is_applied'](self)

    def is_resigned(self):
        """
        the exam was reported to can't be attended
        """
        return import_expressions['exam_is_resigned'](self)

    def is_delayed(self):
        """
        the exam could not be attended with permission
        """
        return import_expressions['exam_is_delayed'](self)

    def is_delayed_u(self):
        """
        the exam could not be attended but without permission
        """
        return import_expressions['exam_is_delayed_u'](self)

    def is_failed(self):
        return import_expressions['exam_is_failed'](self)

    def is_mandatory(self):
        return import_expressions['exam_is_mandatory'](self)

    def update_existing(self):
        # curr = Exam.find_one({'_id': exam.ident})
        # if self.is_success():  # if this is passed always overwrite old
        self.db_save()

    def generate_exam_info_id(self, fields):
        m = hashlib.md5()
        for field in fields:
            m.update(unicode(getattr(self, field)))
        self.exam_info_id = base64.urlsafe_b64encode(m.digest())[0:8]
        return self.exam_info_id

    def generate_ident(self, fields):
        m = hashlib.md5()
        for field in fields:
            m.update(unicode(getattr(self, field)))
        self.ident = base64.urlsafe_b64encode(m.digest())[0:10]
        return self.ident

    def __repr__(self):
        return 'Exam(' + repr(self.__dict__) + ')'

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
        p = Exam()
        p.ident = son['_id']
        del son['_id']
        p.__dict__.update(son)
        return p

    @classmethod
    def db_setup(cls):
        c = cls.get_collection()
        c.create_index([('student_id', 1)])

    @staticmethod
    def import_from_file(file_info):
        import ImportTools
        from Student import Student
        global encoding

        settings = Settings.load_dict([
            'grade_exam_number',
            'final_exam_numbers_ba',
            'ignore_exam_numbers',
            'min_semester',
            'unique_exam_id',
            'unique_exam_info_id',
            'import_encoding',
            'student_ident_string',
            'unique_student_id'
        ])
        encoding = settings['import_encoding']

        ignore_exam_numbers_stg = Settings.load_dict_for_key('ignore_exam_numbers')
        min_semester_stg = Settings.load_dict_for_key('min_semester')
        grade_exam_number_stg = Settings.load_dict_for_key('grade_exam_number')
        final_exam_numbers_ba_stg = Settings.load_dict_for_key('final_exam_numbers_ba')

        grade_exam_number = settings['grade_exam_number']
        final_exam_numbers_ba = settings['final_exam_numbers_ba']
        ignore_exam_numbers = settings['ignore_exam_numbers']

        first_semester = None
        last_semester = None
        logger.info('Check CSV File for min and max semester')
        num = 0
        for entry, curr, total in ImportTools.read_csv(file_info):
            num += 1

            stg = get_unicode(entry['stg'])
            if stg is None:
                continue
            min_semester = min_semester_stg.get(stg, settings['min_semester'])

            sem = get_int(entry['psem'])
            if sem is None or sem < min_semester or sem > 21000:
                logger.error(
                    "Exam.import_from_file " + file_info['file'] + ": ivalid psem entry: " + repr(num) + " : " + repr(
                        entry))
                continue

            if first_semester is None or first_semester > sem:
                first_semester = sem
            if last_semester is None or last_semester < sem:
                last_semester = sem

        logger.info('Remove all status=AN exams between %s and %s', first_semester, last_semester)
        Exam.get_collection().remove({'status': 'AN', 'semester': {'$gte': first_semester, '$lte': last_semester}})

        num = 0
        failed_num = 0
        for entry, curr, total in ImportTools.read_csv(file_info):
            num += 1
            exam = create_exam_from_entry(entry, settings)
            error = None
            if exam == 'missing_field' or exam == 'unknown_course':
                error = exam
                exam = None

            if exam is not None:
                grade_exam_number = grade_exam_number_stg.get(exam.stg, settings['grade_exam_number'])
                final_exam_numbers_ba = final_exam_numbers_ba_stg.get(exam.stg, settings['final_exam_numbers_ba'])
                ignore_exam_numbers = ignore_exam_numbers_stg.get(exam.stg, settings['ignore_exam_numbers'])

                exam.student_id = Student.generate_ident(exam, settings['unique_student_id'])
                student = Student.find_one({'_id': exam.student_id})

                if student and student.start_semester > exam.semester:
                    exam.semester = student.start_semester

                exam.generate_exam_info_id(settings['unique_exam_info_id'])
                exam.generate_ident(settings['unique_exam_id'])

            if exam is not None and (
                    exam.exam_id == grade_exam_number
                    or unicode(exam.exam_id) in final_exam_numbers_ba and exam.status == 'BE'):

                if student and exam.exam_id == grade_exam_number and 100 <= exam.grade <= 400:
                    student.final_grade = exam.grade
                    student.success = True
                # if student and unicode(exam.exam_id) in final_exam_numbers_ba and exam.status == 'BE':
                #     student.success = True
                if student:
                    student.db_update(['final_grade', 'success'])
                    # ExamInfo.update_by_exam(exam)

            elif exam is not None and not ImportTools.is_int_in_ranges(exam.exam_id, ignore_exam_numbers):
                result = exam.db_insert()  # returns none if exam is a duplicate or db has a problem
                if result is None:
                    logger.warning('duplicate exam %s', exam)
                    exam.update_existing()
                    failed_num += 1

                print '%.1f%%' % (float(curr) / total * 100), num, result.inserted_id if result else None, \
                    'duplicate(s): ', failed_num

                # ExamInfo.update_by_exam(exam)  # problem with duplicates, now called in Student.calculate_from_exams
            elif error == 'missing_field':
                logger.warning("import_from_file %s: mandatory field missing, ignore entry: %d : %s",
                               file_info['file'], num, entry)
            elif error == 'unknown_course':
                logger.warning(
                    "import_from_file %s: course for stg %s not found, ignore entry: %d, identnr: %s pnr: %s",
                    file_info['file'], entry['stg'], num, entry['identnr'], entry['pnr'])
            else:
                logger.warning("import_from_file %s: ignored entry: %d :%s", file_info['file'], num, entry)

            if num % 100 == 0:
                ProcessTracking.process_update('import_exams', float(curr) / total, {
                    'num': num,
                    'failed': failed_num
                })

        # ExamInfo.save_cached()

        ProcessTracking.process_update('import_exams', 1.0, {
            'num': num,
            'failed': failed_num
        })


def create_exam_from_entry(data, settings):
    from Course import Course

    exam = Exam()
    if settings['student_ident_string']:
        exam.ident_original = get_unicode(data['identnr'], encoding)
    else:
        exam.ident_original = get_int(data['identnr'])
    exam.exam_id = get_int(data['pnr'])  # ID Number of the exam (PNR)
    exam.semester = get_int(data['psem'])  # semester number
    exam.try_nr = get_int(data['pversuch'])  # try number

    if None in (exam.ident_original, exam.exam_id, exam.semester, exam.try_nr):
        return 'missing_field'

    exam.name = get_unicode(data['pdtxt'])
    exam.bonus = get_float(data['bonus'])  # number of ECTS

    if 'abschlart' in data:
        exam.degree_type = get_unicode(data['abschlart'])  # type of degree this exam is for
    elif 'abschl' in data:
        exam.degree_type = ImportTools.map_by_definiton('abschl', data['abschl'], True)

    exam.stg_original = get_unicode(data['stg'])  # Short of the degree course

    course = Course.get_by_stg_original(exam.stg_original)
    if course is None or course.ignore:
        return 'unknown_course'

    exam.stg = course.stg

    if 'vorname' in data:
        exam.by_forename = get_unicode(data['vorname'])  # Forename of examinant

    if 'nachname' in data:
        exam.by_surname = get_unicode(data['nachname'])  # Surname of examinant

    if 'pversion' in data:
        exam.version = get_int(data['pversion'])

    if 'pdatum' in data:
        exam.date = get_date_from_csv(data['pdatum'])

    exam.status = get_unicode(data['pstatus'])  # BE, AN, NB, EN
    exam.type = get_unicode(data['part'])  # PL,PV,VS
    exam.grade = get_int(data['pnote'])  # grade
    exam.form = get_unicode(data['pform'])  #
    if 'ppflicht' in data:
        exam.mandatory = get_unicode(data['ppflicht'])  # P,W,WA
    if 'pflicht' in data:
        exam.mandatory = get_unicode(data['pflicht'])  # P,W,WA

    exam.comment = get_unicode(data['pvermerk'])  # G,U
    exam.phase = get_unicode(data['pabschn'])  # G,H

    if 'panerk' in data and get_boolean(data['panerk']) == True:
        exam.recognized = True

    return exam
