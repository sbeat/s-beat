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
import struct

from Condition import Condition
from Db import DBDocument
from Query import Query


class PathElement(DBDocument):
    """
    A PathElement is a combination of a Query and a Condition
    The Query tells where to find the value which is used to check with the Condition
    We don't really need them in database
    """

    collection_name = 'path_elements'

    def __init__(self, query=None, condition=None, _id=None):
        self.query = query  # A Query instance defines the field which is used to query the value for comparison
        # with condition
        self.condition = condition  # A Condition instance
        self._id = _id

    def __eq__(self, other):
        return isinstance(other, type(self)) and \
               (self.query, self.condition) == \
               (other.query, other.condition)

    def md5(self):
        m = hashlib.md5()
        m.update(self.query.md5())
        m.update(self.condition.md5())
        return m.digest()

    def md5_id(self):
        return struct.unpack('>q', '\0\0' + self.md5()[10:16])[0]

    def __hash__(self):
        return hash(self.md5())

    def get_dict(self, query_id=False):
        if query_id:
            return {
                'query_id': str(self.query.md5_id()),
                'condition': self.condition.get_dict()
            }
        return {
            'query': self.query.get_dict(),
            'condition': self.condition.get_dict()
        }

    def get_db_query(self, result=None):
        if result is None:
            result = dict()
        result[self.query.q] = self.condition.get_db_query(self.query.formatting)
        return result

    def get_aggregation_db_query(self):
        return self.condition.get_aggregation_db_query(self.query.q, self.query.formatting)

    def get_str(self):
        return self.query.get_str() + ' ' + self.condition.get_str()

    def check(self, student):
        """
        Checks if student matches this path
        """
        data = student.__dict__
        value = self.query.run(data)
        return self.condition.compare(value)

    def __repr__(self):
        return 'PathElement(query=' + repr(self.query) + ', condition=' + repr(self.condition) + ')'

    def db_transform(self):
        """
        Transforms self to a database dictionary object.
        Gets called by transform_incoming of SONManipulator
        """
        return {
            '_id': self.md5_id(),
            # 'query': self.query.get_dict(),
            'query_id': self.query.md5_id(),
            'condition': self.condition.get_dict(),
            'condition_id': self.condition.md5_id()
        }

    @staticmethod
    def db_create(son):
        """
        Creates a new Instance based of database SON data.
        Gets called by transform_outgoing of SONManipulator
        """
        return PathElement(
            query=Query.find_by_id(son['query_id']),
            condition=Condition.from_dict(son['condition']),
            _id=son['_id']
        )

    @classmethod
    def find_by_id(cls, pe_id):
        return cls.find_one({'_id': pe_id})

    @classmethod
    def find_by_query_id(cls, query_id):
        return cls.find({'query_id': query_id})

    @classmethod
    def remove_by_query_id(cls, query_id):
        return cls.get_collection().remove({'query_id': query_id})

    @classmethod
    def remove_by_id(cls, pe_id):
        return cls.get_collection().remove({'_id': pe_id})

    @classmethod
    def update_query_id(cls, query_id, new_query_id):
        return cls.get_collection().update({'query_id': query_id}, {'$set': {'query_id': new_query_id}}, multi=True)


