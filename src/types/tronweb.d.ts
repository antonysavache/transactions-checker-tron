declare module 'tronweb' {
  interface TronWebOptions {
    fullHost?: string;
    fullNode?: string;
    solidityNode?: string;
    eventServer?: string;
    privateKey?: string;
  }

  interface TronAddressUtils {
    fromHex(hexAddress: string): string;
    toHex(base58Address: string): string;
    fromPrivateKey(privateKey: string): string;
    isAddress(address: string): boolean;
  }

  class TronWeb {
    constructor(options: TronWebOptions);
    
    address: TronAddressUtils;
    
    trx: {
      getAccount(address: string): Promise<any>;
      getBalance(address: string): Promise<number>;
      getTransaction(txID: string): Promise<any>;
      getTransactionInfo(txID: string): Promise<any>;
    };
    
    transactionBuilder: {
      sendTrx(to: string, amount: number, from: string): Promise<any>;
    };
    
    contract(): any;
    
    static isAddress(address: string): boolean;
    static address: TronAddressUtils;
  }

  export default TronWeb;
}