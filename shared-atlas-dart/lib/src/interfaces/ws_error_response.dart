import 'package:shared_atlas_dart/shared_atlas_dart.dart';

class WsErrorResponse {
  final WebSocketErrorCode code;
  final String message;
  final dynamic category;
  final dynamic details;
  final String timestamp;

  WsErrorResponse({
    required this.code,
    required this.message,
    required this.category,
    this.details,
    required this.timestamp,
  });

  factory WsErrorResponse.fromJson(Map<String, dynamic> json) {
    return WsErrorResponse(
      code: WebSocketErrorCode.fromJson(json['code']),
      message: json['message'] as String,
      category: json['category'] as dynamic,
      details: json['details'] as dynamic,
      timestamp: json['timestamp'] as String,
    );
  }
  Map<String, dynamic> toJson() {
    return {
      'code': this.code.toJson(),
      'message': this.message,
      'category': this.category,
      'details': this.details,
      'timestamp': this.timestamp,
    };
  }
}