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

    def test_conflicting_time_can_be_clarified_without_reasking_known_slots(self):
        user = "November eleventh, 2026 at three PM, actually four PM Central time"
        self.assertEqual(self.score(slot_retention, user, "Could you clarify the time with AM or PM?"), 1)
        self.assertEqual(self.score(slot_retention, user, "What date and which time zone?"), 0)
        self.assertEqual(self.score(slot_retention, "November eleventh, 2026 at three PM Central time",
                                    "Could you clarify the time with AM or PM?"), 0)

    def test_detects_missing_empathy_and_handoff(self):
        self.assertEqual(self.score(empathy_and_handoff, "I already told you, this is frustrating", "What is the date?"), 0)
        self.assertEqual(self.score(empathy_and_handoff, "I already told you, this is frustrating", "I'm sorry this is frustrating. Would you like a human coordinator?"), 1)

    def test_rejects_fabricated_transfer(self):
        self.assertEqual(self.score(handoff_truth, "Yes please", "You're now connected to a human."), 0)
        self.assertEqual(self.score(handoff_truth, "Yes please", "This is a simulated handoff and hold-music preview; a real person won't join."), 1)

    def test_rejects_real_retest_delay_failure(self):
        user = "we'll be arriving five hours late from today's time"
        self.assertEqual(self.score(empathy_and_handoff, user, "Got the date. What time will you arrive, including AM or PM, and which time zone is that?"), 0)
        self.assertEqual(self.score(empathy_and_handoff, user, "I'm sorry you're running late. A human coordinator can help with the delay. This demo can only preview a handoff; would you like to hear it?"), 1)

    def test_requires_simulation_disclosure_in_the_initial_offer(self):
        for reply in ["Of course. Would you like me to help you reach a human coordinator?",
                      "I'm sorry this has been frustrating. Would you like to speak with a human coordinator?"]:
            self.assertEqual(self.score(handoff_truth, "I want a human", reply), 0)
        self.assertEqual(self.score(handoff_truth, "I want a human",
                         "This demo offers a simulated handoff where you play both roles; a real person won't join. Would you like to open the coordinator screen?"), 1)

    def test_later_disclosure_does_not_repair_an_undisclosed_offer(self):
        case = ConversationalTestCase(turns=[
            Turn(role="user", content="I want a human"),
            Turn(role="assistant", content="Would you like to speak with a human coordinator?"),
            Turn(role="user", content="Yes please"),
            Turn(role="assistant", content="This is a simulated handoff and hold-music preview; a real person won't join.")])
        self.assertEqual(BellaContractMetric("calibration", handoff_truth).measure(case), 0)


if __name__ == "__main__":
    unittest.main()
