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


class Settings(DBDocument):
    """
    Is global for the system and is not dependent upon the data update
    """
    collection_name = 'settings'

    def __init__(self, **kwargs):

        self.id = ''
        """
        path_min_support
        path_min_confidence
        path_max_k
        lights
        """

        self.hash = None

        self.type = 'global'  # global,my,list
        self.user = None  # if the type is user, the user name is noted here

        self.data = None

    def generate_md5(self):
        m = hashlib.md5()
        m.update(self.type)
        if type(self.data) == dict:
            for key, val in self.data.iteritems():
                if key not in ('name', 'id'):
                    m.update(key)
                    m.update(repr(val))
        else:
            m.update(repr(self.data))

        return m.hexdigest()

    def db_transform(self):
        """
        Transforms self to a database dictionary object.
        Gets called by transform_incoming of SONManipulator
        """

        self.hash = self.generate_md5()

        data = self.__dict__.copy()
        del data['id']
        data['_id'] = self.id
        return data

    @staticmethod
    def db_create(son):
        """
        Creates a new Instance based of database SON data.
        Gets called by transform_outgoing of SONManipulator
        """
        p = Settings()
        p.id = son['_id']
        del son['_id']
        p.__dict__.update(son)
        return p

    @classmethod
    def db_setup(cls):
        c = cls.get_collection()
        c.create_index([('type', 1)])
        c.create_index([('hash', 1)])

    @classmethod
    def save_by_dict(cls, d):
        for k, v in d.iteritems():
            s = Settings()
            s.id = k
            s.data = v
            s.db_save()

    @classmethod
    def insert_by_dict(cls, d):
        for k, v in d.iteritems():
            s = Settings()
            s.id = k
            s.data = v
            s.db_insert()

    @classmethod
    def load_dict(cls, keys):
        cursor = cls.find({'_id': {'$in': keys}})
        result = {}
        for s in cursor:
            result[s.id] = s.data
        return result

    @classmethod
    def load_dict_for_key(cls, key):
        """
        Loads all sub keys for the key
        :param key:
        :return:
        """
        cursor = cls.find({'_id': {'$regex': '^'+key}})
        result = {}
        for s in cursor:
            parts = s.id.split(':')
            if len(parts) == 2:
                result[parts[1]] = s.data
            else:
                result[''] = s.data
        return result

    @classmethod
    def load(cls, key):
        s = cls.find_one({'_id': key})
        if s:
            return s.data
        else:
            return None


