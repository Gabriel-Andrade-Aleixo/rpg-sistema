import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:rpg_sheet_app/presentation/widgets/animated_dice.dart';

void main() {
  testWidgets('renderiza todos os poliedros com o resultado virado para cima', (
    tester,
  ) async {
    for (final sides in [4, 6, 8, 10, 12, 20, 100]) {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: AnimatedDice(sides: sides, rolling: false, result: sides),
          ),
        ),
      );
      await tester.pump();

      expect(
        find.bySemanticsLabel(
          'Dado d$sides com o número $sides virado para cima',
        ),
        findsOneWidget,
      );
      expect(tester.takeException(), isNull);
    }
  });

  testWidgets('anima a queda e conclui no resultado sorteado', (tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: AnimatedDice(sides: 20, rolling: true, result: 17),
        ),
      ),
    );
    await tester.pump(const Duration(milliseconds: 500));
    expect(
      find.bySemanticsLabel('Dado d20 rolando em três dimensões'),
      findsOneWidget,
    );

    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: AnimatedDice(sides: 20, rolling: false, result: 17),
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(
      find.bySemanticsLabel('Dado d20 com o número 17 virado para cima'),
      findsOneWidget,
    );
    expect(tester.takeException(), isNull);
  });
}
