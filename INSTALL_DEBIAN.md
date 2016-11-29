The document contains the instructions for a basic installation of S-BEAT on DEBIAN jessie.

# Prepare the system for S-BEAT
## Install general packets

	apt-get install build-essential

## Install Python

	apt-get install python2.7 python-pip python-dev


## Install Python modules

	pip install --upgrade pip
	pip install pymongo
	pip install Flask
	pip install markdown


## Install MongoDB

You only need to install MognoDB if you don't already have an instance available.

See [Install MongoDB Community Edition on Debian](http://docs.mongodb.org/manual/tutorial/install-mongodb-on-debian/)

	
	apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv EA312927
	echo "deb http://repo.mongodb.org/apt/debian jessie/mongodb-org/3.2 main" | sudo tee /etc/apt/sources.list.d/mongodb-org-3.2.list
	apt-get update
	apt-get install -y mongodb-org

Have a look into the configuration file: `/etc/mongod.conf`

Start MongoDB:

	service mongod start

## Install Apache2

Only install Apache2 if you don't already have a HTTP Server on the system.

	apt-get install apache2

	a2enmod ssl
	a2enmod proxy
	a2enmod proxy_http
	

Open the file `/etc/apache2/sites-available/default-ssl.conf`

Add the proxy configuration to redirect all requests to the S-BEAT server on port 8000.

	<Location "/">
            AuthType Basic
            AuthName "Protected area"
            AuthBasicProvider file
            AuthUserFile "/etc/apache2/.htpasswd"
            Require valid-user

            ProxyPass http://127.0.0.1:8000/
    </Location>

Enable the ssl site:

	a2ensite default-ssl

Setup the admin user:

	htpasswd -c /etc/apache2/.htpasswd admin
	
Depeding on your environment you can also use LDAP or any other authentication provider.
It is important that S-BEAT can receive the user name. For basic auth, S-BEAT can read the `Authorization` header. For other mechanisms you should enable the headers mod:

	a2enmod headers

and provide the username with the header:

	RequestHeader set "x-remote-user" "%{REMOTE_USER}e"
	
S-BEAT tries to check the Authentication header by default. But you can change it to only checking the `x-remote-user` header by setting following in the `main.cfg`:

	authentication_header = false
    username_header = true

Restart Apache2:

	service apache2 restart


# Install S-BEAT

## Add a new user

	useradd -m sbeat

## Add some comfort

Add an alias in `~/.bashrc`

	alias sbeat='cd /home/sbeat/s-beat; su -s /bin/bash sbeat'


## Switch to the new user

	su -s /bin/bash sbeat
	cd

## Download S-BEAT

	git clone https://github.com/sbeat/s-beat
	cd s-beat



## Initial setup

Copy the file with the default files to become used files:

	cp config/access_users.default.txt config/access_users.txt
	cp config/main.default.cfg config/main.cfg
	cp data/definitions.default.json data/definitions.json
	cp data/mappings.default.json data/mappings.json

Import the initial setting into the database:

	python sbeat.py initial_settings
	
Import the definitions into the database:

	python sbeat.py import_definitions
	

## Build bitmapchecker

	cd CModules/bitmapchecker
	python setup.py build
	
	Copy the library:
	cp build/lib.linux-x86_64-2.7/bitmapchecker.so ../../lib/
	cd ../..
	
## Add service

As root:

	cp /home/sbeat/s-beat/support/sbeat.service /etc/systemd/system/sbeat.service
	
Add to autostart:
	
	systemctl enable sbeat

Start S-BEAT:
	
	service sbeat start

## Setup logrotate

	cp /home/sbeat/s-beat/support/sbeat.logrotate /etc/logrotate.d/sbeat


## Install cronjob
Switch to sbeat user:

	sbeat
	
Open the crontav editor

	crontab -e
	
Add:

	*/1 * * * * cd /home/sbeat/s-beat && /home/sbeat/s-beat/run_all.sh
	


