"""Local multi-turn regression metrics, plus opt-in LLM judging.

Input is emitted by the real React UI in Playwright with mocked speech APIs.
These tests measure conversation policy, not microphones or audio quality.
"""
import argparse
import json
import os
import re
from datetime import datetime, timezone
from pathlib import Path

os.environ["DEEPEVAL_TELEMETRY_OPT_OUT"] = "YES"
from deepeval.metrics import BaseConversationalMetric
from deepeval.test_case import ConversationalTestCase, Turn

ROOT = Path(__file__).resolve().parent.parent


class BellaContractMetric(BaseConversationalMetric):
    """A deterministic product requirement, not an LLM or acoustic quality score."""
    def __init__(self, name, check):
        self.label = name
        self.check = check
        self.threshold = 1.0
        self.strict_mode = True
        self.async_mode = False
        self.evaluation_model = "local product rules (no model)"

    def measure(self, test_case, *args, **kwargs):
        failures = self.check(test_case.turns)
        self.score = 0.0 if failures else 1.0
        self.success = not failures
        self.reason = "; ".join(failures) if failures else "All applicable checks passed."
        return self.score

    async def a_measure(self, test_case, *args, **kwargs):
        return self.measure(test_case)

    def is_successful(self):
        return self.success

    @property
    def __name__(self):
        return self.label


def exchanges(turns):
    for index, turn in enumerate(turns[:-1]):
        if turn.role == "user" and turns[index + 1].role == "assistant":
            yield turn.content.lower(), turns[index + 1].content.lower()


def caller_language(turns):
    forbidden = r"transcript|backend|database|review.{0,20}save|cleanliness|healthy,? happy life"
    return [f"Caller heard internal/off-topic wording: {t.content}" for t in turns
            if t.role == "assistant" and re.search(forbidden, t.content, re.I)]


def slot_retention(turns):
    errors = []
    for user, reply in exchanges(turns):
        time = re.search(r"(?:\d{1,2}(?::\d{2})?|three(?: thirty)?)\s*(?:p\.?m\.?|a\.?m\.?)", user)
        zone = re.search(r"\b(?:ist|central time|eastern time|india standard time)\b", user)
        date = re.search(r"\btomorrow\b|\btoday\b|\bnovember\b", user)
        if time and re.search(r"what time|including am or pm|time with am or pm", reply):
            errors.append("Asked again for an already supplied time/AM-PM.")
        if zone and re.search(r"which time zone|what time zone", reply):
            errors.append("Asked again for a supplied supported timezone.")
        if date and "what date" in reply:
            errors.append("Asked again for a supplied date.")
    return errors


def empathy_and_handoff(turns):
    errors = []
    for user, reply in exchanges(turns):
        frustrated = re.search(r"frustrat|already told you|irritated|annoyed", user)
        delay = re.search(r"\bdelay\b|broke down|running late|\b(?:\d+|one|two|three|four|five|six|fifteen|thirty)[ -]+(?:hours?|hrs?|minutes?|mins?)[ -]+late\b", user)
        human = re.search(r"(?:speak|talk).{0,25}(?:human|person|coordinator)", user)
        if frustrated and not re.search(r"sorry|understand|frustrating", reply):
            errors.append("Frustration was not acknowledged.")
        if (frustrated or delay or human) and not re.search(r"human|coordinator", reply):
            errors.append("Delay, frustration, or human request did not receive a human-help offer.")
        if delay and re.search(r"got the date|what time|which time zone|including am or pm", reply):
            errors.append("Reported delay received a slot question instead of immediate human help.")
        if delay and not re.search(r"sorry|understand", reply):
            errors.append("Reported delay was not acknowledged empathetically.")
    return errors


