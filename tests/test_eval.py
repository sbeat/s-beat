from unittest import TestCase

from ImportTools import get_import_expressions


class EvalTest(TestCase):
    def test_eval(self):
        result = eval("status in ('BE', 'NB', 'EN', 'RT')", {"status": "BE"})
        self.assertEqual(result, True)

        result = eval("status in ('BE', 'NB', 'EN', 'RT')", {"status": "GE"})
        self.assertEqual(result, False)


    def test_import_expressions(self):
        expressions = get_import_expressions()
        print expressions
