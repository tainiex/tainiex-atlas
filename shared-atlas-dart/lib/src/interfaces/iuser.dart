class IUser {
  final String id;
  final String username;
  final String email;
  final String? avatar;
  final DateTime createdAt;
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