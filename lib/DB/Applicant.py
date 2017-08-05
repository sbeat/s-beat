"""
Copyright (c) 2017 S-BEAT GbR and others and others

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
import time

from pymongo import errors

import CalcTools
import ImportTools
import UserTools
from Db import DBDocument, get_last_error
from ImportTools import get_date_from_csv, get_int, get_unicode, get_boolean, clean_db_string
from MarkedList import MarkedList
from ProcessTracking import ProcessTracking
from Settings import Settings

encoding = 'windows-1252'
logger = logging.getLogger(__name__)


class Applicant(DBDocument):
    collection_name = 'applicants'

    restricted_fields = {
        'gender': 'personal_data',
        'birth_date': 'personal_data',
        'hzb_grade': 'personal_data',
        'hzb_type': 'personal_data',
        'hzb_date': 'personal_data',
        'forename': 'identification_data',
        'surname': 'identification_data',
        'email': 'identification_data',
        'land': 'identification_data',
        'plz': 'identification_data',
        'stang': 'identification_data',
        'eu': 'identification_data'
    }

    cached_min_max = None

    def __init__(self, **kwargs):

        self.ident = None  # Ident number
        self.gender = ''  # Gender of applicant: M,W
        self.birth_date = None  # Date of birth
        self.hzb_grade = 0  # entrance qualification grade
        self.hzb_type = ''  # entrance qualification type
        self.hzb_date = None  # entrance qualification date
        self.stg = None  # Short of the degree course (already mapped!)
        self.stg_original = None  # Original unmapped course
        self.appl_date = None  # application date
        self.zul_date = None  # admission date
        # self.degree_type = None  # type of degree: Diplom,Bachelor,Master

        # Identity
        self.forename = None
        self.surname = None
        self.email = None
        self.land = None  # country of residence
        self.plz = None  # zip code
        self.stang = None  # citizenship
        self.eu = None  # EU citizen (yes/no)

        # 1st step calculated values
        self.start_semester = None  # Start semester number
        self.age = None  # Age of applicant
        self.hzb_appl_time = None  # count of months between entrance qualification and application
        self.admitted = False

        # 2nd step calculated values
        self.ignore = False  # if data is faulty - ignore applicant

    def get_dict(self, user_role=None, hide_finished_ident_data=True):
        data = self.__dict__.copy()
        if user_role is not None:
            for field, role in self.restricted_fields.iteritems():
                if not UserTools.has_right(role, user_role) and field in data:
                    del data[field]
        if hide_finished_ident_data and self.finished:
            for field, role in self.restricted_fields.iteritems():
                if role == 'application_data':
                    del data[field]

        return data

    def __repr__(self):
        return 'Applicant(' + repr(self.__dict__) + ')'

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
        p = Applicant()
        p.ident = son['_id']
        del son['_id']
        p.__dict__.update(son)
        return p

    @staticmethod
    def import_from_file(file_info):
        import ImportTools
        global encoding

        settings = Settings.load_dict([
            'import_applicants',
            'import_ident_from_students',
            'import_encoding'
        ])
        encoding = settings['import_encoding']

        num = 0
        for entry, curr, total in ImportTools.read_csv(file_info):
            num += 1
            stg = get_unicode(entry['stg'], encoding)
            if stg is None:
                logger.error(
                    "Applicant at line " + str(num) + " has no STG")
                continue

            applicant_settings = {
                "import_applicants": settings['import_applicants'],
                "import_ident_from_students": settings['import_ident_from_students']
            }
            applicant = create_applicant_from_entry(entry, applicant_settings)
            if applicant is not None:
                result = applicant.db_save()
                logger.info('applicant %d %s', num, (result.upserted_id if result else None))

            if num % 100 == 0:
                ProcessTracking.process_update('import_applicants', float(curr) / total, {
                    'num': num
                })

        ProcessTracking.process_update('import_applicants', 1.0, {
            'num': num
        })

    @classmethod
    def calc_sums(cls, find=None):
        """
        Groups and counts values for a defined field
        """
        try:
            c = cls.get_collection()
            pipeline = list()
            if find is not None:
                pipeline.append({'$match': find})
            pipeline.append({'$group': {
                '_id': None,
                'count': {'$sum': 1},
                'hzb_appl_time': {'$sum': '$hzb_appl_time'},
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
            c = cls.get_collection()
            pipeline = list()
            if find is not None:
                pipeline.append({'$match': find})
            pipeline.append({'$group': {
                '_id': None,
                'age': {'$avg': '$age'},
                'count': {'$sum': 1},
                'hzb_appl_time': {'$avg': '$hzb_appl_time'},
            }})

            result = cls.db_aggregate(pipeline)
            for d in result:
                return unsanitize_dict(d)
            return None


        except errors.PyMongoError:
            print 'calc_avgs PyMongoError ', get_last_error()
            return None

    @classmethod
    def db_setup(cls):
        pass


def sanitize_field(field):
    return field.replace('.', '-')


def unsanitize_field(field):
    return field.replace('-', '.')


def unsanitize_dict(d):
    for key in d:
        if '-' in key:
            d[unsanitize_field(key)] = d.pop(key)
    return d


def create_applicant_from_entry(data, settings):
    """
    Part of 1st Step Applicant import from csv file
    """
    from Course import Course

    applicant = Applicant()
    applicant.ident = get_int(data['identnr'])
    applicant.gender = get_unicode(data['geschl'], encoding)
    applicant.birth_date = get_date_from_csv(data['gebdat'])

    applicant.stg_original = get_unicode(data['stg'], encoding)

    course = Course.get_by_stg_original(applicant.stg_original)
    if course is None or course.ignore:
        logger.error(
            "Applicant has no known STG group for: " + applicant.stg_original + " ID: " + repr(applicant.ident))
        return None

    applicant.stg = course.stg
    applicant.degree_type = course.degree_type

    applicant.appl_date = get_date_from_csv(data['appldat'])
    applicant.zul_date = get_date_from_csv(data['zuldat'])

    if 'sem' in data:
        applicant.start_semester = get_int(data['sem'])
    else:
        applicant.start_semester = CalcTools.get_appl_start_semester_from_date(applicant.zul_date)

    applicant.hzb_grade = get_int(data['hzbnote'])
    if 'hzbart' in data:
        applicant.hzb_type = ImportTools.map_by_definiton('hzbart', int(data['hzbart']), True, u'Unbekannt')
    if 'hzbgrp' in data:
        applicant.hzb_type = clean_db_string(get_unicode(data['hzbgrp'], encoding))

    if applicant.hzb_type == '':
        logger.warning('No hzb_type for ' + applicant.stg_original + " ID: " + repr(applicant.ident))

    applicant.hzb_date = get_date_from_csv(data['hzbdatum'])
    if applicant.appl_date is not None and applicant.hzb_date is not None:
        applicant.hzb_appl_time = CalcTools.month_delta(applicant.hzb_date, applicant.appl_date)

    applicant.stg = course.stg

    applicant.age = CalcTools.calculate_age(applicant.birth_date, applicant.appl_date)

    if settings['import_ident_from_students']:
        if 'vorname' in data:
            applicant.forename = get_unicode(data['vorname'], encoding)

        if 'nachname' in data:
            applicant.surname = get_unicode(data['nachname'], encoding)

        if 'email' in data:
            applicant.email = get_unicode(data['email'], encoding)

        if 'land' in data:
            applicant.land = get_unicode(data['land'], encoding)

        if 'plz' in data:
            applicant.plz = get_unicode(data['plz'], encoding)

        if 'stang' in data:
            applicant.stang = get_unicode(data['stang'], encoding)

        if 'eu' in data:
            applicant.eu = get_boolean(data['eu'])

    return applicant


def get_progress(num, count, start):
    if num == 0:
        return ''

    left = count - num
    needed = time.clock() - start
    num_per_second = num / needed if needed else 0
    left_time = left * (needed / num) if num else 0

    return '%d / %d %.2f it/s %ds left' % (num, count, num_per_second, left_time)
