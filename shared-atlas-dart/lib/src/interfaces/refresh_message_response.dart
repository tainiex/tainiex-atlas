class RefreshMessageResponse {
  final String message;

  RefreshMessageResponse({
    required this.message,
  });

  factory RefreshMessageResponse.fromJson(Map<String, dynamic> json) {
    return RefreshMessageResponse(
      message: json['message'] as String,
    );
  }
  Map<String, dynamic> toJson() {
    return {
      'message': this.message,
    };
  }
}