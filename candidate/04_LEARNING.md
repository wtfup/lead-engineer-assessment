# 04 — Learn a small unfamiliar Flutter boundary

**20 minutes · 5 points · practical section · setup outside the timer.** Flutter expertise is not assumed and this is not a mobile-platform build. We assess how you learn, reason and verify a bounded change—not prior Flutter vocabulary. Prioritize the core SQL/API/React work first. AI/docs are allowed with disclosure.

## Goal
In `mobile/`, fix the invoice screen so **only the latest requested load may change visible data, loading state or error state**. A slow old request must not replace a newer result. Keep the API client injectable and existing user actions usable.

The tiny web-target Flutter app has two synthetic tenants, an asset-only fake API, integer-paise money, loading/empty/error/retry UI and smoke tests. There is no login, server, network API, mobile signing, store publishing or real tenant data. Fixing the UI race is not a substitute for server-side tenant authorization in a real product.

## Setup (do this before timing)
Validated toolchain: **Flutter 3.38.5 / Dart 3.10.4**. The pubspec permits Dart 3.10–3.x; a different SDK is not promised identical dependency resolution. Use a prepared SDK or [official Flutter installation](https://docs.flutter.dev/install). Do not burn the learning slot installing Android Studio, Xcode or emulators.

From the repository root:
```sh
cd mobile
# Optional: keep downloaded packages inside this ignored directory.
export PUB_CACHE="$PWD/.pub-cache"
flutter --suppress-analytics --no-version-check pub get
flutter --suppress-analytics --no-version-check analyze
flutter --suppress-analytics --no-version-check test
flutter --suppress-analytics --no-version-check run -d web-server --no-web-resources-cdn --web-hostname 127.0.0.1 --web-port 4329
```
Open the loopback URL printed by Flutter. `--suppress-analytics` affects the command, not global Flutter settings. Do not run `flutter config` or upgrade the shared SDK for this lab. Dependency/SDK setup may need Internet; **application data and model exercises are offline**.

For a compiled web run instead:
```sh
flutter --suppress-analytics --no-version-check build web --no-web-resources-cdn
python3 -m http.server 4329 --bind 127.0.0.1 --directory build/web
```
The no-CDN build bundles renderer resources; Python serves the compiled app. Stop either server with Ctrl-C. If port 4329 is occupied, use a free loopback port. Do not expose it publicly.

## Read only what you need (~4 minutes)
- [`State.setState`](https://api.flutter.dev/flutter/widgets/State/setState.html): synchronous state mutation, then rebuild; do not make its callback async.
- [`State.mounted`](https://api.flutter.dev/flutter/widgets/State/mounted.html): lifecycle validity after an await.
- [Dart async/await](https://dart.dev/libraries/async/async-await): a Future completes later; completion order can differ from call order.
- [Widget testing](https://docs.flutter.dev/cookbook/testing/widget/introduction): `pump` advances a widget test; the supplied controlled client completes exact requests without sleeps.

Map these ideas to something you already know in React/TypeScript. Then read `lib/main.dart`, `lib/api_client.dart`, and `challenges/latest_request_test.dart`.

## Work (~12 minutes)
1. Run the explicit acceptance command below before changing code; it is **intentionally RED on the starter**. `flutter test` alone is only setup/smoke proof.
2. Patch the smallest reasonable part of `lib/main.dart`. Do not remove tests, hardcode invoice IDs, delay all clicks, or disable tenant switching/reload to avoid overlapping requests.
3. Prove the latest-request rule for old success, old error, repeated loads of the same tenant and alpha→beta→alpha. Preserve visible active-request errors, retry and disposal safety.

```sh
flutter --suppress-analytics --no-version-check test challenges/latest_request_test.dart
flutter --suppress-analytics --no-version-check test
flutter --suppress-analytics --no-version-check analyze
```

The fixture contract is the JSON array in `mobile/assets/invoices.json`: camelCase `id`, `tenant`, `amountPaise` (integer), `status` (`pending`/`paid`). `ApiClient.loadInvoices(tenant)` returns a Future of filtered invoice rows. The fake normally delays alpha longer than beta. Tests inject `ControlledApi` to force precise ordering; no wall-clock guessing is required.

## Handover (~4 minutes)
Add `submission/LEARNING.md`: what was unfamiliar; the docs/concept you used; the smallest patch and why it works; actual commands and outcomes; one remaining risk. Include RED and GREEN evidence if executed. Do not call a passing build proof that the race is fixed.

## No SDK available? Equivalent reasoning route
State **`EXECUTION_UNVERIFIED — no Flutter SDK`**, read the supplied Dart and tests, and submit a proposed diff or precise Dart-like pseudocode plus a table showing the state after each completion for all four acceptance scenarios. Explain lifecycle and active-error behavior. Do not fabricate a command result or claim the tests passed. This route can earn learning/reasoning points without asserting execution; the evaluator records runtime verification as unobserved. The primary PostgreSQL/Node/React assessment and its scores are unaffected. Setup failure is not an integrity failure.

No extra mobile features, dependency migration or UI redesign are expected. Optional extra tests are useful only if time remains; do not exceed the slot to pursue them.
