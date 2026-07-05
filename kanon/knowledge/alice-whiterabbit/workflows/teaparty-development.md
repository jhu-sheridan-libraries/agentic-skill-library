# Tea Party Pipeline Context

## Module Layout

```
alice-cli/src/alice_cli/teaparty/
├── models.py             # Turn, Script, GenerationMode, TeaPartyMetadata, ScriptParseError
├── source_loader.py      # Multi-source ingestion (file, glob, stdin, locker:, doi:, s3://, url:)
├── prompts.py            # Mode-specific system prompts (conversation, narrator, briefing, interview)
├── script_generator.py   # Bedrock Converse API → Script JSON + long-content chunking
├── voice_resolver.py     # Polly DescribeVoices API → voice selection per language
├── speech_synthesizer.py # Polly TTS + SSML preprocessing + 3000-char chunking
├── audio_stitcher.py     # pydub concatenation + log-normal pause sampling
└── audio_locker.py       # S3 upload/download for Audio_Bucket
```

## Pipeline Stages

```
source_loader → script_generator → speech_synthesizer → audio_stitcher → audio_locker
                    ↑                      ↑
                prompts.py           voice_resolver.py
```

## Script JSON Schema

```json
{
  "turns": [
    {"speaker": "Host_A", "text": "..."},
    {"speaker": "Host_B", "text": "..."}
  ]
}
```

- `speaker`: `"Host_A"` or `"Host_B"` (Literal type)
- `text`: non-empty string
- Minimum 2 turns
- Pydantic models: `Turn`, `Script` in `models.py`
- Round-trip: `parse_script(serialize_script(s)) == s`

## Generation Modes

| Mode | Speakers | Host_A Role | Host_B Role |
|---|---|---|---|
| conversation | 2 | Knowledgeable explainer | Curious questioner |
| narrator | 1 (Host_A only) | Sole narrator | — |
| briefing | 2 | News anchor / topic introducer | Discussant |
| interview | 2 | Interviewer | Subject-matter expert |

## Polly Engine Selection

| Condition | Engine | SSML Extras |
|---|---|---|
| Default | `generative` | `<speak>`, `<p>`, `<s>`, `<break>` |
| Narrator + voice supports long-form | `long-form` | + `<prosody rate="medium">` |
| `--neural-style` + voice supports neural | `neural` | + `<amazon:domain name="conversational\|news">` |
| Fallback (no generative) | `neural` → `standard` | Reduced SSML support |

## SSML Tag Support by Engine

| Tag | generative | long-form | neural |
|---|---|---|---|
| `<speak>` | ✓ | ✓ | ✓ |
| `<break>` | ✓ | ✓ | ✓ |
| `<p>`, `<s>` | ✓ | ✓ | ✓ |
| `<say-as>` | ✓ | ✓ | ✓ |
| `<prosody rate>` | ✗ | ✓ | ✓ |
| `<prosody pitch>` | ✗ | ✗ | ✓ |
| `<emphasis>` | ✗ | ✗ | ✓ |
| `<amazon:domain>` | ✗ | ✗ | ✓ |

## Voice Resolver Logic

1. Call `polly.describe_voices(LanguageCode=lang)`
2. Filter for `generative` engine voices
3. If none → fall back to `neural` → `standard`, set warning
4. Select 2 distinct voices (prefer male + female pairing)
5. Return `ResolvedVoices` with `voice_a_engines`, `voice_b_engines` lists

en-US generative voices: Danielle (F, +long-form), Joanna (F), Ruth (F, +long-form), Salli (F), Matthew (M), Stephen (M), Tiffany (F)

## Text Chunking (3000-char limit)

1. Turn text ≤ 3000 chars → single Polly call
2. Turn text > 3000 chars → split at sentence boundaries (`. `, `? `, `! `)
3. Single sentence > 3000 chars → split at nearest word boundary
4. Each chunk → SSML preprocessing → Polly synthesis
5. Chunk audio segments concatenated for the turn

## SSML Preprocessing Pipeline

```
text → sentence split (<s> tags) → paragraph split (<p> tags)
     → micro-pause insertion (<break> at commas/semicolons)
     → domain wrapping (neural_style: <amazon:domain>)
     → prosody wrapping (long-form narrator: <prosody rate="medium">)
     → outer <speak> wrapping
```

## Audio Stitching Pause Model

- Distribution: log-normal (empirical conversational timing)
- Parameters: `mu = ln(effective_median)`, `σ_log = 0.4`
- Clamped to `[base × 0.3, base × 2.5]`
- Deterministic seed: `random.Random(turn_index)`

| Context | Effective Median |
|---|---|
| Same speaker | `pause_ms × 0.6` |
| Speaker change after `?` | `pause_ms × 0.7` |
| Speaker change after statement | `pause_ms` (full) |

## Audio Bucket Config

- Precedence: `--audio-bucket` > `ALICE_AUDIO_BUCKET` env > `~/.alice/credentials.json` `audio_bucket` > `jh-{namespace}-{environment}-audio`
- Artifact key: `{jhed}/teaparty/{session_id}.mp3`
- Published prefix: `published/teaparty/{session_id}.mp3`
