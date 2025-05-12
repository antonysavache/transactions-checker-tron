import { NestFactory } from '@nestjs/core';
import { MonitorModule } from '@core/monitor.module';
import { EthereumBlockchainDataProvider } from '@core/providers/ethereum/ethereum-blockchain-data.provider';

async function bootstrap() {
  // Создаем приложение NestJS
  const app = await NestFactory.create(MonitorModule);

  // Получаем Ethereum провайдер
  const ethereumProvider = app.get(EthereumBlockchainDataProvider);
  
  // Хеш транзакции, о которой мы хотим получить информацию
  const txHash = process.argv[2] || '0x341128935aba327c209ac22ee1a7db1769286ee038ad0f08e2632ecb55ddd21b';
  
  console.log(`Fetching information about transaction: ${txHash}`);
  
  // Получаем информацию о транзакции
  try {
    const txInfo = await ethereumProvider.getFullTransactionInfo(txHash).toPromise();
    console.log('Transaction details:');
    console.log(JSON.stringify(txInfo, null, 2));
  } catch (error) {
    console.error('Error fetching transaction information:', error);
  }
  
  // Закрываем приложение
  await app.close();
}

bootstrap().catch(error => console.error('Error in bootstrap:', error));
