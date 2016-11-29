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

if [ -f data/run_all.pid ]; then
        echo "data/run_all.pid does exist"
        pid=`cat data/run_all.pid`
        if [ -e /proc/${PID} -a /proc/${PID}/exe ]; then
                echo "data/run_all.pid ${PID} is running, sending SIGINT"
                kill -2 $pid
        else
        	echo "data/run_all.pid ${PID} is not running"
        fi
else
	echo "data/run_all.pid does not exist"

fi
                                                                
