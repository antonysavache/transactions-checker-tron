/**
 * Интерфейс для сервисов мониторинга транзакций
 */
import { IProcessedTransaction, ISourceData } from './index';

export interface Monitor {
    /**
     * Запускает мониторинг транзакций
     */
    start(): Promise<void>;
    
    /**
     * Останавливает мониторинг
     */
    stop(): Promise<void>;
    
    /**
     * Интервал опроса в часах
     */
    intervalHours: number;
    
    /**
     * Функция мониторинга, которая выполняет фетчинг данных 
     * и возвращает список транзакций
     */
    monitorFn: (inputData: ISourceData) => Promise<IProcessedTransaction[]>;
    
    /**
     * Список отслеживаемых кошельков
     */
    wallets: string[];
    
    /**
     * Тип сети (ETH, TRON, MOCK)
     */
    network: string;
}