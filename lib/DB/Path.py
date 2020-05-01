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

import hashlib
import itertools
import logging
import math
import struct
import time
from Queue import Full, Empty
from datetime import datetime

from bson.code import Code

from Db import DBDocument
from ProcessTracking import ProcessTracking
from Settings import Settings

_possible_iterations = 0
_generated = 0
_saved = 0

logger = logging.getLogger(__name__)


class Path(DBDocument):
    """
    Represents a path of elements
    """

    collection_name = 'paths'

    cached_min_max = None

    def __init__(self):
        self.name = ''  # identifier
        self.group = None
        self.filter_elements = set()  # filter criteria
        self.elements = set()  # success criteria

        self.count = 0L
        self.total_count = 0L
        self.matched = 0
        self.value = 0.0
        self.weight = 1
        self.scaled_value = None  # Should be None until it gets calculated as float
        self.weighted_value = 0.0
        self.support = None
        self.confidence = None

    def __eq__(self, other):
        return isinstance(other, type(self)) and \
               (self.group, self.name, self.elements, self.filter_elements) == \
               (other.group, other.name, other.elements, other.filter_elements)

    def md5(self):
        m = hashlib.md5()

        m.update('all' if self.group is None else self.group)
        for element in self.filter_elements:
            m.update(element.md5())

        for element in self.elements:
            m.update(element.md5())

        return m.digest()

    def md5_query(self):  # uniqueness of queries
        m = hashlib.md5()

        for element in self.filter_elements:
            m.update(element.query.md5())

        for element in self.elements:
            m.update(element.query.md5())

        return m.digest()

    def md5_id(self):
        return struct.unpack('>q', '\0\0' + self.md5()[10:16])[0]

    def md5_query_id(self):
        return struct.unpack('>q', '\0\0' + self.md5_query()[10:16])[0]

    def __hash__(self):
        return hash(self.md5())

    def is_preferable(self, path):
        """
        Is the given path preferable over the self path?
        :param path:
        :return:
        """
        if len(self.filter_elements) != len(path.filter_elements):
            return False

        # print 'path ', path.get_str()
        preferred_elements = 0
        for element_a in self.filter_elements:
            query = element_a.query

            for element_b in path.filter_elements:
                if element_b.query.md5_id() != query.md5_id():
                    continue

                # print 'prefer check', element_b.get_str(), ' vs ', element_a.get_str()
                if element_a.condition.order < element_b.condition.order:
                    preferred_elements += 1
                    # print '  prefer ', element_b.get_str(), 'over', element_a.get_str()
                elif element_a.condition.order > element_b.condition.order:
                    preferred_elements -= 1
                elif query.formatting == 'int' \
                        and element_a.condition.comparator != 'between' \
                        and element_b.condition.comparator != 'between':
                    if element_a.condition.compare_value > element_b.condition.compare_value:
                        preferred_elements += 1
                        # print '  prefer ', element_b.get_str(), 'over', element_a.get_str()
                    elif element_a.condition.compare_value < element_b.condition.compare_value:
                        preferred_elements -= 1
                        # print '  unprefer ', element_b.get_str(), 'over', element_a.get_str()
        if preferred_elements > 0:
            return True
        else:
            return False

    @staticmethod
    def get_preferred_paths(paths):
        query_unique = {}
        for path in paths:
            q_id = path.md5_query_id()
            if q_id in query_unique and query_unique[q_id].is_preferable(path) or q_id not in query_unique:
                query_unique[q_id] = path

        return query_unique.values()

    def calculate_path_weight(self, upper_limit, severity=5):
        """Implementation of adapted Sigmoid Function:
        ->for mapping of maximum number of students in one path to relevance value (weight)
        """
        exponent = (severity / 2.0) - (severity * (self.count * severity / upper_limit))
        function_term_for_count = (1.0 / (1.0 + math.exp(exponent)))  # exp is e^ Function

        return function_term_for_count

    def get_str(self):
        value = 0
        if self.count:
            value = float(self.matched) / float(self.count)
        s = '%d / %d (%.1f%%) filter(' % (self.matched, self.count, value * 100)
        i = 0
        for el in self.filter_elements:
            if i > 0:
                s += ', '
            s += el.get_str()
            i += 1
        s += '), success('
        i = 0
        for el in self.elements:
            if i > 0:
                s += ', '
            s += el.get_str()
            i += 1
        s += ')'
        return s

    def add_filter(self, element):
        if element not in self.elements:
            self.filter_elements.add(element)

    def add(self, element):
        if element not in self.elements:
            self.elements.add(element)

    def check_filter(self, data):
        for element in self.filter_elements:
            if not element.check(data):
                return False

        return True

    def check(self, data):
        for element in self.filter_elements:
            if not element.check(data):
                return False

        self.count += 1
        for element in self.elements:
            if not element.check(data):
                return False

        self.matched += 1
        return True

    def reset(self):
        self.count = 0
        self.total_count = 0
        self.matched = 0
        self.value = 0.0
        self.weight = 1

    def is_valid(self):
        queries = set()
        [queries.add(el.query) for el in self.filter_elements]
        [queries.add(el.query) for el in self.elements]

        if len(queries) != len(self.filter_elements) + len(self.elements) \
                or len(self.filter_elements & self.elements) > 0:
            return False

        for el in self.elements:
            if el.query.success is not True:
                return False

        for el in self.filter_elements:
            if el.query.success is True:
                return False

        depends = set()
        found = 0

        for el in self.filter_elements:
            if el.query.depends is not None:
                depends.update(el.query.depends)

        for el in self.filter_elements:
            if el.md5_id() in depends:
                found += 1

        if found < len(depends):
            return False

        return True

    def db_transform(self):
        """
        Transforms self to a database dictionary object.
        Gets called by transform_incoming of SONManipulator
        """
        ret = dict()
        ret['_id'] = self.md5_id()
        ret['name'] = self.name
        ret['group'] = self.group
        ret['filter_elements'] = list()
        ret['elements'] = list()

        for el in self.filter_elements:
            ret['filter_elements'].append(el.md5_id())

        for el in self.elements:
            ret['elements'].append(el.md5_id())

        ret['matched'] = self.matched
        ret['count'] = self.count
        ret['total_count'] = self.total_count
        ret['weight'] = self.weight
        ret['support'] = self.support
        ret['confidence'] = self.confidence
        ret['scaled_value'] = self.scaled_value
        ret['value'] = 0
        if self.count:
            ret['value'] = float(self.matched) / float(self.count)
            ret['weighted_value'] = ret['weight'] * ret['value']

        return ret

    @staticmethod
    def db_create(son):
        """
        Creates a new Instance based of database SON data.
        Gets called by transform_outgoing of SONManipulator
        """
        p = Path()
        p.name = son.get('name', '')
        p.group = son.get('group', None)
        p.count = son.get('count', 0)
        p.total_count = son.get('total_count', 0)
        p.matched = son.get('matched', 0)
        p.value = son.get('value', 0.0)
        p.weight = son.get('weight', 1)
        p.weighted_value = son.get('weighted_value', 0.0)
        p.scaled_value = son.get('scaled_value', 0.0)
        p.support = son.get('support', None)
        p.confidence = son.get('confidence', None)

        import DataDefinitions

        for pe_id in son.get('filter_elements', set()):
            pe = DataDefinitions.get_element_by_hash(pe_id)
            if pe is not None:
                p.filter_elements.add(pe)
            else:
                print 'Warning: Path.db_create ', son['_id'], ' filter_elements ', pe_id, 'not found'

        for pe_id in son.get('elements', set()):
            pe = DataDefinitions.get_element_by_hash(pe_id)
            if pe is not None:
                p.elements.add(pe)
            else:
                print 'Warning: Path.db_create elements ', pe_id, 'not found'

        return p

    @classmethod
    def db_setup(cls):
        c = cls.get_collection()
        c.create_index([('count', 1)])
        c.create_index([('group', 1)])

    def get_dict(self, query_id=False, no_counts=False):
        ret = dict()
        ret['_id'] = self.md5_id()
        ret['name'] = self.name
        ret['group'] = self.group
        ret['filter_elements'] = list()
        ret['elements'] = list()

        for el in self.filter_elements:
            ret['filter_elements'].append(el.md5_id())

        for el in self.elements:
            ret['elements'].append(el.md5_id())

        if not no_counts:
            ret['matched'] = self.matched
            ret['count'] = self.count
            ret['total_count'] = self.total_count
            ret['weight'] = self.weight
            ret['weighted_value'] = self.weighted_value
            ret['scaled_value'] = self.scaled_value
            ret['value'] = self.value
            ret['support'] = self.support
            ret['confidence'] = self.confidence

        return ret

    def __repr__(self):
        return 'Path(' + repr(self.__dict__) + ')'

    @staticmethod
    def generate_paths_with_generator(path_elements, multiprocess=False, min_support=0.05, min_confidence=0.01,
                                      max_k=10, min_students=50):

        feature_set = set([pe for pe in path_elements if not pe.query.ignore and pe.condition.name != 'success'])

        process = Path.get_process_for_generation()
        for num, step in enumerate(process):

            pg = PathGenerator(feature_set, 1)
            pg.ident = step['ident']
            if step['type'] == 'all':
                pg.path_group = 'all'
                pg.student_query = {'finished': True, 'ignore': False}
            elif step['type'] == 'stg':
                pg.path_group = step['ident']
                pg.student_query = {'finished': True, 'ignore': False, 'stg': step['ident']}
            elif step['type'] == 'degree':
                pg.path_group = step['ident']
                pg.student_query = {'finished': True, 'ignore': False, 'degree_type': step['ident']}
            pg.min_support = min_support
            pg.min_confidence = min_confidence
            pg.min_students = min_students
            pg.base_item = None
            pg.process_tracking = 'generate_paths_apriori'
            pg.process_tracking_info = {
                'saved_total': 0,
                'proc_num': num,
                'proc_count': len(process),
                'proc_ident': step['ident'],
                'proc_type': step['type']
            }

            pg.run_all(multiprocess, max_k=max_k, proc_count=6)

    @staticmethod
    def test_generate_paths_with_generator(path_elements, query, multiprocess=False, min_support=0.05,
                                           min_confidence=0.01,
                                           max_k=10, min_students=50):

        feature_set = set([pe for pe in path_elements if not pe.query.ignore and pe.condition.name != 'success'])

        pg = PathGenerator(feature_set, 1)
        pg.ident = 'TEST'
        pg.student_query = query
        pg.min_support = min_support
        pg.min_confidence = min_confidence
        pg.min_students = min_students
        pg.base_item = None
        pg.process_tracking = 'generate_paths_apriori'
        pg.process_tracking_info = {
            'saved_total': 0,
            'proc_num': 0,
            'proc_count': 1,
            'proc_ident': 'TEST',
            'proc_type': 'test'
        }

        pg.run_all(multiprocess, max_k=max_k, proc_count=6)

    @staticmethod
    def get_process_for_generation():
        from Student import Student

        settings = Settings.load_dict([
            'generate_risk_group_all',
            'generate_risk_group_stg',
            'generate_risk_group_degree',
            'min_stg_students'
        ])

        processes = []
        if settings['generate_risk_group_all']:
            processes.append({
                'ident': 'all',
                'type': 'all'
            })

        if settings['generate_risk_group_stg']:
            stg_list = Student.get_grouped_values('stg', find={'finished': True, 'ignore': False})
            for sd in stg_list:
                if sd['count'] < settings['min_stg_students']:
                    continue
                stg = sd['_id']
                processes.append({
                    'ident': stg,
                    'type': 'stg'
                })

        if settings['generate_risk_group_degree']:
            degree_list = Student.get_grouped_values('degree_type', find={'finished': True, 'ignore': False})
            for sd in degree_list:
                if sd['count'] < settings['min_stg_students']:
                    continue
                degree = sd['_id']
                processes.append({
                    'ident': degree,
                    'type': 'degree'
                })

        return processes

    @classmethod
    def get_min_max(cls, field='value', cached=True):
        if cls.cached_min_max is not None and cached:
            return cls.cached_min_max
        result = Path.db_aggregate([
            {"$group": {"_id": 0, "max_count": {"$max": "$" + field}, "min_count": {"$min": "$" + field}}}
        ])[0]
        cls.cached_min_max = (result["min_count"], result["max_count"])
        return cls.cached_min_max

    @staticmethod
    def calculate_path_weights():
        """
        Calculates the path weight for every path and updates path in database
        """
        max_el_result = Path.db_aggregate([
            {"$unwind": "$filter_elements"},
            {"$group": {"_id": "$_id", "count": {"$sum": 1}}},
            {"$group": {"_id": 0, "max_filter_elements": {"$max": "$count"}}}
        ])[0]
        max_filter_elements = float(max_el_result["max_filter_elements"])

        result = Path.db_aggregate([
            {"$match": {"filter_elements": {"$size": max_filter_elements}}},
            {"$group": {"_id": 0, "max_count": {"$max": "$count"}}}
        ])[0]
        max_count = float(result["max_count"])
        max_path = Path.find_one({"count": max_count})
        print "max_count", max_count, max_path.calculate_path_weight(max_count)

        all_paths = Path.find({"count": {"$gt": 0}})

        for p in all_paths:
            p.weight = p.calculate_path_weight(max_count)
            p.weight *= len(p.filter_elements) / max_filter_elements
            p.db_update(["weight", "weighted_value"])
            print p.weight, p.md5_id(), p.get_str()

    @classmethod
    def calculate_scaled_paths(cls):
        """
        Calculates the scaled probability of every path
        This is currently not used.
        """

        min_value, max_value = cls.get_min_max()
        print 'min_value', min_value, 'max_value', max_value

        all_paths = Path.find({})

        for p in all_paths:
            p.scaled_value = (p.value - min_value) / (max_value - min_value)
            p.db_update(["scaled_value"])
            print p.md5_id(), p.value, p.scaled_value, p.get_str()

    @classmethod
    def get_cursor_by_element_ids(cls, student_element_ids, **kwargs):
        db_query = dict()
        db_query['$where'] = Code(
            'this.filter_elements.every(function(id){return student_elements.indexOf(id.toNumber().toString())!=-1})',
            {'student_elements': [str(el_id) for el_id in student_element_ids]}
        )
        return Path.find(db_query, **kwargs)

    @classmethod
    def get_list_by_element_ids(cls, student_element_ids, query=None, sort=None):
        db_query = query.copy() if query is not None else {}
        pipeline = [
            {'$match': db_query},
            {'$project': {
                'isOK': {'$setIsSubset': ['$filter_elements', student_element_ids]},
                'name': 1,
                'group': 1,
                'filter_elements': 1,
                'elements': 1,
                'matched': 1,
                'count': 1,
                'total_count': 1,
                'weight': 1,
                'support': 1,
                'confidence': 1,
                'scaled_value': 1,
                'value': 1,
                'weighted_value': 1
            }},
            {'$match': {'isOK': True}}
        ]
        if sort:
            pipeline.append({'$sort': sort})

        return [cls.db_create(d) for d in cls.get_collection().aggregate(pipeline)]


