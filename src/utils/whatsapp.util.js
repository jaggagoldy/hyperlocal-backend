import chalk from 'chalk';

/**
 * Simulates sending a WhatsApp message by outputting a beautiful terminal log.
 * In production, this would trigger a Twilio/WhatsApp Business API network request.
 * 
 * @param {string} phoneNumber - The recipient's phone number
 * @param {string} message - The message body
 */
export const sendWhatsAppNotification = async (phoneNumber, message) => {
  // Simulate network latency (200-500ms)
  await new Promise((resolve) => setTimeout(resolve, Math.floor(Math.random() * 300) + 200));

  console.log('\n' + chalk.bold.green('📱 WhatsApp Service — Message Dispatched'));
  console.log(chalk.zinc ? chalk.zinc('─'.repeat(55)) : '─'.repeat(55));
  console.log(`${chalk.bold('To:')}      ${chalk.cyan(phoneNumber || 'N/A')}`);
  console.log(`${chalk.bold('Status:')}  ${chalk.green('SUCCESS (Simulated)')}`);
  console.log(`${chalk.bold('Payload:')}`);
  console.log(chalk.italic.yellow(`"${message}"`));
  console.log((chalk.zinc ? chalk.zinc('─'.repeat(55)) : '─'.repeat(55)) + '\n');

  return { success: true, simulated: true };
};
