"""
Copyright (c) 2017 S-BEAT GbR and others

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
from datetime import datetime
from unittest import TestCase

import CalcTools


class CalcToolsTest(TestCase):
    def test_semester_delta(self):
        self.assertEqual(CalcTools.semester_delta(datetime(2016, 3, 01), datetime(2017, 2, 28)), 2)
        self.assertEqual(CalcTools.semester_delta(datetime(2016, 3, 01), datetime(2017, 3, 15)), 2)
        self.assertEqual(CalcTools.semester_delta(datetime(2016, 10, 01), datetime(2017, 2, 28)), 1)

