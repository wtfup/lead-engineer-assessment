import 'dart:convert';
import 'package:flutter/services.dart';

class Invoice {
  final String id;
  final String tenant;
  final int amountPaise;
  final String status;

  const Invoice({required this.id, required this.tenant,
    required this.amountPaise, required this.status});

  factory Invoice.fromJson(Map<String, dynamic> json) => Invoice(
    id: json['id'] as String,
    tenant: json['tenant'] as String,
    amountPaise: json['amountPaise'] as int,
    status: json['status'] as String,
  );

  String get formattedAmount =>
    '${amountPaise ~/ 100}.${(amountPaise % 100).toString().padLeft(2, '0')}';
}

abstract class ApiClient {
  Future<List<Invoice>> loadInvoices(String tenant);
}

/// Asset-only fake. No network, credentials, server, or random timing.
class FixtureApiClient implements ApiClient {
  const FixtureApiClient();

  @override
  Future<List<Invoice>> loadInvoices(String tenant) async {
    final raw = await rootBundle.loadString('assets/invoices.json');
    await Future<void>.delayed(Duration(milliseconds: tenant == 'alpha' ? 900 : 100));
    return (jsonDecode(raw) as List)
      .map((row) => Invoice.fromJson(row as Map<String, dynamic>))
      .where((invoice) => invoice.tenant == tenant).toList();
  }
}
