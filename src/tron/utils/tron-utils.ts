export function isValidTronAddress(address: string): boolean {
  if (!address.startsWith('T') || address.length !== 34) {
    return false;
  }

  const validCharsRegex = /^[a-zA-Z0-9]+$/;
  return validCharsRegex.test(address);
}

export function formatAmount(amount: number, decimals: number = 6): string {
  return amount.toFixed(decimals).replace(/\.?0+$/, '');
}

export function formatTimestamp(timestamp: number, format: string = 'DD.MM.YYYY HH:mm:ss'): string {
  const date = new Date(timestamp);
  
  const tokens: {[key: string]: string} = {
    YYYY: date.getFullYear().toString(),
    MM: (date.getMonth() + 1).toString().padStart(2, '0'),
    DD: date.getDate().toString().padStart(2, '0'),
    HH: date.getHours().toString().padStart(2, '0'),
    mm: date.getMinutes().toString().padStart(2, '0'),
    ss: date.getSeconds().toString().padStart(2, '0')
  };
  
  return format.replace(/YYYY|MM|DD|HH|mm|ss/g, match => tokens[match]);
}

export function shortenAddress(address: string, prefixLength: number = 6, suffixLength: number = 4): string {
  if (!address || address.length <= prefixLength + suffixLength) {
    return address;
  }
  
  return `${address.slice(0, prefixLength)}...${address.slice(-suffixLength)}`;
}

export function simpleHash(input: string): string {
  let hash = 0;
  if (input.length === 0) return hash.toString(16);
  
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  
  return Math.abs(hash).toString(16);
}