# Unfamiliar-module learning

**Executed.** Flutter was not initially available in this environment; I installed it
(`brew install --cask flutter`, resulting in Flutter 3.47.2 / Dart 3.13.2 — the pubspec's
`>=3.10.0 <4.0.0` constraint permits this SDK, though it is not the pinned 3.38.5/3.10.4) and ran
every command `candidate/04_LEARNING.md` specifies. Raw output is preserved under `submission/`:
`mobile-red-evidence.txt`, `mobile-green-evidence.txt`, `mobile-smoke-evidence.txt`,
`mobile-analyze-evidence.txt`.

## Prior familiarity

None claimed beyond the task itself. I had already fixed the identical bug in React earlier in
this assessment (`app/page.tsx` — a stale async response overwriting a newer tenant's data), so
the *concept* (a monotonically increasing "latest request" token gating whether a completion may
apply) was familiar; the Dart/Flutter *mechanics* (`StatefulWidget`/`setState`/`mounted`/widget-test
`pump()`) were not.

## Documentation read and mapped to React

- [`State.setState`](https://api.flutter.dev/flutter/widgets/State/setState.html): the callback is
  synchronous — the fix must live in code *after* an `await`, gating whether `setState` is called
  at all, not inside the callback. Maps to a React `setState`/`useState` setter call guarded by a
  ref check before it runs.
- [`State.mounted`](https://api.flutter.dev/flutter/widgets/State/mounted.html): only proves the
  widget hasn't been disposed, not that a given pending `Future` is still the latest request — the
  existing `mounted` check is necessary but not sufficient. Maps to React's unmount-safety pattern,
  distinct from a request-freshness check.
- [Dart async/await](https://dart.dev/libraries/async/async-await): "completion order can differ
  from call order" — exactly what `mobile/test/support/controlled_api.dart`'s `Completer`-per-
  request design exploits to force the race deterministically, the same class of race as the
  slower-HTTP-response-resolving-later bug I fixed in `app/page.tsx`.
- [Widget testing](https://docs.flutter.dev/cookbook/testing/widget/introduction): `pump()`
  advances one frame/microtask turn after a state change — confirmed in practice: each
  `api.succeed()`/`api.fail()` followed immediately by `await tester.pump()` was sufficient to
  observe the widget tree after that completion, no real delay needed.

## The smallest bounded change and why it works

Read `mobile/lib/main.dart`, `mobile/lib/api_client.dart`, `mobile/test/support/controlled_api.dart`,
and `mobile/challenges/latest_request_test.dart`. The bug: `_load()` captured `requestedTenant` but
tracked no identity for *which call is the latest one* — whichever `Future` resolved last won the
final `setState`, regardless of call order. Patch (`mobile/lib/main.dart`, `_InvoiceScreenState`,
+3 lines):

```dart
int _requestId = 0;                                       // new field

Future<void> _load() async {
  final requestedTenant = _tenant;
  final requestId = ++_requestId;                          // claim the latest slot
  setState(() { _loading = true; _error = null; _invoices = []; });
  try {
    final invoices = await widget.api.loadInvoices(requestedTenant);
    if (!mounted || requestId != _requestId) return;        // + requestId check
    setState(() { _invoices = invoices; _loading = false; });
  } catch (_) {
    if (!mounted || requestId != _requestId) return;        // + requestId check
    setState(() { _error = 'Could not load invoices. Retry.'; _loading = false; });
  }
}
```

Why smallest and why it works: every code path that loads data (`initState`, tenant switch,
`Reload`, `Retry`) already funnels through this one method, so one counter incremented at its top
gives every in-flight call a distinct, comparable identity. No cancellation is needed (Dart
`Future`s have none built in) — a stale completion just becomes a no-op. `api_client.dart` is
untouched, so the client stays injectable; no test was removed, no ID hardcoded, no click delayed,
and tenant switching/reload remain fully usable.

## Actual commands and results (RED then GREEN)

```
$ flutter --suppress-analytics --no-version-check pub get      # resolved cleanly

# 1. RED, run against the ORIGINAL unpatched starter (git-stashed main.dart before this fix):
$ flutter --suppress-analytics --no-version-check test challenges/latest_request_test.dart
00:00 +0 -1: late alpha success cannot overwrite newer beta data [E]
00:00 +0 -2: late alpha error cannot replace beta success with error [E]
00:00 +0 -3: overlapping reload of same tenant uses latest request [E]
00:00 +0 -4: alpha beta alpha switch cannot revive first alpha request [E]
Some tests failed.   (4 failing, as the mission states: "intentionally RED on the starter")

# 2. GREEN, same command, patch restored:
$ flutter --suppress-analytics --no-version-check test challenges/latest_request_test.dart
00:00 +0: late alpha success cannot overwrite newer beta data
00:00 +1: late alpha error cannot replace beta success with error
00:00 +2: overlapping reload of same tenant uses latest request
00:00 +3: alpha beta alpha switch cannot revive first alpha request
00:00 +4: All tests passed!

# 3. Full smoke suite, patched:
$ flutter --suppress-analytics --no-version-check test
00:00 +6: All tests passed!    (includes both disposal-safety smoke tests, unaffected by the fix)

# 4. Static analysis, patched:
$ flutter --suppress-analytics --no-version-check analyze
No issues found! (ran in 5.2s)
```

Full raw output: `submission/mobile-red-evidence.txt`, `submission/mobile-green-evidence.txt`,
`submission/mobile-smoke-evidence.txt`, `submission/mobile-analyze-evidence.txt`. A passing full
`flutter test` alone is not treated as proof the race is fixed — the RED→GREEN transition on the
explicit challenge command above is the actual evidence; the smoke suite only confirms no
regression elsewhere (disposal safety, offline fixture rendering, paise formatting).

## Lifecycle and active-error behavior

`mounted` is still checked first in both branches, preserving disposal safety independent of
request freshness — confirmed by the two disposal-safety smoke tests passing unchanged. An active
visible error can only be replaced by a *newer* request's own outcome (success or error), never
cleared or overwritten by an older, now-stale request — this is exactly what "late alpha error
cannot replace beta success with error" verifies, and it passed.

## Remaining risk

The installed toolchain (Flutter 3.47.2 / Dart 3.13.2) is newer than the mission's pinned
validated toolchain (Flutter 3.38.5 / Dart 3.10.4); the pubspec's version range permits it and all
tests/analysis passed, but dependency resolution pulled newer transitive package versions
(`pub get` reported 6 changed dependencies, e.g. `meta` 1.17.0→1.19.0), which is not guaranteed
identical to the pinned toolchain's resolution per the mission's own caveat ("a different SDK is
not promised identical dependency resolution"). `mobile/pubspec.lock` reflects this newer
resolution.
