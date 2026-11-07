# Bella evaluation workflow

## What runs now

1. `npm test`: deterministic interpretation, intent and safety rules, lifecycle, SQL constraints and persistence.
2. `npm run eval`: independently labelled written inputs and state outcomes, including the reported 3 p.m./IST/30-minute-delay regressions.
3. `npm run test:browser`: exercises the actual React conversation flow with controlled speech API doubles. Exports actual assistant prompts and user turns to ignored `validation/conversations-results.json`; assistant replies are not hardcoded expected transcripts.
4. DeepEval 4.3.3 evaluates those multi-turn outputs using local custom metrics for retained details, caller-facing language, empathy/human-help offers and truthful handoff boundaries. The metric implementations have paired known-good/known-bad calibration tests.

Set up an isolated Python **3.12** environment (the installed 4.3.3 package failed to import with macOS Python 3.9 despite its package metadata):

```sh
python3.12 -m venv .venv-evals
.venv-evals/bin/python -m pip install -r evals/requirements.lock.txt
DEEPEVAL_TELEMETRY_OPT_OUT=YES .venv-evals/bin/python -m unittest evals/test_bella_metrics.py
DEEPEVAL_TELEMETRY_OPT_OUT=YES .venv-evals/bin/python evals/deepeval_bella.py
```

Results are written locally to `validation/CONVERSATION-EVALS.md` and ignored JSON. No Confident Cloud account or upload is needed. A deterministic metric passing is not a subjective empathy rating, an audio-quality score, or evidence of general language understanding.

## Optional model judging

The runner also supports `KnowledgeRetentionMetric`, `TurnRelevancyMetric` and a product-specific `ConversationalGEval`. These require a separately configured evaluator model; an ElevenLabs TTS key cannot run them.

```sh
# Set OPENAI_API_KEY privately in your shell; do not put it in a command history or commit it.
.venv-evals/bin/python evals/deepeval_bella.py --judge --model YOUR_SUPPORTED_JUDGE_MODEL
```

This explicitly sends the synthetic test conversation text to the selected judge and incurs its API usage. The proposed 0.8 thresholds need human calibration; they are not validated product acceptance thresholds. The repository does not claim these checks ran without a key.

## Next: dynamic user simulation

The article's useful distinction is that a simulated caller should react to the agent's last reply, rather than always reading a fixed next line. Preserve the fixed regressions above, and add `ConversationSimulator` with scenarios/personas for:

- A cooperative carrier supplies only 3 PM IST, then gives a date when asked.
- Recognition drops IST: the carrier supplies the missing date and zone without being asked to repeat the time.
- A carrier reports a 30-minute delay instead of answering the clarification.
- An irritated caller says the time was already given and requests a person.
- A caller declines human help; the mandatory delay escalation remains for the coordinator.
- A caller supplies uncertain/conflicting dates; no ETA is manufactured.

Dynamic model-generated simulations have **not run**. They need an evaluator/simulator model and an adapter to the agent's conversation session. The current app uses browser recognition plus ElevenLabs TTS; it is not an ElevenLabs Agents deployment. Do not pass the TTS voice ID as an ElevenLabs agent ID or invoke a SIP/phone connector against this demo.

## Audio is separate

See [AUDIO-CHECKS.md](AUDIO-CHECKS.md). `TranscriptionAccuracyMetric` requires intended caller content paired with the recognizer's actual transcript, or independently transcribed per-turn audio. Naturalness, glitches and turn-taking require real audio/timing. Browser mocks contain neither. Never fill missing audio scores with zero or a fabricated pass.

The user accepted Bella's preview as warm and natural on 7 November 2026. That is one subjective observation, not a measured audio benchmark. The repaired conversation still needs a real microphone trial.

## References and license

- [User-supplied conversation evaluation article](https://deepeval.com/blog/how-to-evaluate-conversational-agent)
- [DeepEval repository](https://github.com/confident-ai/deepeval), [Apache-2.0 license](https://github.com/confident-ai/deepeval/blob/main/LICENSE.md)
- [Conversation Simulator](https://deepeval.com/docs/conversation-simulator)
- [Custom multi-turn metrics](https://deepeval.com/docs/metrics-custom)
- [Knowledge retention](https://deepeval.com/docs/metrics-knowledge-retention)
- [Transcription accuracy](https://deepeval.com/docs/metrics-transcription-accuracy)

DeepEval is a pinned optional development dependency. No upstream source was copied into the application; project-specific metrics and prompts are original. Its licensing does not grant rights to third-party voice recordings or remove model API usage costs.
