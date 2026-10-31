# Project-local development skills

Installed for Unknown Academy on 2026-10-31. These are Markdown guidance,
not executable tools, enforced security controls, or evidence of production readiness.
No application source, package/config files, secrets, or deployment were changed
as part of this skill installation.

## Installed skills

| Skill ID / directory under `.opencode/skills/` | Origin | Purpose |
| --- | --- | --- |
| `vercel-react-best-practices` | Downloaded from official `vercel-labs/agent-skills` | Selective React performance reference |
| `academy-secure-fullstack` | **Locally authored, not downloaded** | Incremental React/API/SQLite work, central admin portal, immutable profile approvals, security acceptance |
| `academy-code-organization` | **Locally authored, not downloaded** | Small typed modules, contracts, policy boundaries, tests, behavior-preserving refactors |

Each directory contains `SKILL.md` with a unique ID and trigger description.
[OpenCode V2 discovery](https://opencode.ai/v2/docs/skills) supports this location
without configuration edits. Explicitly request `@academy-secure-fullstack`,
`@academy-code-organization`, or `@vercel-react-best-practices` when useful.
Actual loading remains subject to session discovery and skill permissions.

## Upstream provenance and installation scope

- Repository: <https://github.com/vercel-labs/agent-skills> (Vercel Labs).
- Exact source commit: [`1a2c79d4e6c4a2283dc2c614b6538cbe1ed5ca62`](https://github.com/vercel-labs/agent-skills/commit/1a2c79d4e6c4a2283dc2c614b6538cbe1ed5ca62).
- Commit timestamp: `2026-10-27T21:40:02Z`; GitHub API reported its signature verified.
  This is a GitHub report, not a locally verified signature or security guarantee.
- Source prefix: `skills/react-best-practices/`; declared skill version `1.0.0`,
  author `vercel`, license `MIT` in the downloaded `SKILL.md` frontmatter.
- Raw source pattern: `https://raw.githubusercontent.com/vercel-labs/agent-skills/1a2c79d4e6c4a2283dc2c614b6538cbe1ed5ca62/skills/react-best-practices/<relative-path>`.
- Installed **74 unmodified upstream Markdown files, 226,102 bytes**:
  `SKILL.md`, compiled `AGENTS.md`, and all 72 `rules/*.md` files (70 rules,
  section metadata, and template). All referenced local rule Markdown is present.
- Each downloaded file was UTF-8/NUL checked and its Git blob SHA-1 compared
  with the pinned commit's complete, non-truncated tree before writing.
  SHA-256 values below describe the original downloaded bytes, without newline conversion.
- Excluded README/build instructions, JSON metadata, packages, archives, scripts,
  executables, deployment skills, plugins, and package installation. No upstream
  example command or code block was executed.
- Supplemental `LICENSE.md` is **locally supplied** standard MIT text with source
  attribution. The pinned upstream tree has no standalone license/copyright file;
  the MIT declaration was preserved rather than inventing an upstream notice.
  This records the declared license, not an independent legal determination.

## What was reviewed

- Read upstream `SKILL.md` completely, all individual rule prose/frontmatter,
  compiled contents/headings and sensitive-pattern matches, plus upstream README
  and metadata for provenance/context (the latter two were not installed).
- Statically scanned all 74 texts, including code blocks, for shell/install commands,
  network calls, credential/environment references, storage, unsafe HTML injection,
  and instruction-override language. This was a scoped review, not a complete
  line-by-line audit of every example or upstream build/package implementation.
- Manually examined authentication/authorization, cross-request caching,
  localStorage minimization, and Next.js dynamic-import examples in full.
- Identified an illustrative `npx svgo` command, hydration inline-script example,
  public documentation links, optional dependency suggestions, and Next.js-only APIs.
  These are reference text, not authorization to install packages, execute scripts,
  contact third parties, weaken CSP, expose private data, or deploy.
- Identified contradictory upstream `useEffectEvent` identity descriptions, React
  19-only examples, and stale “40+” metadata versus the 70-rule index. Do not treat
  every upstream performance claim or example as validated for this project.
- Followed the requested local skill-creator guide's frontmatter, focused workflow,
  progressive-disclosure, and minimal-instructions approach. No subagents, benchmark
  jobs, eval servers, or executable skill resources were created or run.

## Project compatibility and safety limits

This repository currently uses React 18.3, Vite 5, a strict TypeScript client
alongside legacy JSX, and a CommonJS Express/SQLite server. Apply only relevant
upstream principles; this installation does not migrate the stack.

- Use React.lazy/Suspense and native imports where supported, not `next/dynamic`,
  Server Actions, RSC, Next.js caching/`after()`, or Next.js configuration examples.
- Do not copy React 19 Activity/useEffectEvent/resource-hint or async-transition
  semantics into React 18. Preserve explicit request loading/error handling.
- Verify typed public package exports; do not use private deep imports or suppress
  strict TypeScript errors to follow a bundle-size suggestion.
- Do not install SWR, better-all, LRU libraries, analytics, or other packages merely
  because a rule mentions them. Prefer current dependencies and measured changes.
- Do not expose private fields for client-side filtering, cache user data across
  authorization boundaries, prefetch privileged data without authorization, or
  parallelize sensitive reads/writes before required authorization checks.
- Keep approval decisions and their mandatory audit events atomic; do not defer
  essential security auditing to background work despite the upstream `after()` rule.
- Preserve the production refusal guard. Local demo identities, cookie/session
  behavior, profile approval controls, and migration safety need implementation
  and application tests; installing skills does not establish those guarantees.
- No secrets, deployment, destructive seed overwrites, or private-profile exports.
  Local custom-header plus exact-Origin CSRF checks are a design requirement,
  not a claim that the existing server already implements them.
- The local skills describe the requested central-admin-portal/revision policy, not a
  declaration that every legacy route, startup seed, or audit helper follows it.

## Lightweight acceptance scenarios

These are review prompts/expected outcomes, not executed app or agent benchmarks:

1. “Link a profile edit form to the API.” Expect typed DTOs, runtime validation,
   session-derived owner, exact-Origin/custom-header checks, and immutable submission.
2. “Approve the older profile while a new revision is pending.” Expect a decision
   tied to an exact revision, explicit policy, stale-state conflicts, atomic audit,
   and no accidental publication of the pending draft or private fields.
3. “Split a large admin route/component.” Expect a small behavior-preserving diff,
   retained ownership/admin/CSRF guards, stable contract, and isolated regression tests.

Static installation checks validate names/frontmatter, Markdown-only contents,
local references, hashes, and approximate local-skill size. No application tests,
behavioral skill evals, or security certification are implied by these checks.

Validation result: **passed** for all 74 per-file SHA-256 values, the ordered
aggregate, indexed rule files, and the local documentation reference. The skill
tree contains 77 UTF-8 Markdown-only files (74 upstream, one supplemental license,
two local skills). Local skill lengths are 99 and 98 lines respectively. All three
skill IDs were also advertised by this running session after file creation.

## Reproducibility and updates

Do not auto-update from `main`. Review a newly selected exact commit and its license,
compatibility, content, and hash changes before replacing anything. Preserve local
skills and user changes; do not run upstream installers or regenerate the compiled
guide. Keep upstream bytes unchanged and put project-specific caveats here.

The following SHA-256 manifest covers only the 74 downloaded upstream files.
Paths are relative to `.opencode/skills/vercel-react-best-practices/`.
For an aggregate check, sort paths lexicographically, concatenate UTF-8 lines
`<sha256><two spaces><relative-path>\n` (LF), then hash that text. Expected aggregate:
`239e63408fb218b493afcf7a8916ee0110b84d5c6afaaf4fb13209999dac4215`.
Locally authored skills and supplemental license text are intentionally excluded.

| Relative upstream file | SHA-256 |
| --- | --- |
| `AGENTS.md` | `fc93e7421177bbf869cce892bc60a6c83a4517d974bc3bf65c4e2c1e58a6ccf6` |
| `SKILL.md` | `71ed7794962fa6e803ee83030517b5b93a9f70fbfeb431ec4535c5480a8d8355` |
| `rules/_sections.md` | `01c59969e4e867f0708c8f8ef9c6d87fab9a07d0586244f429ff84013db8a115` |
| `rules/_template.md` | `99df2a3ea088c6c22de2484ddc7e964d0e9923846f44c63380343ecc64455442` |
| `rules/advanced-effect-event-deps.md` | `55ed8f9f27a1bff803d6fa55828176207714b02123cbb97ddb8a90d88024a723` |
| `rules/advanced-event-handler-refs.md` | `a3097edeecfb2ff6851cd66ed8cdf0617c3c88180504bee824aa6e75a215bbbc` |
| `rules/advanced-init-once.md` | `3e4dc22173eb0e2b6dcf583e3babd862b8696328f8f59aee7c4d746c5bc05f6c` |
| `rules/advanced-use-latest.md` | `8a3f64dfe5a77d1564248faf17fe662ae75b55d497a243cb30b38eb07ccbbf9a` |
| `rules/async-api-routes.md` | `523338540d73427dc14c0cbb19f2741ebccdf8b105a7b2c1b33d2905cf237a42` |
| `rules/async-cheap-condition-before-await.md` | `03107c1f70a293cd58a8abc5474c5548e20ea4efdf01b6d45aae7ad0ac1cb32c` |
| `rules/async-defer-await.md` | `f3c142d090615abdcc99d31c123be37b31f0f1ed8d9ec9f7789a3bc6883ae0fb` |
| `rules/async-dependencies.md` | `16ef469f877e30c6b8e1e1b4bc3e527312fa3c6318cb785a4eca186ea236131a` |
| `rules/async-parallel.md` | `6d2f841896279e976dfcdc1ac89e70771ac188baadfd43c096b5706cb838b961` |
| `rules/async-suspense-boundaries.md` | `de05fedac2eb7ae563b887b5a424464ec3dfaf84e5b7797467ebe2a796ac8afc` |
| `rules/bundle-analyzable-paths.md` | `62090b5c815fd71bf1133dce754f51abc16a9456d0ccd025fd627de27726e92a` |
| `rules/bundle-barrel-imports.md` | `e648f6d54525f07a691357040ca5bff6ea3424788a91ff63812adb29622a671b` |
| `rules/bundle-conditional.md` | `09c8259c3efb04fc0abb8e412ccbda217c222ae8118516283e571c995fe3a7d4` |
| `rules/bundle-defer-third-party.md` | `3719fb47b191e8db4fe22686ec88448ad5af9e6838585425abbe103d0b642e37` |
| `rules/bundle-dynamic-imports.md` | `401817a7369f315fc5a68a1095742ff7d53d0461906880dc9d64a41495ee1986` |
| `rules/bundle-preload.md` | `d1f7cc28da7cd5ab249acd287edc5b761afcfb194e9cb62cd44c5f3543db2de2` |
| `rules/client-event-listeners.md` | `242a873349febc1ce685e85617994784dbab92c2eaa68aed7fed5a83e7680e93` |
| `rules/client-localstorage-schema.md` | `0fb7cdf9dc93fdf22f87e3669f953fb9d4ac9b0be42eec4a29fe9a2560610b88` |
| `rules/client-passive-event-listeners.md` | `1f35016f9053de69e884ee9be00654e37979c2ca85f5e57764dc2626ff7acb4b` |
| `rules/client-swr-dedup.md` | `644652c39c6cc00de8d1c77a7273612e868dc3f7edda30764164c12ec0f764a3` |
| `rules/js-batch-dom-css.md` | `480b891b9eaf96e929dc1e964274a4828e3a78009b7d00ccd965a0d425215959` |
| `rules/js-cache-function-results.md` | `3daaa11d24f4295cb6be8bc6f407f2ce83cc7b5bd1f0e68891ea8ab835721dc7` |
| `rules/js-cache-property-access.md` | `73e47431e74878a927061bf0ddc7cd91a7556cb35d2573f3421e82300d9ae311` |
| `rules/js-cache-storage.md` | `11b826b0433898c1ece2d3547010d8e77db9fb240185748c45db91493de9b6cc` |
| `rules/js-combine-iterations.md` | `71add08aeeb43091d4ff4c0b2842cce8b4bdef8ad3e732cc034bb5a84827e746` |
| `rules/js-early-exit.md` | `925ce5ce87f3347186ca62212f29cc6baa2b8c85a96d2720ad07c3d0abf781c0` |
| `rules/js-flatmap-filter.md` | `9e5b166a41914d975bef7635467f8fb32cd98b5c3126c0bc6f163490812fb5f0` |
| `rules/js-hoist-regexp.md` | `f9e9aef2f7c2307dd7310f283df85dcada45fc43e9bb941b0c3aa414dec21ec4` |
| `rules/js-index-maps.md` | `5df1bdc2cfabb2c98abd55d26762e5c18189535c2e686184f426082e62920391` |
| `rules/js-length-check-first.md` | `8b54a311c826b299272f29187fc58bc55772a04c4a72eeb29456ee96dc9fc624` |
| `rules/js-min-max-loop.md` | `87dfb67e2f39df6ad8bcfb5b78c5fb364d3c07554ad188a202408d99f3763421` |
| `rules/js-request-idle-callback.md` | `ee08f83905b4011abbc33d594033157d77561b5bbd9b36b04f0f409581ffec32` |
| `rules/js-set-map-lookups.md` | `a7fd781a6ba9ad49065961b6f9a90ef486bf6b648390e1a08704025f98e1642b` |
| `rules/js-tosorted-immutable.md` | `d0a5e1b0fec48a0a81397957e2f068e224329f7c42cb5feeed8aae6fa64025e8` |
| `rules/rendering-activity.md` | `1e5e7eaf3555e61d6a2e900089c676527d26259501db5594f59544b6c664f85a` |
| `rules/rendering-animate-svg-wrapper.md` | `9c6ae0ca7a51434e803887c64cded760956579a1452ccb80a461a03f9c937c77` |
| `rules/rendering-conditional-render.md` | `2ec2fa23c4148285144687050c52369adba3da2fbe3d486f8d3e0aad8f06f2bc` |
| `rules/rendering-content-visibility.md` | `64eee6d5b916fe74df33363994b27fc7f71bea3bcedc7ee04bda23107ca3e6e4` |
| `rules/rendering-hoist-jsx.md` | `93b229560fae92005ed9a2a829064607b39b2e984e92d221d05b2d41df2b7c0e` |
| `rules/rendering-hydration-no-flicker.md` | `dc7ab358c67c177bca6e6f360fbc935ebe4efa928c0ba3ebd3f9f3d9e2000ca3` |
| `rules/rendering-hydration-suppress-warning.md` | `915bacb934e2927d84b37a3f3d225a47b309ac8f9e494ed2bcb66ce07c5676a2` |
| `rules/rendering-resource-hints.md` | `351b1095d641717b930f1b2253282b7120af3023bc74e06c17675168d4286864` |
| `rules/rendering-script-defer-async.md` | `4cea07b7875ba7fc2c7465ff23b63a2bb334f90aaf2d9293d38d67b05fdb32ab` |
| `rules/rendering-svg-precision.md` | `ed468533f6e95f622859c884b122cf21f9f593ed6bb3d500a54de4b9f9bcb9fb` |
| `rules/rendering-usetransition-loading.md` | `3a1249c3f13026b6f54ab5712c388df219d6af01b12aa542749acd99a46f4bc1` |
| `rules/rerender-defer-reads.md` | `234050a77faf50cb306be10a9e15bd4421134ab5907e75f13e6d78e2bd262dc9` |
| `rules/rerender-dependencies.md` | `17eb5830956fb56486fd3cfc7431f5849d39751730c05ad9e77dd4f0c27169c5` |
| `rules/rerender-derived-state-no-effect.md` | `cb11ec76f50aa7b6847269f02d79b120c889a30d9ecd2c1d578f75144419c77a` |
| `rules/rerender-derived-state.md` | `1c326bb67b01fb084eb00c8911b0a7cff54681c2315b629f88e49b64eaa6481d` |
| `rules/rerender-functional-setstate.md` | `5e68df6b2ae8058e67f476ff1ac67bde159f5a9d18df439e46eabcdeb7b52e58` |
| `rules/rerender-lazy-state-init.md` | `4ae844740f266fc8cbf050701230286624a2440ec5be67b9a63d9edc3c580573` |
| `rules/rerender-memo-with-default-value.md` | `81c47476564ad8a79fc68fc442734255ca7d6829424359464503fda0a9f9a0dd` |
| `rules/rerender-memo.md` | `1f258990c2f27ff6256b3cc5c43300631bb3f0d81f749aed08d07fcdcc131dd1` |
| `rules/rerender-move-effect-to-event.md` | `abc2cbf167bee056743023351e96806a411d3398da8802093620aecf0721f029` |
| `rules/rerender-no-inline-components.md` | `1cc32907a770272524ba682eef9e7efdd8ad4533b6f89b718a1fcd7d1d0eb6a3` |
| `rules/rerender-simple-expression-in-memo.md` | `5bdcf2d1558ba5204e643c887b7b4060f89630969425651eb68e96427d97f800` |
| `rules/rerender-split-combined-hooks.md` | `6f45d703343484ef9acef9388397f3642966ae6a5a258899a0cf1f9977cfbf6c` |
| `rules/rerender-transitions.md` | `60f4033909a62df5e5b8c601494f9e50a562e2f8c1c2d81eac24f38142265f1c` |
| `rules/rerender-use-deferred-value.md` | `8c3579576a61a949884167745dcfaf1d5426ba305cc61fd0a79602d70fda4909` |
| `rules/rerender-use-ref-transient-values.md` | `f1a649af9d1d0b5c762f6c9c4c1c70c90d7df82aa10296ee87aadb78c1b76c54` |
| `rules/server-after-nonblocking.md` | `d0b8d24a3db9f0f65f9e2bddbf230b0e03a5f60e1229d93a4a18f5e7a991c7c2` |
| `rules/server-auth-actions.md` | `a2ca8aa102839251c7971ec784560fab943c20b36fe6f80365d4110c13260c23` |
| `rules/server-cache-lru.md` | `1924b64561841923b88a657085097a0aeba3e0ba2d5470b9f5c15cc10d6ae70f` |
| `rules/server-cache-react.md` | `fddeea6c870bb3da4134b61d54b7d09b83d2603f929b7547cd3dc1dc269edd5c` |
| `rules/server-dedup-props.md` | `c2747424cdac46be62f835f245a0aa887b0090b416d28e2ac8676702645eeb37` |
| `rules/server-hoist-static-io.md` | `5abea4dd882b13661bd5f7dfb93f9e547d5f08176c61c448ade91b210ed5d49f` |
| `rules/server-no-shared-module-state.md` | `4d869bf1cd2f1632e5ca4c0e64b1cf0e71c5f5a0f940bc8a22174d205e735ed7` |
| `rules/server-parallel-fetching.md` | `569a2e9fc04f9606686cd75c5894ef8781b502786a7fffe241396846c7733472` |
| `rules/server-parallel-nested-fetching.md` | `ad5d9656984d4a959997a2367bf59cc6632297b4634a1dd13a087939d83f30b3` |
| `rules/server-serialization.md` | `f4c7d68b29c82381baad059c4a7f09e868e71ec9c3115a26ad3ae7d24c0dfe1f` |
