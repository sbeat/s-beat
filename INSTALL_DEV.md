# Setup development entvironment

This guide describes the setup on a Windows system.

## Prepare the system
1. Get the current [Python 2.x](https://www.python.org/downloads/) Version and install it
2. Get the current Version of Jetbrains PyCharm from [Jetbrains](https://www.jetbrains.com/pycharm/download) or a similar IDE and install it
3. Get the latest [Git client](https://git-scm.com/downloads) and install it
4. Install python dependencies:

		pip install --upgrade pip
		pip install -r requirements.txt


## Get S-BEAT

1. Fork the s-beat Project on GitHub
2. Clone S-BEAT:

		git clone https://github.com/[USER]/s-beat
		
3. Switch into the S-BEAT folder:

		cd s-beat
	
4. Configure your git author project:

		git config user.name "My name"
		git config user.email "...@...."


## Setup MongoDB

The following command automatically downloads MongoDB and provides you with helpful bat files. Run it in the S-BEAT project folder:

	python dev-support\support.py download_mongodb
	
Now you can go in the mongodb folder and start the database with the `start_win64.bat`

## Default setup

Run the following commands to setup a default configuration:

	python dev-support\support.py default_setup
	
Create the default folders structure:

	mkdir logs
	python sbeat.py create_default_folders
	
After you have started the MongoDB, import the initial setting into the database:

	python sbeat.py initial_settings
	
Import the definitions into the database:

	python sbeat.py import_definitions

## Open the IDE

When you open PyCharm or a similar Jetbrains IDE, you need to setup the Python Platform SDK.
After that you can use the configured run configurations.

Start the webserver with the **httpserver** run configuration. Then you can navigate in your browser to http://localhost:8000/.
Enter just the username admin, you don't need a password in the dev setup.

To run a data update, you can use the **run_all** run configuration.
