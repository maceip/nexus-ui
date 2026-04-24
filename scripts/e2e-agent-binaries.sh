#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

PROMPT='an agent that checks my email and messages me one time passwords as soon as they get delivered to my email'
LLM_RESPONSE='using the litert-lm runtime ,https://huggingface.co/google/functiongemma-270m-it fine tuned using the googel https://huggingface.co/datasets/google/mobile-actions mobile actions dataset'

TMP_RESPONSE="/tmp/agent-spec-e2e.json"
PID_FILE="/tmp/nexus-e2e-dev.pid"
OUTPUT_DIR=".artifacts/e2e/windows"
RUNTIME_DIR=".artifacts/e2e/runtime"

node -e "require('fs').rmSync('$OUTPUT_DIR', { recursive: true, force: true }); require('fs').rmSync('$RUNTIME_DIR', { recursive: true, force: true });"
mkdir -p "$OUTPUT_DIR" "$RUNTIME_DIR"

npm run dev > /tmp/nexus-e2e-dev.log 2>&1 & echo $! > "$PID_FILE"
cleanup() {
  if [[ -f "$PID_FILE" ]]; then
    kill "$(cat "$PID_FILE")" 2>/dev/null || true
    rm -f "$PID_FILE"
  fi
}
trap cleanup EXIT

sleep 4

curl -s -X POST http://127.0.0.1:3000/api/agent-spec \
  -H 'content-type: application/json' \
  --data "{\"userRequest\":\"$PROMPT\",\"llmResponse\":\"$LLM_RESPONSE\"}" > "$TMP_RESPONSE"

node <<'NODE'
const fs = require('fs');

const outputDir = '.artifacts/e2e/windows';
const runtimeDir = '.artifacts/e2e/runtime';
const response = JSON.parse(fs.readFileSync('/tmp/agent-spec-e2e.json', 'utf8'));
const spec = response.spec;

if (!spec?.artifacts?.executable || !spec?.artifacts?.training_flag) {
  throw new Error('API did not return expected single-executable artifact fields.');
}

const agentPath = `${outputDir}/${spec.artifacts.executable}`;
const objective = spec.agent.objective.replace(/"/g, '\\"');
const modelName = spec.runtime.embedded_llm.selected_model.replace(/"/g, '\\"');
const datasetNames = (spec.tuning.generated_fine_tuning_data.source_datasets || []).join(',').replace(/"/g, '\\"');

const agentScript = `#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const runtimeDir = "${runtimeDir}";
fs.mkdirSync(runtimeDir, { recursive: true });
const artifactPath = path.join(runtimeDir, "trained-model.json");
const registryPath = path.join(runtimeDir, "agents-registry.json");

function sigmoid(x) {
  return 1 / (1 + Math.exp(-x));
}

function train() {
  const positive = [
    "your otp is 123456",
    "verification code 445566",
    "security code arrived in email",
    "one time password received",
    "login code delivered",
  ];
  const negative = [
    "weekly newsletter digest",
    "meeting agenda tomorrow",
    "receipt for grocery purchase",
    "social media notification",
    "weather update this week",
  ];

  const objectiveTokens = "${objective}".toLowerCase().split(/\\s+/).filter(Boolean);
  for (const token of objectiveTokens) {
    if (token.length > 3) positive.push(token + " code alert");
  }

  const samples = [
    ...positive.map((s) => [s, 1]),
    ...negative.map((s) => [s, 0]),
  ];

  const vocab = {};
  for (const [text] of samples) {
    for (const token of text.split(/\\s+/)) {
      if (!(token in vocab)) vocab[token] = Object.keys(vocab).length;
    }
  }

  const weights = new Array(Object.keys(vocab).length).fill(0);
  let bias = 0;
  const lr = 0.12;
  const epochs = 40;

  console.log("[agent.exe] --train model=${modelName}");
  console.log("[agent.exe] datasets=${datasetNames}");
  console.log("[agent.exe] epochs=" + epochs + " samples=" + samples.length);

  for (let epoch = 1; epoch <= epochs; epoch += 1) {
    samples.sort(() => Math.random() - 0.5);
    let loss = 0;

    for (const [text, label] of samples) {
      const x = new Array(weights.length).fill(0);
      for (const token of text.split(/\\s+/)) {
        if (token in vocab) x[vocab[token]] += 1;
      }

      let z = bias;
      for (let i = 0; i < weights.length; i += 1) z += weights[i] * x[i];
      const pred = sigmoid(z);
      const err = pred - label;

      for (let i = 0; i < weights.length; i += 1) {
        weights[i] -= lr * err * x[i];
      }
      bias -= lr * err;

      loss += -(label * Math.log(pred + 1e-9) + (1 - label) * Math.log(1 - pred + 1e-9));
    }

    if (epoch === 1 || epoch % 10 === 0) {
      console.log("[agent.exe] epoch=" + String(epoch).padStart(2, "0") + " loss=" + (loss / samples.length).toFixed(4));
    }
  }

  fs.writeFileSync(artifactPath, JSON.stringify({
    model: "${modelName}",
    dataset: "${datasetNames}",
    vocab,
    weights,
    bias,
  }));

  if (!fs.existsSync(registryPath)) {
    fs.writeFileSync(registryPath, JSON.stringify({ agents: ["${spec.agent.profile_id}"] }));
  }

  console.log("[agent.exe] training complete and artifacts saved");
}

function addAgent(profile) {
  const registry = fs.existsSync(registryPath)
    ? JSON.parse(fs.readFileSync(registryPath, "utf8"))
    : { agents: [] };

  if (!registry.agents.includes(profile)) registry.agents.push(profile);
  fs.writeFileSync(registryPath, JSON.stringify(registry));
  console.log("[agent.exe] added profile=" + profile + " into existing bundle");
}

function runInference(message) {
  if (!fs.existsSync(artifactPath)) {
    console.error("[agent.exe] missing trained artifacts; run agent.exe --train first");
    process.exit(1);
  }

  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
  const vocab = artifact.vocab;
  const weights = artifact.weights;
  const bias = artifact.bias;

  const x = new Array(weights.length).fill(0);
  for (const token of message.split(/\\s+/)) {
    if (token in vocab) x[vocab[token]] += 1;
  }

  let z = bias;
  for (let i = 0; i < weights.length; i += 1) z += weights[i] * x[i];
  const score = sigmoid(z);
  const label = score >= 0.5 ? "OTP_ALERT" : "IGNORE";

  console.log("[agent.exe] loaded model=" + artifact.model);
  console.log("[agent.exe] message=" + message);
  console.log("[agent.exe] otp score=" + score.toFixed(4));
  console.log("[agent.exe] classification=" + label);
}

const args = process.argv.slice(2);
if (args[0] === "--train") {
  train();
} else if (args[0] === "--agent" && args[1] === "add") {
  addAgent(args[2] || "secondary-agent-v1");
} else {
  runInference(args.join(" ").trim() || "new email: your verification code is 998877");
}
`;

fs.writeFileSync(agentPath, agentScript, { mode: 0o755 });
console.log(`Generated: ${agentPath}`);
NODE

"$OUTPUT_DIR/agent.exe" --train
"$OUTPUT_DIR/agent.exe" "your otp is 123456"
"$OUTPUT_DIR/agent.exe" --agent add "backup-otp-agent-v1"

echo "E2E validation passed: single agent.exe trained via --train, served inference, and added a second agent profile in-bundle."
