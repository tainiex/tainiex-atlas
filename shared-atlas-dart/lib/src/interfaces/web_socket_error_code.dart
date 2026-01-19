enum WebSocketErrorCode {
  // @JsonValue('4010')
  AUTH_TOKEN_MISSING('4010'),
  // @JsonValue('4011')
  AUTH_TOKEN_INVALID('4011'),
  // @JsonValue('4012')
  AUTH_TOKEN_EXPIRED('4012'),
  // @JsonValue('4030')
  PERMISSION_DENIED('4030'),
  // @JsonValue('4031')
  RATE_LIMIT_EXCEEDED('4031'),
  // @JsonValue('4032')
  CONCURRENT_LIMIT_REACHED('4032'),
  // @JsonValue('4220')
  INVALID_PAYLOAD('4220'),
  // @JsonValue('4221')
  NOTE_NOT_FOUND('4221'),
  // @JsonValue('4222')
  SESSION_NOT_FOUND('4222'),
  // @JsonValue('5000')
  INTERNAL_ERROR('5000'),
  // @JsonValue('5001')
  DATABASE_ERROR('5001'),
  // @JsonValue('5002')
  YJS_SYNC_FAILED('5002');

  final String value;
  const WebSocketErrorCode(this.value);

  factory WebSocketErrorCode.fromJson(dynamic json) {
    return WebSocketErrorCode.values.firstWhere((e) => e.value == json.toString(), orElse: () => WebSocketErrorCode.values.first);
  }

  String toJson() => value;
}