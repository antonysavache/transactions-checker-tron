import { Injectable, Inject, OnModuleInit } from '@nestjs/common';
import { IProcessedTransaction, ISourceData } from './types';
import { Monitor } from './types/monitor.interface';
import { transactionStorage } from './storage/file-storage';
import { GoogleSheetsService } from './services/google-sheets-service/google-sheets-service';
import { LogMonitorStart, LogMonitorExecution, LogError } from './decorators/logging.decorators';

/**
 * Конфигурация для монитора транзакций
 */
export interface IMonitorConfig {
  intervalHours?: number;
  wallets?: string[];
}

@Injectable()
export class TransactionMonitor implements Monitor, OnModuleInit {
  /**
   * Интервал опроса в часах
   */
  public intervalHours: number;
  
  /**
   * Функция мониторинга, которая выполняет фетчинг данных 
   * и возвращает список транзакций
   */
  public monitorFn: (inputData: ISourceData) => Promise<IProcessedTransaction[]>;
  
  /**
   * Список отслеживаемых кошельков
   */
  public wallets: string[];
  
  /**
   * Тип сети (ETH, TRON, MOCK)
   */
  public network: string;
  
  /**
   * Идентификатор таймера интервала для возможности остановки
   */
  private intervalId: NodeJS.Timeout | null = null;

  constructor(
    @Inject('GoogleSheetsService') private readonly googleSheetsService: GoogleSheetsService,
    config: IMonitorConfig,
    monitorFn: (inputData: ISourceData) => Promise<IProcessedTransaction[]>,
    network: string
  ) {
    this.intervalHours = config.intervalHours || 1;
    this.monitorFn = monitorFn;
    this.wallets = config.wallets || [];
    this.network = network;
  }

  /**
   * Автоматически запускаем мониторинг при инициализации модуля
   */
  async onModuleInit() {
    // Запускаем мониторинг при инициализации модуля
    await this.start();
  }

  /**
   * Запускает мониторинг транзакций
   */
  @LogMonitorStart()
  public async start(): Promise<void> {
    // Запускаем первичный мониторинг
    await this.runMonitor();
    
    // Настраиваем периодический запуск с указанным интервалом
    const intervalMs = this.intervalHours * 60 * 60 * 1000;
    this.intervalId = setInterval(() => this.runMonitor(), intervalMs);
  }

  /**
   * Останавливает мониторинг
   */
  public async stop(): Promise<void> {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * Выполняет один цикл мониторинга
   */
  @LogMonitorExecution()
  private async runMonitor(): Promise<void> {
    // Получение кошельков из Google Sheets, если это возможно
    let walletsToMonitor = [...this.wallets]; // Копируем основной массив кошельков
    
    try {
      // Получаем кошельки из Google Sheets по названию сети
      const sheetsWallets = await this.fetchWalletsFromSheets();
      if (sheetsWallets.length > 0) {
        walletsToMonitor = sheetsWallets;
      }
    } catch (error) {
      // Ошибка логируется в декораторе LogError на fetchWalletsFromSheets
      // Продолжаем с имеющимися кошельками
    }
    
    // Запускаем функцию мониторинга для сети
    const transactions = await this.monitorFn({
      wallets: walletsToMonitor,
      timeIntervalHours: this.intervalHours,
      network: this.network as any
    });
    
    // Сохраняем транзакции
    await this.saveTransactions(transactions);
  }

  /**
   * Получает кошельки из Google Sheets
   */
  @LogError('Error fetching wallets from Google Sheets: %s, falling back to configured wallets')
  private async fetchWalletsFromSheets(): Promise<string[]> {
    return await this.googleSheetsService.getWallets(this.network as any);
  }

  /**
   * Сохраняет транзакции
   */
  @LogError('Error saving %s transactions to Google Sheets: %s')
  private async saveTransactions(transactions: IProcessedTransaction[]): Promise<void> {
    // Сохраняем информацию о транзакциях
    await transactionStorage.saveTransactions(transactions);
    
    // Сохраняем транзакции в Google Sheets
    if (transactions.length > 0) {
      await this.googleSheetsService.saveTransactions(transactions, this.network);
    }
  }
}