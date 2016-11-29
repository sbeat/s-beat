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


class MetaData(DBDocument):
    """
    Depends on data update and data update state
    """
    collection_name = 'metadata'

    all_cached = None

    def __init__(self, **kwargs):
        self.id = ''  # lastDate
        """
        lastDate
            data = {date:} latest date of CSV file with exams
        definitions
        definitionsDate

        """
        self.data = {}

    def db_transform(self):
        """
        Transforms self to a database dictionary object.
        Gets called by transform_incoming of SONManipulator
        """

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
        p = MetaData()
        p.id = son['_id']
        del son['_id']
        p.__dict__.update(son)
        return p

    @classmethod
    def find_by_id(cls, _id):
        return cls.find_one({'_id': _id})

    @classmethod
    def set_data(cls, _id, data):
        md = MetaData()
        md.id = _id
        md.data = data
        return md.db_save()


