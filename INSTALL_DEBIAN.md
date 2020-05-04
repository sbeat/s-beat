The document contains the instructions for a basic installation of S-BEAT on DEBIAN stretch.

# Prepare the system for S-BEAT
## Install general packets

	apt-get install build-essential

## Install Python

	apt-get install python2.7 python-pip python-dev


## Upgrade PIP

	pip install --upgrade pip

## Install MongoDB

You only need to install MognoDB if you don't already have an instance available.

In Debian 9 (Stretch) you need to install the dirmngr package. Otherwise you run into an error.

	apt-get install dirmngr

See [Install MongoDB Community Edition on Debian](https://docs.mongodb.com/v4.0/tutorial/install-mongodb-on-debian/)

*Note: At least MongoDB 4.0 is required*
	
	wget -qO - https://www.mongodb.org/static/pgp/server-4.0.asc | sudo apt-key add -
	echo "deb http://repo.mongodb.org/apt/debian stretch/mongodb-org/4.0 main" | sudo tee /etc/apt/sources.list.d/mongodb-org-4.0.list
	apt-get update
	apt-get install -y mongodb-org

Have a look into the configuration file: `/etc/mongod.conf`

Start MongoDB:

	service mongod start
	systemctl enable mongod

## Install Apache2

Only install Apache2 if you don't already have a HTTP Server on the system.

	apt-get install apache2

	a2enmod ssl
	a2enmod proxy
	a2enmod proxy_http
	

Open the file `/etc/apache2/sites-available/default-ssl.conf`

Scroll down to the closing VirtualHost tag `</VirtualHost>`.
Add the following configuration right above this tag to redirect all requests to the S-BEAT server on port 8000.

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

If not already installed, you need git

	apt-get install git
	
Now you can download S-BEAT	

	git clone https://github.com/sbeat/s-beat
	cd s-beat

## Install Python modules

	pip install -r requirements.txt --user

## Initial setup

Copy the default files so they become used files:

	cp config/access_users.default.txt config/access_users.txt
	cp config/main.default.cfg config/main.cfg
	cp data/definitions.default.json data/definitions.json
	cp data/mappings.default.json data/mappings.json

Create the default folders structure:

	mkdir logs
	python sbeat.py create_default_folders

In case the name of the user_roles in the `main.cfg` file were changed,
the user role specific settings in the `config/initialSettings.json` need to be changed before the following step.

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
	


