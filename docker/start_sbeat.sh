#!/bin/bash

#mongod --smallfiles --quiet &
python sbeat.py create_default_folders
python sbeat.py initial_settings
python sbeat.py import_definitions
#python sbeat.py run_all
service cron start
apachectl -D FOREGROUND
