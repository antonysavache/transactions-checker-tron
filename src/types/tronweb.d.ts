declare module 'tronweb' {
  export default class TronWeb {
    constructor(options: any);
    isAddress(address: string): boolean;
    address: {
      fromHex(hexAddress: string): string;
    };
  }
}