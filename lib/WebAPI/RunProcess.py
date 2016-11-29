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

import math
import os.path
import time
import traceback

from flask import request, g

import DB
import UserTools
from APIBase import respond


def handle():
    if not UserTools.has_right('admin_access', g.user_role):
        return respond({'error': 'no_rights'}, 403)

    apply_data = request.args.get('apply_data', default='false') == 'true'
    if apply_data:
        try:
            DB.ProcessTracking.process_update('apply_data', 0, {'state': 'running'})
            DB.swap_temp_to_op()
            DB.ProcessTracking.process_update('apply_data', 1, {'state': 'done'})
            DB.ProcessTracking.process_done('apply_data')
        except:
            DB.ProcessTracking.process_failed('apply_data', {'error': traceback.format_exc()})
            raise
        return respond({'ok': True}, 200)

    start_file = 'data/request_start.txt'

    if os.path.isfile(start_file):
        return respond({'error': 'start_requested'}, 200)

    with open(start_file, 'w') as fd:
        fd.write(str(time.time()))

    now = time.time()
    nextup = math.ceil(now / 60) * 60

    DB.UserLog.add_entry('run_update', g.username)

    return respond({'ok': True, 'wait': nextup - now}, 200)




