import 'package:flutter/material.dart';

abstract final class AppColors {
  static const darkBackground = Color(0xFF0A0910);
  static const darkSidebar = Color(0xFF141320);
  static const darkSurface = Color(0xFF211F35);
  static const darkSurfaceAlt = Color(0xFF292640);
  static const darkSurfaceRaised = Color(0xFF3D3960);
  static const darkInk = Color(0xFFF0EFF6);
  static const darkMuted = Color(0xFFC2BEDA);
  static const darkLine = Color(0xFF524B81);

  static const lightBackground = Color(0xFFF0EFF6);
  static const lightSidebar = Color(0xFFE0DFEC);
  static const lightSurface = Color(0xFFFAF9FC);
  static const lightSurfaceAlt = Color(0xFFEDECF4);
  static const lightSurfaceRaised = Color(0xFFC2BFD9);
  static const lightInk = Color(0xFF151221);
  static const lightMuted = Color(0xFF3F3663);
  static const lightLine = Color(0xFFC2BFD9);

  static const red = Color(0xFF655CA3);
  static const lightRed = Color(0xFF514983);
  static const gold = Color(0xFFA7B57D);
  static const lightGold = Color(0xFF74824A);
  static const green = Color(0xFF7CB68C);
  static const lightGreen = Color(0xFF498359);
  static const danger = Color(0xFFDE6760);
  static const warning = Color(0xFFE1AA5C);
}

abstract final class AppTheme {
  static ThemeData get dark => _build(Brightness.dark);
  static ThemeData get light => _build(Brightness.light);

