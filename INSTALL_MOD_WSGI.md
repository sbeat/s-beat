This document contains instructions to install mod_wsgi for S-BEAT on DEBIAN stretch.

# mod_wsgi

If not stated otherwise, execute the following tasks as a superuser or with sudo.

## Install packet

	apt-get install libapache2-mod-wsgi
	systemctl restart apache2

## Check correct installation

You can check, if mod_wsgi was correctly installed using the following command:

	apache2ctl -M

This returns a list of all installed modules. You should find `wsgi_module` among them.


## Configure Apache

Open the file `/etc/apache2/sites-available/default-ssl.conf`

Add the following snippet above the Location tag:

            WSGIDaemonProcess sbeat user=sbeat group=sbeat home=/home/sbeat/s-beat/ threads=5
            WSGIScriptAlias / /home/sbeat/s-beat/sbeat.wsgi
            WSGIPassAuthorization On

            <Directory /home/sbeat/s-beat>^
                    WSGIProcessGroup sbeat
                    WSGIApplicationGroup %{GLOBAL}
                    Require all granted
            </Directory>


Within the Location tag, comment out the proxy configuration:

	<Location "/">
            AuthType Basic
            AuthName "Protected area"
            AuthBasicProvider file
            AuthUserFile "/etc/apache2/.htpasswd"
            Require valid-user

    #        ProxyPass http://127.0.0.1:8000/
    </Location>

## Create sbeat.wsgi

Switch to the sbeat user,and create the file sbeat.wsgi:

	sbeat
	vim sbeat.wsgi

Insert the following lines:

	import sys
	sys.path.insert(0, '/home/sbeat/s-beat')
	from httpserver import app as application

Switch back to your superuser and restart Apache once more:

	exit
	systemctl restart apache2

Now you should be able to open S-BEAT in your browser as before.