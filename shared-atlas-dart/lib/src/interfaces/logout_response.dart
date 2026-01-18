class LogoutResponse {
  final String message;

  LogoutResponse({
    required this.message,
  });

  factory LogoutResponse.fromJson(Map<String, dynamic> json) {
    return LogoutResponse(
      message: json['message'] as String,
    );
  }
  Map<String, dynamic> toJson() {
    return {
      'message': this.message,
    };
  }
}