def handoff_truth(turns):
    errors = []
    for turn in turns:
        if turn.role != "assistant":
            continue
        text = turn.content.lower()
        if re.search(r"you(?:'re| are) (?:now )?connected|human (?:has|is) joined|transfer (?:was )?successful", text):
            errors.append("Claimed an unverified live transfer or pickup.")
        if "hold-music" in text and not ("simulated" in text and "won't join" in text):
            errors.append("Hold preview lacked a clear simulation boundary.")
    return errors


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, default=ROOT / "validation/conversations-results.json")
    parser.add_argument("--judge", action="store_true", help="Opt in to paid model evaluation of synthetic text")
    parser.add_argument("--model", help="Explicit evaluator model; required with --judge")
    args = parser.parse_args()
    if args.judge and (not args.model or not os.getenv("OPENAI_API_KEY")):
        parser.error("--judge needs --model and OPENAI_API_KEY in the environment. ElevenLabs is the speech provider, not this judge.")
    loaded = json.loads(args.input.read_text())
    records = [r for r in loaded if any(t["role"] == "user" for t in r["turns"])]
    if not records:
        parser.error("No conversation evidence. Run npm run test:browser first.")
    metrics = [BellaContractMetric(name, fn) for name, fn in [
        ("Caller-facing language", caller_language), ("Retain supplied slots", slot_retention),
        ("Empathy and human help", empathy_and_handoff), ("Truthful simulated handoff", handoff_truth)]]
    if args.judge:
        from deepeval.metrics import KnowledgeRetentionMetric, TurnRelevancyMetric, ConversationalGEval
        from deepeval.test_case import MultiTurnParams
        metrics += [KnowledgeRetentionMetric(model=args.model, threshold=0.8),
                    TurnRelevancyMetric(model=args.model, threshold=0.8),
                    ConversationalGEval(name="Bella empathy and handoff", model=args.model, threshold=0.8,
                        criteria="The shipment coordinator recognizes frustration, responds empathetically, retains known ETA details, asks only for missing details, offers human help for every delay or explicit human request, and never claims a real transfer in this simulation. No caller-facing transcript, save or backend discussion.",
                        evaluation_params=[MultiTurnParams.CONTENT])]
    rows = []
    not_applicable = []
    for record in records:
        case = ConversationalTestCase(turns=[Turn(role=t["role"], content=t["content"]) for t in record["turns"]])
        for metric in metrics:
            user_text = " ".join(t.content for t in case.turns if t.role == "user").lower()
            if isinstance(metric, BellaContractMetric):
                applies = not (
                    (metric.label == "Retain supplied slots" and not re.search(r"p\.?m\.?|a\.?m\.?|tomorrow|november|time zone", user_text)) or
                    (metric.label == "Empathy and human help" and not re.search(r"frustrat|already told you|irritated|annoyed|delay|broke down|late|human", user_text))
                )
                if not applies:
                    not_applicable.append({"conversation": record["name"], "metric": metric.label})
                    continue
            # Standalone measures keep results local; no Confident Cloud upload/login.
            metric.measure(case)
            rows.append({"conversation": record["name"], "metric": metric.__name__,
                         "score": metric.score, "passed": metric.is_successful(), "reason": metric.reason})
    report = {"generatedAt": datetime.now(timezone.utc).isoformat(), "framework": "deepeval 4.3.3",
              "evidence": "React conversation outputs, mocked speech recognition and synthesis; no real audio",
              "conversations": len(records), "checks": len(rows), "passed": sum(r["passed"] for r in rows),
              "notApplicable": len(not_applicable), "excludedWithoutCallerTurn": len(loaded) - len(records),
              "llmJudge": "executed" if args.judge else "NOT RUN: optional evaluator model/key required",
              "audioMetrics": "NOT RUN: real audio, independent transcript reference and timing required", "results": rows}
    destination = ROOT / "validation/deepeval-results.json"
    destination.write_text(json.dumps(report, indent=2))
    lines = ["# Bella conversation evaluations", "", f"Generated {report['generatedAt']}.", "",
             f"DeepEval 4.3.3: {report['passed']}/{report['checks']} {'local contract and model-judged' if args.judge else 'local contract'} checks across {len(records)} browser conversations.",
             f"{len(not_applicable)} non-applicable metric checks excluded; {len(loaded)-len(records)} records without a caller turn excluded.",
             "", report["evidence"] + ".", "", "LLM judge: " + report["llmJudge"] + ".",
             "", "Audio metrics: " + report["audioMetrics"] + ".", "",
             "These deterministic regression checks do not establish general conversational intelligence or acoustic quality.", "",
             "| Conversation | Metric | Result |", "| --- | --- | --- |"]
    lines += [f"| {r['conversation']} | {r['metric']} | {'PASS' if r['passed'] else 'FAIL'} |" for r in rows]
    (ROOT / "validation/CONVERSATION-EVALS.md").write_text("\n".join(lines) + "\n")
    print(json.dumps({k: v for k, v in report.items() if k != "results"}, indent=2))
    raise SystemExit(0 if all(r["passed"] for r in rows) else 1)


if __name__ == "__main__":
    main()
