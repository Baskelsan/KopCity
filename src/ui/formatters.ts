import { format, texts } from './i18n';

const euros = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const integers = new Intl.NumberFormat('fr-FR');
const decimals = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });

export const formatEuros = (value: number) => euros.format(value);
export const formatInteger = (value: number) => integers.format(value);
export const formatStars = (stars: number) => format(texts.squad.stars, { stars: decimals.format(stars) });
