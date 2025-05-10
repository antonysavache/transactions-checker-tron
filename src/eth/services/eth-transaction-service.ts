/**
 * Сервис для работы с ETH транзакциями
 */
import { ethers } from 'ethers';
import axios from 'axios';
import { IEthServiceConfig } from '../types';

export class EthTransactionService {
  private provider: ethers.JsonRpcProvider | null = null;
  private etherscanApiKey: string;
  private retryDelay: number;
  private maxRetries: number;

  constructor(config: IEthServiceConfig) {
    this.etherscanApiKey = config.etherscanApiKey || '';
    this.retryDelay = config.requestDelay || 1000;
    this.maxRetries = config.maxRetries || 3;
    
    if (config.providerUrl) {
      this.provider = new ethers.JsonRpcProvider(config.providerUrl);
    }
  }

  /**
   * Получить нормальные ETH транзакции для адреса
   * @param address ETH адрес
   * @param startBlock Начальный блок
   * @param endBlock Конечный блок (0 - последний)
   * @returns Массив транзакций
   */
  public async getNormalTransactions(address: string, startBlock: number = 0, endBlock: number = 99999999): Promise<any[]> {
    try {
      return await this.makeEtherscanRequest('account', 'txlist', {
        address,
        startblock: startBlock,
        endblock: endBlock,
        sort: 'desc'
      });
    } catch (error) {
      console.error(`Error fetching normal transactions for ${address}:`, (error as Error).message);
      return [];
    }
  }

  /**
   * Получить ERC20 токен транзакции для адреса
   * @param address ETH адрес
   * @param startBlock Начальный блок
   * @param endBlock Конечный блок (0 - последний)
   * @param contractAddress Адрес контракта токена (опционально)
   * @returns Массив ERC20 транзакций
   */
  public async getERC20Transactions(address: string, startBlock: number = 0, endBlock: number = 99999999, contractAddress?: string): Promise<any[]> {
    try {
      let params: any = {
        address,
        startblock: startBlock,
        endblock: endBlock,
        sort: 'desc'
      };
      
      // Если указан адрес контракта, добавляем его
      if (contractAddress) {
        params.contractaddress = contractAddress;
      }
      
      return await this.makeEtherscanRequest('account', 'tokentx', params);
    } catch (error) {
      console.error(`Error fetching ERC20 transactions for ${address}:`, (error as Error).message);
      return [];
    }
  }

  /**
   * Получить все транзакции для кошелька (ETH + USDT + USDC)
   * @param walletAddress ETH адрес кошелька
   * @param startBlock Начальный блок
   * @param endBlock Конечный блок (последний по умолчанию)
   * @returns Объединенный массив транзакций
   */
  public async getAllTransactions(walletAddress: string, startBlock?: number, endBlock?: number): Promise<any[]> {
    try {
      const normalTxs = await this.getNormalTransactions(walletAddress, startBlock, endBlock);
      const erc20Txs = await this.getERC20Transactions(walletAddress, startBlock, endBlock);
      
      // Фильтруем только нужные ETH транзакции (исключаем контрактные вызовы с нулевой суммой)
      const filteredNormalTxs: any[] = [];
      normalTxs.forEach((tx: any) => {
        // Добавляем только транзакции с ненулевой суммой ETH
        if (tx.value && tx.value !== '0') {
          filteredNormalTxs.push(tx);
        }
      });
      
      // Фильтруем только USDT и USDC транзакции
      const filteredErc20Txs = erc20Txs.filter((tx: any) => {
        const symbol = tx.tokenSymbol?.toUpperCase();
        return symbol === 'USDT' || symbol === 'USDC';
      });
      
      // Дополнительно обрабатываем ERC20 транзакции для удобства
      const enhancedErc20Txs = filteredErc20Txs.map((tx: any) => {
        // Добавляем информацию о сети для удобства
        return {
          ...tx,
          network: 'ETH'
        };
      });
      
      // Объединяем нормальные и ERC20 транзакции
      return [...filteredNormalTxs, ...enhancedErc20Txs];
    } catch (error) {
      console.error(`Error fetching all transactions for ${walletAddress}:`, (error as Error).message);
      return [];
    }
  }

  /**
   * Получить текущий номер блока
   * @returns Текущий номер блока или null при ошибке
   */
  public async getCurrentBlockNumber(): Promise<number | null> {
    if (!this.provider) {
      return null;
    }
    
    try {
      return await this.provider.getBlockNumber();
    } catch (error) {
      console.error('Error getting current block number:', (error as Error).message);
      return null;
    }
  }

  /**
   * Получить номер блока для указанного timestamp
   * @param timestamp Timestamp в миллисекундах
   * @returns Номер блока или null при ошибке
   */
  public async getBlockNumberAtTime(timestamp: number): Promise<number | null> {
    if (!this.provider) {
      return null;
    }
    
    // Etherscan API для получения номера блока по временной метке
    // timestamp нужно передавать в секундах
    const unixTimestamp = Math.floor(timestamp / 1000);
    
    try {
      const response = await this.makeEtherscanRequest('block', 'getblocknobytime', {
        timestamp: unixTimestamp,
        closest: 'before' // Получаем ближайший блок до указанного timestamp
      });
      
      if (response && response.blockNumber) {
        return parseInt(response.blockNumber);
      }
      
      return null;
    } catch (error) {
      console.error(`Error getting block number for timestamp ${timestamp}:`, (error as Error).message);
      return null;
    }
  }

  /**
   * Выполнить запрос к Etherscan API с повторными попытками
   * @param module Модуль API
   * @param action Действие API
   * @param params Дополнительные параметры
   * @returns Результат запроса
   */
  private async makeEtherscanRequest(module: string, action: string, params: any, retry: number = 0): Promise<any> {
    try {
      // Базовый URL Etherscan API
      const baseUrl = 'https://api.etherscan.io/api';
      
      // Объединяем все параметры
      const queryParams = new URLSearchParams({
        module,
        action,
        apikey: this.etherscanApiKey,
        ...params
      });
      
      // Делаем запрос к API
      const response = await axios.get(`${baseUrl}?${queryParams.toString()}`);
      
      // Проверяем статус ответа
      if (response.data.status === '1') {
        return response.data.result;
      } else if (response.data.message === 'NOTOK' && response.data.result.includes('Rate limit')) {
        // Если превышен лимит запросов, пытаемся повторить
        if (retry < this.maxRetries) {
          console.warn(`Rate limit exceeded, retrying in ${this.retryDelay}ms (${retry + 1}/${this.maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, this.retryDelay));
          return this.makeEtherscanRequest(module, action, params, retry + 1);
        } else {
          throw new Error(`Rate limit exceeded after ${this.maxRetries} retries`);
        }
      } else {
        throw new Error(`API error: ${response.data.message} - ${response.data.result}`);
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response) {
          throw new Error(`HTTP error ${error.response.status}: ${error.response.statusText}`);
        } else if (error.request) {
          // Если сервер не ответил и не превышено максимальное количество попыток
          if (retry < this.maxRetries) {
            console.warn(`Network error, retrying in ${this.retryDelay}ms (${retry + 1}/${this.maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, this.retryDelay));
            return this.makeEtherscanRequest(module, action, params, retry + 1);
          } else {
            throw new Error(`Network error after ${this.maxRetries} retries`);
          }
        }
      }
      throw error;
    }
  }
}
