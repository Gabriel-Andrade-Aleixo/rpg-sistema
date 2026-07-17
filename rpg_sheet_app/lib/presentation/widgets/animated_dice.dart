import 'dart:math';

import 'package:flutter/material.dart';

class AnimatedDice extends StatefulWidget {
  const AnimatedDice({
    super.key,
    required this.sides,
    required this.rolling,
    required this.result,
  });

  final int sides;
  final bool rolling;
  final int result;

  @override
  State<AnimatedDice> createState() => _AnimatedDiceState();
}

class _AnimatedDiceState extends State<AnimatedDice>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1100),
    );
    if (widget.rolling) _controller.repeat();
  }

  @override
  void didUpdateWidget(covariant AnimatedDice oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.rolling && !oldWidget.rolling) _controller.repeat();
    if (!widget.rolling && oldWidget.rolling) {
      _controller.stop();
      _controller.animateTo(1, duration: const Duration(milliseconds: 180));
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => SizedBox(
    width: 180,
    height: 190,
    child: AnimatedBuilder(
      animation: _controller,
      builder: (context, child) {
        final progress = widget.rolling ? _controller.value : 1.0;
        final fall = min(1.0, progress / .72);
        final bounce = progress <= .72
            ? 0.0
            : sin(((progress - .72) / .28) * pi * 2).abs() *
                  18 *
                  (1 - ((progress - .72) / .28));
        final lift = -74 * pow(1 - fall, 2) - bounce;
        final matrix = Matrix4.identity()
          ..setEntry(3, 2, .0014)
          ..translateByDouble(0.0, lift.toDouble(), 0.0, 1.0)
          ..rotateX((1 - progress) * pi * 6)
          ..rotateY((1 - progress) * pi * 8)
          ..rotateZ((1 - progress) * pi * 4);
        return Transform(
          alignment: Alignment.center,
          transform: matrix,
          child: child,
        );
      },
      child: Stack(
        alignment: Alignment.center,
        children: [
          Transform.translate(
            offset: const Offset(9, 10),
            child: Container(
              width: 132,
              height: 132,
              decoration: BoxDecoration(
                color: Theme.of(context).colorScheme.secondaryContainer,
                borderRadius: BorderRadius.circular(8),
              ),
            ),
          ),
          Container(
            width: 140,
            height: 140,
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [
                  Theme.of(context).colorScheme.primary.withValues(alpha: .92),
                  Theme.of(context).colorScheme.primary,
                  Theme.of(context).colorScheme.primaryContainer,
                ],
              ),
              border: Border.all(
                color: Theme.of(context).colorScheme.secondary,
                width: 2,
              ),
              borderRadius: BorderRadius.circular(8),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: .34),
                  blurRadius: 24,
                  offset: const Offset(0, 16),
                ),
              ],
            ),
            child: CustomPaint(
              painter: _DiceFacetPainter(
                line: Theme.of(
                  context,
                ).colorScheme.secondary.withValues(alpha: .34),
                glow: Theme.of(
                  context,
                ).colorScheme.tertiary.withValues(alpha: .18),
              ),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(
                    'd${widget.sides}',
                    style: TextStyle(
                      color: Theme.of(context).colorScheme.secondary,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  Text(
                    '${widget.result}',
                    style: Theme.of(context).textTheme.displayMedium?.copyWith(
                      color: Theme.of(context).colorScheme.onPrimary,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    ),
  );
}

class _DiceFacetPainter extends CustomPainter {
  const _DiceFacetPainter({required this.line, required this.glow});

  final Color line;
  final Color glow;

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final glowPaint = Paint()
      ..shader = RadialGradient(
        colors: [glow, Colors.transparent],
      ).createShader(Rect.fromCircle(center: center, radius: size.width * .58));
    canvas.drawCircle(center, size.width * .58, glowPaint);

    final paint = Paint()
      ..color = line
      ..strokeWidth = 1.2
      ..style = PaintingStyle.stroke;
    final path = Path()
      ..moveTo(size.width * .18, size.height * .18)
      ..lineTo(size.width * .82, size.height * .18)
      ..lineTo(size.width * .5, size.height * .86)
      ..close()
      ..moveTo(size.width * .18, size.height * .82)
      ..lineTo(size.width * .82, size.height * .82)
      ..lineTo(size.width * .5, size.height * .14)
      ..close()
      ..moveTo(size.width * .5, size.height * .1)
      ..lineTo(size.width * .5, size.height * .9)
      ..moveTo(size.width * .1, size.height * .5)
      ..lineTo(size.width * .9, size.height * .5);
    canvas.drawPath(path, paint);
  }

  @override
  bool shouldRepaint(covariant _DiceFacetPainter oldDelegate) =>
      oldDelegate.line != line || oldDelegate.glow != glow;
}
