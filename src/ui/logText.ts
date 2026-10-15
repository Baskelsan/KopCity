import type { BuildingType, DistrictId, LogEntry } from '../core/state';
import { format, texts } from './i18n';

/** Texte d'une entrée du journal (la clé et les paramètres viennent du cœur). */
export function describeLog(entry: LogEntry): string {
  const params = entry.params ?? {};
  switch (entry.key) {
    case 'constructionDelivered':
      return format(texts.log.constructionDelivered, {
        building: texts.buildings[params.type as BuildingType | 'stadium'] ?? '',
        level: params.level ?? 1,
      });
    case 'districtUnlocked':
      return format(texts.log.districtUnlocked, {
        district: texts.city.districts[params.district as DistrictId] ?? '',
      });
    default:
      return entry.key;
  }
}
