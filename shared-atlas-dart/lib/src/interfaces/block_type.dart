/// Enum defining the type of a content block in a note.
/// 定义笔记中内容块的类型。
/// 
/// Usage / 使用场景:
/// - `IBlock.type`
/// - `CreateBlockDto.type`
enum BlockType {
  // @JsonValue('TEXT')
  TEXT('TEXT'),
  // @JsonValue('HEADING1')
  HEADING1('HEADING1'),
  // @JsonValue('HEADING2')
  HEADING2('HEADING2'),
  // @JsonValue('HEADING3')
  HEADING3('HEADING3'),
  // @JsonValue('BULLET_LIST')
  BULLET_LIST('BULLET_LIST'),
  // @JsonValue('NUMBERED_LIST')
  NUMBERED_LIST('NUMBERED_LIST'),
  // @JsonValue('TODO_LIST')
  TODO_LIST('TODO_LIST'),
  // @JsonValue('TODO_ITEM')
  TODO_ITEM('TODO_ITEM'),
  // @JsonValue('TABLE')
  TABLE('TABLE'),
  // @JsonValue('CODE')
  CODE('CODE'),
  // @JsonValue('IMAGE')
  IMAGE('IMAGE'),
  // @JsonValue('VIDEO')
  VIDEO('VIDEO'),
  // @JsonValue('FILE')
  FILE('FILE'),
  // @JsonValue('DIVIDER')
  DIVIDER('DIVIDER'),
  // @JsonValue('QUOTE')
  QUOTE('QUOTE'),
  // @JsonValue('CALLOUT')
  CALLOUT('CALLOUT'),
  // @JsonValue('TOGGLE')
  TOGGLE('TOGGLE');

  final String value;
  const BlockType(this.value);

  factory BlockType.fromJson(dynamic json) {
    return BlockType.values.firstWhere((e) => e.value == json.toString(), orElse: () => BlockType.values.first);
  }

  String toJson() => value;
}