FROM debian:stretch-slim


RUN apt-get update && apt-get install -y apache2 apache2-utils libapache2-mod-wsgi git \
	build-essential python2.7 python-pip python-dev dirmngr apt-utils
RUN pip install --upgrade pip

RUN a2enmod proxy; a2enmod proxy_http; a2enmod wsgi; a2enmod headers


RUN apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv 2930ADAE8CAF5059EE73BB4B58712A2291FA4AD5;\
	echo "deb http://repo.mongodb.org/apt/debian stretch/mongodb-org/3.6 main" | tee /etc/apt/sources.list.d/mongodb-org-3.6.list
RUN apt-get update && apt-get install -y mongodb-org vim

RUN mkdir -p /data/db

RUN mkdir -p /opt/s-beat
WORKDIR /opt/s-beat

RUN git clone https://github.com/sbeat/s-beat.git .

RUN pip install -r requirements.txt

RUN cp config/access_users.default.txt config/access_users.txt; \
	cp config/main.default.cfg config/main.cfg; \
	cp data/definitions.default.json data/definitions.json; \
	cp data/mappings.default.json data/mappings.json; \
	mkdir logs; \
	python sbeat.py create_default_folders

RUN cd CModules/bitmapchecker; \
	python setup.py build && \
	cp build/lib.linux-x86_64-2.7/bitmapchecker.so ../../lib/ && \
	cd ../..

RUN htpasswd -bc /etc/apache2/.htpasswd admin admin

COPY apache-sbeat.conf /etc/apache2/conf-enabled/apache-sbeat.conf
COPY start_sbeat.sh /opt/s-beat/start_sbeat.sh
COPY sbeat_students.wsgi /opt/s-beat/sbeat_students.wsgi
COPY main.cfg /opt/s-beat/config/main.cfg
COPY initialSettings.json /opt/s-beat/config/initialSettings.json
COPY data/student_data.csv /opt/s-beat/data/students/student_data.csv
COPY data/courses_data.csv /opt/s-beat/data/courses/courses_data.csv

RUN chown -R www-data:www-data /opt/s-beat && chmod +x start_sbeat.sh

RUN a2dissite 000-default; a2dissite default-ssl

EXPOSE 80

CMD	./start_sbeat.sh