def remove_unmet_dependencies(elements):
    result = set()
    ids = [pe.md5_id() for pe in elements]
    for pe in elements:
        found = True
        if pe.query.depends is not None:
            for dpid in pe.query.depends:
                if dpid not in ids:
                    found = False
        if found:
            result.add(pe)
    return result


def is_valid_element_combination(elements):
    """
    Check if queries are unique in combination
    :param elements:
    :return:
    """
    queries = set()
    [queries.add(el.query) for el in elements]

    if len(queries) != len(elements):
        return False

    if len(queries) > 1:
        depends = set()
        found = 0

        for el in elements:
            if el.query.depends is not None:
                depends.update(el.query.depends)

        for el in elements:
            if el.md5_id() in depends:
                found += 1

        if found < len(depends):
            return False

    return True


def get_progress(num, count, start):
    if num == 0:
        return ''

    left = count - num
    needed = time.time() - start
    num_per_second = num / needed if needed else 0
    left_time = left * (needed / num) if num else 0

    return '%d / %d %.2f it/s %ds left' % (num, count, num_per_second, left_time)


def calculate_student_counts_manually(db_query, base_itemset, features):
    from Student import Student

    if db_query is None:
        db_query = dict()
    else:
        db_query = db_query.copy()
    for pe in base_itemset:
        pe.get_db_query(db_query)

    # print 'db_query', db_query

    feature_counts = {}
    for pe in features:
        feature_counts[pe.md5_id()] = 0

    result = Student.find(db_query)
    for student in result:
        for pe in features:
            if pe.check(student):
                feature_counts[pe.md5_id()] += 1

    return feature_counts


