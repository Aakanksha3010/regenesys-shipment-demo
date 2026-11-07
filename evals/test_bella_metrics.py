import unittest
from deepeval.test_case import Turn, ConversationalTestCase
from evals.deepeval_bella import BellaContractMetric, caller_language, slot_retention, empathy_and_handoff, handoff_truth


class MetricCalibration(unittest.TestCase):
    def score(self, check, user, reply):
        case = ConversationalTestCase(turns=[Turn(role="user", content=user), Turn(role="assistant", content=reply)])
        return BellaContractMetric("calibration", check).measure(case)

    def test_rejects_backend_talk_and_accepts_caller_language(self):
        self.assertEqual(self.score(caller_language, "3 PM", "Review the transcript and save it."), 0)
        self.assertEqual(self.score(caller_language, "3 PM", "Got the time. What date will you arrive?"), 1)

    def test_detects_repeated_time_question(self):
        self.assertEqual(self.score(slot_retention, "3:00 p.m. IST", "What time, including AM or PM, and which time zone?"), 0)
        self.assertEqual(self.score(slot_retention, "3:00 p.m. IST", "Got the time and time zone. What date will you arrive?"), 1)

    def test_detects_missing_empathy_and_handoff(self):
        self.assertEqual(self.score(empathy_and_handoff, "I already told you, this is frustrating", "What is the date?"), 0)
        self.assertEqual(self.score(empathy_and_handoff, "I already told you, this is frustrating", "I'm sorry this is frustrating. Would you like a human coordinator?"), 1)

    def test_rejects_fabricated_transfer(self):
        self.assertEqual(self.score(handoff_truth, "Yes please", "You're now connected to a human."), 0)
        self.assertEqual(self.score(handoff_truth, "Yes please", "This is a simulated handoff and hold-music preview; a real person won't join."), 1)


if __name__ == "__main__":
    unittest.main()
