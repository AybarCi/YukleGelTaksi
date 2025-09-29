/**
 * Türk Lirası para birimi formatı için utility fonksiyonları
 * Binlik ayırıcı: nokta (.)
 * Ondalık ayırıcı: virgül (,)
 */

/**
 * Sayıyı Türk Lirası formatına çevirir (binlik ayırıcı nokta, ondalık ayırıcı virgül)
 * @param amount - Formatlanacak miktar
 * @param decimals - Ondalık basamak sayısı (varsayılan: 2)
 * @returns Formatlanmış string (örn: "1.234,56")
 */
export function formatTurkishCurrency(amount: number, decimals: number = 2): string {
  if (typeof amount !== 'number' || isNaN(amount)) {
    return '0,00';
  }

  // Sayıyı belirtilen ondalık basamağa yuvarla
  const roundedAmount = Number(amount.toFixed(decimals));
  
  // Sayıyı string'e çevir ve ondalık kısmı ayır
  const parts = roundedAmount.toString().split('.');
  const integerPart = parts[0];
  const decimalPart = parts[1] || '';
  
  // Binlik ayırıcıları ekle (nokta)
  const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  
  // Ondalık kısmı istenen uzunlukta yap
  const paddedDecimal = decimalPart.padEnd(decimals, '0').substring(0, decimals);
  
  // Sonucu birleştir (virgül ile)
  return decimals > 0 ? `${formattedInteger},${paddedDecimal}` : formattedInteger;
}

/**
 * Türk Lirası sembolü ile birlikte formatlar
 * @param amount - Formatlanacak miktar
 * @param decimals - Ondalık basamak sayısı (varsayılan: 2)
 * @returns Formatlanmış string (örn: "₺1.234,56")
 */
export function formatTurkishLira(amount: number, decimals: number = 2): string {
  return `₺${formatTurkishCurrency(amount, decimals)}`;
}

/**
 * Formatlanmış Türk Lirası string'ini sayıya çevirir
 * @param formattedAmount - Formatlanmış string (örn: "₺1.234,56" veya "1.234,56")
 * @returns Sayı değeri
 */
export function parseTurkishCurrency(formattedAmount: string): number {
  if (typeof formattedAmount !== 'string') {
    return 0;
  }
  
  // ₺ sembolünü kaldır
  let cleanAmount = formattedAmount.replace('₺', '');
  
  // Binlik ayırıcıları kaldır (nokta)
  cleanAmount = cleanAmount.replace(/\./g, '');
  
  // Ondalık ayırıcıyı nokta ile değiştir (virgül -> nokta)
  cleanAmount = cleanAmount.replace(',', '.');
  
  const result = parseFloat(cleanAmount);
  return isNaN(result) ? 0 : result;
}