#!/bin/bash

mongod --smallfiles --quiet &
python sbeat.py initial_settings
python sbeat.py import_definitions
#python sbeat.py run_all
service cron start
service apache2 start
