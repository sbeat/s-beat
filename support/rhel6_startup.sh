#!/bin/bash
# start/stop script for S-BEAT Webserver
### BEGIN INIT INFO
# Provides:          sbeat
# Required-Start:    $remote_fs $syslog $network
# Required-Stop:     $remote_fs $syslog
# Default-Start:     2 3 4 5
# Default-Stop:      0 1 6
# Short-Description: Start S-BEAT webserver
# Description:       Starts the S-BEAT HTTP server interface.
### END INIT INFO

. /etc/rc.d/init.d/functions


basepath="/home/sbeat/s-beat"


user="sbeat"

exec="/usr/bin/python"
pyscript="httpserver.py"
parms=""
prog="sbeat"
pidfile="$basepath/sbeat.pid"
logfile="$basepath/logs/sbeat_webserver.log"

start() {
        if [ ! -x $exec ]
        then
                echo $exec not found
                exit 5
        fi

        if [ -e $pidfile ]
        then
            echo $pidfile found
                stop
        fi


        echo "Starting $prog daemon"

        cd $basepath
        runuser -s /bin/bash $user -c "$exec $pyscript $parms" > $logfile 2>&1 &
        RETPID=$!

        if checkpid $RETPID
        then
                echo $RETPID > $pidfile
                echo_success
        else
                echo_failure
        fi
        echo
        return 0
}

stop() {
        echo "Stopping $prog daemon"
        if [ ! -e $pidfile ]
        then
                echo $pidfile not found
                return 1
        fi

        pid=`cat $pidfile`
        kill $(list_descendants $pid)

        retval=$?
        if [ $retval -eq 0 ]; then
                echo_success
        else
                echo_failure
        fi
        echo
        rm -f $pidfile

        return 0
}

restart() {
    stop
    start
}

list_descendants() {
  local children=$(ps -o pid= --ppid "$1")

  for pid in $children
  do
    list_descendants "$pid"
  done

  echo "$children"
}


case "$1" in
        start)
                $1
                ;;
        stop)
                $1
                ;;
        restart)
                $1
                ;;
        *)
    echo "Usage: $0 {start|stop|restart|reload|force-reload}"
    exit 2
esac

exit $?
                                                     