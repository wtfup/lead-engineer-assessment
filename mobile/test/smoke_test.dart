import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:assessment_mobile/main.dart';

void main() {
  testWidgets('offline fixture loads and renders integer paise accurately', (tester) async {
    await tester.pumpWidget(const InvoiceApp());
    await tester.pumpAndSettle(const Duration(milliseconds: 100));
    expect(find.text('alpha-101 · INR 1234.56 · pending'), findsOneWidget);
    expect(find.text('Tenant: alpha'), findsOneWidget);
    expect(find.byType(CircularProgressIndicator), findsNothing);
  });
}
