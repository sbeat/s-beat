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

import logging

from Db import DBDocument
from datetime import datetime

logger = logging.getLogger(__name__)


class ProcessTracking(DBDocument):
    collection_name = 'processTracking'

    cached_steps = {}

    process_steps = [
        'import_courses',
        'import_students',
        'import_applicants',
        'import_exams',
        'calculate_student_exams',
        'generate_definitions',
        'generate_paths_apriori',
        # 'calculate_scaled_paths',
        'calculate_student_risk',
        'apply_data'
    ]

    def __init__(self, **kwargs):
        self.ident = None  # Ident of the process
        self.done = False  # if the process is finished
        self.running = False  # if the process is running
        self.failed = False  # if the process failed
        self.progress = 0.0  # is at 1.0 if done
        self.progress_info = {}  # dictionary with additional progress info

        self.date_done = None  # last time the process was done
        self.date_started = None  # last time the process was started
        self.date_updated = None  # last time the process was updated

    def start(self):
        self.reset()
        self.running = True
        self.progress = 0.0
        self.progress_info = {}
        self.date_started = datetime.utcnow()
        self.date_updated = datetime.utcnow()

    def finished(self):
        self.done = True
        self.progress = 1.0
        self.running = False
        self.failed = False
        self.date_done = datetime.utcnow()
        self.date_updated = datetime.utcnow()

    def fail(self):
        self.done = False
        self.running = False
        self.failed = True

    def reset(self):
        self.done = False
        self.running = False
        self.failed = False
        self.progress = 0.0
        self.progress_info = {}

    def __repr__(self):
        return 'ProcessTracking(' + repr(self.__dict__) + ')'

    def __eq__(self, other):
        return isinstance(other, type(self)) and \
               self.ident == other.ident

    def __hash__(self):
        return hash(self.ident)

    def db_transform(self):
        """
        Transforms self to a database dictionary object.
        Gets called by transform_incoming of SONManipulator
        """
        data = self.__dict__.copy()
        del data['ident']
        data['_id'] = self.ident
        return data

    @staticmethod
    def db_create(son):
        """
        Creates a new Instance based of database SON data.
        Gets called by transform_outgoing of SONManipulator
        """
        p = ProcessTracking()
        p.ident = son['_id']
        del son['_id']
        p.__dict__.update(son)
        return p

    @classmethod
    def get_process_info(cls):
        ret = {
            'complete': True,
            'current': None,
            'next': None,
            'steps': []
        }
        prev_step = None
        for ident in cls.process_steps:
            step = cls.find_one({'_id': ident})
            if step is None:
                ret['complete'] = False
                continue
            ret['steps'].append(step.__dict__)

            if not step.done and ret['current'] is None:
                ret['complete'] = False
                ret['current'] = ident

            if prev_step is not None and prev_step.ident == ret['current']:
                ret['next'] = ident

            prev_step = step
        return ret

    @classmethod
    def process_start(cls, ident):
        step = cls.find_one({'_id': ident})
        if step is None:
            step = ProcessTracking()
            step.ident = ident
            step.db_insert()

        step.start()
        step.db_update()

        logger.info('process_start ' + ident)

        # reset all following steps
        index = cls.process_steps.index(step.ident)
        for step_ident in cls.process_steps[index + 1:]:
            step = cls.find_one({'_id': step_ident})
            if step is None:
                continue
            step.reset()
            step.db_update()

    @classmethod
    def process_update(cls, ident, progress=0.0, info=None):
        if ident in cls.cached_steps:
            step = cls.cached_steps[ident]
        else:
            step = cls.find_one({'_id': ident})
            if step is None:
                return
            cls.cached_steps[ident] = step

        step.date_updated = datetime.utcnow()
        step.progress = progress
        if info is not None:
            step.progress_info.update(info)

        step.db_update(['date_updated', 'progress', 'progress_info'])

    @classmethod
    def process_done(cls, ident):
        step = cls.find_one({'_id': ident})
        if step is None:
            return

        logger.info('process_done ' + ident)

        step.finished()
        step.db_update()

    @classmethod
    def process_failed(cls, ident, info=None):
        step = cls.find_one({'_id': ident})
        if step is None:
            return

        logger.info('process_failed ' + ident)

        step.fail()
        if info is not None:
            step.progress_info.update(info)
        step.db_update()
