## ADDED Requirements

### Requirement: Secret scanner SHALL detect high-entropy strings as potential secrets
In addition to regex-based pattern matching, the scanner SHALL compute Shannon entropy for each string token in scanned content. A token with entropy ≥ 4.5 bits/character AND length ≥ 20 characters SHALL be flagged as a potential secret with severity `medium` and finding type `HIGH_ENTROPY_STRING`. The scanner SHALL exclude tokens that: consist entirely of repeated characters, are known common words (checked against a built-in 200-word exclusion list), or are valid base64-encoded values shorter than 32 bytes after decoding.

#### Scenario: High-entropy random string is flagged
- **WHEN** content contains `"xK9#mP2$nQ7@wR4!vL6"` (entropy > 4.5, length ≥ 20)
- **THEN** scanner returns a finding with type `HIGH_ENTROPY_STRING` and severity `medium`

#### Scenario: Low-entropy string is not flagged
- **WHEN** content contains `"aaaaaaaaaaaaaaaaaaaaaa"` (entropy ≈ 0)
- **THEN** scanner returns no finding for this token

#### Scenario: Common English word is not flagged despite length
- **WHEN** content contains a 25-character string composed entirely of common dictionary words
- **THEN** scanner does not flag it as a high-entropy secret

#### Scenario: Known regex pattern takes precedence
- **WHEN** content contains an AWS key `AKIA0123456789ABCDEF`
- **THEN** scanner returns a finding with type `AWS_ACCESS_KEY` (regex match) not `HIGH_ENTROPY_STRING` — regex findings are deduplicated against entropy findings for the same token

### Requirement: Entropy scanning SHALL be opt-in via CLI flag
The `bp verify` and `bp scan` commands SHALL accept `--entropy-scan` flag to enable entropy-based detection. When not passed, entropy scanning SHALL be skipped. The flag SHALL also be configurable in the project manifest under `scan.entropyEnabled: true`.

#### Scenario: Entropy scan disabled by default
- **WHEN** `bp verify` is run without `--entropy-scan` flag
- **THEN** no `HIGH_ENTROPY_STRING` findings are reported even if high-entropy strings are present

#### Scenario: Entropy scan enabled via flag
- **WHEN** `bp verify --entropy-scan` is run against content with a high-entropy string
- **THEN** a `HIGH_ENTROPY_STRING` finding is included in the report

#### Scenario: Entropy scan enabled via manifest config
- **WHEN** `scan.entropyEnabled: true` is set in the project manifest and `bp verify` runs without `--entropy-scan`
- **THEN** entropy scanning runs as if `--entropy-scan` were passed
