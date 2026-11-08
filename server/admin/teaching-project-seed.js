'use strict';
/**
 * Seeded defaults for the public research project directory. This is the text that was
 * hard-coded in client/src/components/projects/researchTopics.ts before it moved into the
 * database, so the public site keeps the same content until staff edit it in the panel.
 * Used once by teaching-projects.js#ensureProjectCatalog (idempotent, keyed by seed_key).
 */
const TRACKS = [
  {
    "key": "language",
    "label": "Reliable language AI",
    "description": "Scientific question answering, citation checks, retrieval and evidence control across Bangla and English."
  },
  {
    "key": "climate",
    "label": "Climate and geospatial",
    "description": "Flood, drought and heat mapping evaluated across events, regions and reference uncertainty."
  },
  {
    "key": "systems",
    "label": "Reliable systems and analytics",
    "description": "Sensor failures, federated learning, tabular shift and code or permission audits in deployed systems."
  },
  {
    "key": "vision",
    "label": "Industrial vision",
    "description": "Inspection, anomaly detection and edge deployment under lighting, device and bandwidth shifts."
  }
];

const TOPICS = [
 {
  "code": "T01",
  "slug": "t01-risk-controlled-scientific-answering-under-bangla-english-language-and-topic-shift",
  "track": "language",
  "title": "Risk-Controlled Scientific Answering Under Bangla–English Language and Topic Shift",
  "plain_summary": "Can AI recognize when its Bangla answer is unreliable?",
  "research_question": "Does language-conditional recalibration maintain error control on unseen scientific topics at useful coverage?",
  "planning_label": "advance",
  "pilot": 0,
  "sort_order": 1,
  "detail_sections": [
   {
    "heading": "Closest-work challenge",
    "body": "Abstention and Bangla hallucination are established. Test transfer of a frozen risk threshold, not another generic QA benchmark."
   },
   {
    "heading": "Contribution to test",
    "body": "Compare pooled versus language-conditional calibration; stress units and evidence availability; report conditional failures."
   },
   {
    "heading": "Comparison methods (baselines)",
    "body": "Prompt refusal; confidence threshold; conformal/selective prediction; published abstention approach"
   },
   {
    "heading": "Evaluation and metrics",
    "body": "Risk–coverage; error at fixed coverage; ECE; annotation agreement"
   }
  ],
  "journals": [
   {
    "name": "Expert Systems with Applications",
    "url": "https://www.sciencedirect.com/journal/expert-systems-with-applications",
    "note": "Q1 · Computer Science, Artificial Intelligence. Fit: Applied reliable AI and decision systems. Route: Subscription route candidate."
   },
   {
    "name": "Information Processing & Management",
    "url": "https://www.sciencedirect.com/journal/information-processing-and-management",
    "note": "Q1 · Computer Science, Information Systems. Fit: Evidence verification, retrieval, agents and scientific documents. Route: Subscription route candidate."
   }
  ]
 },
 {
  "code": "T02",
  "slug": "t02-atomic-citation-verification-under-cross-language-evidence-and-technical-qualifier-loss",
  "track": "language",
  "title": "Atomic Citation Verification Under Cross-Language Evidence and Technical Qualifier Loss",
  "plain_summary": "Build a research assistant whose evidence can be checked",
  "research_question": "Can a qualifier-aware verifier reject subtly unsupported scientific claims without rejecting valid translations?",
  "planning_label": "advance",
  "pilot": 1,
  "sort_order": 2,
  "detail_sections": [
   {
    "heading": "Closest-work challenge",
    "body": "ALCE, ALiiCE and CoVeGAT already check citations. Isolate altered units, qualifiers and cross-language attribution."
   },
   {
    "heading": "Contribution to test",
    "body": "Fact/qualifier extraction plus entailment verifier; adversarial minimal edits and natural RAG outputs; expert adjudication."
   },
   {
    "heading": "Comparison methods (baselines)",
    "body": "ALCE citation metrics; ALiiCE atomic decomposition; multilingual NLI; simple lexical model"
   },
   {
    "heading": "Evaluation and metrics",
    "body": "Atomic support precision/recall; false rejection of valid translation; cost per claim"
   }
  ],
  "journals": [
   {
    "name": "Information Processing & Management",
    "url": "https://www.sciencedirect.com/journal/information-processing-and-management",
    "note": "Q1 · Computer Science, Information Systems. Fit: Evidence verification, retrieval, agents and scientific documents. Route: Subscription route candidate."
   },
   {
    "name": "Expert Systems with Applications",
    "url": "https://www.sciencedirect.com/journal/expert-systems-with-applications",
    "note": "Q1 · Computer Science, Artificial Intelligence. Fit: Applied reliable AI and decision systems. Route: Subscription route candidate."
   }
  ]
 },
 {
  "code": "T03",
  "slug": "t03-calibrated-retrieval-recovery-for-romanized-and-code-switched-bangla-scientific-queries",
  "track": "language",
  "title": "Calibrated Retrieval Recovery for Romanized and Code-Switched Bangla Scientific Queries",
  "plain_summary": "Find the right source from the way students actually type",
  "research_question": "When does transliteration recovery improve scientific retrieval without silently changing the question?",
  "planning_label": "reserve",
  "pilot": 0,
  "sort_order": 3,
  "detail_sections": [
   {
    "heading": "Closest-work challenge",
    "body": "Code-switched RAG and Benglish retrieval exist. Target meaning-preserving script changes and recovery under a fixed verification budget."
   },
   {
    "heading": "Contribution to test",
    "body": "Gate query normalization with semantic checks; vary script independently from language mix."
   },
   {
    "heading": "Comparison methods (baselines)",
    "body": "BM25; multilingual dense retriever; normalization-only; R07 language-targeted method"
   },
   {
    "heading": "Evaluation and metrics",
    "body": "Recall/nDCG; semantic preservation; unsupported answer rate; latency"
   }
  ],
  "journals": [
   {
    "name": "Information Processing & Management",
    "url": "https://www.sciencedirect.com/journal/information-processing-and-management",
    "note": "Q1 · Computer Science, Information Systems. Fit: Evidence verification, retrieval, agents and scientific documents. Route: Subscription route candidate."
   }
  ]
 },
 {
  "code": "T04",
  "slug": "t04-necessary-fact-removal-for-evidence-sufficiency-testing-in-bilingual-scientific-rag",
  "track": "language",
  "title": "Necessary-Fact Removal for Evidence-Sufficiency Testing in Bilingual Scientific RAG",
  "plain_summary": "Teach AI to say the documents do not contain the answer",
  "research_question": "Can sufficiency checking transfer across language when relevant entities remain but one required fact is absent?",
  "planning_label": "advance",
  "pilot": 0,
  "sort_order": 4,
  "detail_sections": [
   {
    "heading": "Closest-work challenge",
    "body": "Unanswerability is established. Necessary-fact interventions must eliminate superficial missing-evidence cues."
   },
   {
    "heading": "Contribution to test",
    "body": "Paired sufficient/insufficient contexts with matched length, entities and source; train a small gate."
   },
   {
    "heading": "Comparison methods (baselines)",
    "body": "Always answer; prompt abstain; NLI; published unanswerability/evidence-sufficiency method"
   },
   {
    "heading": "Evaluation and metrics",
    "body": "Unsupported rate at matched coverage; sensitivity by fact type; cost"
   }
  ],
  "journals": [
   {
    "name": "Information Processing & Management",
    "url": "https://www.sciencedirect.com/journal/information-processing-and-management",
    "note": "Q1 · Computer Science, Information Systems. Fit: Evidence verification, retrieval, agents and scientific documents. Route: Subscription route candidate."
   },
   {
    "name": "Expert Systems with Applications",
    "url": "https://www.sciencedirect.com/journal/expert-systems-with-applications",
    "note": "Q1 · Computer Science, Artificial Intelligence. Fit: Applied reliable AI and decision systems. Route: Subscription route candidate."
   }
  ]
 },
 {
  "code": "T05",
  "slug": "t05-condition-preserving-scientific-synthesis-under-conflicting-experimental-evidence",
  "track": "language",
  "title": "Condition-Preserving Scientific Synthesis Under Conflicting Experimental Evidence",
  "plain_summary": "Can an assistant explain why research papers disagree?",
  "research_question": "Does structured condition extraction improve faithful disagreement reporting on unseen studies?",
  "planning_label": "reserve",
  "pilot": 0,
  "sort_order": 5,
  "detail_sections": [
   {
    "heading": "Closest-work challenge",
    "body": "Conflict-aware synthesis exists. Retain experimental conditions rather than collapse findings into consensus."
   },
   {
    "heading": "Contribution to test",
    "body": "Extract population, intervention, setup, outcome; condition graph; citation-constrained synthesis."
   },
   {
    "heading": "Comparison methods (baselines)",
    "body": "Naive RAG; contradiction-aware retrieval; extraction-only; expert summaries"
   },
   {
    "heading": "Evaluation and metrics",
    "body": "Condition completeness; contradiction preservation; citation support; expert agreement"
   }
  ],
  "journals": [
   {
    "name": "Information Processing & Management",
    "url": "https://www.sciencedirect.com/journal/information-processing-and-management",
    "note": "Q1 · Computer Science, Information Systems. Fit: Evidence verification, retrieval, agents and scientific documents. Route: Subscription route candidate."
   },
   {
    "name": "Expert Systems with Applications",
    "url": "https://www.sciencedirect.com/journal/expert-systems-with-applications",
    "note": "Q1 · Computer Science, Artificial Intelligence. Fit: Applied reliable AI and decision systems. Route: Subscription route candidate."
   }
  ]
 },
 {
  "code": "T06",
  "slug": "t06-dimensionally-constrained-verification-of-numerical-claims-across-bangla-and-english",
  "track": "language",
  "title": "Dimensionally Constrained Verification of Numerical Claims Across Bangla and English",
  "plain_summary": "Stop AI from mixing up numbers and units",
  "research_question": "Can symbolic dimension checking reduce plausible but invalid quantitative answers across scripts?",
  "planning_label": "advance",
  "pilot": 1,
  "sort_order": 6,
  "detail_sections": [
   {
    "heading": "Closest-work challenge",
    "body": "Bilingual physics QA already exists. Evaluate a dimension-aware intervention and controlled unit perturbations."
   },
   {
    "heading": "Contribution to test",
    "body": "Quantity parser; unit normalizer; symbolic constraints; independent final answer verification."
   },
   {
    "heading": "Comparison methods (baselines)",
    "body": "Prompt-only; calculator tool; general NLI; parser without dimensional constraints"
   },
   {
    "heading": "Evaluation and metrics",
    "body": "Unit error; exact numeric accuracy with tolerance; invalid-answer acceptance; coverage"
   }
  ],
  "journals": [
   {
    "name": "Expert Systems with Applications",
    "url": "https://www.sciencedirect.com/journal/expert-systems-with-applications",
    "note": "Q1 · Computer Science, Artificial Intelligence. Fit: Applied reliable AI and decision systems. Route: Subscription route candidate."
   },
   {
    "name": "Information Processing & Management",
    "url": "https://www.sciencedirect.com/journal/information-processing-and-management",
    "note": "Q1 · Computer Science, Information Systems. Fit: Evidence verification, retrieval, agents and scientific documents. Route: Subscription route candidate."
   }
  ]
 },
 {
  "code": "T07",
  "slug": "t07-evidence-preserving-context-compression-for-bilingual-technical-question-answering",
  "track": "language",
  "title": "Evidence-Preserving Context Compression for Bilingual Technical Question Answering",
  "plain_summary": "Use fewer AI tokens without deleting the crucial evidence",
  "research_question": "Can compression preserve necessary facts at the same token budget better than relevance-only selection?",
  "planning_label": "reserve",
  "pilot": 0,
  "sort_order": 7,
  "detail_sections": [
   {
    "heading": "Closest-work challenge",
    "body": "Adaptive retrieval and context compression are mature. Focus on loss of necessary numerical/qualifying facts."
   },
   {
    "heading": "Contribution to test",
    "body": "Fact-aware compression with a necessity detector; fixed budgets and independently marked evidence."
   },
   {
    "heading": "Comparison methods (baselines)",
    "body": "Top-k; uniform truncation; Adaptive-k; strong current compressor"
   },
   {
    "heading": "Evaluation and metrics",
    "body": "Evidence survival; answer risk; retrieval cost; token count"
   }
  ],
  "journals": [
   {
    "name": "Information Processing & Management",
    "url": "https://www.sciencedirect.com/journal/information-processing-and-management",
    "note": "Q1 · Computer Science, Information Systems. Fit: Evidence verification, retrieval, agents and scientific documents. Route: Subscription route candidate."
   }
  ]
 },
 {
  "code": "T08",
  "slug": "t08-chart-reasoning-reliability-under-joint-label-language-and-unit-perturbations",
  "track": "language",
  "title": "Chart Reasoning Reliability Under Joint Label-Language and Unit Perturbations",
  "plain_summary": "Can AI read a chart after labels and units change?",
  "research_question": "Are translation and unit-scale shifts compositional, and can structured extraction restore consistency?",
  "planning_label": "reserve",
  "pilot": 0,
  "sort_order": 8,
  "detail_sections": [
   {
    "heading": "Closest-work challenge",
    "body": "ChartQAPro and 2026 chart-robustness studies already exist. Isolate language × scale interaction with validated visual controls."
   },
   {
    "heading": "Contribution to test",
    "body": "Programmatically render charts from licensed tables; factorized shifts; table-first verification."
   },
   {
    "heading": "Comparison methods (baselines)",
    "body": "VLM direct; OCR+LLM; structured parser; ChartQAPro-style evaluation"
   },
   {
    "heading": "Evaluation and metrics",
    "body": "Numerical correctness; interaction effect; calibration; OCR failure breakdown"
   }
  ],
  "journals": [
   {
    "name": "Information Processing & Management",
    "url": "https://www.sciencedirect.com/journal/information-processing-and-management",
    "note": "Q1 · Computer Science, Information Systems. Fit: Evidence verification, retrieval, agents and scientific documents. Route: Subscription route candidate."
   },
   {
    "name": "Pattern Recognition",
    "url": "https://www.sciencedirect.com/journal/pattern-recognition",
    "note": "Q1 · Computer Science, Artificial Intelligence. Fit: Generalizable detection, representation or reliability methodology. Route: Subscription route candidate; stretch target."
   }
  ]
 },
 {
  "code": "T09",
  "slug": "t09-cost-matched-adaptive-retrieval-with-selective-answering-under-source-shift",
  "track": "language",
  "title": "Cost-Matched Adaptive Retrieval With Selective Answering Under Source Shift",
  "plain_summary": "When should a research assistant search again?",
  "research_question": "Does a cheap evidence-gap signal generalize across unfamiliar sources at a fixed inference budget?",
  "planning_label": "reserve",
  "pilot": 0,
  "sort_order": 9,
  "detail_sections": [
   {
    "heading": "Closest-work challenge",
    "body": "2025–2026 adaptive RAG already optimizes budgets. A transferable policy or falsifiable cost–risk finding is needed."
   },
   {
    "heading": "Contribution to test",
    "body": "Train lightweight retrieval/stop/abstain policy; measure actual tokens and calls including failed retrievals."
   },
   {
    "heading": "Comparison methods (baselines)",
    "body": "Fixed-k; Adaptive-RAG; Adaptive-k; strong 2026 budgeted RAG"
   },
   {
    "heading": "Evaluation and metrics",
    "body": "Risk–cost frontier; coverage; wall time; retrieval calls"
   }
  ],
  "journals": [
   {
    "name": "Information Processing & Management",
    "url": "https://www.sciencedirect.com/journal/information-processing-and-management",
    "note": "Q1 · Computer Science, Information Systems. Fit: Evidence verification, retrieval, agents and scientific documents. Route: Subscription route candidate."
   }
  ]
 },
 {
  "code": "T10",
  "slug": "t10-permission-and-evidence-separation-in-multilingual-research-agents",
  "track": "language",
  "title": "Permission and Evidence Separation in Multilingual Research Agents",
  "plain_summary": "Keep a research agent useful while respecting its permissions",
  "research_question": "Can explicit permission enforcement retain benign task completion under cross-language tool-content attacks?",
  "planning_label": "extended",
  "pilot": 0,
  "sort_order": 10,
  "detail_sections": [
   {
    "heading": "Closest-work challenge",
    "body": "AgentDojo-type defences, TRAP and BabelDojo already cover injection. Language variation alone is insufficient."
   },
   {
    "heading": "Contribution to test",
    "body": "Typed action policy; provenance labels; isolated simulated tools; unseen attack-family tests."
   },
   {
    "heading": "Comparison methods (baselines)",
    "body": "Prompt-only defence; tool filters; applicable established containment defence"
   },
   {
    "heading": "Evaluation and metrics",
    "body": "Unauthorized actions; benign completion; false blocks; compute"
   }
  ],
  "journals": [
   {
    "name": "Expert Systems with Applications",
    "url": "https://www.sciencedirect.com/journal/expert-systems-with-applications",
    "note": "Q1 · Computer Science, Artificial Intelligence. Fit: Applied reliable AI and decision systems. Route: Subscription route candidate."
   },
   {
    "name": "Information Processing & Management",
    "url": "https://www.sciencedirect.com/journal/information-processing-and-management",
    "note": "Q1 · Computer Science, Information Systems. Fit: Evidence verification, retrieval, agents and scientific documents. Route: Subscription route candidate."
   }
  ]
 },
 {
  "code": "T11",
  "slug": "t11-budgeted-recalibration-of-industrial-anomaly-detectors-under-unseen-lighting",
  "track": "vision",
  "title": "Budgeted Recalibration of Industrial Anomaly Detectors Under Unseen Lighting",
  "plain_summary": "Inspect products even when factory lighting changes",
  "research_question": "Can nuisance-aware threshold adaptation preserve tiny-defect recall at a specified false-alarm budget?",
  "planning_label": "advance",
  "pilot": 1,
  "sort_order": 11,
  "detail_sections": [
   {
    "heading": "Closest-work challenge",
    "body": "MVTec AD 2 and PIAD explicitly address lighting. New contribution must improve risk under a fixed small calibration set."
   },
   {
    "heading": "Contribution to test",
    "body": "Compare global, condition-aware and uncertainty-weighted thresholds; keep defect labels out of unsupervised calibration."
   },
   {
    "heading": "Comparison methods (baselines)",
    "body": "PatchCore; PIAD where applicable; fixed threshold; test-time adaptation"
   },
   {
    "heading": "Evaluation and metrics",
    "body": "Defect recall at fixed false alarms; AU-PRO; category-wise CI; calibration cost"
   }
  ],
  "journals": [
   {
    "name": "Engineering Applications of Artificial Intelligence",
    "url": "https://www.sciencedirect.com/journal/engineering-applications-of-artificial-intelligence",
    "note": "Q1 · Computer Science, Artificial Intelligence. Fit: Industrial inspection, edge reliability and engineering sensors. Route: Subscription route candidate."
   },
   {
    "name": "Pattern Recognition",
    "url": "https://www.sciencedirect.com/journal/pattern-recognition",
    "note": "Q1 · Computer Science, Artificial Intelligence. Fit: Generalizable detection, representation or reliability methodology. Route: Subscription route candidate; stretch target."
   }
  ]
 },
 {
  "code": "T12",
  "slug": "t12-small-defect-preservation-under-normal-only-domain-adaptation",
  "track": "vision",
  "title": "Small-Defect Preservation Under Normal-Only Domain Adaptation",
  "plain_summary": "Avoid adapting away the very defects you need to detect",
  "research_question": "Can a normal-only adaptation constraint prevent loss of sensitivity to rare small anomalies?",
  "planning_label": "reserve",
  "pilot": 0,
  "sort_order": 12,
  "detail_sections": [
   {
    "heading": "Closest-work challenge",
    "body": "Illumination-robust detection and contaminated training are established. Study adaptation erasure of small defects."
   },
   {
    "heading": "Contribution to test",
    "body": "Freeze local feature anchors; compare adaptation severity; stratify by defect area."
   },
   {
    "heading": "Comparison methods (baselines)",
    "body": "No adaptation; common test-time adaptation; PIAD; contamination-aware baseline"
   },
   {
    "heading": "Evaluation and metrics",
    "body": "Small-defect sensitivity; false alarms; feature drift; category bootstrap CI"
   }
  ],
  "journals": [
   {
    "name": "Engineering Applications of Artificial Intelligence",
    "url": "https://www.sciencedirect.com/journal/engineering-applications-of-artificial-intelligence",
    "note": "Q1 · Computer Science, Artificial Intelligence. Fit: Industrial inspection, edge reliability and engineering sensors. Route: Subscription route candidate."
   },
   {
    "name": "Pattern Recognition",
    "url": "https://www.sciencedirect.com/journal/pattern-recognition",
    "note": "Q1 · Computer Science, Artificial Intelligence. Fit: Generalizable detection, representation or reliability methodology. Route: Subscription route candidate; stretch target."
   }
  ]
 },
 {
  "code": "T13",
  "slug": "t13-label-efficient-real-defect-validation-of-synthetic-anomaly-training",
  "track": "vision",
  "title": "Label-Efficient Real-Defect Validation of Synthetic Anomaly Training",
  "plain_summary": "Know which synthetic defects improve real inspection",
  "research_question": "Can a training-only utility estimator select synthetic defects that transfer to unseen real defect families?",
  "planning_label": "reserve",
  "pilot": 0,
  "sort_order": 13,
  "detail_sections": [
   {
    "heading": "Closest-work challenge",
    "body": "Synthetic anomaly generation is mature. Target selection of harmful synthetic examples without using final real defects."
   },
   {
    "heading": "Contribution to test",
    "body": "Hold out defect families; compare generator confidence versus coverage/feature discrepancy selection."
   },
   {
    "heading": "Comparison methods (baselines)",
    "body": "Real-only; random synthetic mix; Unseen Visual Anomaly Generation"
   },
   {
    "heading": "Evaluation and metrics",
    "body": "Real-defect recall; synthetic selection cost; performance by family"
   }
  ],
  "journals": [
   {
    "name": "Engineering Applications of Artificial Intelligence",
    "url": "https://www.sciencedirect.com/journal/engineering-applications-of-artificial-intelligence",
    "note": "Q1 · Computer Science, Artificial Intelligence. Fit: Industrial inspection, edge reliability and engineering sensors. Route: Subscription route candidate."
   },
   {
    "name": "Pattern Recognition",
    "url": "https://www.sciencedirect.com/journal/pattern-recognition",
    "note": "Q1 · Computer Science, Artificial Intelligence. Fit: Generalizable detection, representation or reliability methodology. Route: Subscription route candidate; stretch target."
   }
  ]
 },
 {
  "code": "T14",
  "slug": "t14-contamination-tolerant-normal-reference-banks-for-industrial-inspection",
  "track": "vision",
  "title": "Contamination-Tolerant Normal Reference Banks for Industrial Inspection",
  "plain_summary": "Detect defects even when the training folder contains bad samples",
  "research_question": "Can reliability-weighted reference selection tolerate contaminated normal data and changed lighting?",
  "planning_label": "reserve",
  "pilot": 0,
  "sort_order": 14,
  "detail_sections": [
   {
    "heading": "Closest-work challenge",
    "body": "WACV 2025 already treats contamination. Need a selective memory-bank contribution under combined shift."
   },
   {
    "heading": "Contribution to test",
    "body": "Robust bank construction; contamination rate stress tests; separate real from injected contamination."
   },
   {
    "heading": "Comparison methods (baselines)",
    "body": "PatchCore; robust trimming; Adaptive Deviation Learning"
   },
   {
    "heading": "Evaluation and metrics",
    "body": "AU-PRO; defect recall; contamination sensitivity; memory"
   }
  ],
  "journals": [
   {
    "name": "Engineering Applications of Artificial Intelligence",
    "url": "https://www.sciencedirect.com/journal/engineering-applications-of-artificial-intelligence",
    "note": "Q1 · Computer Science, Artificial Intelligence. Fit: Industrial inspection, edge reliability and engineering sensors. Route: Subscription route candidate."
   },
   {
    "name": "Pattern Recognition",
    "url": "https://www.sciencedirect.com/journal/pattern-recognition",
    "note": "Q1 · Computer Science, Artificial Intelligence. Fit: Generalizable detection, representation or reliability methodology. Route: Subscription route candidate; stretch target."
   }
  ]
 },
 {
  "code": "T15",
  "slug": "t15-acquisition-aware-few-normal-sample-anomaly-detection",
  "track": "vision",
  "title": "Acquisition-Aware Few-Normal-Sample Anomaly Detection",
  "plain_summary": "Choose the most useful few normal product images",
  "research_question": "Does diversity-based normal sample acquisition improve shift robustness over random selection at equal image count?",
  "planning_label": "reserve",
  "pilot": 0,
  "sort_order": 15,
  "detail_sections": [
   {
    "heading": "Closest-work challenge",
    "body": "Few-shot anomaly detection is crowded. Investigate how a fixed capture budget covers nuisance variation."
   },
   {
    "heading": "Contribution to test",
    "body": "Capture/selection policy over pose and light; annotation-free diversity estimation; held-out acquisition settings."
   },
   {
    "heading": "Comparison methods (baselines)",
    "body": "Random; k-center; pretrained nearest-neighbour; few-shot published detector"
   },
   {
    "heading": "Evaluation and metrics",
    "body": "Risk versus sample budget; coverage of nuisance conditions; latency"
   }
  ],
  "journals": [
   {
    "name": "Engineering Applications of Artificial Intelligence",
    "url": "https://www.sciencedirect.com/journal/engineering-applications-of-artificial-intelligence",
    "note": "Q1 · Computer Science, Artificial Intelligence. Fit: Industrial inspection, edge reliability and engineering sensors. Route: Subscription route candidate."
   },
   {
    "name": "Pattern Recognition",
    "url": "https://www.sciencedirect.com/journal/pattern-recognition",
    "note": "Q1 · Computer Science, Artificial Intelligence. Fit: Generalizable detection, representation or reliability methodology. Route: Subscription route candidate; stretch target."
   }
  ]
 },
 {
  "code": "T16",
  "slug": "t16-defect-sensitive-quantization-of-edge-inspection-models-under-joint-shift",
  "track": "vision",
  "title": "Defect-Sensitive Quantization of Edge Inspection Models Under Joint Shift",
  "plain_summary": "Can a small device still find tiny defects?",
  "research_question": "Do standard quantizers disproportionately remove rare-defect information, and can selective precision recover it?",
  "planning_label": "advance",
  "pilot": 1,
  "sort_order": 16,
  "detail_sections": [
   {
    "heading": "Closest-work challenge",
    "body": "IoT VAD compression has a 2026 benchmark. Isolate model quantization and deployment shift at matched end-to-end latency."
   },
   {
    "heading": "Contribution to test",
    "body": "Mixed-precision/feature sensitivity calibration; real-device profiling; identical inference pipeline."
   },
   {
    "heading": "Comparison methods (baselines)",
    "body": "Uncompressed detector; PTQ; QAT or distillation; small native model"
   },
   {
    "heading": "Evaluation and metrics",
    "body": "Tiny-defect recall; false alarms; p95 latency; peak memory"
   }
  ],
  "journals": [
   {
    "name": "Engineering Applications of Artificial Intelligence",
    "url": "https://www.sciencedirect.com/journal/engineering-applications-of-artificial-intelligence",
    "note": "Q1 · Computer Science, Artificial Intelligence. Fit: Industrial inspection, edge reliability and engineering sensors. Route: Subscription route candidate."
   },
   {
    "name": "Pattern Recognition",
    "url": "https://www.sciencedirect.com/journal/pattern-recognition",
    "note": "Q1 · Computer Science, Artificial Intelligence. Fit: Generalizable detection, representation or reliability methodology. Route: Subscription route candidate; stretch target."
   }
  ]
 },
 {
  "code": "T17",
  "slug": "t17-risk-aware-edge-cloud-inspection-under-bandwidth-interruptions",
  "track": "vision",
  "title": "Risk-Aware Edge–Cloud Inspection Under Bandwidth Interruptions",
  "plain_summary": "Keep inspection reliable when factory internet fails",
  "research_question": "Can a policy trade local inspection, cloud escalation and abstention under intermittent links?",
  "planning_label": "reserve",
  "pilot": 0,
  "sort_order": 17,
  "detail_sections": [
   {
    "heading": "Closest-work challenge",
    "body": "Edge-server compression already studied. Add explicit outages, stale decisions and reject/fallback behaviour."
   },
   {
    "heading": "Contribution to test",
    "body": "Replay network traces; local risk estimate; deferred escalation; controlled fault injection."
   },
   {
    "heading": "Comparison methods (baselines)",
    "body": "Always local; always cloud; fixed quality compression; published IIoT split pipeline"
   },
   {
    "heading": "Evaluation and metrics",
    "body": "Defect recall; deadline misses; bandwidth; p95 delay; reject rate"
   }
  ],
  "journals": [
   {
    "name": "Engineering Applications of Artificial Intelligence",
    "url": "https://www.sciencedirect.com/journal/engineering-applications-of-artificial-intelligence",
    "note": "Q1 · Computer Science, Artificial Intelligence. Fit: Industrial inspection, edge reliability and engineering sensors. Route: Subscription route candidate."
   },
   {
    "name": "Expert Systems with Applications",
    "url": "https://www.sciencedirect.com/journal/expert-systems-with-applications",
    "note": "Q1 · Computer Science, Artificial Intelligence. Fit: Applied reliable AI and decision systems. Route: Subscription route candidate."
   }
  ]
 },
 {
  "code": "T18",
  "slug": "t18-human-review-allocation-for-cost-sensitive-industrial-defect-screening",
  "track": "vision",
  "title": "Human-Review Allocation for Cost-Sensitive Industrial Defect Screening",
  "plain_summary": "Send the right uncertain products to the human inspector",
  "research_question": "Can calibrated selective review reduce missed defects within a fixed human-review budget?",
  "planning_label": "advance",
  "pilot": 0,
  "sort_order": 18,
  "detail_sections": [
   {
    "heading": "Closest-work challenge",
    "body": "Cost-sensitive detection is established. Investigate policy robustness when costs and defect prevalence change."
   },
   {
    "heading": "Contribution to test",
    "body": "Risk–coverage policy and cost sensitivity analysis; optional partner-derived costs with evidence."
   },
   {
    "heading": "Comparison methods (baselines)",
    "body": "Fixed threshold; random review; uncertainty-only review; cost-weighted baseline"
   },
   {
    "heading": "Evaluation and metrics",
    "body": "Defects missed; reviews required; cost curves across plausible assumptions"
   }
  ],
  "journals": [
   {
    "name": "Engineering Applications of Artificial Intelligence",
    "url": "https://www.sciencedirect.com/journal/engineering-applications-of-artificial-intelligence",
    "note": "Q1 · Computer Science, Artificial Intelligence. Fit: Industrial inspection, edge reliability and engineering sensors. Route: Subscription route candidate."
   },
   {
    "name": "Expert Systems with Applications",
    "url": "https://www.sciencedirect.com/journal/expert-systems-with-applications",
    "note": "Q1 · Computer Science, Artificial Intelligence. Fit: Applied reliable AI and decision systems. Route: Subscription route candidate."
   }
  ]
 },
 {
  "code": "T19",
  "slug": "t19-cross-fabric-defect-transfer-under-camera-and-weave-changes",
  "track": "vision",
  "title": "Cross-Fabric Defect Transfer Under Camera and Weave Changes",
  "plain_summary": "Build textile inspection that survives a different fabric",
  "research_question": "Can normal-only calibration transfer across fabric weave/camera combinations without new defect labels?",
  "planning_label": "extended",
  "pilot": 0,
  "sort_order": 19,
  "detail_sections": [
   {
    "heading": "Closest-work challenge",
    "body": "Generic anomaly transfer is mature. Local fabric acquisition can add value only with independent production runs."
   },
   {
    "heading": "Contribution to test",
    "body": "Factorial camera × weave protocol; small permitted target-normal set; failure taxonomy."
   },
   {
    "heading": "Comparison methods (baselines)",
    "body": "Source-only; target-normal recalibration; domain adaptation; patch detector"
   },
   {
    "heading": "Evaluation and metrics",
    "body": "Defect recall by weave; false alarms; target labels used; annotation hours"
   }
  ],
  "journals": [
   {
    "name": "Engineering Applications of Artificial Intelligence",
    "url": "https://www.sciencedirect.com/journal/engineering-applications-of-artificial-intelligence",
    "note": "Q1 · Computer Science, Artificial Intelligence. Fit: Industrial inspection, edge reliability and engineering sensors. Route: Subscription route candidate."
   }
  ]
 },
 {
  "code": "T20",
  "slug": "t20-reliability-audits-of-vision-language-explanations-for-industrial-anomalies",
  "track": "vision",
  "title": "Reliability Audits of Vision-Language Explanations for Industrial Anomalies",
  "plain_summary": "Can an AI explanation point to the actual defect?",
  "research_question": "Can mask-constrained evidence generation reduce unsupported defect explanations across nuisance changes?",
  "planning_label": "reserve",
  "pilot": 0,
  "sort_order": 20,
  "detail_sections": [
   {
    "heading": "Closest-work challenge",
    "body": "VLM reliability and anomaly detection exist. Evaluate explanation grounding instead of fluent descriptions."
   },
   {
    "heading": "Contribution to test",
    "body": "Link pixel evidence to atomic explanations; independent industrial reader ratings."
   },
   {
    "heading": "Comparison methods (baselines)",
    "body": "Direct VLM; detector+captioner; evidence-first captioning"
   },
   {
    "heading": "Evaluation and metrics",
    "body": "Spatial grounding; unsupported attributes; defect detection risk; cost"
   }
  ],
  "journals": [
   {
    "name": "Engineering Applications of Artificial Intelligence",
    "url": "https://www.sciencedirect.com/journal/engineering-applications-of-artificial-intelligence",
    "note": "Q1 · Computer Science, Artificial Intelligence. Fit: Industrial inspection, edge reliability and engineering sensors. Route: Subscription route candidate."
   },
   {
    "name": "Pattern Recognition",
    "url": "https://www.sciencedirect.com/journal/pattern-recognition",
    "note": "Q1 · Computer Science, Artificial Intelligence. Fit: Generalizable detection, representation or reliability methodology. Route: Subscription route candidate; stretch target."
   }
  ]
 },
 {
  "code": "T21",
  "slug": "t21-fixed-annotation-budget-adaptation-for-cross-event-monsoon-flood-mapping",
  "track": "climate",
  "title": "Fixed-Annotation-Budget Adaptation for Cross-Event Monsoon Flood Mapping",
  "plain_summary": "Make flood maps that work beyond one familiar flood",
  "research_question": "Does label-efficient adaptation improve the worst unseen flood event over strong source-only models?",
  "planning_label": "advance",
  "pilot": 1,
  "sort_order": 21,
  "detail_sections": [
   {
    "heading": "Closest-work challenge",
    "body": "Multi-event transfer and Bangladesh conformal mapping exist. Use event-independent adaptation with a fixed annotation budget."
   },
   {
    "heading": "Contribution to test",
    "body": "Event-aware selection and adaptation; compare matched labelled area budgets and permanent-water errors."
   },
   {
    "heading": "Comparison methods (baselines)",
    "body": "Backscatter threshold; U-Net; pretrained segmenter; adaptation comparator"
   },
   {
    "heading": "Evaluation and metrics",
    "body": "Flood IoU/F1; worst-event result; labelled hectares; event-level intervals"
   }
  ],
  "journals": [
   {
    "name": "Journal of Hydrology",
    "url": "https://www.sciencedirect.com/journal/journal-of-hydrology",
    "note": "Q1 · Water Resources. Fit: Hydrologically grounded flood forecasting and mapping. Route: Subscription route candidate."
   },
   {
    "name": "International Journal of Applied Earth Observation and Geoinformation",
    "url": "https://www.sciencedirect.com/journal/international-journal-of-applied-earth-observation-and-geoinformation",
    "note": "Q1 · Geography, Physical. Fit: Cross-event satellite mapping and reference uncertainty. Route: Open-access funding must be verified."
   }
  ]
 },
 {
  "code": "T22",
  "slug": "t22-selective-flood-mapping-under-spatial-and-event-level-calibration-failure",
  "track": "climate",
  "title": "Selective Flood Mapping Under Spatial and Event-Level Calibration Failure",
  "plain_summary": "Show where a flood map should not be trusted",
  "research_question": "Can event-aware recalibration improve selective mapping without claiming unconditional conformal coverage?",
  "planning_label": "reserve",
  "pilot": 0,
  "sort_order": 22,
  "detail_sections": [
   {
    "heading": "Closest-work challenge",
    "body": "Spatial conformal Feni work already exists. Diagnose calibration failure on entirely new events and terrains."
   },
   {
    "heading": "Contribution to test",
    "body": "Spatial blocks plus held-out events; calibrated reject regions; finite-sample sensitivity."
   },
   {
    "heading": "Comparison methods (baselines)",
    "body": "Softmax threshold; ensemble variance; global conformal; spatial conformal"
   },
   {
    "heading": "Evaluation and metrics",
    "body": "Coverage by event/terrain; retained-map IoU; abstained area"
   }
  ],
  "journals": [
   {
    "name": "Journal of Hydrology",
    "url": "https://www.sciencedirect.com/journal/journal-of-hydrology",
    "note": "Q1 · Water Resources. Fit: Hydrologically grounded flood forecasting and mapping. Route: Subscription route candidate."
   },
   {
    "name": "International Journal of Applied Earth Observation and Geoinformation",
    "url": "https://www.sciencedirect.com/journal/international-journal-of-applied-earth-observation-and-geoinformation",
    "note": "Q1 · Geography, Physical. Fit: Cross-event satellite mapping and reference uncertainty. Route: Open-access funding must be verified."
   }
  ]
 },
 {
  "code": "T23",
  "slug": "t23-observation-gap-aware-radar-optical-flood-mapping-across-events",
  "track": "climate",
  "title": "Observation-Gap-Aware Radar–Optical Flood Mapping Across Events",
  "plain_summary": "Map floods when observations are missing",
  "research_question": "Which real acquisition-gap patterns most damage transfer, and can explicit missingness modelling help?",
  "planning_label": "reserve",
  "pilot": 0,
  "sort_order": 23,
  "detail_sections": [
   {
    "heading": "Closest-work challenge",
    "body": "Multisource and terrain-constrained maps are established. Compare sustained sensor gaps and usable-only inference."
   },
   {
    "heading": "Contribution to test",
    "body": "Gap-aware fusion; outage length sweep; distinguish radar from cloud-affected optical data."
   },
   {
    "heading": "Comparison methods (baselines)",
    "body": "Available sensor only; last observation; simple imputation; fusion without gap indicators"
   },
   {
    "heading": "Evaluation and metrics",
    "body": "IoU versus gap; temporal error; uncertainty; recovery after observations resume"
   }
  ],
  "journals": [
   {
    "name": "Journal of Hydrology",
    "url": "https://www.sciencedirect.com/journal/journal-of-hydrology",
    "note": "Q1 · Water Resources. Fit: Hydrologically grounded flood forecasting and mapping. Route: Subscription route candidate."
   },
   {
    "name": "International Journal of Applied Earth Observation and Geoinformation",
    "url": "https://www.sciencedirect.com/journal/international-journal-of-applied-earth-observation-and-geoinformation",
    "note": "Q1 · Geography, Physical. Fit: Cross-event satellite mapping and reference uncertainty. Route: Open-access funding must be verified."
   }
  ]
 },
 {
  "code": "T24",
  "slug": "t24-lead-time-honest-flood-forecast-evaluation-under-delayed-rainfall-observations",
  "track": "climate",
  "title": "Lead-Time-Honest Flood Forecast Evaluation Under Delayed Rainfall Observations",
  "plain_summary": "Predict a flood before it arrives, not after",
  "research_question": "How does a latency-aware forecast differ from a retrospective model at useful warning lead times?",
  "planning_label": "extended",
  "pilot": 0,
  "sort_order": 24,
  "detail_sections": [
   {
    "heading": "Closest-work challenge",
    "body": "Forecasting and warning cost benefit exist. Isolate real-time data delay and retrospective leakage."
   },
   {
    "heading": "Contribution to test",
    "body": "Timestamp every feature by availability; replay delays; calibrate exceedance alerts."
   },
   {
    "heading": "Comparison methods (baselines)",
    "body": "Persistence; seasonal climatology; process-based available model; LSTM/boosted trees"
   },
   {
    "heading": "Evaluation and metrics",
    "body": "Lead-time skill; false alarms; detection delay; calibration"
   }
  ],
  "journals": [
   {
    "name": "Journal of Hydrology",
    "url": "https://www.sciencedirect.com/journal/journal-of-hydrology",
    "note": "Q1 · Water Resources. Fit: Hydrologically grounded flood forecasting and mapping. Route: Subscription route candidate."
   }
  ]
 },
 {
  "code": "T25",
  "slug": "t25-terrain-and-reference-label-sensitivity-in-flood-depth-reconstruction",
  "track": "climate",
  "title": "Terrain and Reference-Label Sensitivity in Flood Depth Reconstruction",
  "plain_summary": "Find how much a flood-depth map depends on its assumptions",
  "research_question": "Which DEM/reference errors dominate depth estimates across distinct flood settings?",
  "planning_label": "extended",
  "pilot": 0,
  "sort_order": 25,
  "detail_sections": [
   {
    "heading": "Closest-work challenge",
    "body": "Terrain constraints and satellite-derived depth uncertainty already published. Test independently measured depths and failure causes."
   },
   {
    "heading": "Contribution to test",
    "body": "Controlled DEM perturbations; multiple reconstruction methods; separate extent and depth uncertainty."
   },
   {
    "heading": "Comparison methods (baselines)",
    "body": "Standard DEM intersection; available hydrodynamic comparator; terrain-aware method"
   },
   {
    "heading": "Evaluation and metrics",
    "body": "Depth MAE; interval coverage; sensitivity; error by terrain"
   }
  ],
  "journals": [
   {
    "name": "Journal of Hydrology",
    "url": "https://www.sciencedirect.com/journal/journal-of-hydrology",
    "note": "Q1 · Water Resources. Fit: Hydrologically grounded flood forecasting and mapping. Route: Subscription route candidate."
   },
   {
    "name": "International Journal of Applied Earth Observation and Geoinformation",
    "url": "https://www.sciencedirect.com/journal/international-journal-of-applied-earth-observation-and-geoinformation",
    "note": "Q1 · Geography, Physical. Fit: Cross-event satellite mapping and reference uncertainty. Route: Open-access funding must be verified."
   }
  ]
 },
 {
  "code": "T26",
  "slug": "t26-decision-sensitive-flood-exposure-mapping-under-reference-and-population-uncertainty",
  "track": "climate",
  "title": "Decision-Sensitive Flood Exposure Mapping Under Reference and Population Uncertainty",
  "plain_summary": "Which flood-map errors change relief priorities?",
  "research_question": "Do mapping improvements change the prioritization of exposed settlements under a fixed response budget?",
  "planning_label": "extended",
  "pilot": 0,
  "sort_order": 26,
  "detail_sections": [
   {
    "heading": "Closest-work challenge",
    "body": "Decision-focused disaster mapping exists. Quantify ranking stability under exposure/reference uncertainty."
   },
   {
    "heading": "Contribution to test",
    "body": "Propagate map/exposure uncertainty; compare robust ranking policies using openly declared decision assumptions."
   },
   {
    "heading": "Comparison methods (baselines)",
    "body": "Area-only ranking; population exposure ranking; uncertainty-agnostic allocation"
   },
   {
    "heading": "Evaluation and metrics",
    "body": "Priority stability; missed exposure; policy regret in simulation"
   }
  ],
  "journals": [
   {
    "name": "Journal of Hydrology",
    "url": "https://www.sciencedirect.com/journal/journal-of-hydrology",
    "note": "Q1 · Water Resources. Fit: Hydrologically grounded flood forecasting and mapping. Route: Subscription route candidate."
   },
   {
    "name": "Expert Systems with Applications",
    "url": "https://www.sciencedirect.com/journal/expert-systems-with-applications",
    "note": "Q1 · Computer Science, Artificial Intelligence. Fit: Applied reliable AI and decision systems. Route: Subscription route candidate."
   }
  ]
 },
 {
  "code": "T27",
  "slug": "t27-cross-season-satellite-drought-indicators-with-honest-crop-stress-validation",
  "track": "climate",
  "title": "Cross-Season Satellite Drought Indicators With Honest Crop-Stress Validation",
  "plain_summary": "Detect crop stress without confusing it with normal seasons",
  "research_question": "Can calibrated multisource indicators distinguish seasonal phenology from independently labelled stress?",
  "planning_label": "extended",
  "pilot": 0,
  "sort_order": 27,
  "detail_sections": [
   {
    "heading": "Closest-work challenge",
    "body": "Cross-year remote-sensing adaptation exists. Crop type labels cannot establish drought stress."
   },
   {
    "heading": "Contribution to test",
    "body": "Seasonal baseline; temporal anomaly model; agronomic confounders and missing-observation checks."
   },
   {
    "heading": "Comparison methods (baselines)",
    "body": "Vegetation-index threshold; seasonal climatology; boosted trees; temporal model"
   },
   {
    "heading": "Evaluation and metrics",
    "body": "Stress sensitivity; false alarms; calibration by season/crop"
   }
  ],
  "journals": [
   {
    "name": "International Journal of Applied Earth Observation and Geoinformation",
    "url": "https://www.sciencedirect.com/journal/international-journal-of-applied-earth-observation-and-geoinformation",
    "note": "Q1 · Geography, Physical. Fit: Cross-event satellite mapping and reference uncertainty. Route: Open-access funding must be verified."
   }
  ]
 },
 {
  "code": "T28",
  "slug": "t28-cross-region-geospatial-model-evaluation-under-spatial-autocorrelation",
  "track": "climate",
  "title": "Cross-Region Geospatial Model Evaluation Under Spatial Autocorrelation",
  "plain_summary": "Stop neighbouring satellite tiles inflating research accuracy",
  "research_question": "Does a method-ranking conclusion survive event, spatial block and acquisition-date separation?",
  "planning_label": "advance",
  "pilot": 1,
  "sort_order": 28,
  "detail_sections": [
   {
    "heading": "Closest-work challenge",
    "body": "Spatial leakage is established, including Feni 2026. Target when leakage reverses adaptation method rankings across datasets."
   },
   {
    "heading": "Contribution to test",
    "body": "Factorized split audit with common tuning budgets; cluster-aware intervals; reproducible split manifests."
   },
   {
    "heading": "Comparison methods (baselines)",
    "body": "Random tiles; spatial blocks; leave-event-out; leave-region-out"
   },
   {
    "heading": "Evaluation and metrics",
    "body": "Ranking reversal; effect size; uncertainty; independent event count"
   }
  ],
  "journals": [
   {
    "name": "International Journal of Applied Earth Observation and Geoinformation",
    "url": "https://www.sciencedirect.com/journal/international-journal-of-applied-earth-observation-and-geoinformation",
    "note": "Q1 · Geography, Physical. Fit: Cross-event satellite mapping and reference uncertainty. Route: Open-access funding must be verified."
   },
   {
    "name": "Expert Systems with Applications",
    "url": "https://www.sciencedirect.com/journal/expert-systems-with-applications",
    "note": "Q1 · Computer Science, Artificial Intelligence. Fit: Applied reliable AI and decision systems. Route: Subscription route candidate."
   }
  ]
 },
 {
  "code": "T29",
  "slug": "t29-annotation-noise-aware-flood-boundary-learning-under-limited-expert-review",
  "track": "climate",
  "title": "Annotation-Noise-Aware Flood Boundary Learning Under Limited Expert Review",
  "plain_summary": "Spend scarce expert labels where flood boundaries are uncertain",
  "research_question": "Can review targeted by disagreement improve independent boundary accuracy at a fixed expert budget?",
  "planning_label": "reserve",
  "pilot": 0,
  "sort_order": 29,
  "detail_sections": [
   {
    "heading": "Closest-work challenge",
    "body": "Flood boundary and uncertainty work exists. Distinguish uncertain reference labels from model uncertainty."
   },
   {
    "heading": "Contribution to test",
    "body": "Multi-annotator boundary subset; label-noise model; active review policy."
   },
   {
    "heading": "Comparison methods (baselines)",
    "body": "Random review; uncertainty sampling; robust loss; no correction"
   },
   {
    "heading": "Evaluation and metrics",
    "body": "Boundary F1; label agreement; expert minutes; worst-event error"
   }
  ],
  "journals": [
   {
    "name": "International Journal of Applied Earth Observation and Geoinformation",
    "url": "https://www.sciencedirect.com/journal/international-journal-of-applied-earth-observation-and-geoinformation",
    "note": "Q1 · Geography, Physical. Fit: Cross-event satellite mapping and reference uncertainty. Route: Open-access funding must be verified."
   },
   {
    "name": "Journal of Hydrology",
    "url": "https://www.sciencedirect.com/journal/journal-of-hydrology",
    "note": "Q1 · Water Resources. Fit: Hydrologically grounded flood forecasting and mapping. Route: Subscription route candidate."
   }
  ]
 },
 {
  "code": "T30",
  "slug": "t30-cross-district-urban-surface-heat-transfer-with-explicit-exposure-limits",
  "track": "climate",
  "title": "Cross-District Urban Surface-Heat Transfer With Explicit Exposure Limits",
  "plain_summary": "Study urban heat without confusing ground temperature and personal risk",
  "research_question": "Can surface-temperature predictions generalize across cities, and where do air-temperature claims fail?",
  "planning_label": "extended",
  "pilot": 0,
  "sort_order": 30,
  "detail_sections": [
   {
    "heading": "Closest-work challenge",
    "body": "Satellite heat mapping is mature. Test cross-district transfer and the measurement gap explicitly."
   },
   {
    "heading": "Contribution to test",
    "body": "Scene/time transfer study; calibrated surface estimates; separate analysis of independently observed air temperature."
   },
   {
    "heading": "Comparison methods (baselines)",
    "body": "Land-cover regression; boosted trees; spatial interpolation; domain adaptation"
   },
   {
    "heading": "Evaluation and metrics",
    "body": "Surface RMSE; interval coverage; district/time failure; air/surface discrepancy"
   }
  ],
  "journals": [
   {
    "name": "International Journal of Applied Earth Observation and Geoinformation",
    "url": "https://www.sciencedirect.com/journal/international-journal-of-applied-earth-observation-and-geoinformation",
    "note": "Q1 · Geography, Physical. Fit: Cross-event satellite mapping and reference uncertainty. Route: Open-access funding must be verified."
   }
  ]
 },
 {
  "code": "T31",
  "slug": "t31-maintenance-decisions-under-persistent-and-operating-condition-dependent-sensor-failures",
  "track": "systems",
  "title": "Maintenance Decisions Under Persistent and Operating-Condition-Dependent Sensor Failures",
  "plain_summary": "Make maintenance predictions survive broken sensors",
  "research_question": "Can a missingness-aware policy reduce premature/late maintenance across held-out operating conditions?",
  "planning_label": "reserve",
  "pilot": 0,
  "sort_order": 31,
  "detail_sections": [
   {
    "heading": "Closest-work challenge",
    "body": "RESS 2025 already combines missing/faulty sensors and uncertainty. Add realistic persistent outages and decision robustness."
   },
   {
    "heading": "Contribution to test",
    "body": "Structured outage generator; uncertainty-aware RUL; sensitivity over explicit maintenance costs."
   },
   {
    "heading": "Comparison methods (baselines)",
    "body": "Imputation+LSTM; missingness mask; R25 comparator; simple degradation model"
   },
   {
    "heading": "Evaluation and metrics",
    "body": "RUL MAE; interval coverage; late-maintenance rate; cost sensitivity"
   }
  ],
  "journals": [
   {
    "name": "Reliability Engineering & System Safety",
    "url": "https://www.sciencedirect.com/journal/reliability-engineering-and-system-safety",
    "note": "Q1 · Engineering, Industrial. Fit: Sensor-failure maintenance and system-level decision risk. Route: Subscription route candidate."
   },
   {
    "name": "Engineering Applications of Artificial Intelligence",
    "url": "https://www.sciencedirect.com/journal/engineering-applications-of-artificial-intelligence",
    "note": "Q1 · Computer Science, Artificial Intelligence. Fit: Industrial inspection, edge reliability and engineering sensors. Route: Subscription route candidate."
   }
  ]
 },
 {
  "code": "T32",
  "slug": "t32-device-heterogeneity-aware-federated-learning-under-unequal-participation-budgets",
  "track": "systems",
  "title": "Device-Heterogeneity-Aware Federated Learning Under Unequal Participation Budgets",
  "plain_summary": "Train collaboratively when devices have different limits",
  "research_question": "Can participation-aware aggregation improve worst-client performance at equal device and communication budgets?",
  "planning_label": "reserve",
  "pilot": 0,
  "sort_order": 32,
  "detail_sections": [
   {
    "heading": "Closest-work challenge",
    "body": "Robust/fair federated learning is mature. Fixed wall-time and communication budgets must include skipped clients."
   },
   {
    "heading": "Contribution to test",
    "body": "Control compute/network heterogeneity; weighted aggregation with clear objective and fairness limitations."
   },
   {
    "heading": "Comparison methods (baselines)",
    "body": "FedAvg; FedProx; strong robust/personalized method; source profile comparator"
   },
   {
    "heading": "Evaluation and metrics",
    "body": "Worst-client accuracy; rounds; bytes; wall time; participation distribution"
   }
  ],
  "journals": [
   {
    "name": "Expert Systems with Applications",
    "url": "https://www.sciencedirect.com/journal/expert-systems-with-applications",
    "note": "Q1 · Computer Science, Artificial Intelligence. Fit: Applied reliable AI and decision systems. Route: Subscription route candidate."
   },
   {
    "name": "Engineering Applications of Artificial Intelligence",
    "url": "https://www.sciencedirect.com/journal/engineering-applications-of-artificial-intelligence",
    "note": "Q1 · Computer Science, Artificial Intelligence. Fit: Industrial inspection, edge reliability and engineering sensors. Route: Subscription route candidate."
   }
  ]
 },
 {
  "code": "T33",
  "slug": "t33-corruption-aware-federated-model-evaluation-with-client-and-feature-shift",
  "track": "systems",
  "title": "Corruption-Aware Federated Model Evaluation With Client and Feature Shift",
  "plain_summary": "Keep collaborative models reliable when client data changes",
  "research_question": "Can corruption detection improve utility under jointly changing clients/features at equal communication cost?",
  "planning_label": "reserve",
  "pilot": 0,
  "sort_order": 33,
  "detail_sections": [
   {
    "heading": "Closest-work challenge",
    "body": "Edge corruption detection and robust FL already published by prospective mentors. Seek unseen-corruption transfer beyond their existing methods."
   },
   {
    "heading": "Contribution to test",
    "body": "Hold out corruption families; selective client update; compare detected versus actual corruption."
   },
   {
    "heading": "Comparison methods (baselines)",
    "body": "FedAvg; robust aggregation; mentor-provided recent corruption detector"
   },
   {
    "heading": "Evaluation and metrics",
    "body": "Worst-client utility; false exclusions; communication; attack/corruption success"
   }
  ],
  "journals": [
   {
    "name": "Expert Systems with Applications",
    "url": "https://www.sciencedirect.com/journal/expert-systems-with-applications",
    "note": "Q1 · Computer Science, Artificial Intelligence. Fit: Applied reliable AI and decision systems. Route: Subscription route candidate."
   },
   {
    "name": "Engineering Applications of Artificial Intelligence",
    "url": "https://www.sciencedirect.com/journal/engineering-applications-of-artificial-intelligence",
    "note": "Q1 · Computer Science, Artificial Intelligence. Fit: Industrial inspection, edge reliability and engineering sensors. Route: Subscription route candidate."
   }
  ]
 },
 {
  "code": "T34",
  "slug": "t34-sensor-subset-reliability-for-cross-subject-activity-and-equipment-recognition",
  "track": "systems",
  "title": "Sensor-Subset Reliability for Cross-Subject Activity and Equipment Recognition",
  "plain_summary": "Keep recognition working when a sensor goes offline",
  "research_question": "Does uncertainty-guided sensor-subset selection transfer to unseen people/devices or operating states?",
  "planning_label": "reserve",
  "pilot": 0,
  "sort_order": 34,
  "detail_sections": [
   {
    "heading": "Closest-work challenge",
    "body": "Missing-sensor uncertainty is established. Test structured missing modalities and distribution-shift interaction."
   },
   {
    "heading": "Contribution to test",
    "body": "Mask-aware fusion; frozen training-only sensor selection; no-subset-leakage evaluation."
   },
   {
    "heading": "Comparison methods (baselines)",
    "body": "Single sensor; imputation; subset ensemble; mask-aware network"
   },
   {
    "heading": "Evaluation and metrics",
    "body": "Macro-F1; calibration; performance by dropout pattern; latency"
   }
  ],
  "journals": [
   {
    "name": "Engineering Applications of Artificial Intelligence",
    "url": "https://www.sciencedirect.com/journal/engineering-applications-of-artificial-intelligence",
    "note": "Q1 · Computer Science, Artificial Intelligence. Fit: Industrial inspection, edge reliability and engineering sensors. Route: Subscription route candidate."
   },
   {
    "name": "Expert Systems with Applications",
    "url": "https://www.sciencedirect.com/journal/expert-systems-with-applications",
    "note": "Q1 · Computer Science, Artificial Intelligence. Fit: Applied reliable AI and decision systems. Route: Subscription route candidate."
   }
  ]
 },
 {
  "code": "T35",
  "slug": "t35-drift-aware-energy-forecasting-under-feature-loss-and-production-regime-change",
  "track": "systems",
  "title": "Drift-Aware Energy Forecasting Under Feature Loss and Production Regime Change",
  "plain_summary": "Forecast energy use after the working schedule changes",
  "research_question": "Can drift detection and selective retraining improve forecasts when features disappear and schedules change?",
  "planning_label": "reserve",
  "pilot": 0,
  "sort_order": 35,
  "detail_sections": [
   {
    "heading": "Closest-work challenge",
    "body": "Temporal tabular shifts and load uncertainty are established. Need authentic schedule/regime evidence."
   },
   {
    "heading": "Contribution to test",
    "body": "Chronological replay; retraining trigger; compare complete/limited feature sets at equal compute."
   },
   {
    "heading": "Comparison methods (baselines)",
    "body": "Seasonal naive; LightGBM/CatBoost; temporal model; fixed retraining"
   },
   {
    "heading": "Evaluation and metrics",
    "body": "MAE; pinball loss; coverage; retraining cost"
   }
  ],
  "journals": [
   {
    "name": "Expert Systems with Applications",
    "url": "https://www.sciencedirect.com/journal/expert-systems-with-applications",
    "note": "Q1 · Computer Science, Artificial Intelligence. Fit: Applied reliable AI and decision systems. Route: Subscription route candidate."
   },
   {
    "name": "Engineering Applications of Artificial Intelligence",
    "url": "https://www.sciencedirect.com/journal/engineering-applications-of-artificial-intelligence",
    "note": "Q1 · Computer Science, Artificial Intelligence. Fit: Industrial inspection, edge reliability and engineering sensors. Route: Subscription route candidate."
   }
  ]
 },
 {
  "code": "T36",
  "slug": "t36-information-availability-audits-for-llm-generated-analytical-code",
  "track": "systems",
  "title": "Information-Availability Audits for LLM-Generated Analytical Code",
  "plain_summary": "Can AI code quietly leak tomorrow into today?",
  "research_question": "Can static and dynamic availability checks detect leakage missed by ordinary code tests?",
  "planning_label": "advance",
  "pilot": 0,
  "sort_order": 36,
  "detail_sections": [
   {
    "heading": "Closest-work challenge",
    "body": "Agent reproduction and SE test generation exist. Audit whether generated pipelines obey prediction-time availability."
   },
   {
    "heading": "Contribution to test",
    "body": "Label feature availability; inject temporal/proxy faults; evaluate automatic gate and human-reviewed natural outputs."
   },
   {
    "heading": "Comparison methods (baselines)",
    "body": "Unit tests only; linting; LLM review; manual audit; CORE-related tasks"
   },
   {
    "heading": "Evaluation and metrics",
    "body": "Leak detection precision/recall; false blocks; model inflation removed; runtime"
   }
  ],
  "journals": [
   {
    "name": "Expert Systems with Applications",
    "url": "https://www.sciencedirect.com/journal/expert-systems-with-applications",
    "note": "Q1 · Computer Science, Artificial Intelligence. Fit: Applied reliable AI and decision systems. Route: Subscription route candidate."
   },
   {
    "name": "Information Processing & Management",
    "url": "https://www.sciencedirect.com/journal/information-processing-and-management",
    "note": "Q1 · Computer Science, Information Systems. Fit: Evidence verification, retrieval, agents and scientific documents. Route: Subscription route candidate."
   }
  ]
 },
 {
  "code": "T37",
  "slug": "t37-execution-verified-geospatial-question-answering-under-tool-and-schema-changes",
  "track": "systems",
  "title": "Execution-Verified Geospatial Question Answering Under Tool and Schema Changes",
  "plain_summary": "Make map assistants verify their answers with actual calculations",
  "research_question": "Can typed tool contracts and execution checks prevent silent errors after map schema changes?",
  "planning_label": "extended",
  "pilot": 0,
  "sort_order": 37,
  "detail_sections": [
   {
    "heading": "Closest-work challenge",
    "body": "MapEval, MapAgent and CODESIM already exist among candidates. Need a distinct verified execution mechanism."
   },
   {
    "heading": "Contribution to test",
    "body": "Schema perturbations; typed tool outputs; executable reference queries; controlled agent fallback."
   },
   {
    "heading": "Comparison methods (baselines)",
    "body": "Direct LLM; map-tool agent; retry-only; contract checking"
   },
   {
    "heading": "Evaluation and metrics",
    "body": "Verified task success; unauthorized actions; tool calls; robustness by schema"
   }
  ],
  "journals": [
   {
    "name": "Information Processing & Management",
    "url": "https://www.sciencedirect.com/journal/information-processing-and-management",
    "note": "Q1 · Computer Science, Information Systems. Fit: Evidence verification, retrieval, agents and scientific documents. Route: Subscription route candidate."
   },
   {
    "name": "Expert Systems with Applications",
    "url": "https://www.sciencedirect.com/journal/expert-systems-with-applications",
    "note": "Q1 · Computer Science, Artificial Intelligence. Fit: Applied reliable AI and decision systems. Route: Subscription route candidate."
   }
  ]
 },
 {
  "code": "T38",
  "slug": "t38-budget-constrained-tabular-adaptation-under-coupled-temporal-and-feature-shift",
  "track": "systems",
  "title": "Budget-Constrained Tabular Adaptation Under Coupled Temporal and Feature Shift",
  "plain_summary": "Keep useful predictions when both time and available data change",
  "research_question": "Can a simple policy identify when recalibration, retraining or abstention is the best budgeted action?",
  "planning_label": "reserve",
  "pilot": 0,
  "sort_order": 38,
  "detail_sections": [
   {
    "heading": "Closest-work challenge",
    "body": "TabFSBench and temporal tabular methods exist. Test joint shifts under fixed retraining and labelling budgets."
   },
   {
    "heading": "Contribution to test",
    "body": "Coupled shift protocol; train-only policy; strong simple models and deep tabular comparator."
   },
   {
    "heading": "Comparison methods (baselines)",
    "body": "CatBoost/LightGBM; TabFSBench methods; temporal embeddings; fixed update"
   },
   {
    "heading": "Evaluation and metrics",
    "body": "Calibration; AUROC/F1; update cost; abstention coverage; worst-domain result"
   }
  ],
  "journals": [
   {
    "name": "Expert Systems with Applications",
    "url": "https://www.sciencedirect.com/journal/expert-systems-with-applications",
    "note": "Q1 · Computer Science, Artificial Intelligence. Fit: Applied reliable AI and decision systems. Route: Subscription route candidate."
   }
  ]
 },
 {
  "code": "T39",
  "slug": "t39-predictor-availability-and-duplicate-group-leakage-in-educational-ai",
  "track": "systems",
  "title": "Predictor Availability and Duplicate-Group Leakage in Educational AI",
  "plain_summary": "Find which student-prediction results survive a fair test",
  "research_question": "Does an availability/duplicate audit change intervention-relevant predictions across independent cohorts?",
  "planning_label": "reserve",
  "pilot": 0,
  "sort_order": 39,
  "detail_sections": [
   {
    "heading": "Closest-work challenge",
    "body": "October 2026 leakage-aware education benchmark is a close precedent. Study prediction-time availability across more genuine cohorts."
   },
   {
    "heading": "Contribution to test",
    "body": "Feature availability ledger; group disjoint splits; matched tuning; explicit audit intervention."
   },
   {
    "heading": "Comparison methods (baselines)",
    "body": "Leakage-aware R29 setup; simple trees; logistic regression; tabular neural model"
   },
   {
    "heading": "Evaluation and metrics",
    "body": "Inflation removed; cohort transfer; calibration; target-proxy detection"
   }
  ],
  "journals": [
   {
    "name": "Expert Systems with Applications",
    "url": "https://www.sciencedirect.com/journal/expert-systems-with-applications",
    "note": "Q1 · Computer Science, Artificial Intelligence. Fit: Applied reliable AI and decision systems. Route: Subscription route candidate."
   }
  ]
 },
 {
  "code": "T40",
  "slug": "t40-utility-preserving-security-tests-for-ai-tools-under-changing-permissions",
  "track": "systems",
  "title": "Utility-Preserving Security Tests for AI Tools Under Changing Permissions",
  "plain_summary": "Measure whether AI safety checks block useful work",
  "research_question": "Can policy checks remain effective when a task legitimately changes its authorized action scope?",
  "planning_label": "extended",
  "pilot": 0,
  "sort_order": 40,
  "detail_sections": [
   {
    "heading": "Closest-work challenge",
    "body": "Security–utility evaluation exists. Need explicit permission-state changes and reproducible tool semantics."
   },
   {
    "heading": "Contribution to test",
    "body": "State-machine permissions; labelled benign/forbidden actions; held-out changes and attack families."
   },
   {
    "heading": "Comparison methods (baselines)",
    "body": "Prompt-only; static allowlist; established containment; semantic permission checker"
   },
   {
    "heading": "Evaluation and metrics",
    "body": "Violation rate; legitimate completion; false blocks; latency"
   }
  ],
  "journals": [
   {
    "name": "Expert Systems with Applications",
    "url": "https://www.sciencedirect.com/journal/expert-systems-with-applications",
    "note": "Q1 · Computer Science, Artificial Intelligence. Fit: Applied reliable AI and decision systems. Route: Subscription route candidate."
   },
   {
    "name": "Information Processing & Management",
    "url": "https://www.sciencedirect.com/journal/information-processing-and-management",
    "note": "Q1 · Computer Science, Information Systems. Fit: Evidence verification, retrieval, agents and scientific documents. Route: Subscription route candidate."
   }
  ]
 }
];

module.exports = { TRACKS, TOPICS };
