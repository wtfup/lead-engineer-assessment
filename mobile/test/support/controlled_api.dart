import 'dart:async';
import 'package:assessment_mobile/api_client.dart';

class PendingRequest {
  final String tenant;
  final Completer<List<Invoice>> completer = Completer<List<Invoice>>();
  PendingRequest(this.tenant);
}

class ControlledApi implements ApiClient {
  final List<PendingRequest> requests = [];

  @override
  Future<List<Invoice>> loadInvoices(String tenant) {
    final request = PendingRequest(tenant);
    requests.add(request);
    return request.completer.future;
  }

  void succeed(int index, {String? id}) {
    final request = requests[index];
    request.completer.complete([Invoice(id: id ?? '${request.tenant}-row',
      tenant: request.tenant, amountPaise: 105, status: 'pending')]);
  }

  void fail(int index) => requests[index].completer.completeError(Exception('lab failure'));
}
