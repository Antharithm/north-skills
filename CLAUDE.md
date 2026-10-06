# CLAUDE.md

Repo `north-skills` (npm package `create-north-app`): Agent Skills for North plus an interactive installer (`bin/cli.mjs`).

Two install paths, same code: `npx skills add Antharithm/north-skills` installs the skills, then `/north-embedded-checkout` asks framework + new/existing and runs `skills/north-embedded-checkout/scripts/scaffold.mjs`. `npx create-north-app` asks everything up front and calls the same `scaffold()`.

- `skills/<name>/SKILL.md` + `references/`: the skills. Frontmatter follows the Agent Skills standard (name, description, version, license, compatibility, metadata, allowed-tools).
- `skills/north-embedded-checkout/templates/<framework>/base`: new-project files. `.../north`: files added to new and existing projects. `env.example.tpl` is merged into `.env.example`. Every template ends in `.tpl` (stripped on copy) so a user's TypeScript build never compiles the copies inside `.claude/skills`. `_gitignore` is renamed; `{{PROJECT_NAME}}` is replaced.
- Installer rules: never overwrite user files; skills always overwrite (they are ours); never read, ask for, or write secret values.
- Facts about North's API come from a verified Sandbox integration. Do not add endpoints, headers or fields that haven't been verified; mark unknowns as such.
- `skills/north-doctor/scripts/doctor.mjs`: static checks (CHECKS catalogue) + `--live`. Every check needs a planted-bug case in `scripts/test-doctor.mjs`, and the clean starters must report zero findings.
- JS tools use `// @ts-check` + JSDoc (strict, `tsconfig.json`); keep `npm run typecheck` at zero errors. No build step: tools must stay runnable as `node file.mjs`.
- Run `npm test` after any change; `sh scripts/test-installer.sh --build` before a release.
