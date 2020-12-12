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
import re
import sys

sys.path.append('lib')

from functools import wraps
from ConfigParser import RawConfigParser
from flask import Flask, abort, render_template, request, Response, g, send_file
import logging
import markdown
import codecs

import UserTools
import WebAPI
import Version
import DB
import StudentsWebAPI

config = RawConfigParser()
config.read('config/main.cfg')

logging.basicConfig(filename=config.get('http', 'logfile'), level=logging.INFO)
# logging.getLogger('').addHandler(logging.StreamHandler())

port = config.getint('http', 'port')
host = config.get('http', 'host')
debug = True if config.get('http', 'debug') == 'true' else False
document_root = config.get('http', 'document_root')
upload_folder = config.get('http', 'upload_folder')

if config.has_section('web'):
    web_config = dict(config.items('web'))
else:
    web_config = dict()

# check which authentication methods should be used
authentication_header = True
username_header = False
if config.has_option('http', 'authentication_header'):
    authentication_header = config.getboolean('http', 'authentication_header')
if config.has_option('http', 'username_header'):
    username_header = config.getboolean('http', 'username_header')

realm = 'S-BEAT Gesicherter Bereich'

app = Flask(__name__, static_url_path='', static_folder=document_root, template_folder=document_root)
app.config['UPLOAD_FOLDER'] = upload_folder

UserTools.set_user_roles_by_config(config)


def has_right(required_role):
    return UserTools.has_right(required_role, g.user_role)

@app.before_request
def before_request():
    g.user_role = 'guest'
    g.has_right = has_right
    g.user = None
    g.username = ''
    g.web_config = web_config
    g.students_view = config.has_section('http_students')

    g.settings = DB.Settings.load_dict([
        'cp_label',
        'student_list_limit',
        'contact_software',
        'contact_hosting',
        'contact_data',
        'import_applicants',
        'privacy_notice'
    ])

    g.version = Version.get_string()

    g.logo = None
    if config.has_section('logo'):
        g.logo = {}
        for key, value in config.items('logo'):
            g.logo[key] = value.decode('utf-8')


def authenticate():
    """Sends a 401 response that enables basic auth"""
    return Response(
        render_template('unauthorized.html'), 401,
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

        if username is not None:
            user = UserTools.get_user(username)
            g.user = user
            if user:
                g.username = username
                g.user_role = user['role']
                return f(*args, **kwargs)

        return authenticate()

    return decorated


@app.route('/')
@app.route('/index.html')
@requires_auth
def index():
    return render_template('index.html')


@app.route('/logout.html')
def logout():
    auth = request.authorization
    logout_user = request.args.get('user')

    if auth is not None and logout_user == auth.username:
        return authenticate()
    else:
        response = Response(
            '<p>You should be redirected to URL: '
            '<a href="%s">%s</a>.' %
            ('/index.html', '/index.html'), 302, mimetype='text/html')
        response.autocorrect_location_header = False
        response.headers['Location'] = '/index.html'
        return response


@app.route('/LICENSE.md')
def license():
    with codecs.open('LICENSE.md', mode='r', encoding='utf-8') as fd:
        return Response(markdown.markdown(fd.read()), 200, mimetype='text/html')


@app.route('/Datenspezifikation.md')
def data_specification():
    with codecs.open('Datenspezifikation.md', mode="r", encoding="utf-8") as fd:
        return Response(markdown.markdown(fd.read()), 200, mimetype='text/html')


@app.route('/gpl.txt')
def gpl():
    return send_file('gpl.txt', 'text/plain')


@app.route('/students_view_<student_ident>.html')
@requires_auth
def students_view(student_ident):
    if not UserTools.has_right('students_data', g.user_role):
        return Response('No Permission', 403)
    return render_template('students_view/student_details.html')


@app.route('/api/get_current_students_data')
@requires_auth
def handle_students_view_api_request():
    if not UserTools.has_right('students_data', g.user_role):
        return Response('No Permission', 403)

    if not request.headers['referer']:
        return Response('No Referer', 403)

    m = re.search('students_view_(.+?)\\.html', request.headers['referer'])
    if m is None:
        return Response('No Student ident found', 404)

    g.settings = DB.Settings.load_dict([
        'hide_finished_ident_data',
        'student_ident_string'
    ])

    ident = m.group(1)
    if not g.settings['student_ident_string']:
        ident = int(ident)

    g.student = DB.Student.find_one({'_id': ident})
    if g.student is None:
        return Response('No Student found with ident ' + ident, 404)

    return StudentsWebAPI.GetData.handle()


@app.route('/<filename>.html')
@requires_auth
def html(filename):
    if re.match('^[-a-zA-Z0-9_]{1,30}$', filename):
        return render_template(filename + '.html')
    else:
        return Response('Illegal file name', 400)


@app.route('/api/<endpoint>', methods=['POST', 'GET'])
@requires_auth
def handle_api_request(endpoint):
    if not hasattr(WebAPI, endpoint):
        abort(404)

    endpoint = getattr(WebAPI, endpoint)
    if not hasattr(endpoint, 'handle'):
        abort(501)

    get_temp = request.args.get('temp', default='false') == 'true'
    if get_temp:
        DB.enable_temp_data()

    try:
        response = endpoint.handle()
        if get_temp:
            DB.disable_temp_data()
    except:
        if get_temp:
            DB.disable_temp_data()
        raise

    return response


if __name__ == '__main__':
    print 'Starting Webserver on ', 'http://' + host + ':' + str(port) + '/'

    app.run(host=host, port=port, debug=debug, use_reloader=True)
