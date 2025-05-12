import { Injectable} from "@nestjs/common";
import { CompleteTransaction} from "@shared/models";
import { Observable, from, merge, of, zip } from "rxjs";
import { catchError, map, reduce } from "rxjs/operators";
import {MockBlockchainDataProvider} from "@core/providers/mock/blockchain-data.provider";
import {TronBlockchainDataProvider} from "@core/providers/tron/tron-blockchain-data.provider";
import {EthereumBlockchainDataProvider} from "@core/providers/ethereum/ethereum-blockchain-data.provider";

export enum BlockchainType {
    MOCK = 'MOCK',
    TRON = 'TRON',
    ETH = 'ETH'
}

@Injectable()
export class BlockchainTransaction {
    private readonly serviceName = 'BlockchainTransaction';

    constructor(
        private mockDataProvider: MockBlockchainDataProvider,
        private tronDataProvider: TronBlockchainDataProvider,
        private ethereumDataProvider: EthereumBlockchainDataProvider
    ) {}

    /**
     * Получает транзакции для заданных кошельков из выбранной блокчейн-сети
     * @param wallets Список кошельков
     * @param intervalHours Интервал времени в часах
     * @param blockchainType Тип блокчейн-сети (MOCK, TRON, ETH) или AUTO для автоопределения
     * @returns Observable с транзакциями
     */
    getTransactions(wallets: string[], intervalHours: number = 24, blockchainType: BlockchainType | string = 'AUTO'): Observable<CompleteTransaction[]> {
        console.log(
            `BlockchainTransaction.getTransactions: Using ${wallets.length} wallets, interval: ${intervalHours} hours (override default: ${process.env.DEFAULT_TIME_INTERVAL || 'not set'}), blockchain: ${blockchainType}`
        );
        
        // Если установлен режим AUTO, анализируем кошельки и разделяем их по типам
        if (blockchainType === 'AUTO' && wallets.length > 0) {
            const ethWallets: string[] = [];
            const tronWallets: string[] = [];
            
            // Разделяем кошельки по форматам адресов
            for (const wallet of wallets) {
                if (wallet.startsWith('0x')) {
                    // Это Ethereum адрес
                    ethWallets.push(wallet);
                } else if (wallet.startsWith('T')) {
                    // Это TRON адрес
                    tronWallets.push(wallet);
                } else {
                    console.warn(`Unknown wallet format: ${wallet}, skipping`);
                }
            }
            
            console.log(`Auto-detected wallet types: ETH: ${ethWallets.length}, TRON: ${tronWallets.length}`);
            
            // Обработка кошельков по типам и объединение результатов
            const observables: Observable<CompleteTransaction[]>[] = [];
            
            if (ethWallets.length > 0) {
                console.log(`Processing ${ethWallets.length} ETH wallets`);
                observables.push(
                    this.ethereumDataProvider.fetch(ethWallets, intervalHours).pipe(
                        catchError(error => {
                            console.error('Error fetching ETH transactions:', error);
                            return of([]);
                        })
                    )
                );
            }
            
            if (tronWallets.length > 0) {
                console.log(`Processing ${tronWallets.length} TRON wallets`);
                observables.push(
                    this.tronDataProvider.fetch(tronWallets, intervalHours).pipe(
                        catchError(error => {
                            console.error('Error fetching TRON transactions:', error);
                            return of([]);
                        })
                    )
                );
            }
            
            // Если нет ни одного распознанного кошелька, возвращаем пустой массив
            if (observables.length === 0) {
                console.warn('No valid wallets detected, returning empty result');
                return of([]);
            }
            
            if (observables.length === 1) {
                // Если у нас только один провайдер, просто возвращаем его результат
                return observables[0];
            }
            
            // Используем zip для объединения всех результатов в один массив
            return zip(...observables).pipe(
                map(transactionArrays => {
                    // Объединяем все массивы транзакций в один
                    const allTransactions = transactionArrays.reduce((acc, curr) => [...acc, ...curr], []);
                    console.log(`Combined ${allTransactions.length} transactions from multiple providers`);
                    return allTransactions;
                }),
                catchError(error => {
                    console.error('Error combining transactions:', error);
                    return of([]);
                })
            );
        }
        
        // Если режим не AUTO, используем указанный тип блокчейна
        switch (blockchainType) {
            case BlockchainType.MOCK:
                console.log('Using mock provider');
                return this.mockDataProvider.fetch(wallets, intervalHours);
            case BlockchainType.TRON:
                console.log('Using TRON provider');
                return this.tronDataProvider.fetch(wallets, intervalHours);
            case BlockchainType.ETH:
                console.log('Using Ethereum provider');
                return this.ethereumDataProvider.fetch(wallets, intervalHours);
            default:
                console.warn(`Unknown blockchain type: ${blockchainType}, using TRON as default`);
                return this.tronDataProvider.fetch(wallets, intervalHours);
        }
    }
}