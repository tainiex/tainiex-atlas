/// Represents a User entity in the system for frontend consumption.
/// Contains public profile information. Sensitive data like passwords are excluded.
class IUser {
  /// Unique UUID of the user.
  final String id;
  /// Unique username chosen by the user.
  final String username;
  /// Email address of the user.
  final String email;
  /// URL to the user's avatar image.
  /// Can be a GCS signed URL or external URL (e.g., Google profile picture).
  final String? avatar;
  /// Timestamp when the user account was registered.
  final DateTime createdAt;
  /// Timestamp when the user profile was last updated.
  final DateTime updatedAt;

  IUser({
    required this.id,
    required this.username,
    required this.email,
    this.avatar,
    required this.createdAt,
    required this.updatedAt,
  });

  factory IUser.fromJson(Map<String, dynamic> json) {
    return IUser(
      id: json['id'] as String,
      username: json['username'] as String,
      email: json['email'] as String,
      avatar: json['avatar'] as String?,
      createdAt: DateTime.parse(json['createdAt'] as String),
      updatedAt: DateTime.parse(json['updatedAt'] as String),
    );
  }
  Map<String, dynamic> toJson() {
    return {
      'id': this.id,
      'username': this.username,
      'email': this.email,
      'avatar': this.avatar,
      'createdAt': this.createdAt.toIso8601String(),
      'updatedAt': this.updatedAt.toIso8601String(),
    };
  }
}