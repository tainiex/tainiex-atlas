import 'package:shared_atlas_dart/shared_atlas_dart.dart';

class AuthResponse {
  final IUser user;
  final dynamic tokens;

  AuthResponse({
    required this.user,
    required this.tokens,
  });

  factory AuthResponse.fromJson(Map<String, dynamic> json) {
    return AuthResponse(
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