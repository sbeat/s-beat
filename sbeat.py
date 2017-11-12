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

import sys

sys.path.append('lib')

from DB import *
import ImportTools
import time
import math
import pymongo
import itertools
import logging.handlers
import traceback
from ConfigParser import RawConfigParser

config = RawConfigParser()
config.read('config/main.cfg')


logger = None


def version():
    import Version
    logger.info(Version.get_string())


def initial_settings():
    """
    Installs the initial settings into the database
    """

    import json

    Settings.db_setup()

    with open('config/initialSettings.json') as json_data:
        settings = json.load(json_data)
        json_data.close()

        Settings.insert_by_dict(settings)

        print settings
        logger.info("Settings inserted")


def remove_setting():
    name = sys.argv[2]
    setting = Settings.find_one({'_id': name})
    if setting is not None:
        print 'found', setting.id
        print setting.db_remove()


def reset_students():
    """
    reset ignore-flag for all students
    """
    # db.students.update({ignore:true},{$set:{ignore:false}},{multi:true})


def run_on_temp_data():
    enable_temp_data()


def reset_db():
    run_on_temp_data()

    logger.info('drop Courses')
    Course.drop()

    logger.info('drop Student')
    Student.drop()

    logger.info('drop Exam')
    Exam.drop()

    logger.info('drop ExamInfo')
    ExamInfo.drop()

    logger.info('drop Path')
    Path.drop()

    logger.info('drop CourseSemesterInfo')
    CourseSemesterInfo.drop()


def run_all():
    import os

    with open('data/run_all.pid', 'w') as fd:
        fd.write(str(os.getpid()))

    reset_db()
    run_import()
    run_calculations()


def run_import():
    """
    Runs all imports
    """

    start = time.clock()
    run_on_temp_data()

    logger.info('####### import courses #######')
    import_courses()

    logger.info('####### import students #######')
    import_students()

    logger.info('####### import applicants #######')
    import_applicants()

    logger.info('####### import exams #######')
    import_exams()

    # DataDefinitions.create_definitions()
    # reload(DataDefinitions)
    # logger.info('####### generate paths #######')
    # generate_paths()

    end = time.clock()  # took 259s for 6768 paths
    logger.info('time: %i', end - start)


def run_calculations():
    """
    Runs all calculations
    """

    run_on_temp_data()

    logger.info('####### calculate exams #######')
    calculate_student_exams()

    logger.info('####### generate_definitions #######')
    generate_definitions()

    logger.info('####### generate_paths_apriori paths #######')
    generate_paths_apriori_mp()

    # logger.info('####### calculate_scaled_paths #######')
    # calculate_scaled_paths()

    logger.info('####### calculate_student_risk #######')
    calculate_student_risk()

    if not Settings.load('update_manual_apply'):
        apply_data()
    else:
        ProcessTracking.process_start('apply_data')
        ProcessTracking.process_update('apply_data', 0, {'state': 'wait_for_admin'})
        ProcessTracking.process_done('apply_data')


def apply_data():
    ProcessTracking.process_start('apply_data')
    try:
        ProcessTracking.process_update('apply_data', 0, {'state': 'running'})
        swap_temp_to_op()
        ProcessTracking.process_update('apply_data', 1, {'state': 'done'})
        ProcessTracking.process_done('apply_data')
    except:
        ProcessTracking.process_failed('apply_data', {'error': traceback.format_exc()})
        raise


def save_defintions_to_db():
    import DataDefinitions
    DataDefinitions.save_defintions_to_db()
    print 'Done'


def generate_definitions():
    """
    Generated definitions
    """
    import DataDefinitions
    ProcessTracking.process_start('generate_definitions')
    # DataDefinitions.create_definitions()
    DataDefinitions.generate_definitions_in_db()
    DataDefinitions.load_definitions_from_db()
    DataDefinitions.save_definitions_to_meta_data()
    ProcessTracking.process_done('generate_definitions')


def calculate_path_weights():
    """
    Calculates weights for every path
    """
    ProcessTracking.process_start('calculate_path_weights')
    Path.calculate_path_weights()
    ProcessTracking.process_done('calculate_path_weights')


