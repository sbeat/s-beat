# S-BEAT Project by Annkristin Stratmann, Niclas Steigelmann, Dominik Herbst

from flask import request, g, send_from_directory
import re
import UserTools
from APIBase import respond


def handle():
    # if request.method == 'POST':
    # name = request.form['name']

    if not UserTools.has_right('admin_access', g.user_role):
        return respond({'error': 'no_rights'}, 403)

    file_name = request.args.get('file')

    if file_name is None or not re.match(r'^[A-Za-z0-9]+(\.\d)?$', file_name):
        return respond({'error': 'invalid_file'}, 403)

    return send_from_directory('./logs', file_name + '.log', as_attachment=False, mimetype='text/plain')
