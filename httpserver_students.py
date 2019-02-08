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
import sys

sys.path.append('lib')

import StudentsWebAPI

from functools import wraps
from ConfigParser import RawConfigParser
from flask import Flask, render_template, request, Response, g, send_file
import logging
import markdown
import codecs

import UserTools
import Version
import DB

config = RawConfigParser()
config.read('config/main.cfg')

logging.basicConfig(filename=config.get('http_students', 'logfile'), level=logging.INFO)
log_formatter = logging.Formatter('%(asctime)s %(name)-12s %(levelname)-8s %(message)s')
console_handler = logging.StreamHandler()
console_handler.setFormatter(log_formatter)
logging.getLogger('').addHandler(console_handler)

logger = logging.getLogger(__name__)

port = config.getint('http_students', 'port')
host = config.get('http_students', 'host')
debug = True if config.get('http_students', 'debug') == 'true' else False
document_root = config.get('http_students', 'document_root')
base_path = '/students_view'
if config.has_section('web'):
    web_config = dict(config.items('web'))
else:
    web_config = dict()

# check which authentication methods should be used
authentication_header = True
username_header = False

realm = 'S-BEAT Gesicherter Bereich'

app = Flask(__name__, static_url_path=base_path, static_folder=document_root, template_folder=document_root)

UserTools.set_user_roles_by_config(config)


def has_right(required_role):
    return UserTools.has_right(required_role, g.user_role)


def get_setting(key):
    import DB
    return DB.Settings.load(key)


@app.before_request
def before_request():
    g.version = Version.get_string()
    g.web_config = web_config
    g.get_setting = get_setting

    g.logo = None
    if config.has_section('logo'):
        g.logo = {}
        for key, value in config.items('logo'):
            g.logo[key] = value.decode('utf-8')


def authenticate():
    """Sends a 401 response that enables basic auth"""
    return Response(
        render_template('students_view/unauthorized.html'), 401,
        {'WWW-Authenticate': 'Basic realm="' + realm + '"'})


def requires_auth(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth = request.authorization
        username = None
        if authentication_header and auth is not None:
            username = auth.username
        if username_header and 'x-remote-user' in request.headers:
            username = request.headers['x-remote-user']

        if username is not None and type(username) is str:
            user = DB.Student.find_one({'short': username})
            logger.info("Authenticated %s %s", username, user is not None)
            g.user = user
            if user:
                g.username = user.short
                return f(*args, **kwargs)

        return authenticate()

    return decorated


@app.route(base_path + '/')
@app.route(base_path + '/index.html')
@requires_auth
def index():
    return render_template('students_view/student_details.html')


@app.route(base_path + '/LICENSE.md')
def license():
    with codecs.open('LICENSE.md', mode='r', encoding='utf-8') as fd:
        return Response(markdown.markdown(fd.read()), 200, mimetype='text/html')


@app.route(base_path + '/gpl.txt')
def gpl():
    return send_file('gpl.txt', 'text/plain')


@app.route(base_path + '/<filename>.html')
@requires_auth
def html(filename):
    return render_template('students_view/' + filename + '.html')


@app.route(base_path + '/api/get_current_students_data')
@requires_auth
def handle_api_request():
    return StudentsWebAPI.GetData.handle()


if __name__ == '__main__':
    print 'Starting Webserver on ', 'http://' + host + ':' + str(port) + base_path

    app.run(host=host, port=port, debug=debug, use_reloader=True)
