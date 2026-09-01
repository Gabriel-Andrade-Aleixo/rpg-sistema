import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:rpg_sheet_app/core/theme/app_theme.dart';

void main() {
  testWidgets('rolagem longa não instala camada de overscroll no Android', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.dark,
        scrollBehavior: const RunalithScrollBehavior(),
        home: Scaffold(
          body: ListView.builder(
            itemCount: 80,
            itemBuilder: (_, index) =>
                SizedBox(height: 72, child: Text('Linha $index')),
          ),
        ),
      ),
    );

    await tester.fling(find.byType(ListView), const Offset(0, -3000), 5000);
    await tester.pumpAndSettle();
    await tester.fling(find.byType(ListView), const Offset(0, 1400), 4000);
    await tester.pumpAndSettle();

    expect(find.byType(StretchingOverscrollIndicator), findsNothing);
    expect(find.byType(GlowingOverscrollIndicator), findsNothing);
    expect(
      tester.widget<Scaffold>(find.byType(Scaffold)).backgroundColor,
      isNull,
    );
    expect(AppTheme.dark.scaffoldBackgroundColor, AppColors.darkBackground);
  });
}