def calculate_scaled_paths():
    """
    Calculates weights for every path
    """
    ProcessTracking.process_start('calculate_scaled_paths')
    run_on_temp_data()
    Path.calculate_scaled_paths()
    ProcessTracking.process_done('calculate_scaled_paths')


def calculate_student_risk():
    """
    Calculates risk for every student that is not finished
    """
    ProcessTracking.process_start('calculate_student_risk')
    run_on_temp_data()
    try:
        Student.calculate_student_risk()
        ProcessTracking.process_done('calculate_student_risk')
    except:
        ProcessTracking.process_failed('calculate_student_risk', {'error': traceback.format_exc()})
        raise


def process_info():
    info = ProcessTracking.get_process_info()
    print 'complete ', info['complete']
    print 'current ', info['current']
    print 'next ', info['next']

    for step in info['steps']:
        print step


def structures_test():
    def testfunc(**args):
        print args

        testfunc()


def test_definitions_db():
    import DataDefinitions
    run_on_temp_data()
    DataDefinitions.load_definitions_from_db()
    print 'loaded'
    DataDefinitions.save_definitions_to_meta_data()
    print 'saved'
    md = MetaData.find_by_id('definitionsDate')
    print type(md.data), md.data

    DataDefinitions.load_definitions_from_meta_data()
    print 'loaded'

    # get_definitions()


def test_student_iteration():
    db_query = {}
    students = Student.find(db_query, modifiers={'$snapshot': True}).batch_size(20)
    count = students.count()
    index = 0
    for student in students:
        index += 1
        student.email = 'unknown@example.com'
        student.db_update(['email'])

        print index, '/', count


def path_test():
    p1 = Path()
    p1.add_filter(PathElement(Query('hzb_grade'), Condition('lower', 200)))
    p1.add_filter(PathElement(Query('hzb_type'), Condition('equal', 'Abitur')))
    p1.add_filter(PathElement(Query('finished'), Condition('is', True)))
    p1.add(PathElement(Query('success'), Condition('is', True)))

    print p1

    pe = PathElement(Query('hzb_grade'), Condition('lower', 200))
    print pe

    # p2 = Path()
    # p2.add_filter(PathElement(Query('hzb_grade'), Condition('greater_equal', 200)))
    # p2.add_filter(PathElement(Query('hzb_type'), Condition('equal', 'Abitur')))
    # p2.add_filter(PathElement(Query('finished'), Condition('is', True)))
    # p2.add(PathElement(Query('success'), Condition('is', True)))
    #
    # print hash(p2)
    #
    # students = Student.find({})
    #
    # for student in students:
    # p1.check(student)
    # p2.check(student)
    #
    # print p1.matched, p1.count, '%.2f%%' % (float(p1.matched) / float(p1.count) * 100.0)
    # print p2.matched, p2.count, '%.2f%%' % (float(p2.matched) / float(p2.count) * 100.0)


def path_aggregate_test():

    def get_student_matching_elements(student_id):
        student = Student.find_one({'_id': student_id})
        if student is None:
            return None
        return [pe.md5_id() for pe in student.get_matching_elements()]

    student_element_ids = get_student_matching_elements(12824)

    start = time.clock()
    ret = Path.get_cursor_by_element_ids(student_element_ids)
    result = [x for x in ret]
    print 'where: ', time.clock() - start, ' count: ', len(result)

    start = time.clock()
    ret = Path.get_list_by_element_ids(student_element_ids)
    print 'aggre: ', time.clock() - start, ' count: ', len(ret)

    preferred = Path.get_preferred_paths(ret)
    print 'preferred', len(preferred)


def import_courses():
    ProcessTracking.process_start('import_courses')
    run_on_temp_data()
    try:
        Course.db_setup()

        file_list = ImportTools.get_files_info('courses')
        for info in file_list:
            if not info['active']:
                logger.info('Skip file: %s', info)
                continue
            logger.info('Import file: %s', info)
            Course.import_from_file(info)

        ProcessTracking.process_done('import_courses')
    except:
        ProcessTracking.process_failed('import_courses', {'error': traceback.format_exc()})
        raise


