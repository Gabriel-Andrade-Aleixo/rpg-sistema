import '../models/character.dart';

class CatalogItem {
  const CatalogItem({
    required this.id,
    required this.name,
    required this.type,
    required this.description,
    this.weight = 0,
    this.bonus = '',
    this.notes = '',
    this.equipment = false,
  });

  final String id;
  final String name;
  final String type;
  final String description;
  final double weight;
  final String bonus;
  final String notes;
  final bool equipment;

  InventoryItem toInventoryItem(String id) => InventoryItem(
    id: id,
    name: name,
    type: type,
    description: description,
    weight: weight,
    quantity: 1,
    bonus: bonus,
    notes: notes,
  );
}

// O documento nao define uma tabela numerica de equipamentos. Este catalogo
// registra apenas itens explicitamente citados, mantendo bonus/peso em aberto.
const itemCatalog = <CatalogItem>[
  CatalogItem(
    id: 'mana_potion',
    name: 'Pocao de mana',
    type: 'Consumivel',
    description:
        'Recupera mana. A quantidade recuperada deve ser definida pelo mestre.',
    notes: 'Citada como uma das formas de recuperar Mana.',
  ),
  CatalogItem(
    id: 'spell_scroll',
    name: 'Pergaminho de feitico',
    type: 'Feitico',
    description: 'Armazena um feitico comum, espiritual ou divino.',
    notes: 'Normalmente uso unico, exceto feiticos divinos conforme pacto.',
  ),
  CatalogItem(
    id: 'spell_stone',
    name: 'Pedra de feitico',
    type: 'Feitico',
    description:
        'Recipiente usado para armazenar magia ativada instantaneamente.',
  ),
  CatalogItem(
    id: 'spell_rune',
    name: 'Runa de feitico',
    type: 'Feitico',
    description: 'Runa preparada para armazenar e liberar um efeito magico.',
  ),
  CatalogItem(
    id: 'grimoire',
    name: 'Grimorio',
    type: 'Ferramenta magica',
    description:
        'Permite ao Mago escrever magias dominadas e usar reacoes magicas.',
    equipment: true,
  ),
  CatalogItem(
    id: 'command_instrument',
    name: 'Instrumento de Comando',
    type: 'Arma especial',
    description:
        'Instrumento magico usado pelo Maestro Tatico para impor ritmo ao combate.',
    equipment: true,
  ),
  CatalogItem(
    id: 'sacred_scripture',
    name: 'Escrituras sagradas',
    type: 'Artefato divino',
    description: 'Artefato divino possivel para Clerigos.',
    equipment: true,
  ),
  CatalogItem(
    id: 'blessed_symbol',
    name: 'Simbolo abencoado',
    type: 'Artefato divino',
    description: 'Simbolo santo vinculado a uma divindade.',
    equipment: true,
  ),
  CatalogItem(
    id: 'holy_instrument',
    name: 'Instrumento santo',
    type: 'Artefato divino',
    description: 'Instrumento sagrado utilizado para canalizar poder divino.',
    equipment: true,
  ),
  CatalogItem(
    id: 'sacred_sword',
    name: 'Espada sagrada',
    type: 'Artefato divino',
    description: 'Artefato divino possivel para Paladinos.',
    equipment: true,
  ),
  CatalogItem(
    id: 'consecrated_armor',
    name: 'Armadura consagrada',
    type: 'Artefato divino',
    description: 'Armadura vinculada ao Deus seguido pelo Paladino.',
    equipment: true,
  ),
  CatalogItem(
    id: 'blessed_shield',
    name: 'Escudo abencoado',
    type: 'Artefato divino',
    description: 'Escudo sagrado usado como artefato divino.',
    equipment: true,
  ),
  CatalogItem(
    id: 'war_relic',
    name: 'Reliquia de guerra',
    type: 'Artefato divino',
    description: 'Reliquia divina voltada a combate e punicao sagrada.',
    equipment: true,
  ),
  CatalogItem(
    id: 'original_artifact',
    name: 'Artefato Original',
    type: 'Artefato divino',
    description: 'Artefato divino mais poderoso ligado a uma entidade.',
    equipment: true,
  ),
  CatalogItem(
    id: 'demon_slaying_relic',
    name: 'Reliquia anti-demonio',
    type: 'Reliquia unica',
    description:
        'Unica reliquia capaz de matar permanentemente um demonio sem rolagens.',
    notes: 'Item unico de mundo. Nao deve ser entregue sem decisao do mestre.',
    equipment: true,
  ),
  CatalogItem(
    id: 'simple_trap_materials',
    name: 'Materiais de armadilha simples',
    type: 'Material',
    description: 'Materiais narrativos para armadilhas simples do Ranger.',
  ),
];
