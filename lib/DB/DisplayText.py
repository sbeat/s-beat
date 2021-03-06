#  Copyright (c) 2019 S-BEAT GbR and others
#
#  This file is part of S-BEAT.
#
#  S-BEAT is free software: you can redistribute it and/or modify
#  it under the terms of the GNU General Public License as published by
#  the Free Software Foundation, either version 3 of the License, or
#  (at your option) any later version.
#
#  S-BEAT is distributed in the hope that it will be useful,
#  but WITHOUT ANY WARRANTY; without even the implied warranty of
#  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
#  GNU General Public License for more details.
#
#  You should have received a copy of the GNU General Public License
#  along with S-BEAT. If not, see <http://www.gnu.org/licenses/>.
from Db import DBDocument


class DisplayText(DBDocument):
    """
    A DisplayText can be shown on a stundet view page
    """

    collection_name = 'display_texts'

    def __init__(self, **kwargs):
        self.filters = []  # list of filter definitions
        self.ident = ''
        self.position = 'left'  # positon where to display the text
        self.text = ''  # HTML text
        self.enabled = False
        self.order = 0  # in case multiple texts match, sort by this order number

    def get_dict(self, for_output=False):
        if for_output:
            return {
                'position': self.position,
                'text': self.text
            }
        data = self.__dict__.copy()
        return data

    def db_transform(self):
        """
        Transforms self to a database dictionary object.
        Gets called by transform_incoming of SONManipulator
        """
        data = self.__dict__.copy()
        del data['ident']
        data['_id'] = self.ident
        data['filter_ids'] = self.get_filter_ids()
        return data

    def get_filter_ids(self):
        filter_ids = list()
        for f in self.filters:
            if f['type'] == 'filterElement':
                filter_ids.append(f['id'])
            if f['type'] == 'value':
                filter_ids.append(f['id'] + '=' + f['value'])

        return filter_ids

    @staticmethod
    def db_create(son):
        """
        Creates a new Instance based of database SON data.
        Gets called by transform_outgoing of SONManipulator
        """
        p = DisplayText()
        p.ident = son['_id']
        del son['_id']
        p.__dict__.update(son)
        return p

    @staticmethod
    def get_by_student(student, settings):
        element_ids = [unicode(pe._id) for pe in student.get_matching_elements()]
        lights = settings['lights']
        if 'lights:' + student.stg_original in settings:
            lights = settings['lights:' + student.stg_original]
        if 'lights:' + student.stg in settings:
            lights = settings['lights:' + student.stg]

        for name in ['risk', 'risk_all', 'risk_stg', 'risk_degree']:
            cat_value = student.__dict__[name]
            if cat_value is None:
                continue
            value = cat_value['median_scaled']
            if value < lights[1]:
                element_ids.append(name + '=green')
            if lights[1] <= value < lights[2]:
                element_ids.append(name + '=yellow')
            if value >= lights[2]:
                element_ids.append(name + '=red')

        return DisplayText.find({'$and': [
            {'enabled': True},
            {'$expr': {'$setIsSubset': ['$filter_ids', element_ids]}}
        ]}, sort=[['order', 1]])
