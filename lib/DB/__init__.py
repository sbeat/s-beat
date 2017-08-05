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

from Db import *
from Settings import Settings
from Query import Query
from Condition import Condition
from PathElement import PathElement
from Course import Course
from Student import Student
from Applicant import Applicant
from Path import Path
from ExamInfo import ExamInfo
from Exam import Exam
from ProcessTracking import ProcessTracking
from MarkedStudent import MarkedStudent
from CourseSemesterInfo import CourseSemesterInfo
from MetaData import MetaData
from MarkedList import MarkedList
from UserLog import UserLog


def enable_temp_data():
    Course.db_setprefix('temp_')
    Exam.db_setprefix('temp_')
    ExamInfo.db_setprefix('temp_')
    Path.db_setprefix('temp_')
    Student.db_setprefix('temp_')
    Applicant.db_setprefix('temp_')
    CourseSemesterInfo.db_setprefix('temp_')
    MetaData.db_setprefix('temp_')


def disable_temp_data():
    Course.db_setprefix('')
    Exam.db_setprefix('')
    ExamInfo.db_setprefix('')
    Path.db_setprefix('')
    Student.db_setprefix('')
    Applicant.db_setprefix('')
    CourseSemesterInfo.db_setprefix('')
    MetaData.db_setprefix('')


def swap_temp_to_op():
    enable_temp_data()
    Course.get_collection().rename('courses', dropTarget=True)
    Exam.get_collection().rename('exams', dropTarget=True)
    ExamInfo.get_collection().rename('examInfos', dropTarget=True)
    Path.get_collection().rename('paths', dropTarget=True)
    Student.get_collection().rename('students', dropTarget=True)
    Applicant.get_collection().rename('applicants', dropTarget=True)
    CourseSemesterInfo.get_collection().rename('courseSemesterInfos', dropTarget=True)
    MetaData.get_collection().rename('metadata', dropTarget=True)
    disable_temp_data()