def calculate_student_counts(db_query, base_itemset, features):
    from Student import Student

    if db_query is None:
        db_query = dict()
    else:
        db_query = db_query.copy()
    for pe in base_itemset:
        pe.get_db_query(db_query)

    # print 'db_query', db_query
    pipeline = list()
    pipeline.append({'$match': db_query})

    feature_counts = {}

    group = {'_id': 0}
    for pe in features:
        if pe in base_itemset:
            continue
        group['c' + str(pe.md5_id())] = {'$sum': {'$cond': {'if': pe.get_aggregation_db_query(), 'then': 1, 'else': 0}}}
        feature_counts[pe.md5_id()] = 0

    pipeline.append({'$group': group})

    result = Student.db_aggregate(pipeline)

    for data in result:
        for pe in features:
            if pe in base_itemset:
                continue
            feature_counts[pe.md5_id()] = data['c' + str(pe.md5_id())]

    return feature_counts


class PathGenerator:
    def __init__(self, feature_set=None, k=1):
        self.ident = ''  # ident of the generator
        self.path_group = None
        self.feature_set = remove_unmet_dependencies(feature_set)
        self.k = k
        self.student_query = {'finished': True, 'ignore': False}
        self.min_support = 0.1
        self.min_confidence = 0.1
        self.min_students = 20
        self.start = 0
        self.end = -1
        self.queue_tracking = None
        self.process_tracking = None
        self.process_tracking_info = {}
        self.print_rate = 500000L
        self.print_results = True

        # calculated values
        self.num = 0L
        self.count = 0L
        self.real_count = 0L
        self.index = 0L
        self.count_students = 0L
        self.total_counts = {}
        self.date_started = None
        self.ts_started = None
        self.last_output = None
        self.count_saved = 0
        self.count_saved_total = 0
        self.count_denied = 0
        self.features_used = set()

    def _calc_count(self):
        feature_count = len(self.feature_set)
        self.count = math.factorial(feature_count) / \
                     (math.factorial(feature_count - self.k) * math.factorial(self.k))

        if self.end != -1:
            self.real_count = self.end - self.start
        else:
            self.real_count = self.count

    def _calc_ba(self):
        from Student import Student

        start = time.time()
        student_ba = Student.get_students_bitarray(self.feature_set, self.student_query)
        diff = time.time() - start
        logger.info(
            'PathGenerator %s calculated bitmap for %d features and %d students with %d rows after %.1f seconds',
            self.ident, len(self.feature_set), student_ba.count, student_ba.rows, diff)

        return student_ba

    def _calc_totals(self, ba):
        self.count_students = ba.count
        self.total_counts = {}
        for pe in self.feature_set:
            dep_el = pe.query.get_depends_elements()
            if len(dep_el):
                self.total_counts[pe] = ba.count_matching(dep_el)
            else:
                self.total_counts[pe] = ba.count

    def _track_qeueue(self):
        if not self.queue_tracking:
            return

        res = {
            'ident': self.ident,
            'num': self.num,
            'index': self.index,
            'count_saved': self.count_saved,
            'count_denied': self.count_denied,
            'count_saved_total': self.count_saved_total,
            'features_used': self.features_used
        }

        try:
            self.queue_tracking.put(res, False)
        except Full:
            pass

    def _track_process(self):
        self._track_qeueue()
        if not self.process_tracking:
            return

        self.process_tracking_info['num'] = self.num
        self.process_tracking_info['count'] = self.real_count
        self.process_tracking_info['dim'] = self.k
        self.process_tracking_info['dim_started'] = self.date_started
        self.process_tracking_info['features'] = len(self.feature_set)
        self.process_tracking_info['features_used'] = len(self.features_used)
        self.process_tracking_info['saved'] = self.count_saved
        self.process_tracking_info['saved_total'] = self.count_saved_total

        ProcessTracking.process_update(self.process_tracking, float(self.num) / self.count,
                                       self.process_tracking_info)

    def _find_total_count(self, itemset):
        total_count = self.count_students
        counts = [self.total_counts.get(pe, total_count) for pe in itemset]
        return min(counts)

    def _check_itemset(self, itemset, ba):
        matching_count = ba.count_matching(itemset)
        total_count = self._find_total_count(itemset)

        support = float(matching_count) / total_count if total_count else 0.0

        # print '_check_itemset ', matching_count, '/', total_count, [pe.get_str() for pe in itemset]

        if support > self.min_support:
            self.features_used.update(itemset)
            self._create_path(itemset, matching_count, total_count, ba)
        else:
            self.count_denied += 1

    def _create_path(self, itemset, matching_count, student_count, ba):
        sup = float(matching_count) / student_count

        # divide itemset in filter and success elements
        filter_elements = set()
        success_elements = set()
        for pe in itemset:
            if pe.query.success:
                success_elements.add(pe)
            else:
                filter_elements.add(pe)

        if len(filter_elements) == 0 or len(success_elements) == 0:
            return False

        a = filter_elements
        a_matching = ba.count_matching(a)
        a_sup = float(a_matching) / student_count
        if a_sup == 0.0 or a_matching < self.min_students:
            return False

        conf = sup / a_sup

        if conf >= self.min_confidence:
            path = Path()
            path.group = self.path_group
            path.filter_elements = set(a)
            path.elements = success_elements

            if path.is_valid():
                path.count = a_matching
                path.total_count = student_count
                path.matched = matching_count
                path.confidence = conf
                path.support = sup
                result = path.db_insert()
                if result is not None:
                    self.count_saved += 1
                    self.count_saved_total += 1

                    logger.info('saved path %s id %s sup: %.2f conf: %.2f path: %s -> %s matching: %d / %d', self.ident,
                                result.inserted_id, sup, conf, [pe.get_str() for pe in a],
                                [pe.get_str() for pe in success_elements], matching_count, a_matching)
                    return result.inserted_id
        return False

    def _print_process(self):
        if not self.print_results:
            return
        logger.info('Progress k: %d | %s | features: %d used: %d saved: %d / %d denied: %d time: %.3f', self.k,
                     get_progress(self.num, self.real_count, self.ts_started), len(self.feature_set),
                     len(self.features_used), self.count_saved, self.count_saved_total, self.count_denied,
                     time.time() - self.ts_started)

    def run(self, do_calc=True):
        """
        Runs only this PathGenerator
        :return:
        """

        self._calc_count()
        ba = self._calc_ba()
        self._calc_totals(ba)

        if self.print_results:
            logger.info('PathGenerator %s run k: %d features: %d count: %d start: %d end: %d', self.ident, self.k,
                        len(self.feature_set), self.count, self.start, self.end)

        self.date_started = datetime.utcnow()
        self.ts_started = time.time()

        if ba.bmo is not None:
            self.run_in_c(ba)
            return

        last_output = time.time()

        self.index = 0L
        self.num = 0L
        for itemset in itertools.combinations(self.feature_set, self.k):
            self.index += 1L
            if self.index < self.start:
                continue

            if self.end != -1 and self.index >= self.end:
                break

            self.num += 1L

            if self.num % self.print_rate == 0 and time.time() - last_output > 1:
                self._print_process()
                self._track_process()
                last_output = time.time()
                # print '\tgenerated ', [pe.get_str() for pe in itemset]

            if not is_valid_element_combination(itemset):  # check if every query is used only once
                self.count_denied += 1L
                # rint '\tinvalid ', [pe.get_str() for pe in itemset]
                continue

            self._check_itemset(itemset, ba)

        self._print_process()
        self._track_process()

    def run_in_c(self, ba):
        """
        Runs combinations in C

        :return:
        """

        self.last_output = time.time()

        def on_status(data):
            if data['itemset'] is not None and is_valid_element_combination(data['itemset']):
                self.features_used.update(data['itemset'])
                # sup = float(data['matched']) / data['total']
                # print 'found itemset:', data['matched'], '/', data['total'], '%.2f'%(sup), \
                # [pe.get_str() for pe in data['itemset']]
                self._create_path(data['itemset'], data['matched'], data['total'], ba)

            self.num = data['num']
            self.count_denied = data['denied']
            self.index = self.start + self.num
            if time.time() - self.last_output > 1:
                self._print_process()
                self._track_process()
                self.last_output = time.time()

        end = self.end
        if end == -1:
            end = self.count

        ba.run_combinations(self.k, self.start, end, on_status, self.total_counts, self.min_support,
                            self.print_rate, self.min_students)

        self._print_process()
        self._track_process()

    def run_multiprocess(self, proc_count=6):
        if self.k < 2:
            self.run()
            return

        self._calc_count()

        logger.info('PathGenerator run multiprocess k: %d features: %d count: %d', self.k, len(self.feature_set),
                    self.count)

        # self._calc_ba()
        # self._calc_totals()

        self.date_started = datetime.utcnow()
        self.ts_started = time.time()

        from multiprocessing import Pool, Manager, TimeoutError

        manager = Manager()
        p = Pool(proc_count)
        queue = manager.Queue()

        def job_generator(pg_instance, rate, start, end, q):
            jobnum = 0
            for i in range(start, end, rate):
                jobnum += 1
                yield {'pg': pg_instance, 'start': i, 'end': i + rate, 'ident': str(jobnum), 'queue': q}

        per_proc = self.count / proc_count
        if self.count % proc_count:
            per_proc += 1

        gen = job_generator(self, per_proc, 0L, self.count, queue)
        async_res = p.map_async(run_multiprocess_pg_task, gen)

        all_info = dict()
        count_saved_total = self.count_saved_total
        while True:
            try:
                pg_list = async_res.get(0)

                self.num = 0L
                self.count_saved = 0L
                self.count_denied = 0L
                self.count_saved_total = count_saved_total
                for pg in pg_list:
                    self.index = max(self.index, pg.index)
                    self.count_saved_total += pg.count_saved
                    self.features_used.update(pg.features_used)
                    self.num += pg.num
                    self.count_saved += pg.count_saved
                    self.count_denied += pg.count_denied
                    logger.info('finished %s num: %d / %d saved: %d used: %d', pg.ident, pg.num, per_proc,
                                pg.count_saved, len(pg.features_used))

                self._track_process()
                self._print_process()

                break
            except TimeoutError:
                pass

            try:
                qi = queue.get(True, 1)
                # print 'recieved queue message', qi
                all_info[qi['ident']] = qi
                self.index = max(self.index, qi['index'])
                self.features_used.update(qi['features_used'])
                self.num = 0L
                self.count_saved = 0L
                self.count_denied = 0L
                self.count_saved_total = count_saved_total
                for ident, info in all_info.iteritems():
                    self.num += info['num']
                    self.count_saved += info['count_saved']
                    self.count_saved_total += info['count_saved']
                    self.count_denied += info['count_denied']
                    # print 'process ', ident, 'num:', info['num'], '/', per_proc, 'saved:', info['count_saved']

                self._track_process()
                self._print_process()

            except Empty:
                pass

        # items_per_step = proc_count * self.print_rate
        # step_count = self.count / items_per_step
        # if self.count % items_per_step:
        # step_count += 1
        #
        # # print 'step_count', step_count
        # for s in range(step_count):
        # # print 'start step ', s
        # gen = job_generator(self, self.print_rate, s * items_per_step, (s + 1) * items_per_step)
        # # for args in gen:
        # # print 'args:', args
        # # pres = p.apply(run_multiprocess_pg_task, (args,))
        # # _on_finish((pres,))
        # _on_finish(p.map(run_multiprocess_pg_task, gen))

        # for i in range(jobs_count):
        # print 'start process job: ', i, 'with', self.print_rate
        # p.apply_async(run_multiprocess_pg_task,
        # (self, i * self.print_rate, i * self.print_rate + self.print_rate, str(i)),
        # callback=_on_finish)

        p.close()
        p.join()

    def run_all(self, multiprocess=False, max_k=None, proc_count=6):
        if multiprocess:
            self.run_multiprocess(proc_count)
        else:
            self.run()

        if max_k is not None and max_k == self.k:
            print 'end by max_k:', self.k, 'used:', len(self.features_used), 'saved:', self.count_saved
            return

        if len(self.features_used) == 0 \
                or self.k > 2 and self.count_saved == 0 \
                or self.k + 1 >= len(self.features_used):
            print 'end k:', self.k, 'used:', len(self.features_used), 'saved:', self.count_saved
            return

        pg = PathGenerator(self.features_used, self.k + 1)
        pg.path_group = self.path_group
        pg.student_query = self.student_query
        pg.min_support = self.min_support
        pg.min_confidence = self.min_confidence
        pg.min_students = self.min_students
        pg.process_tracking = self.process_tracking
        pg.process_tracking_info = self.process_tracking_info
        pg.count_saved_total = self.count_saved_total

        pg.run_all(multiprocess, max_k, proc_count)


def run_multiprocess_pg_task(info):
    # print 'mp start '
    from Student import Student
    # import faulthandler
    # faulthandler.enable()

    Path.db_setprefix('temp_')
    Student.db_setprefix('temp_')

    pg = info['pg']
    pg.print_results = False
    pg.process_tracking = None
    pg.queue_tracking = info['queue']
    pg.count_saved = 0
    pg.count_denied = 0
    pg.ident = info['ident']
    pg.start = info['start']
    pg.end = info['end']

    logger.info('start %s from: %d to: %d', pg.ident, info['start'], info['end'])
    pg.run(False)
    logger.info('ended %s from: %d to: %d', pg.ident, info['start'], info['end'])

    return pg
