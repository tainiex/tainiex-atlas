import 'package:shared_atlas_dart/shared_atlas_dart.dart';

class UploadFileQueryDto {
  final StorageModule? module;
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