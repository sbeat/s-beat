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

import urllib2
import zipfile
import os
from os.path import join, exists, basename
import sys
import shutil

# mongodb_url = 'https://fastdl.mongodb.org/win32/mongodb-win32-x86_64-2008plus-ssl-3.6.13.zip'
mongodb_url = 'https://fastdl.mongodb.org/win32/mongodb-win32-x86_64-2008plus-ssl-4.0.12.zip'


def download_mongodb():
    basedir = join(os.getcwd(), 'mongodb')
    target_file = join(basedir, 'mongodb.zip')
    target_dir = join(basedir, 'bin64')
    create_dir(basedir)

    print "Download MongoDB to ", target_file

    if os.path.exists(target_file):
        print target_file, "already exists, skip download"
    else:
        response = urllib2.urlopen(mongodb_url)
        if response.getcode() != 200:
            print "Abort because of HTTP Code " + str(response.getcode())
            return

        total_size = 0
        downloaded_size = 0
        if 'Content-Length' in response.info():
            total_size = long(response.info().get('Content-Length'))

        print "Total: ", total_size, "downloading ...."

        with open(target_file, 'wb') as f:
            while True:
                chunk = response.read(64 * 1024)
                downloaded_size += len(chunk)

                if total_size > 0:
                    percent = float(downloaded_size) / total_size * 100
                    sys.stdout.write("\r{:.2f}%".format(percent))

                if not chunk:
                    break
                f.write(chunk)

    print "\nUnzipping ", target_file

    create_dir(target_dir)
    with zipfile.ZipFile(target_file, 'r') as z:
        for member in z.namelist():
            if 'bin/' in member:
                try:
                    file_path = z.extract(member, target_dir)
                    os.rename(file_path, join(target_dir, basename(file_path)))
                except zipfile.error as e:
                    print member, e

    os.unlink(target_file)

    create_dir(join(basedir, 'data'))

    copy_files(join(os.getcwd(),'dev-support','mongodb'), 'mongodb')


def default_setup():
    basedir = join(os.getcwd())
    data_dir = join(basedir, 'data')
    config_dir = join(basedir, 'config')

    files = [
        [config_dir, 'access_users.default.txt', 'access_users.txt'],
        [config_dir, 'main.default.cfg', 'main.cfg'],
        [data_dir, 'definitions.default.json', 'definitions.json'],
        [data_dir, 'mappings.default.json', 'mappings.json'],
    ]

    for fc in files:
        tf = join(fc[0], fc[2])
        sf = join(fc[0], fc[1])
        if not exists(tf):
            print "copy ", fc[1], "to", fc[2]
            shutil.copy(sf, tf)
        else:
            print "skip copy of", fc[1], "to", fc[2]


def copy_files(src, dest):
    create_dir(dest)
    for f in os.listdir(src):
        fp = join(src, f)
        tp = join(dest, f)
        if not exists(tp):
            shutil.copy(fp, tp)


def create_dir(path):
    if not exists(path):
        os.makedirs(path)


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print 'please provide a command as first argument'

    elif sys.argv[1] in dir():
        eval(sys.argv[1] + '()')

    else:
        print sys.argv[1], 'Not found'
