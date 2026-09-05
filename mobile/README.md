# Tenant Invoice Lab

Small Flutter web-target learning exercise. Start with [candidate instructions](../candidate/04_LEARNING.md). No backend or credentials are used.

- `lib/main.dart`: screen and deliberately incomplete latest-request handling.
- `lib/api_client.dart`: injectable API contract and asset-only fake.
- `assets/invoices.json`: synthetic camelCase invoice rows.
- `test/`: setup/smoke checks, expected GREEN.
- `challenges/`: explicit behavioral challenge, expected RED before your patch.

Run from `mobile/` with Flutter 3.38.5 / Dart 3.10.4 (verified baseline):
```sh
export PUB_CACHE="$PWD/.pub-cache"
flutter --suppress-analytics --no-version-check pub get
flutter --suppress-analytics --no-version-check analyze
flutter --suppress-analytics --no-version-check test
flutter --suppress-analytics --no-version-check test challenges/latest_request_test.dart
flutter --suppress-analytics --no-version-check build web --no-web-resources-cdn
```

The explicit challenge command fails on the starter by design; do not interpret that as broken SDK setup. Build output can include a Flutter Cupertino font/tree-shaking warning; the lab uses Material icons and does not require Cupertino assets. Local framework resources are bundled by the no-CDN build option. Setup dependency downloads are separate from the offline application.

For a compiled preview: `python3 -m http.server 4329 --bind 127.0.0.1 --directory build/web`, then open `http://127.0.0.1:4329/`. Stop with Ctrl-C. No mobile-native deployment, database integration, credentials or SDK-global configuration changes are needed.