  static ThemeData _build(Brightness brightness) {
    final isDark = brightness == Brightness.dark;
    final background = isDark
        ? AppColors.darkBackground
        : AppColors.lightBackground;
    final surface = isDark ? AppColors.darkSurface : AppColors.lightSurface;
    final surfaceAlt = isDark
        ? AppColors.darkSurfaceAlt
        : AppColors.lightSurfaceAlt;
    final surfaceRaised = isDark
        ? AppColors.darkSurfaceRaised
        : AppColors.lightSurfaceRaised;
    final ink = isDark ? AppColors.darkInk : AppColors.lightInk;
    final muted = isDark ? AppColors.darkMuted : AppColors.lightMuted;
    final line = isDark ? AppColors.darkLine : AppColors.lightLine;
    final accent = isDark ? AppColors.red : AppColors.lightRed;
    final gold = isDark ? AppColors.gold : AppColors.lightGold;
    final green = isDark ? AppColors.green : AppColors.lightGreen;

    final scheme = ColorScheme(
      brightness: brightness,
      primary: accent,
      onPrimary: Colors.white,
      primaryContainer: surfaceRaised,
      onPrimaryContainer: ink,
      secondary: gold,
      onSecondary: isDark ? AppColors.darkBackground : Colors.white,
      secondaryContainer: surfaceRaised,
      onSecondaryContainer: ink,
      tertiary: green,
      onTertiary: Colors.white,
      tertiaryContainer: surfaceAlt,
      onTertiaryContainer: ink,
      error: isDark ? AppColors.danger : const Color(0xFFA93129),
      onError: Colors.white,
      errorContainer: surfaceAlt,
      onErrorContainer: ink,
      surface: surface,
      onSurface: ink,
      onSurfaceVariant: muted,
      outline: line,
      outlineVariant: line,
      shadow: Colors.black,
      scrim: Colors.black,
      inverseSurface: ink,
      onInverseSurface: background,
      inversePrimary: accent,
      surfaceTint: Colors.transparent,
    );

    final base = ThemeData(
      useMaterial3: true,
      brightness: brightness,
      colorScheme: scheme,
      scaffoldBackgroundColor: background,
      canvasColor: surface,
      dividerColor: line,
      splashFactory: InkSparkle.splashFactory,
    );

    final textTheme = base.textTheme.copyWith(
      headlineSmall: base.textTheme.headlineSmall?.copyWith(
        fontWeight: FontWeight.w800,
        letterSpacing: 0,
      ),
      titleLarge: base.textTheme.titleLarge?.copyWith(
        fontWeight: FontWeight.w800,
        letterSpacing: 0,
      ),
      titleMedium: base.textTheme.titleMedium?.copyWith(
        fontWeight: FontWeight.w700,
        letterSpacing: 0,
      ),
      labelLarge: base.textTheme.labelLarge?.copyWith(
        fontWeight: FontWeight.w700,
        letterSpacing: 0,
      ),
      bodyMedium: base.textTheme.bodyMedium?.copyWith(letterSpacing: 0),
      bodySmall: base.textTheme.bodySmall?.copyWith(
        color: muted,
        letterSpacing: 0,
      ),
    );

    final roundedRectangle = RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(8),
    );
    final borderedRectangle = RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(8),
      side: BorderSide(color: line),
    );

    return base.copyWith(
      textTheme: textTheme,
      appBarTheme: AppBarTheme(
        centerTitle: false,
        elevation: 0,
        scrolledUnderElevation: 0,
        backgroundColor: background,
        foregroundColor: ink,
        surfaceTintColor: Colors.transparent,
        titleTextStyle: textTheme.titleLarge?.copyWith(color: ink),
      ),
      cardTheme: CardThemeData(
        elevation: 0,
        color: surface,
        surfaceTintColor: Colors.transparent,
        margin: EdgeInsets.zero,
        shape: borderedRectangle,
      ),
      navigationBarTheme: NavigationBarThemeData(
        height: 68,
        elevation: 0,
        backgroundColor: isDark
            ? AppColors.darkSidebar
            : AppColors.lightSidebar,
        indicatorColor: surfaceRaised,
        labelTextStyle: WidgetStateProperty.resolveWith((states) {
          return textTheme.labelMedium?.copyWith(
            color: states.contains(WidgetState.selected) ? ink : muted,
            fontWeight: states.contains(WidgetState.selected)
                ? FontWeight.w800
                : FontWeight.w600,
          );
        }),
        iconTheme: WidgetStateProperty.resolveWith((states) {
          return IconThemeData(
            color: states.contains(WidgetState.selected) ? gold : muted,
          );
        }),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: surfaceAlt,
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 12,
          vertical: 12,
        ),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: BorderSide(color: line),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: BorderSide(color: line),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: BorderSide(color: gold, width: 1.5),
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          minimumSize: const Size(48, 44),
          shape: roundedRectangle,
          textStyle: textTheme.labelLarge,
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          minimumSize: const Size(48, 44),
          foregroundColor: ink,
          side: BorderSide(color: line),
          shape: roundedRectangle,
          textStyle: textTheme.labelLarge,
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          minimumSize: const Size(40, 40),
          foregroundColor: gold,
          shape: roundedRectangle,
          textStyle: textTheme.labelLarge,
        ),
      ),
      iconButtonTheme: IconButtonThemeData(
        style: IconButton.styleFrom(
          minimumSize: const Size(42, 42),
          foregroundColor: ink,
          shape: roundedRectangle,
        ),
      ),
      floatingActionButtonTheme: FloatingActionButtonThemeData(
        elevation: 4,
        backgroundColor: accent,
        foregroundColor: Colors.white,
        shape: roundedRectangle,
      ),
      dialogTheme: DialogThemeData(
        backgroundColor: surface,
        surfaceTintColor: Colors.transparent,
        shape: borderedRectangle,
      ),
      bottomSheetTheme: BottomSheetThemeData(
        backgroundColor: surface,
        surfaceTintColor: Colors.transparent,
        modalBackgroundColor: surface,
        showDragHandle: true,
        shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(8)),
        ),
      ),
      chipTheme: base.chipTheme.copyWith(
        backgroundColor: surfaceAlt,
        selectedColor: surfaceRaised,
        side: BorderSide(color: line),
        shape: roundedRectangle,
        labelStyle: textTheme.labelMedium,
      ),
      progressIndicatorTheme: ProgressIndicatorThemeData(
        color: green,
        linearTrackColor: surfaceRaised,
      ),
      snackBarTheme: SnackBarThemeData(
        behavior: SnackBarBehavior.floating,
        backgroundColor: surfaceRaised,
        contentTextStyle: textTheme.bodyMedium?.copyWith(color: ink),
        shape: roundedRectangle,
      ),
      popupMenuTheme: PopupMenuThemeData(
        color: surface,
        surfaceTintColor: Colors.transparent,
        shape: borderedRectangle,
      ),
      dividerTheme: DividerThemeData(color: line, space: 1),
    );
  }
}
