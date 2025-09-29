/**
 * Türk Lirası formatı için utility fonksiyonları
 * Binlik ayırıcı: nokta (.)
 * Ondalık ayırıcı: virgül (,)
 */

/**
 * Sayıyı Türk Lirası formatında formatlar
 * @param amount - Formatlanacak miktar
 * @param decimals - Ondalık basamak sayısı (varsayılan: 2)
 * @returns Formatlanmış string (örn: "1.234,56")
 */
export const formatTurkishCurrency = (amount: number | string, decimals: number = 2): string => {
  // Sayıya çevir
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  
  // Geçersiz sayı kontrolü
  if (isNaN(numAmount)) {
    return '0,00';
  }
  
  // Ondalık basamak sayısını belirle
  const fixedAmount = numAmount.toFixed(decimals);
  
  // Tam ve ondalık kısımları ayır
  const [integerPart, decimalPart] = fixedAmount.split('.');
  
  // Binlik ayırıcı ekle (nokta ile)
  const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  
  // Ondalık kısım varsa virgül ile birleştir
  if (decimalPart && decimals > 0) {
    return `${formattedInteger},${decimalPart}`;
  }
  
  return formattedInteger;
};

/**
 * Türk Lirası sembolü ile birlikte formatlar
 * @param amount - Formatlanacak miktar
 * @param decimals - Ondalık basamak sayısı (varsayılan: 2)
 * @returns Formatlanmış string (örn: "₺1.234,56")
 */
export const formatTurkishLira = (amount: number | string, decimals: number = 2): string => {
  return `₺${formatTurkishCurrency(amount, decimals)}`;
};

/**
 * Formatlanmış Türk Lirası stringini sayıya çevirir
 * @param formattedAmount - Formatlanmış string (örn: "₺1.234,56" veya "1.234,56")
 * @returns Sayı değeri
 */
export const parseTurkishCurrency = (formattedAmount: string): number => {
  // ₺ sembolünü kaldır
  let cleanAmount = formattedAmount.replace('₺', '');
  
  // Binlik ayırıcıları (nokta) kaldır
  cleanAmount = cleanAmount.replace(/\./g, '');
  
  // Ondalık ayırıcıyı (virgül) noktaya çevir
  cleanAmount = cleanAmount.replace(',', '.');
  
  return parseFloat(cleanAmount) || 0;
};