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

from Db import DBDocument


class Tag(DBDocument):
    collection_name = 'tags'

    def __init__(self, **kwargs):
        self.name = None  # name of the tag
        self.order = 0
        self.active = False  # whether it is allowed to assign the tag to students

    def __repr__(self):
        return 'Tag(' + repr(self.__dict__) + ')'

    def get_dict(self):
        p = self.__dict__.copy()
        return p

    def db_transform(self):
        """
        Transforms self to a database dictionary object.
        Gets called by transform_incoming of SONManipulator
        """

        data = self.__dict__.copy()
        del data['name']
        if self.name:
            data['_id'] = self.name
        return data

    @staticmethod
    def db_create(son):
        """
        Creates a new Instance based of database SON data.
        Gets called by transform_outgoing of SONManipulator
        """
        p = Tag()
        p.name = son['_id']
        del son['_id']
        p.__dict__.update(son)
        return p