def import_students():
    ProcessTracking.process_start('import_students')
    run_on_temp_data()
    try:
        MarkedList.db_setup()
        Student.db_setup()
        file_list = ImportTools.get_files_info('students')
        file_list2 = ImportTools.get_files_info('studentidents')
        num = 0
        file_count = len(file_list) + len(file_list2)
        for info in file_list:
            num += 1
            ProcessTracking.process_update('import_students', 0.0, {
                'file_num': num,
                'file_count': file_count
            })

            if not info['active']:
                logger.info('Skip file: %s', info)
                continue
            logger.info('Import file: %s', info)
            Student.import_from_file(info)

        # import identity data
        for info in file_list2:
            num += 1
            ProcessTracking.process_update('import_students', 0.0, {
                'file_num': num,
                'file_count': file_count
            })
            if not info['active']:
                logger.info('Skip file: %s', info)
                continue
            logger.info('Import file: %s', info)
            Student.import_identity_from_file(info)

        ProcessTracking.process_done('import_students')
    except:
        ProcessTracking.process_failed('import_students', {'error': traceback.format_exc()})
        raise


def import_applicants():
    ProcessTracking.process_start('import_applicants')
    run_on_temp_data()
    try:
        Applicant.db_setup()
        file_list = ImportTools.get_files_info('applicants')
        num = 0
        file_count = len(file_list)
        for info in file_list:
            num += 1
            ProcessTracking.process_update('import_applicants', 0.0, {
                'file_num': num,
                'file_count': file_count
            })

            if not info['active']:
                logger.info('Skip file: %s', info)
                continue
            logger.info('Import file: %s', info)
            Applicant.import_from_file(info)

        ProcessTracking.process_done('import_applicants')
    except:
        ProcessTracking.process_failed('import_applicants', {'error': traceback.format_exc()})
        raise


def import_exams():
    ProcessTracking.process_start('import_exams')
    run_on_temp_data()
    try:
        Exam.db_setup()
        file_list = ImportTools.get_files_info('exams')
        max_mtime = None
        num = 0
        for info in file_list:
            num += 1
            ProcessTracking.process_update('import_exams', 0.0, {
                'file_num': num,
                'file_count': len(file_list)
            })
            if not info['active']:
                logger.info('Skip file: %s', info)
                continue
            logger.info("import_exams from " + info['file'])
            Exam.import_from_file(info)
            if not max_mtime or max_mtime < info['mtime']:
                max_mtime = info['mtime']

            MetaData.set_data('lastDate', {'date': max_mtime})

        ProcessTracking.process_done('import_exams')
    except:
        ProcessTracking.process_failed('import_exams', {'error': traceback.format_exc()})
        raise


def path_store_test():
    q = Query('hzb_grade', 'HZB Note', 'Student.HZB', 'grade')
    print q.db_insert()

    for item in Query.find({}):
        print item.md5_id(), item.get_dict()

    cond = Condition('between', (200, 390))

    pe = PathElement(q, cond)
    print pe.db_insert()

    for item in PathElement.find({}):
        print item.md5_id(), item.get_dict()


def find_test():
    run_on_temp_data()
    student = Student.find_one({'_id': 69790})
    print 'student', student

    student.calculate_from_exams()

    print student.semester_data


# find all courses of study and count the inscribed students for each
def find_values():
    result = Student.get_grouped_values(['stg', 'stg_original'])
    for entry in result:
        print entry


def get_definitions():
    import DataDefinitions
    hashes = set()
    for path_el in DataDefinitions.get_elements():
        if path_el.md5_id() in hashes:
            print path_el.md5_id(), 'exists'
        else:
            print path_el.md5_id()

        hashes.add(path_el.md5_id())

        print path_el.get_dict()

    el_count = len(DataDefinitions.get_elements())
    hashes_count = len(hashes)
    # print el_count, math.factorial(el_count)/math.factorial(el_count-3)/math.factorial(2-1)
    print el_count, hashes_count, math.factorial(el_count) / (
        math.factorial(el_count - 3) * math.factorial(3))


def export_definitions():
    import DataDefinitions
    json = DataDefinitions.export_definitions_from_db()
    with open('data/definitions.json', 'w') as fd:
        fd.write(json.encode('utf-8'))
    print 'done'


def import_definitions():
    import DataDefinitions
    with open('data/definitions.json', 'r') as fd:
        json_data = fd.read().decode('utf-8')
        DataDefinitions.import_definitions_into_db(json_data, True)

    print 'done'


