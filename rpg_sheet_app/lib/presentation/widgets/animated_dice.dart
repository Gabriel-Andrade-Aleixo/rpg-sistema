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
      duration: const Duration(milliseconds: 1250),
      value: widget.rolling ? 0 : 1,
    );
    if (widget.rolling) _controller.forward();
  }

  @override
  void didUpdateWidget(covariant AnimatedDice oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.rolling &&
        (!oldWidget.rolling || oldWidget.sides != widget.sides)) {
      _controller.forward(from: 0);
      return;
    }
    if (!widget.rolling && oldWidget.rolling) {
      final remaining = (1 - _controller.value).clamp(0.0, 1.0);
      _controller.animateTo(
        1,
        duration: Duration(milliseconds: max(240, (remaining * 720).round())),
        curve: Curves.easeOutCubic,
      );
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Semantics(
      image: true,
      label: widget.rolling
          ? 'Dado d${widget.sides} rolando em três dimensões'
          : 'Dado d${widget.sides} com o número ${widget.result} virado para cima',
      child: SizedBox(
        width: 230,
        height: 238,
        child: AnimatedBuilder(
          animation: _controller,
          builder: (context, _) => CustomPaint(
            painter: _PolyhedronDicePainter(
              sides: widget.sides,
              result: widget.result,
              progress: _controller.value,
              rolling: widget.rolling,
              primary: scheme.primary,
              primaryContainer: scheme.primaryContainer,
              edge: scheme.secondary,
              ink: scheme.onPrimary,
              shadow: scheme.shadow,
            ),
          ),
        ),
      ),
    );
  }
}

class _PolyhedronDicePainter extends CustomPainter {
  const _PolyhedronDicePainter({
    required this.sides,
    required this.result,
    required this.progress,
    required this.rolling,
    required this.primary,
    required this.primaryContainer,
    required this.edge,
    required this.ink,
    required this.shadow,
  });

  final int sides;
  final int result;
  final double progress;
  final bool rolling;
  final Color primary;
  final Color primaryContainer;
  final Color edge;
  final Color ink;
  final Color shadow;

  static final Map<int, _Polyhedron> _models = {};

  @override
  void paint(Canvas canvas, Size size) {
    final model = _models.putIfAbsent(sides, () => _polyhedronFor(sides));
    if (model.faces.isEmpty) return;

    final selectedIndex = (max(1, result) - 1) % model.faces.length;
    final settled = _settledRotation(model, model.faces[selectedIndex]);
    final fall = min(1.0, progress / .7);
    final landing = progress <= .7 ? 0.0 : (progress - .7) / .3;
    final settle = landing * landing * (3 - 2 * landing);
    final spin = pow(1 - progress, 1.12).toDouble();
    final rotation =
        _Mat3.rotationZ(spin * pi * (5 + result % 2)) *
        _Mat3.rotationY(spin * pi * (9 + result % 4)) *
        _Mat3.rotationX(spin * pi * (7 + result % 3)) *
        settled;
    final bounce = landing > 0
        ? sin(landing * pi * 2.45).abs() * .48 * (1 - landing)
        : 0.0;
    final translation = _Vec3(
      -1.45 * pow(1 - fall, 2).toDouble(),
      3.1 * (1 - fall * fall) + bounce,
      .35 * sin(fall * pi) * (1 - fall),
    );
    final worldVertices = model.vertices
        .map((vertex) => rotation.transform(vertex) + translation)
        .toList();
    final camera = const _Vec3(0, 3.5, 7.2);
    final target = const _Vec3(0, .05, 0);
    final forward = (target - camera).normalized;
    final right = forward.cross(const _Vec3(0, 1, 0)).normalized;
    final cameraUp = right.cross(forward).normalized;
    final focal = size.shortestSide * 2.22;
    final stageCenter = Offset(size.width / 2, size.height * .52);

    Offset project(_Vec3 point) {
      final relative = point - camera;
      final depth = max(.1, relative.dot(forward));
      return Offset(
        stageCenter.dx + focal * relative.dot(right) / depth,
        stageCenter.dy - focal * relative.dot(cameraUp) / depth,
      );
    }

    final haloProgress = landing <= 0 ? 0.0 : sin(min(1, landing * 1.6) * pi);
    final shadowCenter = project(const _Vec3(0, -1.28, 0));
    final shadowPaint = Paint()
      ..color = shadow.withValues(alpha: .25 + haloProgress * .08)
      ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 13);
    canvas.drawOval(
      Rect.fromCenter(
        center: shadowCenter,
        width: 138 + haloProgress * 22,
        height: 31 + haloProgress * 7,
      ),
      shadowPaint,
    );
    if (haloProgress > 0) {
      canvas.drawOval(
        Rect.fromCenter(
          center: shadowCenter,
          width: 118 + landing * 42,
          height: 25 + landing * 8,
        ),
        Paint()
          ..color = edge.withValues(alpha: haloProgress * .32)
          ..style = PaintingStyle.stroke
          ..strokeWidth = 2,
      );
    }

