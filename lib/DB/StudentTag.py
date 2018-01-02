"""
Copyright (c) 2018 S-BEAT GbR and others

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
from datetime import datetime

from Db import DBDocument


class StudentTag(DBDocument):
    """
    Stores the relation between student and tag
    """
    collection_name = 'student_tags'

    def __init__(self, **kwargs):
        self.ident = None  # ident of the relation
        self.name = None  # name of the tag
        self.student_id = None  # ident of the student
        self.date = None  # when the tag was assigned

    def __repr__(self):
        return 'Tag(' + repr(self.__dict__) + ')'

    def get_dict(self):
        p = self.__dict__.copy()
        return p

    @classmethod
    def create_tag(cls, name, student_id):
        p = StudentTag()
        p.ident = name + '_' + student_id
        p.name = name
        p.student_id = student_id
        p.date = datetime.utcnow()

        return p.db_save()

    @classmethod
    def find_by_id(cls, name, student_id):
        return cls.find_one({'_id': name + '_' + student_id})

    def db_transform(self):
        """
        Transforms self to a database dictionary object.
        Gets called by transform_incoming of SONManipulator
        """

        data = self.__dict__.copy()
        del data['ident']
        if self.ident:
            data['_id'] = self.ident
        return data

    @staticmethod
    def db_create(son):
        """
        Creates a new Instance based of database SON data.
        Gets called by transform_outgoing of SONManipulator
        """
        p = StudentTag()
        p.ident = son['_id']
        del son['_id']
        p.__dict__.update(son)
        return p
