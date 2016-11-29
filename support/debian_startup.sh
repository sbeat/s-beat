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

. /lib/lsb/init-functions


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


	log_daemon_msg "Starting $prog daemon"

	start-stop-daemon --start --pidfile $pidfile -m -c $user --chdir $basepath --exec $exec -- $pyscript $parms > $logfile 2>&1 &

	echo "ok"

	return 0
}


stop() {
	log_daemon_msg "Stopping $prog daemon"
	if [ ! -e $pidfile ]
	then
	        echo $pidfile not found
		return 1
	fi
	
	pid=`cat $pidfile`
	pkill -P $pid

	#start-stop-daemon --stop --retry 10 --pidfile $pidfile 
	retval=$?
	if [ $retval -eq 0 ]; then
		rm -f $pidfile
		echo "ok"
	fi
	return 0
}

restart() {
    stop
    start
}

reload() {
	log_daemon_msg "Reloading $prog"
	#kill -USR2 `cat $pidfile`
	#start-stop-daemon --stop --pidfile $pidfile --signal USR2
	echo ""
}
force-reload() {
	log_daemon_msg "Reloading $prog"
	#kill -HUP `cat $pidfile`
	#start-stop-daemon --stop --pidfile $pidfile --signal HUP
	echo ""
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
	reload)
		$1
		;;
	force-reload)
		$1
		;;
	*)
    echo "Usage: $0 {start|stop|restart|reload|force-reload}"
    exit 2
esac

exit $?
