import 'package:shared_atlas_dart/shared_atlas_dart.dart';

/// Upload File Query DTO
/// 上传文件查询 DTO
/// 
/// Validates query parameters for file upload endpoint.
/// 验证文件上传端点的查询参数。
class UploadFileQueryDto {
  /// Module prefix for directory separation
  /// 目录分离的模块前缀
  final StorageModule? module;
  /// Target folder within the module
  /// 模块内的目标文件夹
  final String? folder;

  UploadFileQueryDto({
    this.module,
    this.folder,
  });

  factory UploadFileQueryDto.fromJson(Map<String, dynamic> json) {
    return UploadFileQueryDto(
      module: json['module'] == null ? null : StorageModule.fromJson(json['module']),
      folder: json['folder'] as String?,
    );
  }
  Map<String, dynamic> toJson() {
    return {
      'module': this.module?.toJson(),
      'folder': this.folder,
    };
  }
}