# S-BEAT Upgrade Notes

The following notes tell you what to do when upgrading S-BEAT from an older version.

## Upgrade 1.4 to 1.5

Run the following command to integrate new settings:

    python sbeat.py initial_settings
    

## Upgrade 1.3 to 1.4

In the `main.cfg` `http` section add:

	authentication_header = true
    username_header = false

Check for symlinks that might have been created during setup of S-BEAT because the following files were moved to the `support` directory.
* `debian_startup.sh`
* `rhel6_startup.sh`
* `sbeat.logrotate`
* `sbeat.service`

The automatic mapping of course shorts with a 7 at its end to a group with B at its end instead, has been removed. Please ensure the STG to GROUP mapping is corrent in your courses CSV file or is configured in the `data/mappings.json` file.

Add markdown as dependency:

	pip install markdown
	
Run the following command to integrate new settings:

    python sbeat.py initial_settings

