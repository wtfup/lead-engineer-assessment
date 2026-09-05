import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:assessment_mobile/main.dart';
import 'support/controlled_api.dart';

void main() {
  testWidgets('active error is visible and retry can succeed', (tester) async {
    final api = ControlledApi();
    await tester.pumpWidget(InvoiceApp(api: api));
    expect(find.byType(CircularProgressIndicator), findsOneWidget);
    api.fail(0);
    await tester.pump();
    expect(find.byKey(const ValueKey('load-error')), findsOneWidget);
    await tester.tap(find.byKey(const ValueKey('retry')));
    await tester.pump();
    expect(find.byKey(const ValueKey('load-error')), findsNothing);
    api.succeed(1);
    await tester.pump();
    expect(find.byKey(const ValueKey('alpha-row')), findsOneWidget);
  });

  testWidgets('switch clears old visible rows while loading', (tester) async {
    final api = ControlledApi();
    await tester.pumpWidget(InvoiceApp(api: api));
    api.succeed(0);
    await tester.pump();
    await tester.tap(find.byKey(const ValueKey('tenant-beta')));
    await tester.pump();
    expect(find.byKey(const ValueKey('alpha-row')), findsNothing);
    expect(find.text('Tenant: beta'), findsOneWidget);
    expect(find.byType(CircularProgressIndicator), findsOneWidget);
    api.succeed(1);
    await tester.pump();
  });

  testWidgets('empty success is not reported as an error', (tester) async {
    final api = ControlledApi();
    await tester.pumpWidget(InvoiceApp(api: api));
    api.requests[0].completer.complete([]);
    await tester.pump();
    expect(find.text('No invoices'), findsOneWidget);
    expect(find.byKey(const ValueKey('load-error')), findsNothing);
  });

  for (final fail in [false, true]) {
    testWidgets('completion after disposal is safe (failure=$fail)', (tester) async {
      final api = ControlledApi();
      await tester.pumpWidget(InvoiceApp(api: api));
      await tester.pumpWidget(const SizedBox.shrink());
      if (fail) { api.fail(0); } else { api.succeed(0); }
      await tester.pump();
      expect(tester.takeException(), isNull);
    });
  }
}
