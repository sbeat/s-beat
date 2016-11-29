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

from datetime import datetime
from Db import DBDocument


class UserLog(DBDocument):
    collection_name = 'userlog'

    def __init__(self, **kwargs):
        self.ident = None  # ident of log entry
        self.date = None
        self.action = None
        self.user = None
        self.info = None

    def __repr__(self):
        return 'UserLog(' + repr(self.__dict__) + ')'

    def get_dict(self):
        p = dict()
        p['ident'] = str(self.ident)
        p['date'] = self.date
        p['action'] = self.action
        p['user'] = self.user
        p['info'] = self.info
        return p

    @classmethod
    def add_entry(cls, action, user, info=None):
        p = UserLog()
        p.date = datetime.utcnow()
        p.action = action
        p.user = user
        p.info = info

        p.db_insert()

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
        p = UserLog()
        p.ident = son['_id']
        del son['_id']
        p.__dict__.update(son)
        return p


