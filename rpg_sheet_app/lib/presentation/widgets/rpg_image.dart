import 'package:flutter/material.dart';

class RpgImage extends StatelessWidget {
  const RpgImage({
    super.key,
    required this.url,
    this.width,
    this.height,
    this.fit = BoxFit.cover,
    this.icon = Icons.shield_outlined,
  });

  final String url;
  final double? width;
  final double? height;
  final BoxFit fit;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    Widget fallback() => Container(
      width: width,
      height: height,
      color: Theme.of(context).colorScheme.surfaceContainerHighest,
      alignment: Alignment.center,
      child: Icon(icon, size: 40, color: Theme.of(context).colorScheme.primary),
    );
    if (url.trim().isEmpty) return fallback();
    return Image.network(
      url,
      width: width,
      height: height,
      fit: fit,
      errorBuilder: (_, _, _) => fallback(),
      loadingBuilder: (context, child, progress) =>
          progress == null ? child : fallback(),
    );
  }
}
