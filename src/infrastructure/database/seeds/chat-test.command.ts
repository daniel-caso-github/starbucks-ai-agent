import { Command, CommandRunner } from 'nest-commander';
import { Inject, Logger } from '@nestjs/common';
import * as readline from 'readline';
import { ProcessMessageUseCase } from '@application/use-cases';
import { ProcessMessageOutputDto } from '@application/dtos';

/**
 * Interactive chat command for testing the barista AI end-to-end.
 *
 * This command allows you to have a real conversation with the AI barista
 * including actual order creation, modification, and confirmation.
 * All actions are persisted to MongoDB.
 *
 * Usage: pnpm run chat
 */
@Command({
  name: 'chat',
  description: 'Start an interactive chat with the Starbucks barista AI',
})
export class ChatTestCommand extends CommandRunner {
  private readonly logger = new Logger(ChatTestCommand.name);
  private conversationId: string | undefined;
  private lastResponse: ProcessMessageOutputDto | null = null;

  constructor(
    @Inject('ProcessMessageUseCase')
    private readonly processMessage: ProcessMessageUseCase,
  ) {
    super();
  }

  async run(): Promise<void> {
    console.log('\n☕ ¡Bienvenido al Chat del Barista AI de Starbucks!');
    console.log('═'.repeat(55));
    console.log('Esta es una prueba completa con gestión real de órdenes.');
    console.log('Las órdenes se guardan en MongoDB.');
    console.log('');
    console.log('Comandos:');
    console.log('  "salir" o "exit"  - Terminar la conversación');
    console.log('  "limpiar"         - Iniciar nueva conversación');
    console.log('  "orden"           - Mostrar detalles de la orden actual');
    console.log('  "debug"           - Mostrar información de depuración');
    console.log('═'.repeat(55));
    console.log('');

    // Send initial greeting
    await this.sendMessage('Hola!');

    // Start interactive loop - wrap in a Promise to keep the app context alive
    await new Promise<void>((resolve) => {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      const prompt = (): void => {
        rl.question('\n👤 You: ', (input) => {
          const trimmedInput = input.trim();

          if (!trimmedInput) {
            prompt();
            return;
          }

          // Handle special commands
          const command = trimmedInput.toLowerCase();

          if (command === 'exit' || command === 'quit' || command === 'salir') {
            console.log('\n☕ ¡Gracias por visitar Starbucks! ¡Que tengas un excelente día!\n');
            rl.close();
            resolve();
            return;
          }

          if (command === 'clear' || command === 'limpiar') {
            this.conversationId = undefined;
            this.lastResponse = null;
            console.log('\n🔄 Conversación limpiada. ¡Empezando de nuevo!\n');
            void this.sendMessage('Hola!').then(() => prompt());
            return;
          }

          if (command === 'order' || command === 'orden') {
            this.showCurrentOrder();
            prompt();
            return;
          }

          if (command === 'debug') {
            this.showDebugInfo();
            prompt();
            return;
          }

          // Process regular message
          void this.sendMessage(trimmedInput).then(() => prompt());
        });
      };

      prompt();
    });
  }

  /**
   * Send a message through the full ProcessMessageUseCase pipeline.
   */
  private async sendMessage(userMessage: string): Promise<void> {
    try {
      this.logger.debug(
        `Sending message: "${userMessage}" with conversationId: ${this.conversationId ?? 'none'}`,
      );

      const result = await this.processMessage.execute({
        message: userMessage,
        conversationId: this.conversationId,
      });

      this.logger.debug(`Result isLeft: ${String(result.isLeft())}`);

      if (result.isLeft()) {
        console.error('\n❌ Error:', result.value.message);
        return;
      }

      const response = result.value;
      this.lastResponse = response;

      // Store conversation ID for continuity
      if (!this.conversationId) {
        this.conversationId = response.conversationId;
        console.log(`   [Nueva conversación: ${this.conversationId.substring(0, 8)}...]`);
      }

      // Display the barista's response
      console.log(`\n🧑‍🍳 Barista: ${response.response}`);

      // Show intent if not greeting/unknown
      if (response.intent !== 'greeting' && response.intent !== 'unknown') {
        console.log(`   [Intención: ${response.intent}]`);
      }

      // Show current order status if there is one
      if (response.currentOrder) {
        const order = response.currentOrder;
        console.log(
          `   [Orden: ${order.itemCount} item(s) - ${order.totalPrice} - Estado: ${order.status}]`,
        );
      }

      // Show suggested actions
      if (response.suggestedReplies && response.suggestedReplies.length > 0) {
        console.log(`   [Sugerencias: ${response.suggestedReplies.slice(0, 3).join(' | ')}]`);
      }
    } catch (error) {
      console.error('\n❌ Error:', error instanceof Error ? error.message : 'Error desconocido');
      this.logger.error('Error en chat:', error);
    }
  }

  /**
   * Display current order details.
   */
  private showCurrentOrder(): void {
    console.log('\n📋 Orden Actual:');
    console.log('─'.repeat(40));

    if (!this.lastResponse?.currentOrder) {
      console.log('No hay orden activa.');
      console.log('─'.repeat(40));
      return;
    }

    const order = this.lastResponse.currentOrder;
    console.log(`ID de Orden: ${order.orderId.substring(0, 8)}...`);
    console.log(`Estado: ${order.status}`);
    console.log(`Items (${order.itemCount}):`);

    order.items.forEach((item) => {
      const size = item.size ? ` (${item.size})` : '';
      const customizations = this.formatCustomizations(item.customizations);
      const customStr = customizations ? ` - ${customizations}` : '';
      console.log(
        `  ${item.index}. ${item.quantity}x ${item.drinkName}${size} - ${item.price}${customStr}`,
      );
    });

    console.log(`\nTotal: ${order.totalPrice}`);
    console.log(`Se puede confirmar: ${order.canConfirm ? 'Sí' : 'No'}`);
    console.log('─'.repeat(40));
  }

  /**
   * Format customizations for display.
   */
  private formatCustomizations(customizations: Record<string, string | undefined>): string {
    const parts: string[] = [];

    if (customizations.milk) parts.push(`leche ${customizations.milk}`);
    if (customizations.syrup) parts.push(`jarabe ${customizations.syrup}`);
    if (customizations.sweetener) parts.push(customizations.sweetener);
    if (customizations.topping) parts.push(customizations.topping);

    return parts.join(', ');
  }

  /**
   * Display debug information.
   */
  private showDebugInfo(): void {
    console.log('\n🔍 Información de Depuración:');
    console.log('─'.repeat(40));
    console.log(`ID de Conversación: ${this.conversationId || 'Ninguno'}`);
    console.log(`Última Intención: ${this.lastResponse?.intent || 'Ninguna'}`);
    console.log(`Tiene Orden: ${this.lastResponse?.currentOrder ? 'Sí' : 'No'}`);

    if (this.lastResponse?.currentOrder) {
      console.log(`Estado de Orden: ${this.lastResponse.currentOrder.status}`);
      console.log(`Items en Orden: ${this.lastResponse.currentOrder.itemCount}`);
    }

    console.log('─'.repeat(40));
  }
}