    final visibleFaces = <_ProjectedFace>[];
    for (var index = 0; index < model.faces.length; index++) {
      final face = model.faces[index];
      final vertices = face
          .map((vertexIndex) => worldVertices[vertexIndex])
          .toList();
      final center = _average(vertices);
      final normal = _faceNormal(vertices);
      if (normal.dot(camera - center) <= 0) continue;
      visibleFaces.add(
        _ProjectedFace(
          index: index,
          world: vertices,
          screen: vertices.map(project).toList(),
          center: center,
          normal: normal,
          depth: (center - camera).dot(forward),
        ),
      );
    }
    visibleFaces.sort((a, b) => b.depth.compareTo(a.depth));

    const light = _Vec3(-.35, .82, .48);
    for (final face in visibleFaces) {
      final path = Path()..moveTo(face.screen.first.dx, face.screen.first.dy);
      for (final point in face.screen.skip(1)) {
        path.lineTo(point.dx, point.dy);
      }
      path.close();
      final brightness =
          (.38 + max(0.0, face.normal.dot(light.normalized)) * .62).clamp(
            0.0,
            1.0,
          );
      final isSelected = face.index == selectedIndex;
      final litPrimary = Color.lerp(primaryContainer, primary, brightness)!;
      final fill = isSelected
          ? Color.lerp(litPrimary, edge, .15 + settle * .12)!
          : litPrimary;
      canvas.drawPath(path, Paint()..color = fill);
      canvas.drawPath(
        path,
        Paint()
          ..color = edge.withValues(alpha: isSelected ? .95 : .62)
          ..style = PaintingStyle.stroke
          ..strokeJoin = StrokeJoin.round
          ..strokeWidth = isSelected ? 2.3 : 1.35,
      );
      _drawFaceNumber(
        canvas,
        face,
        value: _faceValue(face.index, selectedIndex),
        selected: isSelected,
      );
    }

    final dieLabel = TextPainter(
      text: TextSpan(
        text: 'd$sides',
        style: TextStyle(
          color: edge.withValues(alpha: .9),
          fontSize: 15,
          fontWeight: FontWeight.w800,
        ),
      ),
      textDirection: TextDirection.ltr,
    )..layout();
    dieLabel.paint(
      canvas,
      Offset((size.width - dieLabel.width) / 2, size.height - 21),
    );
  }

  int _faceValue(int faceIndex, int selectedIndex) {
    final offset = (faceIndex - selectedIndex) % _models[sides]!.faces.length;
    return ((result - 1 + offset) % sides) + 1;
  }

  void _drawFaceNumber(
    Canvas canvas,
    _ProjectedFace face, {
    required int value,
    required bool selected,
  }) {
    final center =
        face.screen.reduce((a, b) => a + b) / face.screen.length.toDouble();
    final radius = face.screen
        .map((point) => (point - center).distance)
        .reduce(min);
    if (radius < 6) return;

    var angle = atan2(
      face.screen[1].dy - face.screen[0].dy,
      face.screen[1].dx - face.screen[0].dx,
    );
    if (angle > pi / 2) angle -= pi;
    if (angle < -pi / 2) angle += pi;
    final badgeRadius = min(selected ? 26.0 : 19.0, radius * .72);
    final fontSize = min(selected ? 28.0 : 20.0, max(8.0, badgeRadius * .92));

    canvas.save();
    canvas.translate(center.dx, center.dy);
    canvas.rotate(angle);
    canvas.drawCircle(
      Offset.zero,
      badgeRadius,
      Paint()..color = const Color(0xDB0A0910),
    );
    canvas.drawCircle(
      Offset.zero,
      badgeRadius,
      Paint()
        ..color = edge.withValues(alpha: selected ? 1 : .72)
        ..style = PaintingStyle.stroke
        ..strokeWidth = selected ? 2.1 : 1.1,
    );
    final painter = TextPainter(
      text: TextSpan(
        text: '$value',
        style: TextStyle(
          color: ink,
          fontSize: fontSize,
          fontWeight: FontWeight.w900,
          height: 1,
        ),
      ),
      textDirection: TextDirection.ltr,
      textAlign: TextAlign.center,
    )..layout();
    painter.paint(canvas, Offset(-painter.width / 2, -painter.height / 2));
    canvas.restore();
  }

  @override
  bool shouldRepaint(covariant _PolyhedronDicePainter oldDelegate) =>
      oldDelegate.sides != sides ||
      oldDelegate.result != result ||
      oldDelegate.progress != progress ||
      oldDelegate.rolling != rolling ||
      oldDelegate.primary != primary ||
      oldDelegate.edge != edge;
}

