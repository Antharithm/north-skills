#!/bin/sh
# Smoke test: run the installer non-interactively for every supported combination,
# then check the expected files exist. Pass --build to also npm install + typecheck/build.
set -e
cd "$(dirname "$0")/.."
OUT=.test-output
rm -rf "$OUT" && mkdir -p "$OUT"
CLI="$PWD/bin/cli.mjs"
fail() { echo "FAIL: $1"; exit 1; }

for fw in nextjs express; do
  (cd "$OUT" && node "$CLI" --product embedded-checkout --agents claude-code,antigravity --framework $fw --mode new --name "new-$fw" --yes >/dev/null)
  d="$OUT/new-$fw"
  [ -f "$d/.claude/skills/north-embedded-checkout/SKILL.md" ] || fail "$fw: claude skill missing"
  [ -f "$d/.agents/skills/learn-north/SKILL.md" ] || fail "$fw: .agents skill missing"
  [ -f "$d/.claude/skills/north-doctor/scripts/doctor.mjs" ] || fail "$fw: north-doctor missing"
  [ -f "$d/.env.example" ] || fail "$fw: .env.example missing"
  [ -f "$d/.gitignore" ] || fail "$fw: .gitignore missing"
  grep -q '{{' -r "$d" --include=*.json --include=*.ts --include=*.tsx --include=*.md --include=*.html && fail "$fw: unreplaced placeholder"
  echo "ok  new $fw"
done
[ -f "$OUT/new-nextjs/app/api/north/session/route.ts" ] || fail "nextjs route missing"
[ -f "$OUT/new-express/src/north/router.ts" ] || fail "express router missing"

# Existing Next.js project with src/app: files land under src/, existing files untouched.
E="$OUT/existing-next"
mkdir -p "$E/src/app" && echo '{"dependencies":{"next":"16"}}' > "$E/package.json" && echo 'KEEP' > "$E/src/app/page.tsx"
(cd "$OUT" && node "$CLI" --product embedded-checkout --agents windsurf --framework nextjs --mode existing --dir existing-next --yes >/dev/null)
[ -f "$E/src/lib/north/client.ts" ] || fail "existing: src/lib/north missing"
[ -f "$E/src/app/api/north/verify/route.ts" ] || fail "existing: src/app route missing"
[ "$(cat "$E/src/app/page.tsx")" = "KEEP" ] || fail "existing: page.tsx overwritten"
[ -f "$E/.windsurf/skills/north-embedded-checkout/SKILL.md" ] || fail "existing: windsurf skill missing"
echo "ok  existing nextjs (src/ layout)"

# Coming-soon choices are refused.
node "$CLI" --product payment-api --agents claude-code --framework nextjs --mode new --yes >/dev/null 2>&1 && fail "coming-soon product accepted"
echo "ok  coming-soon refused"

# The skill's own scaffold script (the path the agent uses after `npx skills add`).
S="$OUT/new-nextjs/.claude/skills/north-embedded-checkout/scripts/scaffold.mjs"
(cd "$OUT" && node "../$S" --framework express --mode new --name via-skill >/dev/null) || fail "skill scaffold failed"
[ -f "$OUT/via-skill/src/north/router.ts" ] || fail "skill scaffold: express router missing"
[ "$(cd "$OUT/existing-next" && node "../../$S" --detect)" = "nextjs" ] || fail "skill scaffold: --detect"
echo "ok  scaffold.mjs from installed skill"

# No template is left as compilable source inside the installed skill.
find "$OUT/new-nextjs/.claude/skills" -name "*.ts" -o -name "*.tsx" | grep -q . && fail "compilable .ts inside installed skill"
echo "ok  installed skill holds only .tpl templates"

if [ "$1" = "--build" ]; then
  (cd "$OUT/new-nextjs" && npm install --silent && npx tsc --noEmit && npx next build >/dev/null) && echo "ok  nextjs builds"
  (cd "$OUT/new-express" && npm install --silent && npx tsc --noEmit) && echo "ok  express typechecks"
fi
echo "All installer tests passed."
