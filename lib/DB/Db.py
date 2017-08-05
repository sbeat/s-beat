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

import ConfigParser
from pymongo import errors, MongoClient
from datetime import datetime
import sys
import logging
logger = logging.getLogger(__name__)

_open_db = None

_collection_prefixes = dict()
_manipulation_enabled = True


def set_manipulation(enabled):
    global _manipulation_enabled
    _manipulation_enabled = enabled


def get_db():
    global _open_db
    if _open_db is not None:
        return _open_db

    config = ConfigParser.RawConfigParser()
    config.read('config/main.cfg')

    try:
        client = MongoClient(config.get('mongodb', 'host'), config.getint('mongodb', 'port'), connect=False)

        _open_db = client[config.get('mongodb', 'name')]
        # _open_db.add_son_manipulator(_DBTransform())
    except errors.ConnectionFailure:
        print 'ERROR: Connection to Database failed.'
        sys.exit(1)
    return _open_db


def get_last_error():
    return get_db().error()


def get_collection(name):
    """
    :param name: Name without prefix
    :return:
    """
    db = get_db()
    if name in _collection_prefixes:
        name = _collection_prefixes[name] + name
    return db[name]


def set_collection_prefix(name, prefix):
    _collection_prefixes[name] = prefix


def get_db_query_by_type(value, data_type):
    if data_type == 'float':
        parts = value.split(',')
        if len(parts) > 1:
            result = {}
            if len(parts[0]) > 0:
                result['$gte'] = float(parts[0])

            if len(parts[1]) > 0:
                result['$lte'] = float(parts[1])
        else:
            result = float(value)

    elif data_type == 'int':
        parts = value.split(',')
        if len(parts) > 1:
            result = {}
            if len(parts[0]) > 0:
                result['$gte'] = int(parts[0])

            if len(parts[1]) > 0:
                result['$lte'] = int(parts[1])
        else:
            result = int(value)

    elif data_type == 'long':
        parts = value.split(',')
        if len(parts) > 1:
            result = {}
            if len(parts[0]) > 0:
                result['$gte'] = long(parts[0])

            if len(parts[1]) > 0:
                result['$lte'] = long(parts[1])
        else:
            result = long(value)

    elif data_type == 'list':
        parts = value.split(',')
        result = {'$all': parts}

    elif data_type == 'intlist':
        parts = value.split(',')
        result = {'$all': [int(i) for i in parts]}

    elif data_type == 'in_intlist':
        parts = value.split(',')
        result = {'$in': [int(i) for i in parts]}

    elif data_type == 'exists':
        result = {'$exists': True}

    elif data_type == 'datetime':
        result = datetime.utcfromtimestamp(value)

    elif data_type == 'bool':
        if value == 'true':
            result = True
        else:
            result = False

    else:
        result = value

    return result


