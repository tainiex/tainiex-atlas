import 'package:shared_atlas_dart/shared_atlas_dart.dart';

/// Refresh Token Response for Mobile
/// Mobile clients expect tokens wrapped in a tokens object
class RefreshTokenResponse {
  final TokenResponse tokens;

  RefreshTokenResponse({
    required this.tokens,
  });

  factory RefreshTokenResponse.fromJson(Map<String, dynamic> json) {
    return RefreshTokenResponse(
      tokens: TokenResponse.fromJson(json['tokens'] as Map<String, dynamic>),
    );
  }
  Map<String, dynamic> toJson() {
    return {
      'tokens': this.tokens.toJson(),
    };
  }
}