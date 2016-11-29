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

import math
import hashlib
import struct


class Condition:
    """
    The Condition takes an input and compares it with the comparison value
    input type compare_value
    """

    def __init__(self, comparator='equal', compare_value=None, negate=False, name=None, order=0):
        self.name = name
        # Type of condition: equal,lower,lower_equal,greater,greater_equal,in,between,is_nan,is
        self.comparator = comparator

        self.negate = negate  # Whether condition should be negated
        self.compare_value = compare_value  # The value on right side of comparison
        self.order = order

    def __repr__(self):
        return 'Condition(' + repr(self.comparator) + ', ' + repr(self.compare_value) + ', ' + repr(
            self.negate) + ')'

    def get_db_query(self, data_format='int'):
        if data_format in ('int', 'semester', 'grade', 'float'):
            if self.comparator == 'equal':
                return self.compare_value

            if self.comparator == 'equal' and self.negate:
                return {'$ne': self.compare_value}

            if self.comparator == 'lower':
                return {'$lt': self.compare_value}

            if self.comparator == 'lower_equal':
                return {'$lte': self.compare_value}

            if self.comparator == 'greater':
                return {'$gt': self.compare_value}

            if self.comparator == 'greater_equal':
                return {'$gte': self.compare_value}

            if self.comparator == 'between':
                return {'$gte': self.compare_value[0], '$lte': self.compare_value[1]}

            if self.comparator == 'is_nan':
                return None

        if data_format in ('str', 'gender', 'stg', 'auto'):
            if self.comparator == 'equal':
                return self.compare_value

            if self.comparator == 'equal' and self.negate:
                return {'$ne': self.compare_value}

            if self.comparator == 'in' and self.negate:
                return {'$nin': self.compare_value}

            if self.comparator == 'in':
                return {'$in': self.compare_value}

        if data_format in ('yesno', 'bool'):
            if self.comparator == 'is':
                return self.compare_value

        return None

    def get_aggregation_db_query(self, fieldname, data_format='int'):
        if data_format in ('int', 'semester', 'grade', 'float'):
            if self.comparator == 'equal':
                return {'$eq': ['$' + fieldname, self.compare_value]}

            if self.comparator == 'equal' and self.negate:
                return {'$ne': ['$' + fieldname, self.compare_value]}

            if self.comparator == 'lower':
                return {'$lt': ['$' + fieldname, self.compare_value]}

            if self.comparator == 'lower_equal':
                return {'$lte': ['$' + fieldname, self.compare_value]}

            if self.comparator == 'greater':
                return {'$gt': ['$' + fieldname, self.compare_value]}

            if self.comparator == 'greater_equal':
                return {'$gte': ['$' + fieldname, self.compare_value]}

            if self.comparator == 'between':
                return {'$and': [
                    {'$gte': ['$' + fieldname, self.compare_value[0]]},
                    {'$lte': ['$' + fieldname, self.compare_value[1]]}
                ]}

            if self.comparator == 'is_nan':
                return {'$eq': ['$' + fieldname, None]}

        if data_format in ('str', 'gender', 'stg', 'auto'):
            if self.comparator == 'equal':
                return {'$eq': ['$' + fieldname, self.compare_value]}

            if self.comparator == 'equal' and self.negate:
                return {'$ne': ['$' + fieldname, self.compare_value]}

        if data_format in ('yesno', 'bool'):
            if self.comparator == 'is':
                return {'$eq': ['$' + fieldname, self.compare_value]}

        return None

    def compare(self, input_value):
        result = False
        if type(input_value) in (long, int, float):
            result = self.compare_number(input_value)

        if type(input_value) in (str, unicode):
            result = self.compare_string(input_value)

        if type(input_value) in (list, set):
            result = self.compare_list(input_value)

        if type(input_value) is bool:
            result = self.compare_bool(input_value)

        if self.negate:
            return not result
        else:
            return result

    def compare_number(self, input_value):
        if self.comparator == 'equal':
            return input_value == self.compare_value

        if self.comparator == 'lower':
            return input_value < self.compare_value

        if self.comparator == 'lower_equal':
            return input_value <= self.compare_value

        if self.comparator == 'greater':
            return input_value > self.compare_value

        if self.comparator == 'greater_equal':
            return input_value >= self.compare_value

        if self.comparator == 'between':
            return self.compare_value[0] <= input_value <= self.compare_value[1]

        if self.comparator == 'is_nan':
            return isinstance(input_value, float) and math.isnan(input_value)

    def compare_bool(self, input_value):
        if self.comparator == 'is':
            return input_value is self.compare_value

    def compare_string(self, input_value):
        if self.comparator == 'equal':
            return input_value == self.compare_value

        if self.comparator == 'in':
            return input_value in self.compare_value

    def compare_list(self, input_value):
        if self.comparator == 'in':
            return self.compare_value in input_value

    def __eq__(self, other):
        return isinstance(other, type(self)) and \
               (self.comparator, self.negate, self.compare_value) == \
               (other.comparator, other.negate, other.compare_value)

    def md5(self):
        m = hashlib.md5()
        m.update(self.get_str())
        return m.digest()

    def md5_id(self):
        return struct.unpack('>q', '\0\0' + self.md5()[10:16])[0]

    def __hash__(self):
        return hash(self.md5())

    def get_dict(self):
        return self.__dict__

    def get_str(self):
        s = ''
        if self.negate:
            s += 'not '

        s += '' + self.comparator + ' '
        s += repr(self.compare_value)
        return s

    @staticmethod
    def from_dict(data):
        q = Condition()
        q.name = data['name']
        q.comparator = data['comparator']
        q.negate = data['negate']
        if 'order' in data:
            q.order = data['order']
        if type(data['compare_value']) is list:
            q.compare_value = tuple(data['compare_value'])
        else:
            q.compare_value = data['compare_value']
        return q
