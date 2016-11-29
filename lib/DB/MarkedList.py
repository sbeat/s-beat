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
from datetime import datetime


class MarkedList(DBDocument):
    collection_name = 'markedlist'

    def __init__(self, **kwargs):
        self.ident = None  # ident of the list
        self.date_insert = datetime.utcnow()
        self.date_update = datetime.utcnow()

        self.name = ''  # name of the list

        self.list = set()  # list of all student idents
        self.count = 0  # count of students in this list

        self.comments = {}  # comments for each student ident:{text,date,by}

        self.owner = None  # owner of the list
        self.created_by = None
        self.updated_by = None

        self.read_only = False  # can only the owner modify this list?
        self.user_roles = None  # user roles that are allowed to access this list, None for private list
        self.deleteable = True  # if this list can be deleted, the list to remember consultings should not be deletable

    def __repr__(self):
        return 'MarkedList(' + repr(self.__dict__) + ')'

    def get_dict(self):
        return self.__dict__

    def is_allowed(self, username, user_role):
        return username == self.owner or self.user_roles and user_role in self.user_roles

    def is_writable(self, username, user_role):
        return username == self.owner or self.user_roles and user_role in self.user_roles and not self.read_only

    def add_student(self, ident):
        self.list.add(ident)
        self.count = len(self.list)

    def remove_student(self, ident):
        if ident not in self.list:
            return
        self.list.remove(ident)
        if ident in self.comments:
            del self.comments[ident]
        self.count = len(self.list)

    def db_transform(self):
        """
        Transforms self to a database dictionary object.
        Gets called by transform_incoming of SONManipulator
        """

        data = self.__dict__.copy()
        del data['ident']
        data['_id'] = self.ident
        data['list'] = list(self.list)

        return data

    @staticmethod
    def db_create(son):
        """
        Creates a new Instance based of database SON data.
        Gets called by transform_outgoing of SONManipulator
        """
        p = MarkedList()
        p.ident = son['_id']
        del son['_id']
        p.__dict__.update(son)
        p.list = set(p.list)
        return p

    @classmethod
    def db_setup(cls):
        c = cls.get_collection()
        c.create_index([('owner', 1)])
        c.create_index([('user_roles', 1)])
        c.create_index([('list', 1)])

        cls.ensure_default_lists()

    @classmethod
    def ensure_default_lists(cls):
        ml = MarkedList()
        ml.ident = 'consulted'
        ml.name = 'Wurde beraten'
        ml.owner = 'SYSTEM'
        ml.created_by = ml.owner
        ml.updated_by = ml.owner
        ml.deleteable = False
        ml.user_roles = ['berater', 'admin']
        ml.db_insert()



