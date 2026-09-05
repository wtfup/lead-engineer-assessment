// Explicit challenge suite: intentionally RED on the public starter.
// Run separately from `flutter test`, which checks setup/smoke only.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:assessment_mobile/main.dart';
import '../test/support/controlled_api.dart';

void main() {
  testWidgets('late alpha success cannot overwrite newer beta data', (tester) async {
    final api = ControlledApi();
    await tester.pumpWidget(InvoiceApp(api: api));
    await tester.tap(find.byKey(const ValueKey('tenant-beta')));
    api.succeed(1);
    await tester.pump();
    expect(find.byKey(const ValueKey('beta-row')), findsOneWidget);
    api.succeed(0);
    await tester.pump();
    expect(find.text('Tenant: beta'), findsOneWidget);
    expect(find.byKey(const ValueKey('beta-row')), findsOneWidget);
    expect(find.byKey(const ValueKey('alpha-row')), findsNothing);
  });

  testWidgets('late alpha error cannot replace beta success with error', (tester) async {
    final api = ControlledApi();
    await tester.pumpWidget(InvoiceApp(api: api));
    await tester.tap(find.byKey(const ValueKey('tenant-beta')));
    api.succeed(1);
    await tester.pump();
    api.fail(0);
    await tester.pump();
    expect(find.byKey(const ValueKey('load-error')), findsNothing);
    expect(find.byKey(const ValueKey('beta-row')), findsOneWidget);
  });

  testWidgets('overlapping reload of same tenant uses latest request', (tester) async {
    final api = ControlledApi();
    await tester.pumpWidget(InvoiceApp(api: api));
    await tester.tap(find.byKey(const ValueKey('reload')));
    api.succeed(1, id: 'fresh-alpha');
    await tester.pump();
    api.succeed(0, id: 'stale-alpha');
    await tester.pump();
    expect(find.byKey(const ValueKey('fresh-alpha')), findsOneWidget);
    expect(find.byKey(const ValueKey('stale-alpha')), findsNothing);
  });

  testWidgets('alpha beta alpha switch cannot revive first alpha request', (tester) async {
    final api = ControlledApi();
    await tester.pumpWidget(InvoiceApp(api: api));
    await tester.tap(find.byKey(const ValueKey('tenant-beta')));
    await tester.tap(find.byKey(const ValueKey('tenant-alpha')));
    api.succeed(2, id: 'current-alpha');
    await tester.pump();
    api.succeed(1);
    api.succeed(0, id: 'obsolete-alpha');
    await tester.pump();
    expect(find.byKey(const ValueKey('current-alpha')), findsOneWidget);
    expect(find.byKey(const ValueKey('obsolete-alpha')), findsNothing);
    expect(find.byKey(const ValueKey('beta-row')), findsNothing);
  });
}