class _ProjectedFace {
  const _ProjectedFace({
    required this.index,
    required this.world,
    required this.screen,
    required this.center,
    required this.normal,
    required this.depth,
  });

  final int index;
  final List<_Vec3> world;
  final List<Offset> screen;
  final _Vec3 center;
  final _Vec3 normal;
  final double depth;
}

class _Polyhedron {
  const _Polyhedron(this.vertices, this.faces);

  final List<_Vec3> vertices;
  final List<List<int>> faces;
}

_Polyhedron _polyhedronFor(int sides) {
  final phi = (1 + sqrt(5)) / 2;
  final inversePhi = 1 / phi;
  late final List<_Vec3> vertices;
  if (sides == 4) {
    vertices = const [
      _Vec3(1, 1, 1),
      _Vec3(-1, -1, 1),
      _Vec3(-1, 1, -1),
      _Vec3(1, -1, -1),
    ];
  } else if (sides == 6) {
    vertices = [
      for (final x in [-1.0, 1.0])
        for (final y in [-1.0, 1.0])
          for (final z in [-1.0, 1.0]) _Vec3(x, y, z),
    ];
  } else if (sides == 8) {
    vertices = const [
      _Vec3(1, 0, 0),
      _Vec3(-1, 0, 0),
      _Vec3(0, 1, 0),
      _Vec3(0, -1, 0),
      _Vec3(0, 0, 1),
      _Vec3(0, 0, -1),
    ];
  } else if (sides == 10) {
    vertices = [
      const _Vec3(0, 1.25, 0),
      const _Vec3(0, -1.25, 0),
      for (var index = 0; index < 5; index++)
        _Vec3(
          cos(-pi / 2 + index * pi * 2 / 5) * 1.18,
          0,
          sin(-pi / 2 + index * pi * 2 / 5) * 1.18,
        ),
    ];
  } else if (sides == 12) {
    vertices = [
      for (final x in [-1.0, 1.0])
        for (final y in [-1.0, 1.0])
          for (final z in [-1.0, 1.0]) _Vec3(x, y, z),
      for (final y in [-inversePhi, inversePhi])
        for (final z in [-phi, phi]) _Vec3(0, y, z),
      for (final x in [-inversePhi, inversePhi])
        for (final y in [-phi, phi]) _Vec3(x, y, 0),
      for (final x in [-phi, phi])
        for (final z in [-inversePhi, inversePhi]) _Vec3(x, 0, z),
    ];
  } else {
    vertices = [
      for (final y in [-1.0, 1.0])
        for (final z in [-phi, phi]) _Vec3(0, y, z),
      for (final x in [-1.0, 1.0])
        for (final y in [-phi, phi]) _Vec3(x, y, 0),
      for (final x in [-phi, phi])
        for (final z in [-1.0, 1.0]) _Vec3(x, 0, z),
    ];
  }

  final radius = vertices.map((vertex) => vertex.length).reduce(max);
  final normalized = vertices
      .map((vertex) => vertex * (1.18 / radius))
      .toList();
  return _Polyhedron(normalized, _convexHullFaces(normalized));
}

