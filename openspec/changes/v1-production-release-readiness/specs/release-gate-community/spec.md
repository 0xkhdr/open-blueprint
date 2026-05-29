## ADDED Requirements

### Requirement: SECURITY.md exists at repo root
A `SECURITY.md` file SHALL exist at the repository root, describing how security vulnerabilities should be reported. It MUST reference GitHub's private security advisory feature or provide a contact email, and MUST include a supported versions table.

#### Scenario: SECURITY.md is present
- **WHEN** the repository root is listed
- **THEN** `SECURITY.md` is present

#### Scenario: SECURITY.md contains reporting instructions
- **WHEN** `SECURITY.md` is read
- **THEN** it contains a section describing how to privately report a vulnerability (GitHub advisory URL or contact email)

#### Scenario: GitHub surfaces security policy
- **WHEN** the repository's Security tab is visited on GitHub
- **THEN** GitHub recognises the `SECURITY.md` and displays the reporting instructions in the "Report a vulnerability" flow

### Requirement: CODE_OF_CONDUCT.md exists at repo root
A `CODE_OF_CONDUCT.md` file SHALL exist at the repository root following the Contributor Covenant 2.1 standard. It MUST include enforcement contact information.

#### Scenario: CODE_OF_CONDUCT.md is present
- **WHEN** the repository root is listed
- **THEN** `CODE_OF_CONDUCT.md` is present

#### Scenario: CODE_OF_CONDUCT.md references Contributor Covenant
- **WHEN** `CODE_OF_CONDUCT.md` is read
- **THEN** it references "Contributor Covenant" version 2.1 and includes an enforcement email or GitHub contact

### Requirement: GitHub community health score reflects complete profile
After adding both files, GitHub's community standards checklist SHALL show both `SECURITY.md` and `CODE_OF_CONDUCT.md` as complete, contributing to a 100% community health score alongside the existing `README.md`, `LICENSE`, and `CONTRIBUTING.md` equivalents.

#### Scenario: Community standards page shows both files complete
- **WHEN** the repository's Insights > Community Standards page is viewed after merging
- **THEN** both the Code of conduct and Security policy rows display a green checkmark
