export interface CompleteTransaction {
    data: string;
    walletSender: string;
    walletReceiver: string;
    hash: string;
    amount: number;
    currency: string;
}