def generate_exam_conditons():
    count = 0
    for d in Student.get_grouped_values('stg'):
        for ed in Exam.get_grouped_values('exam_id', {'stg': d['_id']}):
            if ed['count'] > 100:
                print d['_id'], ed
                count += 1

    print count


def find_path_elements():
    import DataDefinitions
    for pe in DataDefinitions.get_elements_by_query(Query('success')):
        print hash(pe)
        print pe.get_dict()


def generate_paths_apriori():
    import DataDefinitions
    ProcessTracking.process_start('generate_paths_apriori')
    run_on_temp_data()
    try:
        Path.drop()
        Path.db_setup()
        # Path.generate_paths(DataDefinitions.elements)
        Path.generate_paths_with_generator(DataDefinitions.get_elements())
        ProcessTracking.process_done('generate_paths_apriori')
    except:
        ProcessTracking.process_failed('generate_paths_apriori', {'error': traceback.format_exc()})
        raise


def generate_paths_apriori_mp():
    import DataDefinitions
    ProcessTracking.process_start('generate_paths_apriori')
    run_on_temp_data()
    try:
        Path.drop()
        Path.db_setup()

        settings = Settings.load_dict([
            'path_min_support',
            'path_min_confidence',
            'path_max_k',
            'path_min_students'
        ])

        # Path.generate_paths(DataDefinitions.elements)
        Path.generate_paths_with_generator(
            DataDefinitions.get_elements(),
            True,
            settings['path_min_support'],
            settings['path_min_confidence'],
            settings['path_max_k'],
            settings['path_min_students']
        )
        ProcessTracking.process_done('generate_paths_apriori')
    except:
        ProcessTracking.process_failed('generate_paths_apriori', {'error': traceback.format_exc()})
        raise


def test_generate_paths_apriori_mp():
    import DataDefinitions
    ProcessTracking.process_start('generate_paths_apriori')
    run_on_temp_data()
    try:
        Path.drop()
        Path.db_setup()

        settings = Settings.load_dict([
            'path_min_support',
            'path_min_confidence',
            'path_max_k',
            'path_min_students'
        ])

        # Path.generate_paths(DataDefinitions.elements)
        Path.test_generate_paths_with_generator(
            DataDefinitions.get_elements(),
            {'finished': True, 'ignore': False, 'stg': 'DTB'},
            True,
            settings['path_min_support'],
            settings['path_min_confidence'],
            settings['path_max_k'],
            settings['path_min_students']
        )
        ProcessTracking.process_done('generate_paths_apriori')
    except:
        ProcessTracking.process_failed('generate_paths_apriori', {'error': traceback.format_exc()})
        raise


def db_eval():
    """
    Evaluate script on database (deprecated, do not use)
    """
    db = get_db()

    start = time.clock()
    with open('mongodb/db_calc_paths.js', 'r') as fd:
        try:
            result = db.eval(fd.read(), {
                "c": {
                    "student": Student.get_collection_name(),
                    "path": Path.get_collection_name(),
                    "path_element": PathElement.get_collection_name(),
                    "exam": Exam.get_collection_name()
                },
                "batchSize": 100
            })
            print result
        except TypeError:
            print 'Wrong code'
        except pymongo.errors.OperationFailure:
            print 'eval failed'
            print db.error()

    end = time.clock()  # took 496s for 6768 paths
    print 'time: ', end - start


def calculate_student_exams():
    ProcessTracking.process_start('calculate_student_exams')
    run_on_temp_data()
    try:
        Student.calculate_exams()
        ProcessTracking.process_done('calculate_student_exams')
    except:
        ProcessTracking.process_failed('calculate_student_exams', {'error': traceback.format_exc()})
        raise


def permutations():
    import DataDefinitions
    elements = DataDefinitions.get_elements()[0:91]

    k = 7
    # elements = elements
    comb_count = math.factorial(len(elements)) / \
                 (math.factorial(len(elements) - k) * math.factorial(k))

    index = 0L
    start = time.time()
    for els in itertools.combinations(elements, k):
        if index % 100000 == 0:
            print index, '/', comb_count, 'time:', time.time() - start

        index += 1

    print index, '/', comb_count, 'time:', time.time() - start


