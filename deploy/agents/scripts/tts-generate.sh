#!/bin/bash
set -euo pipefail

# Generate Georgian TTS audio using Piper's ka_GE-natia-medium voice,
# converted to opus/ogg for compact web delivery.
#
# Usage:
#   /scripts/tts-generate.sh "<Georgian text>" <output.ogg>
#
# Example:
#   /scripts/tts-generate.sh "გამარჯობა" /workspace/repo/src/Trale/wwwroot/audio/alphabet/hello.ogg
#
# Batch via JSON manifest (one object per line):
#   {"text": "...", "output": "..."}
# Pipe through: while read -r line; do
#   t=$(jq -r .text <<<"$line"); o=$(jq -r .output <<<"$line")
#   /scripts/tts-generate.sh "$t" "$o"
# done < manifest.jsonl

PIPER_BIN="/opt/piper/piper"
VOICE_MODEL="/opt/piper-voices/ka_GE-natia-medium.onnx"

if [ "$#" -ne 2 ]; then
    echo "Usage: $0 \"<text>\" <output.ogg>" >&2
    exit 64
fi

TEXT="$1"
OUT="$2"

if [ ! -x "${PIPER_BIN}" ]; then
    echo "Piper binary not found at ${PIPER_BIN}" >&2
    exit 69
fi
if [ ! -f "${VOICE_MODEL}" ]; then
    echo "Voice model not found at ${VOICE_MODEL}" >&2
    exit 69
fi

mkdir -p "$(dirname "${OUT}")"

# Piper writes WAV to stdout when --output_file is -; pipe into ffmpeg for opus.
# LD_LIBRARY_PATH picks up the bundled .so files next to the piper binary.
LD_LIBRARY_PATH="/opt/piper:${LD_LIBRARY_PATH:-}" \
    printf '%s\n' "${TEXT}" \
    | "${PIPER_BIN}" \
        --model "${VOICE_MODEL}" \
        --output_file - \
        2>/dev/null \
    | ffmpeg -hide_banner -loglevel error -y \
        -i - \
        -c:a libopus -b:a 48k -ac 1 \
        "${OUT}"

# Sanity: file must exist and be non-empty.
if [ ! -s "${OUT}" ]; then
    echo "TTS failed: ${OUT} not written or empty" >&2
    exit 74
fi

echo "wrote ${OUT} ($(wc -c < "${OUT}") bytes) for: ${TEXT}"
