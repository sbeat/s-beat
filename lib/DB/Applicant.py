# coding=utf-8
# S-BEAT Project by Annkristin Stratmann, Niclas Steigelmann, Dominik Herbst

import array
import csv
import logging
import time

from pymongo import errors

import CalcTools
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
from ImportTools import get_date_from_csv, get_int, get_unicode, get_boolean

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
        self.sem_start = None  # estimated start semester number
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
        self.consulted = False  # TODO: Should applicants be consulted as well? (Otherwise scratch that)

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

        # Has there been a consulting with the applicant?
        consulted_list = MarkedList.find_one({'_id': 'consulted'})

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
                if consulted_list and applicant.ident in consulted_list.list:
                    applicant.consulted = True
                result = applicant.db_save()
                print num, result.upserted_id if result else None

            if num % 100 == 0:
                ProcessTracking.process_update('import_applicants', float(curr) / total, {
                    'num': num
                })

        ProcessTracking.process_update('import_applicants', 1.0, {
            'num': num
        })

    @classmethod
    def import_identity_from_file(cls, file_info):
        import ImportTools
        global encoding

        settings = Settings.load_dict([
            'import_encoding'
        ])
        encoding = settings['import_encoding']

        num = 0
        for data, curr, total in ImportTools.read_csv(file_info):
            num += 1
            ident = get_int(data['identnr'])
            applicant = cls.find_one({'_id': ident})
            if applicant is None:
                continue

            applicant.forename = get_unicode(data['vorname'], encoding)
            applicant.surname = get_unicode(data['nachname'], encoding)
            applicant.email = get_unicode(data['email'], encoding)
            applicant.land = get_unicode(data['land'], encoding)
            applicant.plz = get_unicode(data['plz'], encoding)
            applicant.stang = get_unicode(data['stang'], encoding)
            applicant.eu = get_boolean(data['eu'])

            applicant.db_update([
                'forename', 'surname', 'email', 'land', 'plz', 'stang', 'eu'
            ])

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
                for key in d:
                    if '-' in key:
                        d[key.replace('-', '.')] = d.pop(key)
                return d
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
                for key in d:
                    if '-' in key:
                        d[key.replace('-', '.')] = d.pop(key)
                return d
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
    def get_matching_applicants_count(path_elements, query=None):
        if query is None:
            query = dict()
        else:
            query = query.copy()
        for pe in path_elements:
            pe.get_db_query(query)
        # print 'query ', query
        return Applicant.find(query).count()

    @staticmethod
    def get_applicants_bitarray(path_elements, query=None):
        return ApplicantsBitArray(path_elements, query)


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

    applicant.start_semester = CalcTools.get_appl_start_semester_from_date(applicant.zul_date)

    applicant.hzb_grade = get_int(data['hzbnote'])
    if 'hzbart' in data:
        applicant.hzb_type = get_hzbgrp(data['hzbart'])
    if 'hzbgrp' in data:
        applicant.hzb_type = get_unicode(data['hzbgrp'], encoding)

    if applicant.hzb_type == '':
        logger.warning('No hzb_type for ' + applicant.stg_original + " ID: " + repr(applicant.ident))

    applicant.hzb_date = get_date_from_csv(data['hzbdatum'])
    if applicant.appl_date is not None and applicant.hzb_date is not None:
        applicant.hzb_appl_time = CalcTools.month_delta(applicant.hzb_date, applicant.appl_date)

    applicant.stg = course.stg

    applicant.age = CalcTools.calculate_age(applicant.birth_date, applicant.imm_date)

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


hzb_grps = None


def get_hzbgrp(hzbart):
    global hzb_grps
    if hzb_grps is None:
        with open('data/hzbart.csv', 'rb') as fd:
            reader = csv.DictReader(fd, delimiter=';')
            hzb_grps = dict()
            for entry in reader:
                hzb_grps[entry['HZBART']] = get_unicode(entry['HZBGRP'], encoding)

    return hzb_grps.get(hzbart, '')


def get_progress(num, count, start):
    if num == 0:
        return ''

    left = count - num
    needed = time.clock() - start
    num_per_second = num / needed if needed else 0
    left_time = left * (needed / num) if num else 0

    return '%d / %d %.2f it/s %ds left' % (num, count, num_per_second, left_time)


class ApplicantsBitArray():
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
        applicants = Applicant.find(self.query, modifiers={'$snapshot': True})
        self.count = applicants.count()
        self.yields = 0

        def generate_applicants(applicants, elements):
            for applicant in applicants:
                bm = [pe.check(applicant) for pe in elements]
                self.yields += 1
                yield bm

        generator = generate_applicants(applicants, self.elements)

        self.bmo = bitmapchecker.BitmapObject(generator, self.count, len(self.elements))
        self.rows = self.bmo.rows
        self.read_rows = self.bmo.read_rows
        print 'load_bitmapchecker count:', self.count, 'columns:', len(self.elements), 'rows:', self.rows, \
            'yields', self.yields, 'read_rows:', self.read_rows

    def run_combinations(self, k, start, end, callback, el_counts, min_support, rate, min_matching):
        if not self.bmo:
            return False

        element_indices = [self.elements.index(pe) for pe in self.elements]
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
        applicants = Applicant.find(self.query, modifiers={'$snapshot': True})
        self.count = applicants.count()
        for applicant in applicants:
            ba = self.make_bit_array(count_elements, 0)
            for i, pe in enumerate(self.elements):
                if pe.check(applicant):
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
        applicants = Applicant.find(self.query)
        element_counts = {}
        for pe in self.elements:
            element_counts[pe] = 0

        for applicant in applicants:
            for pe in self.elements:
                if pe.check(applicant):
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

        ret = ApplicantsBitArray(data['elements'], data['query'])
        ret.count = data['count']
        ret.query = data['query']
        ret.data = data['data']
        ret.bmo = pickle.loads(data['bmo_s'])
        ret.rows = data['rows']
        return ret