def multiproc_test():
    from multiprocessing import Pool, TimeoutError

    p = Pool(4)

    start = time.time()

    async_res = p.map_async(multiproc_test_func, [1, 4, 7, 8])
    while True:
        try:
            res_list = async_res.get(0)
            print 'result after ', time.time() - start
        except TimeoutError:
            pass


def multiproc_test_func(sleeptime):
    time.sleep(sleeptime)
    return sleeptime


def stg_mapping():
    db = get_db()
    db.stg_mapping.insert(
        {'stg_group': "WIB", 'stg': [{'stg_name': "WIB", 'stg_id': "None"}, {'stg_name': "ISB", 'stg_id': "None"}]},
        {'stg_group': "ESB", 'stg': [{'stg_name': "ESB", 'stg_id': "None"}, {'stg_name': "SEB", 'stg_id': "None"}]},
        {'stg_group': "MI", 'stg': [{'stg_name': "MI", 'stg_id': "None"}, {'stg_name': "MI7", 'stg_id': "None"}]}
    )


def get_delayed():
    run_on_temp_data()
    # ProcessTracking.process_start('get_courses_with_delayed_exams')
    try:
        Course.get_delayed()
        # ProcessTracking.process_done('get_courses_with_delayed_exams')
    except:
        print "Unexpected error:", sys.exc_info()[0]
        # ProcessTracking.process_failed('get_courses_with_delayed_exams')
        raise


def check_path_counts():
    import DataDefinitions
    run_on_temp_data()
    all_paths = Path.find({})
    elements = [pe for pe in DataDefinitions.get_elements() if not pe.query.ignore and pe.condition.name != 'success']
    ba = Student.get_students_bitarray(elements, {'ignore': False, 'finished': True})

    for path in all_paths:
        db_query = {'ignore': False, 'finished': True}
        all_pe = []
        for pe in path.filter_elements:
            pe.get_db_query(db_query)
            all_pe.append(pe)

        db_query_count = db_query.copy()

        path_count_ba = ba.count_matching(path.filter_elements)
        path_count = Student.find(db_query_count).count()
        for pe in path.elements:
            pe.get_db_query(db_query)
            all_pe.append(pe)

        path_matched_ba = ba.count_matching(all_pe)
        path_matched = Student.find(db_query).count()

        if path_count != path.count or path_matched != path.matched:
            print 'path ba:', path_matched_ba, '/', path_count_ba, ' db:', path_matched, '/', path_count, '!=', path.get_str()
            print '\t count', db_query_count
            print '\t matched', db_query


def test_bit_array_stability():
    import DataDefinitions
    run_on_temp_data()
    db_query = {'ignore': False, 'finished': True}
    elements = [pe for pe in DataDefinitions.get_elements() if not pe.query.ignore and pe.condition.name != 'success']
    ba = Student.get_students_bitarray(elements, db_query)

    count_off = 0

    matches = dict()
    for pe in elements:
        matches[pe] = 0

    for student in Student.find(db_query):
        for pe in elements:
            if pe.check(student):
                matches[pe] += 1

    for pe in elements:
        pquery = db_query.copy()
        pe.get_db_query(pquery)

        db_match = Student.find(pquery).count()
        ba_match = ba.count_matching([pe])

        if db_match != ba_match:
            print db_match, '!=', ba_match, 'm', matches[pe], pe.get_str(), pquery
            count_off += 1
        else:
            print db_match, '==', ba_match, 'm', matches[pe], pe.get_str(), pquery

    print 'off:', count_off, '/', len(elements)


