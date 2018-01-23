#!/bin/bash
#	Copyright (c) 2016 S-BEAT GbR and others
#
#	This file is part of S-BEAT.
#
#	S-BEAT is free software: you can redistribute it and/or modify
#	it under the terms of the GNU General Public License as published by
#	the Free Software Foundation, either version 3 of the License, or
#	(at your option) any later version.
#
#	S-BEAT is distributed in the hope that it will be useful,
#	but WITHOUT ANY WARRANTY; without even the implied warranty of
#	MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
#	GNU General Public License for more details.
#
#	You should have received a copy of the GNU General Public License
#	along with S-BEAT. If not, see <http://www.gnu.org/licenses/>.


if [ ! -f data/request_start.txt ]; then
	echo "data/request_start.txt does not exist"
	exit
fi
rm data/request_start.txt

if [ -f data/run_all.pid ]; then
        echo "data/run_all.pid does already exist"
        pid=`cat data/run_all.pid`
        if [ -e /proc/${pid} ]; then
       		echo "data/run_all.pid ${pid} is running"
	        exit
	fi
fi

echo $$ > data/run_all.pid

python sbeat.py run_all

rm data/run_all.pid


