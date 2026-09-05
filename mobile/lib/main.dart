import 'package:flutter/material.dart';
import 'api_client.dart';

void main() => runApp(const InvoiceApp());

class InvoiceApp extends StatelessWidget {
  final ApiClient api;
  const InvoiceApp({super.key, this.api = const FixtureApiClient()});

  @override
  Widget build(BuildContext context) => MaterialApp(
    title: 'Tenant Invoice Lab',
    theme: ThemeData(colorSchemeSeed: Colors.indigo, useMaterial3: true,
      fontFamily: 'Roboto', fontFamilyFallback: const ['Roboto']),
    home: InvoiceScreen(api: api),
  );
}

class InvoiceScreen extends StatefulWidget {
  final ApiClient api;
  const InvoiceScreen({super.key, required this.api});

  @override
  State<InvoiceScreen> createState() => _InvoiceScreenState();
}

class _InvoiceScreenState extends State<InvoiceScreen> {
  String _tenant = 'alpha';
  List<Invoice> _invoices = [];
  bool _loading = true;
  String? _error;
  int _requestId = 0;

  @override
  void initState() {
    super.initState();
    _load();
  }

  // Learning task: see candidate/04_LEARNING.md. Keep the client injectable.
  Future<void> _load() async {
    final requestedTenant = _tenant;
    final requestId = ++_requestId; // only the latest request may apply its result
    setState(() {
      _loading = true;
      _error = null;
      _invoices = [];
    });
    try {
      final invoices = await widget.api.loadInvoices(requestedTenant);
      if (!mounted || requestId != _requestId) return;
      setState(() {
        _invoices = invoices;
        _loading = false;
      });
    } catch (_) {
      if (!mounted || requestId != _requestId) return;
      setState(() {
        _error = 'Could not load invoices. Retry.';
        _loading = false;
      });
    }
  }

  void _selectTenant(String tenant) {
    setState(() => _tenant = tenant);
    _load();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Tenant Invoice Lab')),
    body: Padding(
      padding: const EdgeInsets.all(20),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Text('Synthetic data · offline · no sends'),
        const SizedBox(height: 12),
        Wrap(spacing: 8, children: [
          for (final tenant in ['alpha', 'beta'])
            OutlinedButton(
              key: ValueKey('tenant-$tenant'),
              onPressed: () => _selectTenant(tenant),
              child: Text('Open $tenant'),
            ),
          OutlinedButton(key: const ValueKey('reload'),
            onPressed: _load, child: const Text('Reload')),
        ]),
        const SizedBox(height: 16),
        Text('Tenant: $_tenant'),
        const SizedBox(height: 12),
        if (_loading) const CircularProgressIndicator(),
        if (_error != null) ...[
          Text(_error!, key: const ValueKey('load-error')),
          TextButton(key: const ValueKey('retry'),
            onPressed: _load, child: const Text('Retry')),
        ],
        if (!_loading && _error == null && _invoices.isEmpty)
          const Text('No invoices'),
        Expanded(child: ListView(children: [
          for (final invoice in _invoices)
            Padding(padding: const EdgeInsets.symmetric(vertical: 8),
              child: Text('${invoice.id} · INR ${invoice.formattedAmount} · ${invoice.status}',
                key: ValueKey(invoice.id))),
        ])),
      ]),
    ),
  );
}
