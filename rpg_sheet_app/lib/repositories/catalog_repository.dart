import '../models/catalog_models.dart';
import '../services/backend_api_service.dart';

class CatalogRepository {
  CatalogRepository(this._backend);

  final BackendApiService _backend;
  OfficialCatalog? _cache;

  OfficialCatalog? get cached => _cache;

  Future<OfficialCatalog> load({bool refresh = false}) async {
    if (!refresh && _cache != null) return _cache!;
    if (!_backend.isConfigured) {
      throw StateError(
        'Configure BACKEND_URL para carregar o catálogo oficial.',
      );
    }
    final catalog = await _backend.loadCatalog(refresh: refresh);
    _cache = catalog;
    return catalog;
  }

  Future<CatalogEntry> createItem(Map<String, dynamic> item) async {
    if (!_backend.isConfigured) {
      throw StateError('Configure BACKEND_URL para criar itens no catálogo.');
    }
    final created = await _backend.createCatalogItem(item);
    _cache = null;
    return created;
  }

  Future<CatalogEntry> saveEntry(
    String kind,
    Map<String, dynamic> entry, {
    String? id,
  }) async {
    if (!_backend.isConfigured) {
      throw StateError('Configure BACKEND_URL para gerenciar o catálogo.');
    }
    final saved = id == null || id.isEmpty
        ? kind == 'spell'
              ? await _backend.createCatalogSpell(entry)
              : await _backend.createCatalogItem(entry)
        : await _backend.updateCatalogEntry(kind, id, entry);
    _cache = null;
    return saved;
  }

  Future<void> deleteEntry(String kind, String id) async {
    if (!_backend.isConfigured) {
      throw StateError('Configure BACKEND_URL para gerenciar o catálogo.');
    }
    await _backend.deleteCatalogEntry(kind, id);
    _cache = null;
  }
}
