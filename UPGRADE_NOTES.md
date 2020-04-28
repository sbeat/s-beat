# S-BEAT Upgrade Notes

The following notes tell you what to do when upgrading S-BEAT from an older version.

## Upgrade 1.6 to 1.7

Update the MongoDB Database to at least version 3.6. Update the depencenies:

    pip install -r requirements.txt --user

Run the following command to integrate new settings:

    python sbeat.py initial_settings
    
Add new Definition under Administration -> Definitionen:

    Student » Studium
        Name: Facultät
        Query: faculty
        Formatierung: String
        Ignorieren: Ja
         
    Student » Studium » Prüfungsleistungen
        Name: Semester mit 2. Versuchen
        Query: exam_try_semesters.2
        Formatierung: Semester
        Ignorieren: Ja
        
    Student » Studium » Prüfungsleistungen
        Name: Semester mit 3. Versuchen
        Query: exam_try_semesters.3
        Formatierung: Semester
        Ignorieren: Ja

## Upgrade 1.5 to 1.6

Run the following command to integrate new settings:

    python sbeat.py initial_settings


In the `main.cfg` `user_roles` section add the new premissions accordingly:

	course_data  # can access course data
    students_data  # can access data of single students
    student_analytics  # can use student analytics
    exams_data  # can see exam infos
    applicant_analytics  # can use analytics for applicants

Add new Definition under Administration -> Definitionen:
                         
     Student » Studium
         Name: End Semester
         Query: end_semester
         Formatierung: Semester
         Ignorieren: Ja


## Upgrade 1.4 to 1.5

Run the following command to integrate new settings:

    python sbeat.py initial_settings
    
Run that command to migrate the persistent database data to a new model:

	python sbeat.py migrate_db
    

Add new Definition under Administration -> Definitionen:

    Student » Studium
        Name: Abschluss
        Query: degree_type
        Formatierung: String
        Ignorieren: Ja
        Bedingungsgenerierung: Ja

Run a data update.

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

