# coding=utf-8
"""
Copyright (c) 2016 S-BEAT GbR and others

This file is part of S-BEAT.

S-BEAT is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

S-BEAT is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with S-BEAT. If not, see <http://www.gnu.org/licenses/>.
"""

from calendar import monthrange
from datetime import datetime, timedelta
import math


def get_semester_from_date(date):
    # Wintersemester: 01.09-28.02/29.02 [2]
    # Sommersemester: 01.03-31.08 [1]
    # Format: [year][1|2]

    ss_start = datetime(date.year, 3, 1)
    ws_start = datetime(date.year, 9, 1)

    if date < ss_start:
        return (date.year - 1) * 10 + 2
    elif date < ws_start:
        return date.year * 10 + 1
    else:
        return date.year * 10 + 2  # WS im aktuellen Jahr


def get_appl_start_semester_from_date(date):
    # Wintersemester: 01.09-28.02/29.02 [2]
    # Sommersemester: 01.03-31.08 [1]
    # Format: [year][1|2]

    ss_start = datetime(date.year, 3, 1)
    ws_start = datetime(date.year, 9, 1)

    if date < ss_start:
        return date.year * 10 + 1
    elif date < ws_start:
        return date.year * 10 + 2
    else:
        return (date.year + 1) * 10 + 1  # SS im nächsten Jahr


def get_semester_text(value):
    year = int(math.floor(value / 10))
    semnr = value % 10
    ret = ''
    if semnr == 1:
        ret = 'SoSe ' + str(year)
    if semnr == 2:
        sndyear = int((year + 1) % 100)
        fstyear = int(year % 100)
        ret = 'WiSe '
        ret += '0' + str(fstyear) if fstyear < 10 else str(fstyear)
        ret += '/'
        ret += '0' + str(sndyear) if sndyear < 10 else str(sndyear)
    return ret


def month_delta(d1, d2):
    delta = 0
    while True:
        mdays = monthrange(d1.year, d1.month)[1]
        d1 += timedelta(days=mdays)
        if d1 <= d2:
            delta += 1
        else:
            break
    return delta


def semester_delta(d1, d2):
    delta = month_delta(d1, d2)
    return int(round(float(delta) / 6.0))


def calculate_age(born, today=datetime.today()):
    try:
        birthday = born.replace(year=today.year)
    except ValueError:  # raised when birth date is February 29 and the current year is not a leap year
        birthday = born.replace(year=today.year, month=born.month + 1, day=1)
    if birthday > today:
        return today.year - born.year - 1
    else:
        return today.year - born.year


def calc_avg_grade(examlist):
    grades = 0
    bonussum = 0
    for examid, exam in examlist.iteritems():
        grades += (exam['grade'] * exam['bonus'])
        bonussum += exam['bonus']

    return grades / bonussum if bonussum > 0 else 0.0


def update_stat_dict_by_values(d):
    total_count = sum(d['values'].values())
    if total_count:
        exams_values = [int(x) for x in d['values'] if x != 'None']
        d['min'] = min(exams_values)
        d['max'] = max(exams_values)
        values_sum = [int(x) * c for x, c in d['values'].iteritems() if x != 'None']
        d['mean'] = float(sum(values_sum)) / total_count


def add_to_stat_dict(d, value):
    value_id = str(value)
    if value_id not in d['values']:
        d['values'][value_id] = 1
    else:
        d['values'][value_id] += 1