def test_student_bit_array():
    import DataDefinitions
    run_on_temp_data()
    elements = set(
        [pe for pe in DataDefinitions.get_elements() if not pe.query.ignore and pe.condition.name != 'success'])
    elements = list(elements)
    print 'elements', len(elements)
    start = time.time()
    ba = Student.get_students_bitarray(elements, {'ignore': False, 'finished': True})
    duration = time.time() - start
    print 'generated ba with count:', ba.count, 'rows:', ba.rows, 'after:', duration, 'it/s: ', ba.count / duration

    test_elements = [
        DataDefinitions.get_element_by_name('failed'),
        DataDefinitions.get_element_by_name('stg_MIB')
    ]
    matching = ba.count_matching(test_elements)
    print 'Matching ', matching, '/', ba.count, 'after: '
    print 'Real: ', Student.find({'ignore': False, 'finished': True, 'success': False, 'stg': 'MIB'}).count()

    # return
    k = 1
    # elements = elements
    comb_count = math.factorial(len(elements)) / \
                 (math.factorial(len(elements) - k) * math.factorial(k))

    total_counts = {}
    for pe in ba.elements:
        dep_el = pe.query.get_depends_elements()
        if len(dep_el):
            total_counts[pe] = ba.count_matching(dep_el)
        else:
            total_counts[pe] = ba.count

    print 'test time for', comb_count, 'combinations of ', len(elements), ' features and k:', k
    start = time.time()

    def on_status(info):
        pass

    ba.run_combinations(k, 0, -1, on_status, total_counts, 0.1, 100000, 1)

    # for test_elements in itertools.combinations(elements, k):
    # matching = ba.count_matching(test_elements)
    duration = time.time() - start
    print 'checked all combinations after:', duration, 'it/s: ', comb_count / duration


def test_bitmapchecker():
    import DataDefinitions
    import bitmapchecker
    import pickle

    if hasattr(bitmapchecker, 'unpickle'):
        print 'has unpickle'

    elements = set(
        [pe for pe in DataDefinitions.get_elements() if not pe.query.ignore and pe.condition.name != 'success'])
    # elements = set([pe for pe in DataDefinitions.elements if not pe.query.ignore and pe.condition.name in ('failed','stg_MIB')])
    # elements = [pe for pe in DataDefinitions.elements if
    # pe.query.ignore is False]
    # and pe.query.category.find('Leistungen') == -1
    elements = list(elements)

    print 'elements', len(elements)

    students = Student.find({'ignore': False, 'finished': True})

    test_elements = [
        DataDefinitions.get_element_by_name('failed'),
        DataDefinitions.get_element_by_name('stg_MIB')
    ]

    def generate_students(students, elements):
        for student in students:
            bm = [pe.check(student) for pe in elements]
            # print 'yield ',bm
            yield bm

    students_count = students.count()
    print 'students', students_count
    bmo = bitmapchecker.BitmapObject(generate_students(students, elements), students_count, len(elements))

    print 'bitmapchecker: count:', bmo.count, 'columns:', bmo.columns, ' rows:', bmo.rows, 'int_size:', bmo.int_size

    # reduced = bmo.__reduce__()
    # print 'func: ', reduced[0]

    pickle.dump(bmo, open("test_bmo.pickle", "wb"))
    print 'dumped'

    # bmo = pickle.load(open("test_bmo.pickle", "rb"))
    # print 'loaded'

    test_bm = [pe in test_elements for pe in elements]
    print 'test_bm', test_bm
    matching = bmo.count_matching(test_bm)

    print 'Matching ', matching, '/', students_count, 'after: '
    print 'Real: ', Student.find({'ignore': False, 'finished': True, 'success': False, 'stg': 'MIB'}).count()

    k = 1
    # elements = elements
    comb_count = math.factorial(len(elements)) / \
                 (math.factorial(len(elements) - k) * math.factorial(k))

    total_counts = {}
    for pe in elements:
        dep_el = pe.query.get_depends_elements()
        if len(dep_el):
            total_counts[pe] = bmo.count_matching([pe2 in dep_el for pe2 in elements])
        else:
            total_counts[pe] = bmo.count

    element_indices = [elements.index(pe) for pe in elements]
    element_counts = [total_counts[pe] for pe in elements]

    used_set = set()

    def info_callb(num, denied, itemset, matched, total):
        ret = {
            'num': num,
            'denied': denied,
            'itemset': itemset,
            'matched': matched,
            'total': total
        }
        if itemset is not None:
            ret['itemset'] = [elements[i] for i in itemset]
            used_set.update(ret['itemset'])

            test_bm = [pe in ret['itemset'] for pe in elements]
            matching = bmo.count_matching(test_bm)

            print num, '/', comb_count, ' m:', matched, '(', matching, ')/', total, \
                [pe.get_str() for pe in ret['itemset']], '%.2f' % (
                float(ret['matched']) / ret['total'])


        else:
            print num, '/', comb_count

    # bmo.run_combinations(
    # itertools.combinations(element_indices, k),
    # element_counts,
    # info_callb,
    # 0,
    # -1,
    # 0.01,
    #     1000
    # )

    bmo.run_combinations_k(
        k,
        element_counts,
        [],
        info_callb,
        0,
        -1,
        0.08,
        1000
    )

    print 'used', len(used_set)



    # debuglist = bmo.count_matching_debug(test_bm)
    # print 'debug:'
    # for dbg in debuglist:
    #     print dbg


