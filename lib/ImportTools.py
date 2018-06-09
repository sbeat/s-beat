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

from ConfigParser import RawConfigParser
from os import listdir, unlink
from os.path import isfile, join, getsize, getmtime
import csv
import re
from datetime import datetime
import json
import logging

allowed_directories = ('applicants', 'courses', 'exams', 'studentidents', 'students')
data_path = 'data'
mappings = None
logger = logging.getLogger(__name__)


def get_files_info(directory, data_list=None):
    ret = []

    base_path = join(data_path, directory)
    index_config = join(base_path, 'index.cfg')
    index = RawConfigParser()
    index.modified = False
    if isfile(index_config):
        index.read(index_config)

    files_list = [f for f in listdir(base_path) if isfile(join(base_path, f)) and f[-4:] == '.csv']
    removed_order = None
    order_num = len(index.sections())
    for f in files_list:
        file_path = join(base_path, f)
        info = {
            'file': f,
            'dir': directory,
            'size': getsize(file_path),
            'mtime': getmtime(file_path),
        }
        if index.has_section(f):
            info['order'] = index.getint(f, 'order')
            info['active'] = index.getboolean(f, 'active')
            info['comment'] = index.get(f, 'comment')

        else:
            index.add_section(f)
            order_num += 1
            info['order'] = order_num
            info['active'] = True
            info['comment'] = u''
            index.set(f, 'order', info['order'])
            index.set(f, 'active', info['active'])
            index.set(f, 'comment', info['comment'])
            index.modified = True

        if data_list is not None:
            data = next((x for x in data_list if x.get('file') == info['file']))
            if data is not None and data.get('remove') is True:
                index.remove_section(f)
                index.modified = True
                removed_order = data['order']
                unlink(file_path)
                continue

            elif data is not None:
                info['order'] = int(data.get('order', info['order']))
                info['active'] = bool(data.get('active', info['active']))
                info['comment'] = unicode(data.get('comment', info['comment']))
                index.set(f, 'order', info['order'])
                index.set(f, 'active', info['active'])
                index.set(f, 'comment', info['comment'])
                index.modified = True

        ret.append(info)

    if removed_order is not None:
        ret.sort(key=lambda nfo: nfo['order'])
        for i, info in enumerate(ret):
            if info['order'] > removed_order:
                info['order'] -= 1
                index.set(info['file'], 'order', info['order'])

    if index.modified:
        with open(index_config, 'wb') as fd:
            index.write(fd)

    ret.sort(key=lambda nfo: nfo['order'])
    return ret


def get_file_path(directory, filename):
    return join(data_path, directory, filename)


def read_csv(info, delimiter=';'):
    size = info['size']
    with open(get_file_path(info['dir'], info['file']), 'rb') as fd:
        exam_reader = csv.DictReader(fd, delimiter=delimiter)
        exam_reader.fieldnames = map(lambda x: x.lower(), exam_reader.fieldnames)
        logger.info('read_csv %s', exam_reader.fieldnames)

        for entry in exam_reader:
            pos = fd.tell()

            # make all fieldnames lowercase
            # lowerentry = dict()
            # for k,v in entry.iteritems():
            #    lowerentry[k.lower()] = v

            yield (entry, pos, size)


def is_int_in_ranges(number, ranges):
    for data in ranges:
        parts = data.split('-')
        if (len(parts) == 2 and len(parts[1]) == 0 or len(parts) == 1) and number == int(parts[0]):
            return True
        elif len(parts) == 2 and len(parts[0]) > 0 and len(parts[1]) > 0 and int(parts[0]) <= number <= int(parts[1]):
            return True
    return False


def map_by_definiton(col, value, required=False, default=None):
    """Maps value of a column to a value that is defined in the mappings.json file"""
    global mappings
    if mappings is None:
        with open('data/mappings.json', 'r') as fd:
            json_data = fd.read().decode('utf-8')
            mappings = json.loads(json_data)

    if col not in mappings and required:
        return default
    elif col not in mappings:
        return value

    key = unicode(value)
    if key in mappings[col]:
        return mappings[col][key]
    elif required:
        return default
    else:
        return value


def get_date_from_csv(input_date):
    m = re.search(r'^(\d\d)-(\w\w\w)-(\d\d)', input_date)
    if m:
        year = int(m.group(3))
        if year < 40:
            year += 2000
        else:
            year += 1900

        months = {
            'Jan': 1,
            'Feb': 2,
            'Mrz': 3,
            'Apr': 4,
            'Mai': 5,
            'Jun': 6,
            'Jul': 7,
            'Aug': 8,
            'Sep': 9,
            'Okt': 10,
            'Nov': 11,
            'Dez': 12
        }

        return datetime(year, months[m.group(2)], int(m.group(1)))

    m = re.search(r'^(\d\d?)\.(\d\d?)\.(\d\d\d\d)', input_date)
    if m:
        return datetime(int(m.group(3)), int(m.group(2)), int(m.group(1)))

    return None


def get_int(s):
    try:
        if ',' in s:
            s = float(s.replace(',', '.'))
        return int(s)
    except (ValueError, TypeError):
        return None


def get_float(s):
    try:
        if ',' in s:
            return float(s.replace(',', '.'))
        return float(s)
    except (ValueError, TypeError):
        return None


def get_boolean(s):
    s = s.lower()
    if s in [True, 'true', 'y', 'j']:
        return True
    else:
        return False


def get_unicode(s, encoding='windows-1252'):
    s = s.decode(encoding)
    return unicode(s.strip())


def clean_db_string(s):
    if '.' in s:
        s = s.replace('.', ' ')
    if '$' in s:
        s = s.replace('$', '')
    return s


def get_import_expressions():
    config = RawConfigParser()
    config.read('config/main.cfg')

    if not config.has_section('import_expressions'):
        return {}

    import_expressions = {}
    for name, expr in dict(config.items('import_expressions')).iteritems():
        import_expressions[name] = eval('lambda e: '+expr)

    return import_expressions


