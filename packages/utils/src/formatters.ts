export const formatCurrency = (amount: number, currency: string = 'THB', locale: string = 'th-TH'): string => {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency,
  }).format(amount);
};

export const formatNumber = (value: number, locale: string = 'th-TH'): string => {
  return new Intl.NumberFormat(locale).format(value);
};

export const formatDate = (date: Date, locale: string = 'th-TH'): string => {
  return new Intl.DateTimeFormat(locale).format(date);
};

export const formatDateTime = (date: Date, locale: string = 'th-TH'): string => {
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(date);
};

export const formatFileSize = (bytes: number): string => {
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  if (bytes === 0) return '0 Bytes';
  
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
};

export const formatPhoneNumber = (phone: string, countryCode: string = '+66'): string => {
  // Remove all non-digit characters
  const cleaned = phone.replace(/\D/g, '');
  
  // Thai phone number formatting
  if (countryCode === '+66' && cleaned.length === 10) {
    return `${countryCode} ${cleaned.slice(1, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  
  // Default international format
  return `${countryCode} ${cleaned}`;
};

export const formatPercentage = (value: number, decimalPlaces: number = 2): string => {
  return `${value.toFixed(decimalPlaces)}%`;
};

export const truncateText = (text: string, maxLength: number, suffix: string = '...'): string => {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - suffix.length) + suffix;
};

export const capitalizeFirstLetter = (text: string): string => {
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
};

export const formatBusinessName = (name: string): string => {
  return name
    .split(' ')
    .map(word => capitalizeFirstLetter(word))
    .join(' ');
};