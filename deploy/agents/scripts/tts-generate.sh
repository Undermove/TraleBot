#!/bin/bash
set -euo pipefail

# Generate Georgian TTS audio using Piper's ka_GE-natia-medium voice.
#
# IMPORTANT: default output is .m4a (AAC in MP4 container) — universally
# playable in browsers including iOS Safari/WKWebView (Telegram iOS Mini App).
# Do NOT default to .ogg/Opus: iOS < 17.4 and many in-app WebViews silently
# fail to play opus, leaving users with a dead audio button. AAC works
# everywhere desktop/Android/iOS without exceptions.
#
# Usage:
#   /scripts/tts-generate.sh "<Georgian text>" <output.m4a>
#
# Output codec is selected from the file extension:
#   .m4a → AAC (recommended, default, iOS-safe)
#   .mp3 → MP3 (also iOS-safe, larger files)
#   .ogg → opus (legacy, AVOID — breaks on iOS in Telegram WebView)
#
# Example:
#   /scripts/tts-generate.sh "გამარჯობა" /workspace/repo/src/Trale/wwwroot/audio/alphabet/hello.m4a
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

# Pick codec args from output extension. AAC/m4a is the default & recommended
# path; opus is kept for backward compat but will warn loudly.
case "${OUT,,}" in
    *.m4a) FFMPEG_CODEC=(-c:a aac -b:a 64k -ac 1 -movflags +faststart) ;;
    *.mp3) FFMPEG_CODEC=(-c:a libmp3lame -b:a 64k -ac 1) ;;
    *.ogg)
        echo "WARNING: .ogg/opus does NOT play on iOS Safari/Telegram WebView. Use .m4a instead." >&2
        FFMPEG_CODEC=(-c:a libopus -b:a 48k -ac 1)
        ;;
    *)
        echo "Unsupported output extension: ${OUT}. Use .m4a (recommended), .mp3, or .ogg." >&2
        exit 64
        ;;
esac

# Piper writes WAV to stdout when --output_file is -; pipe into ffmpeg for the
# chosen codec. LD_LIBRARY_PATH picks up the bundled .so files next to piper.
LD_LIBRARY_PATH="/opt/piper:${LD_LIBRARY_PATH:-}" \
    printf '%s\n' "${TEXT}" \
    | "${PIPER_BIN}" \
        --model "${VOICE_MODEL}" \
        --output_file - \
        2>/dev/null \
    | ffmpeg -hide_banner -loglevel error -y \
        -i - \
        "${FFMPEG_CODEC[@]}" \
        "${OUT}"

# Sanity: file must exist and be non-empty.
if [ ! -s "${OUT}" ]; then
    echo "TTS failed: ${OUT} not written or empty" >&2
    exit 74
fi

echo "wrote ${OUT} ($(wc -c < "${OUT}") bytes) for: ${TEXT}"
