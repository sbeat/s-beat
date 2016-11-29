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

from flask import request, Response
import json
import datetime
import calendar


def respond(data, code):
    output = request.args.get('output', default='json')

    response = Response(status=code)
    if output == 'pretty':
        response.content_type = 'text/plain; charset=utf-8'
        response.data = json.dumps(data, ensure_ascii=False, indent=4, separators=(',', ': '), cls=APIJSONEncoder)
    else:
        response.content_type = 'application/json; charset=utf-8'
        response.data = json.dumps(data, ensure_ascii=False, cls=APIJSONEncoder)

    return response


class APIJSONEncoder(json.JSONEncoder):
    def default(self, o):
        if type(o) == datetime.datetime:
            return int(calendar.timegm(o.timetuple()))
            # return (o - datetime.datetime(1970, 1, 1)).total_seconds()
        if type(o) == set:
            return list(o)

        return json.JSONEncoder.default(self, o)