def test_spawn():
    import subprocess

    pid = subprocess.Popen(["cmd", "myarg"]).pid
    print 'pid', pid


def get_students_with_pre_exams():
    import DB
    import csv

    result = DB.Student.find({
        '$where': 'this.semester_data && this.semester_data.sem_1 && this.semester_data.sem_1.semester_id < this.start_semester && this.bonus_total >= 1'
    })

    with open('students_with_pre_exams.csv', 'w') as csvfile:
        fieldnames = ['ident', 'stg_original', 'start_semester', 'status', 'pre_exam_count']
        writer = csv.DictWriter(csvfile, fieldnames=fieldnames, delimiter=';')

        status = {1: 'finished', 2: 'aborted', 3: 'successful', 4: 'studying'}

        writer.writeheader()

        for student in result:
            entry = {
                'ident': student.ident,
                'stg_original': student.stg_original,
                'start_semester': student.start_semester,
                'status': status[student.status],
                'pre_exam_count': 0
            }
            entry['pre_exam_count'] = student.semester_data['sem_1']['count']

            writer.writerow(entry)

    print result.count()


def get_pv_pl():
    import DB

    result = [x for x in DB.ExamInfo.find({
        '$or': [
            {'pv_id': {'$ne': None}},
            {'pl_id': {'$ne': None}}
        ]
    }, sort=[('_id', 1)])]

    print len(result)

    for entry in result:
        if entry.pv_id is not None:
            for ei in result:
                if ei.exam_id == entry.pv_id:
                    print str(entry.exam_id) + ' ' + entry.name + ' -> ' + str(ei.exam_id) + ' ' + ei.name + ' ' + (
                        ','.join(entry.stg_original))


def get_hash_id():
    import hashlib
    import base64

    def get_from_id(id):
        m = hashlib.md5()
        m.update(unicode(str(id)))
        return base64.urlsafe_b64encode(m.digest())[0:8]

    used_ids = set()
    for x in range(20000):
        new_id = get_from_id(x)
        if new_id in used_ids:
            raise Exception('is in used set')
        used_ids.add(new_id)

    m = hashlib.md5()
    m.update(unicode(str(4566)))
    m.update(unicode(str(5674)))
    m.update(unicode(str(5674)))
    print base64.urlsafe_b64encode(m.digest())[0:8]


def create_default_folders():
    default_folders = [
        'data/courses',
        'data/exams',
        'data/studentidents',
        'data/students',
        'data/applicants',
        'data/temp',
        'logs'
    ]
    import os
    for folder in default_folders:
        try:
            os.makedirs(folder)
        except OSError:
            pass


def migrate_db():
    marked_list = MarkedList.find({})
    for d in marked_list:
        new_set = set()
        # convert all numeric ids to string ids
        for id in d.list:
            new_set.add(unicode(id))
        d.list = new_set
        res = d.db_update(['list'])
        logger.info("List updated %s", d.ident)


if __name__ == '__main__':
    log_formatter = logging.Formatter('%(asctime)s %(name)-12s %(levelname)-8s %(message)s')
    console_handler = logging.StreamHandler()
    console_handler.setFormatter(log_formatter)

    file_handler = logging.handlers.RotatingFileHandler(
        filename=config.get('general', 'logfile'), maxBytes=1024 * 1024 * 20, backupCount=10)
    file_handler.setFormatter(log_formatter)
    logging.getLogger('').addHandler(console_handler)
    logging.getLogger('').addHandler(file_handler)
    logging.getLogger('').setLevel(logging.INFO)

    logger = logging.getLogger(__name__)

    if len(sys.argv) < 2:
        logger.info('please provide a command as first argument')

    elif sys.argv[1] in dir():
        if sys.argv[1] == 'run_all':
            file_handler.doRollover()

        eval(sys.argv[1] + '()')

    else:
        print sys.argv[1], 'Not found'