List<List<int>> _convexHullFaces(List<_Vec3> vertices) {
  const epsilon = .001;
  final facesByKey = <String, List<int>>{};
  for (var i = 0; i < vertices.length - 2; i++) {
    for (var j = i + 1; j < vertices.length - 1; j++) {
      for (var k = j + 1; k < vertices.length; k++) {
        var normal = (vertices[j] - vertices[i]).cross(
          vertices[k] - vertices[i],
        );
        if (normal.length < epsilon) continue;
        normal = normal.normalized;
        var hasPositive = false;
        var hasNegative = false;
        for (final vertex in vertices) {
          final distance = normal.dot(vertex - vertices[i]);
          if (distance > epsilon) hasPositive = true;
          if (distance < -epsilon) hasNegative = true;
        }
        if (hasPositive && hasNegative) continue;

        final coplanar = <int>[];
        for (var index = 0; index < vertices.length; index++) {
          if (normal.dot(vertices[index] - vertices[i]).abs() <= epsilon) {
            coplanar.add(index);
          }
        }
        if (coplanar.length < 3) continue;
        final keyValues = [...coplanar]..sort();
        final key = keyValues.join(':');
        if (facesByKey.containsKey(key)) continue;

        final center = _average(
          coplanar.map((index) => vertices[index]).toList(),
        );
        if (normal.dot(center) < 0) normal = normal * -1;
        final axisX = (vertices[coplanar.first] - center).normalized;
        final axisY = normal.cross(axisX).normalized;
        coplanar.sort((a, b) {
          final deltaA = vertices[a] - center;
          final deltaB = vertices[b] - center;
          final angleA = atan2(deltaA.dot(axisY), deltaA.dot(axisX));
          final angleB = atan2(deltaB.dot(axisY), deltaB.dot(axisX));
          return angleA.compareTo(angleB);
        });
        facesByKey[key] = coplanar;
      }
    }
  }
  return facesByKey.values.toList();
}

_Mat3 _settledRotation(_Polyhedron model, List<int> face) {
  final vertices = face.map((index) => model.vertices[index]).toList();
  final center = _average(vertices);
  var normal = _faceNormal(vertices);
  if (normal.dot(center) < 0) normal = normal * -1;
  var axisX = (vertices[1] - vertices[0]).normalized;
  axisX = (axisX - normal * axisX.dot(normal)).normalized;
  final axisZ = axisX.cross(normal).normalized;
  return _Mat3([
    axisX.x,
    axisX.y,
    axisX.z,
    normal.x,
    normal.y,
    normal.z,
    axisZ.x,
    axisZ.y,
    axisZ.z,
  ]);
}

_Vec3 _average(List<_Vec3> values) =>
    values.fold<_Vec3>(const _Vec3(0, 0, 0), (sum, value) => sum + value) *
    (1 / values.length);

_Vec3 _faceNormal(List<_Vec3> vertices) =>
    (vertices[1] - vertices[0]).cross(vertices[2] - vertices[0]).normalized;

class _Mat3 {
  const _Mat3(this.values);

  final List<double> values;

  factory _Mat3.rotationX(double angle) {
    final c = cos(angle);
    final s = sin(angle);
    return _Mat3([1, 0, 0, 0, c, -s, 0, s, c]);
  }

  factory _Mat3.rotationY(double angle) {
    final c = cos(angle);
    final s = sin(angle);
    return _Mat3([c, 0, s, 0, 1, 0, -s, 0, c]);
  }

  factory _Mat3.rotationZ(double angle) {
    final c = cos(angle);
    final s = sin(angle);
    return _Mat3([c, -s, 0, s, c, 0, 0, 0, 1]);
  }

  _Vec3 transform(_Vec3 vector) => _Vec3(
    values[0] * vector.x + values[1] * vector.y + values[2] * vector.z,
    values[3] * vector.x + values[4] * vector.y + values[5] * vector.z,
    values[6] * vector.x + values[7] * vector.y + values[8] * vector.z,
  );

  _Mat3 operator *(_Mat3 other) {
    final result = List<double>.filled(9, 0);
    for (var row = 0; row < 3; row++) {
      for (var column = 0; column < 3; column++) {
        for (var index = 0; index < 3; index++) {
          result[row * 3 + column] +=
              values[row * 3 + index] * other.values[index * 3 + column];
        }
      }
    }
    return _Mat3(result);
  }
}

class _Vec3 {
  const _Vec3(this.x, this.y, this.z);

  final double x;
  final double y;
  final double z;

  double get length => sqrt(x * x + y * y + z * z);
  _Vec3 get normalized => length == 0 ? this : this * (1 / length);

  _Vec3 operator +(_Vec3 other) => _Vec3(x + other.x, y + other.y, z + other.z);
  _Vec3 operator -(_Vec3 other) => _Vec3(x - other.x, y - other.y, z - other.z);
  _Vec3 operator *(double scalar) => _Vec3(x * scalar, y * scalar, z * scalar);
  double dot(_Vec3 other) => x * other.x + y * other.y + z * other.z;
  _Vec3 cross(_Vec3 other) => _Vec3(
    y * other.z - z * other.y,
    z * other.x - x * other.z,
    x * other.y - y * other.x,
  );
}