class DBDocument(object):
    """
    Basic Database document class
    """

    collection_name = 'undefined_collection'

    def db_transform(self):
        """
        Transforms self to a database dictionary object.
        Gets called by transform_incoming of SONManipulator
        """
        return self.__dict__

    @staticmethod
    def db_create(son):
        """
        Creates a new Instance based of database SON data.
        Gets called by transform_outgoing of SONManipulator
        """
        p = DBDocument()
        p.__dict__.update(son)
        return p

    def db_insert(self):
        """
        Inserts a new document into the collection
        Returns the _id if successful
        Returns None if error
        """
        try:
            c = get_collection(self.collection_name)
            return c.insert_one(self.db_transform())

        except errors.DuplicateKeyError as error:
            logger.error("db_insert error: " + error.message)
            return None

    @classmethod
    def db_aggregate(cls, pipeline):
        try:
            c = get_collection(cls.collection_name)
            cursor = c.aggregate(pipeline)
            result = [d for d in cursor]
            return result

        except errors.OperationFailure as error:
            logger.error("db_aggregate error: " + error.message)
            return None

    def db_save(self):
        """
        Saves document to collection
        Overwrites existing documents
        Inserts new documents
        """
        try:
            c = get_collection(self.collection_name)
            data = self.db_transform()
            return c.replace_one({'_id': data['_id']}, data, upsert=True)
            # return c.save(self.db_transform())

        except errors.OperationFailure as error:
            logger.error("db_save error: " + error.message)
            return None

    def db_remove(self):
        """
        Removes document from database
        """
        try:
            data = self.db_transform()
            c = get_collection(self.collection_name)
            return c.delete_one({'_id': data['_id']})

        except errors.OperationFailure as error:
            logger.error("db_remove error: " + error.message)
            return None

    def db_update(self, changed=None, custom_set=None):
        """
        Updates document in database.
        changed could be a list of attributes to update
        custom_set is a dictionary of custom update query
        """
        try:
            c = get_collection(self.collection_name)
            data = self.db_transform()
            if custom_set is not None:
                c.update_one({'_id': data['_id']}, custom_set)

            elif changed is not None:
                upd = {'$set': {}}
                for field in changed:
                    if field in data:
                        upd['$set'][field] = data[field]
                c.update_one({'_id': data['_id']}, upd)

            else:
                return c.replace_one({'_id': data['_id']}, data)

        except errors.PyMongoError as error:
            logger.error("db_update error: " + error.message)
            return None

    @classmethod
    def find_one(cls, query, **kwargs):
        """
        Finds exactly one document by a query
        """
        c = get_collection(cls.collection_name)
        doc = c.find_one(query, **kwargs)
        return cls.db_create(doc) if doc is not None else doc

    @classmethod
    def find(cls, query, **kwargs):
        """
        Returns a cursor to traverse found documents
        """
        c = get_collection(cls.collection_name)
        return DBCursor(c.find(query, **kwargs), cls)

    @classmethod
    def get_grouped_values(cls, field, find=None):
        """
        Groups and counts values for a defined field
        if field is a list it returns groups for all fields
        """

        try:
            pipeline = list()
            if find is not None:
                pipeline.append({'$match': find})
            if type(field) == list:
                group_dict = {
                    '_id': None,
                    'count': {'$sum': 1}
                }
                for f in field:
                    group_dict[f] = {
                        '$addToSet': '$' + f
                    }
                pipeline.append({'$group': group_dict})

            else:
                pipeline.append({'$group': {'_id': '$' + field, 'count': {'$sum': 1}}})
            pipeline.append({"$sort": {'_id': 1}})

            res_list = cls.db_aggregate(pipeline)
            if res_list and type(field) == list:
                data = res_list[0]
                result = {}
                for f in field:
                    result[f] = data[f]
                return result

            result = [item for item in res_list]
            return result

        except errors.PyMongoError as error:
            logger.error("get_grouped_values error: " + error.message)
            return None

    @classmethod
    def drop(cls, **kwargs):
        """
        Drops the collections
        """
        c = get_collection(cls.collection_name)
        return c.drop(**kwargs)

    @classmethod
    def get_collection_name(cls):
        name = cls.collection_name
        return cls.get_collection_prefix() + name

    @classmethod
    def get_collection_prefix(cls):
        name = cls.collection_name
        if name in _collection_prefixes:
            return _collection_prefixes[name]
        return ''

    @classmethod
    def get_collection(cls):
        return get_collection(cls.collection_name)

    @classmethod
    def create_collection(cls):
        try:
            db = get_db()
            return db.create_collection(cls.get_collection_name())
        except errors.CollectionInvalid:
            return None

    @classmethod
    def db_setup(cls):
        cls.create_collection()

    @classmethod
    def db_setprefix(cls, prefix):
        set_collection_prefix(cls.collection_name, prefix)
        cls.create_collection()

    @classmethod
    def db_is_sortable(cls, field):
        o = cls().__dict__
        if len(field) == 0:
            return False
        for key in field.split('.'):
            if type(o) != dict or key not in o:
                return False
            o = o[key]
        return True


class DBCursor:
    def __init__(self, cursor, db_class):
        self.cursor = cursor
        self.db_class = db_class

    def __iter__(self):
        return self

    def next(self):
        doc = self.cursor.next()
        if doc is not None:
            return self.db_class.db_create(doc)
        return doc

    __next__ = next

    def __getitem__(self, index):
        doc = self.cursor.__getitem__(index)
        if doc is not None:
            return self.db_class.db_create(doc)
        return doc

    def close(self):
        return self.cursor.close()

    def batch_size(self, *args, **kwargs):
        self.cursor.batch_size(*args, **kwargs)
        return self

    def limit(self, *args, **kwargs):
        self.cursor.limit(*args, **kwargs)
        return self

    def count(self, *args, **kwargs):
        return self.cursor.count(*args, **kwargs)

    def where(self, *args, **kwargs):
        return self.cursor.where(*args, **kwargs)

    def max_scan(self, *args, **kwargs):
        return self.cursor.max_scan(*args, **kwargs)

    def max_time_ms(self, *args, **kwargs):
        return self.cursor.max_time_ms(*args, **kwargs)

    def distinct(self, *args, **kwargs):
        return self.cursor.distinct(*args, **kwargs)

    def explain(self, *args, **kwargs):
        return self.cursor.explain(*args, **kwargs)
