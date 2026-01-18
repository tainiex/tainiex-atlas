import 'package:shared_atlas_dart/shared_atlas_dart.dart';

/// Prefix: Mobile
/// Used for mobile app authentication response.
class MobileAuthResponse {
  final IUser user;
  final dynamic tokens;

  MobileAuthResponse({
    required this.user,
    required this.tokens,
  });

  factory MobileAuthResponse.fromJson(Map<String, dynamic> json) {
    return MobileAuthResponse(
      user: IUser.fromJson(json['user'] as Map<String, dynamic>),
      tokens: json['tokens'] as dynamic,
    );
  }
  Map<String, dynamic> toJson() {
    return {
      'user': this.user.toJson(),
      'tokens': this.tokens,
    };
  }
}