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
import hashlib
import struct


class Query(DBDocument):
    """
    The Query tells where to find a value.
    """

    collection_name = 'queries'
    cached_items = {}

    def __init__(self, q=None, name=None, category=None, formatting='auto', query_type='dict', success=False,
                 depends=None, ignore=False):
        self.name = name  # the query description
        self.category = category  # category of the query
        self.formatting = formatting  # formatting: int, float:2, date, grade, semester, yesno
        self.query_type = query_type  # Type of query: dict,call
        self.q = q  # Query value could be a path to the needed resource
        self.success = success  # Is this query relevant for success
        self.depends = depends  # list of PathElements which are required before this can be used
        self.ignore = ignore  # Ignore this query for path generation
        self._id = None  # Databse ID if available, is calculated automatically on save with md5_id()
        self.auto_generate = False  # should the conditions be generated automatically

    def __eq__(self, other):
        return isinstance(other, type(self)) and \
               (self.query_type, self.q) == \
               (other.query_type, other.q)

    def md5(self):
        m = hashlib.md5()
        m.update(self.query_type)
        m.update(self.q)
        return m.digest()

    def md5_id(self):
        return struct.unpack('>q', '\0\0' + self.md5()[10:16])[0]

    def __hash__(self):
        return hash(self.md5())

    def run(self, data):
        if self.q in data:
            return data[self.q]
        else:
            return select_by_path(self.q.split('.'), data)

    def get_dict(self, str_ids=False, replace_vars=None):
        data = self.__dict__.copy()
        if str_ids:
            if isinstance(self.depends, set):
                data['depends'] = list()
                for pe_id in self.depends:
                    data['depends'].append(str(pe_id))

        if replace_vars is not None:
            for key, val in replace_vars.iteritems():
                data['name'] = data['name'].replace(key, val)
                data['category'] = data['category'].replace(key, val)

        return data

    def get_str(self):
        return self.q

    def get_depends_elements(self):
        import DataDefinitions

        result = set()
        if self.depends is None:
            return result
        for el_id in self.depends:
            el = DataDefinitions.get_element_by_hash(el_id)
            if el is not None:
                result.add(el)
        return result

    @staticmethod
    def from_dict(data):
        q = Query()
        q.name = data['name']
        q.category = data['category']
        q.formatting = data['formatting']
        q.query_type = data['query_type']
        q.q = data['q']
        q.success = data['success']
        q.depends = data['depends']
        if isinstance(q.depends, list):
            q.depends = set(q.depends)
        q.ignore = data['ignore']
        if '_id' in data:
            q._id = data['_id']
        if 'auto_generate' in data:
            q.auto_generate = data['auto_generate']
        return q

    def __repr__(self):
        return 'Query(' + repr(self.q) + ')'

    def db_transform(self):
        """
        Transforms self to a database dictionary object.
        Gets called by transform_incoming of SONManipulator
        """

        data = self.get_dict().copy()
        if isinstance(data['depends'], set):
            data['depends'] = list(data['depends'])
        data['_id'] = self.md5_id()
        return data

    @staticmethod
    def db_create(son):
        """
        Creates a new Instance based of database SON data.
        Gets called by transform_outgoing of SONManipulator
        """
        return Query.from_dict(son)

    @classmethod
    def find_by_id(cls, query_id):
        return cls.find_one({'_id': query_id})

        # if query_id in cls.cached_items:
        # return cls.cached_items[query_id]
        # else:
        #     cls.cached_items[query_id] = cls.find_one({'_id': query_id})
        #     return cls.cached_items[query_id]


def select_by_path(path, data):
    d = data
    for attr in path:
        if d is not None and attr in d:
            d = d[attr]
        else:
            return None
    return d
