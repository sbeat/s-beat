#!/bin/bash

mongod --smallfiles --quiet &
python sbeat.py initial_settings
python sbeat.py import_definitions
python sbeat.py run_all
service apache2 start
