class IVectorStoreRecord {
  final String id;
  final String content;
  final List<num> embedding;
  final dynamic metadata;

  IVectorStoreRecord({
    required this.id,
    required this.content,
    required this.embedding,
    required this.metadata,
  });

  factory IVectorStoreRecord.fromJson(Map<String, dynamic> json) {
    return IVectorStoreRecord(
      id: json['id'] as String,
      content: json['content'] as String,
      embedding: (json['embedding'] as List<dynamic>).map((e) => e as num).toList(),
      metadata: json['metadata'] as dynamic,
    );
  }
  Map<String, dynamic> toJson() {
    return {
      'id': this.id,
      'content': this.content,
      'embedding': this.embedding,
      'metadata': this.metadata,
    };
  }
}