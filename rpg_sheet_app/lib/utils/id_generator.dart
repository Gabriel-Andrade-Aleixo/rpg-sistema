String newId(String prefix) {
  final now = DateTime.now().microsecondsSinceEpoch;
  return '${prefix}_$now';
}
